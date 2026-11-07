import { Types } from 'mongoose';
import { Payment, type PaymentStatus } from './payment.model';
import { Order } from '../orders/order.model';
import type { AuthUser } from '../../middleware/auth';
import { assertObjectId, badRequest, conflict, notFound, pagination } from '../../lib/http';
import { loadOrderForUser } from '../orders/order.workflow';
import { audit } from '../audit/audit.service';
import { removeStoredFile, storedFilePath } from '../../lib/uploads';
import { publicUrl } from '../../lib/urls';
import type { CreatePaymentInput } from './payments.validation';

/** Keeps the cached order.amountPaid in sync with the payment ledger. */
export async function recomputePaid(orderId: Types.ObjectId | string) {
  const [row] = await Payment.aggregate<{ total: number }>([
    { $match: { order: new Types.ObjectId(String(orderId)), $or: [{ status: 'verified' }, { status: { $exists: false } }] } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  await Order.updateOne({ _id: orderId }, { $set: { amountPaid: row?.total ?? 0 } });
}

function orderDto(value: any, fallback?: { id: string; orderNo: string }) {
  if (!value) return fallback ?? { id: '', orderNo: '' };
  if (typeof value === 'object') {
    const id = value._id ?? value.id;
    return { id: id ? String(id) : fallback?.id ?? '', orderNo: value.orderNo ?? fallback?.orderNo ?? '' };
  }
  return { id: String(value), orderNo: fallback?.orderNo ?? '' };
}

const toDto = (p: Record<string, any>, fallbackOrder?: { id: string; orderNo: string }) => ({
  id: String(p._id),
  amount: p.amount,
  method: p.method,
  reference: p.reference,
  note: p.note,
  status: (p.status ?? 'verified') as PaymentStatus,
  verifiedBy: p.verifiedBy && typeof p.verifiedBy === 'object' && 'name' in p.verifiedBy ? p.verifiedBy.name : null,
  verifiedAt: p.verifiedAt,
  rejectionReason: p.rejectionReason ?? '',
  reversalReason: p.reversalReason ?? '',
  reversedBy: p.reversedBy && typeof p.reversedBy === 'object' && 'name' in p.reversedBy ? p.reversedBy.name : null,
  reversedAt: p.reversedAt,
  proof: p.proof?.storedName ? { originalName: p.proof.originalName, size: p.proof.size, url: publicUrl(`/api/payments/${String(p._id)}/proof`) } : null,
  receivedAt: p.receivedAt,
  order: orderDto(p.order, fallbackOrder),
  customer: p.customer && typeof p.customer === 'object' && 'name' in p.customer ? { id: String(p.customer._id), name: p.customer.name } : { id: String(p.customer), name: '' },
  recordedBy: p.recordedBy && typeof p.recordedBy === 'object' && 'name' in p.recordedBy ? p.recordedBy.name : '',
});

export async function listPayments(user: AuthUser, query: Record<string, unknown>) {
  const { limit, skip, page } = pagination(query, 100);
  const filter: Record<string, unknown> = {};
  if (typeof query.order === 'string') {
    // Scope check via the order itself.
    const order = await loadOrderForUser(assertObjectId(query.order, 'Order'), user);
    filter.order = order._id;
  }
  if (user.role === 'customer') filter.customer = user.customerId;
  else if (typeof query.customer === 'string') filter.customer = assertObjectId(query.customer, 'Customer');

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('order', 'orderNo')
      .populate('customer', 'name')
      .populate('recordedBy', 'name')
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  const missingOrderIds = payments
    .filter((payment) => {
      const order = (payment as any).order;
      return order && typeof order === 'object' && !order.orderNo;
    })
    .map((payment) => {
      const order = (payment as any).order;
      return String(order._id ?? order.id);
    })
    .filter((id) => Types.ObjectId.isValid(id));
  const fallbackOrders = missingOrderIds.length
    ? await Order.find({ _id: { $in: missingOrderIds } }).select('orderNo').lean()
    : [];
  const fallbackById = new Map(fallbackOrders.map((order) => [String(order._id), { id: String(order._id), orderNo: order.orderNo }]));
  return {
    payments: payments.map((payment) => {
      const order = (payment as any).order;
      const paymentOrderId = order && typeof order === 'object' ? String(order._id ?? order.id) : String(order);
      return toDto(payment, fallbackById.get(paymentOrderId));
    }),
    total,
    page,
    limit,
  };
}

function proofEntry(file: Express.Multer.File, user: AuthUser) {
  return { storedName: file.filename, originalName: file.originalname, mimeType: file.mimetype, size: file.size, uploadedBy: user.id };
}

export async function createPayment(user: AuthUser, body: CreatePaymentInput, uploaded: Express.Multer.File | undefined) {
  const order = await loadOrderForUser(assertObjectId(body.orderId, 'Order'), user);
  if (!order.totalAmount) throw conflict('Set the order price before recording payments');
  const [submitted] = await Payment.aggregate<{ total: number }>([
    { $match: { order: order._id, $or: [{ status: { $in: ['pending', 'verified'] } }, { status: { $exists: false } }] } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const balance = order.totalAmount - (submitted?.total ?? 0);
  if (body.amount > balance + 0.001) throw badRequest(`amount: Payment exceeds the outstanding balance of ${balance}`);
  if (body.receivedAt && body.receivedAt > new Date()) throw badRequest('receivedAt: Payment date cannot be in the future');
  const payment = await Payment.create({
    order: order._id,
    customer: order.customer,
    amount: body.amount,
    method: body.method,
    reference: body.reference,
    note: body.note,
    proof: uploaded ? proofEntry(uploaded, user) : undefined,
    receivedAt: body.receivedAt ?? new Date(),
    recordedBy: user.id,
    status: user.role === 'customer' ? 'pending' : 'verified',
    verifiedBy: user.role === 'customer' ? null : user.id,
    verifiedAt: user.role === 'customer' ? null : new Date(),
  });
  await recomputePaid(order._id);
  await audit(user, 'payment.recorded', 'Payment', String(payment._id), `Recorded ${body.method} payment of ${body.amount} for ${order.orderNo}`);
  const saved = await Payment.findById(payment._id).populate('order', 'orderNo').populate('customer', 'name').populate('recordedBy', 'name').populate('verifiedBy', 'name').lean();
  return { payment: toDto(saved!) };
}

export async function verifyPayment(user: AuthUser, id: string) {
  const payment = await Payment.findById(id);
  if (!payment) throw notFound('Payment not found');
  if (payment.status !== 'pending') throw conflict('Only pending payments can be verified');
  const order = await loadOrderForUser(payment.order.toString(), user);
  const available = order.totalAmount - order.amountPaid;
  if (payment.amount > available + 0.001) throw conflict(`Payment exceeds the remaining balance of ${available}`);
  payment.status = 'verified';
  payment.verifiedBy = user.id as never;
  payment.verifiedAt = new Date();
  await payment.save();
  await recomputePaid(order._id);
  await audit(user, 'payment.verified', 'Payment', String(payment._id), `Verified payment of ${payment.amount} for ${order.orderNo}`);
  const saved = await Payment.findById(payment._id).populate('order', 'orderNo').populate('customer', 'name').populate('recordedBy', 'name').populate('verifiedBy', 'name').lean();
  return { payment: toDto(saved!) };
}

export async function rejectPayment(user: AuthUser, id: string, reason: string) {
  const payment = await Payment.findById(id);
  if (!payment) throw notFound('Payment not found');
  if (payment.status !== 'pending') throw conflict('Only pending payments can be rejected');
  payment.status = 'rejected';
  payment.rejectionReason = reason;
  payment.verifiedBy = user.id as never;
  payment.verifiedAt = new Date();
  await payment.save();
  await audit(user, 'payment.rejected', 'Payment', String(payment._id), `Rejected payment of ${payment.amount}`);
  const saved = await Payment.findById(payment._id).populate('order', 'orderNo').populate('customer', 'name').populate('recordedBy', 'name').populate('verifiedBy', 'name').lean();
  return { payment: toDto(saved!) };
}

/** Returns the stored proof file once the caller is allowed to see the order. */
export async function getPaymentProof(user: AuthUser, id: string) {
  const payment = await Payment.findById(id).lean();
  if (!payment?.proof?.storedName) throw notFound('Payment proof not found');
  await loadOrderForUser(assertObjectId(String(payment.order), 'Order'), user);
  return { mimeType: payment.proof.mimeType || 'application/octet-stream', path: storedFilePath(payment.proof.storedName) };
}

export async function deletePayment(user: AuthUser, id: string) {
  const payment = await Payment.findById(id).populate('order', 'orderNo');
  if (!payment) throw notFound('Payment not found');
  if (payment.status === 'verified') throw conflict('Verified payments cannot be deleted.');
  if (payment.status === 'reversed') throw conflict('Reversed payments are kept for audit history.');
  removeStoredFile(payment.proof?.storedName);
  await payment.deleteOne();
  const orderRef = payment.order as unknown as { _id: Types.ObjectId; orderNo: string };
  await recomputePaid(orderRef._id);
  await audit(user, 'payment.deleted', 'Payment', id, `Deleted payment of ${payment.amount} on ${orderRef.orderNo}`);
  return { ok: true };
}
