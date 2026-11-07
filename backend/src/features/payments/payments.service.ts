import { Types } from 'mongoose';
import { Payment, PAYMENT_STATUSES, type PaymentStatus } from './payment.model';
import { Order } from '../orders/order.model';
import type { AuthUser } from '../../middleware/auth';
import { assertObjectId, badRequest, conflict, notFound, pagination } from '../../lib/http';
import { loadOrderForUser, orderScope } from '../orders/order.workflow';
import { audit } from '../audit/audit.service';
import { removeStoredFile, storedFilePath } from '../../lib/uploads';
import { publicUrl } from '../../lib/urls';
import { Customer } from '../customers/customer.model';
import { dayRange, paymentStateMatch } from '../orders/orders.service';
import type { BillingQuery, CreatePaymentInput } from './payments.validation';

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
  const received = dayRange(query.from, query.to);
  if (received) filter.receivedAt = received;
  if (typeof query.status === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(query.status)) {
    filter.status = query.status === 'verified' ? { $in: ['verified', null] } : query.status;
  }

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

// ---------- billing: summary & exports ----------

/** Customers only ever see their own records; staff may narrow to one customer. */
function billingCustomer(user: AuthUser, query: BillingQuery) {
  if (user.role === 'customer') return user.customerId ?? '000000000000000000000000';
  return query.customer;
}

function billingOrderFilter(user: AuthUser, query: BillingQuery) {
  const filter: Record<string, unknown> = { ...orderScope(user) };
  const customer = billingCustomer(user, query);
  if (customer) filter.customer = new Types.ObjectId(customer);
  const created = dayRange(query.from, query.to);
  if (created) filter.createdAt = created;
  const state = paymentStateMatch(query.payment);
  if (state) filter.$and = [state];
  return filter;
}

function billingPaymentFilter(user: AuthUser, query: BillingQuery) {
  const filter: Record<string, unknown> = {};
  const customer = billingCustomer(user, query);
  if (customer) filter.customer = new Types.ObjectId(customer);
  const received = dayRange(query.from, query.to);
  if (received) filter.receivedAt = received;
  if (query.status) filter.status = query.status === 'verified' ? { $in: ['verified', null] } : query.status;
  return filter;
}

/** Totals for the billing page across every matching record (not just the rows on screen). */
export async function getBillingSummary(user: AuthUser, query: BillingQuery) {
  const orderFilter = billingOrderFilter(user, query);
  const paymentFilter = billingPaymentFilter(user, { ...query, status: undefined });
  const customerId = billingCustomer(user, query);
  const [orderTotals, paymentTotals, customer] = await Promise.all([
    Order.aggregate<{ orders: number; value: number; paid: number; invoiced: number; awaitingPrice: number; sets: number }>([
      { $match: orderFilter },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          sets: { $sum: '$quantity' },
          value: { $sum: '$totalAmount' },
          paid: { $sum: '$amountPaid' },
          invoiced: { $sum: { $cond: [{ $ifNull: ['$invoice.number', false] }, 1, 0] } },
          awaitingPrice: { $sum: { $cond: [{ $gt: ['$totalAmount', 0] }, 0, 1] } },
        },
      },
    ]),
    Payment.aggregate<{ _id: string; amount: number; count: number }>([
      { $match: paymentFilter },
      { $group: { _id: { $ifNull: ['$status', 'verified'] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    customerId ? Customer.findById(customerId).lean() : null,
  ]);
  const o = orderTotals[0] ?? { orders: 0, value: 0, paid: 0, invoiced: 0, awaitingPrice: 0, sets: 0 };
  const byStatus = Object.fromEntries(paymentTotals.map((p) => [p._id, { amount: p.amount, count: p.count }]));
  return {
    orders: o.orders,
    sets: o.sets,
    orderValue: o.value,
    collected: o.paid,
    outstanding: Math.max(0, o.value - o.paid),
    invoicesIssued: o.invoiced,
    awaitingPrice: o.awaitingPrice,
    payments: {
      verified: byStatus.verified ?? { amount: 0, count: 0 },
      pending: byStatus.pending ?? { amount: 0, count: 0 },
      rejected: byStatus.rejected ?? { amount: 0, count: 0 },
    },
    customer: customer ? {
      id: String(customer._id), name: customer.name, contactPerson: customer.contactPerson, phone: customer.phone,
      email: customer.email, address: customer.address, panNumber: customer.panNumber,
    } : null,
  };
}

const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
const isoDay = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const stateOf = (o: { totalAmount: number; amountPaid: number }) => (!o.totalAmount ? 'Awaiting price' : o.amountPaid >= o.totalAmount ? 'Paid' : o.amountPaid > 0 ? 'Part paid' : 'Unpaid');
const nameOf = (ref: unknown) => (ref && typeof ref === 'object' && 'name' in ref ? String((ref as { name: unknown }).name) : '');
const orderNoOf = (ref: unknown) => (ref && typeof ref === 'object' && 'orderNo' in ref ? String((ref as { orderNo: unknown }).orderNo) : '');
const createdAtOf = (doc: unknown) => (doc as { createdAt?: Date }).createdAt;

export async function exportInvoicesCsv(user: AuthUser, query: BillingQuery) {
  const orders = await Order.find(billingOrderFilter(user, query)).populate('customer', 'name').sort({ createdAt: -1 }).lean();
  const header = ['Order', 'Invoice', 'Invoice date', 'Customer', 'Team', 'Product', 'Quantity', 'Unit rate', 'Total', 'Paid', 'Balance', 'Payment state', 'Stage', 'Ordered', 'Due'];
  return toCsv([header, ...orders.map((o) => [
    o.orderNo, o.invoice?.number ?? '', isoDay(o.invoice?.issuedAt), nameOf(o.customer), o.teamName, o.productConfig,
    o.quantity, o.unitRate, o.totalAmount, o.amountPaid, Math.max(0, o.totalAmount - o.amountPaid), stateOf(o), o.stage, isoDay(createdAtOf(o)), isoDay(o.dueDate),
  ])]);
}

export async function exportPaymentsCsv(user: AuthUser, query: BillingQuery) {
  const payments = await Payment.find(billingPaymentFilter(user, query)).populate('order', 'orderNo').populate('customer', 'name').populate('recordedBy', 'name').sort({ receivedAt: -1 }).lean();
  const header = ['Date', 'Order', 'Customer', 'Method', 'Reference', 'Amount', 'Status', 'Recorded by', 'Note', 'Rejection reason'];
  return toCsv([header, ...payments.map((p) => [
    isoDay(p.receivedAt), orderNoOf(p.order), nameOf(p.customer), p.method, p.reference,
    p.amount, p.status ?? 'verified', nameOf(p.recordedBy), p.note, p.rejectionReason ?? '',
  ])]);
}

/** Customer statement: orders as charges and verified payments as credits, oldest first with a running balance. */
export async function exportStatementCsv(user: AuthUser, query: BillingQuery) {
  const customerId = billingCustomer(user, query);
  if (!customerId) throw badRequest('customer: Choose a customer to export a statement');
  const customer = await Customer.findById(customerId).lean();
  if (!customer) throw notFound('Customer not found');
  const scoped: BillingQuery = { ...query, customer: customerId, payment: undefined, status: undefined };
  const [orders, payments] = await Promise.all([
    Order.find(billingOrderFilter(user, scoped)).lean(),
    Payment.find({ ...billingPaymentFilter(user, scoped), status: { $in: ['verified', null] } }).populate('order', 'orderNo').lean(),
  ]);
  const entries = [
    ...orders.filter((o) => o.totalAmount > 0).map((o) => ({ date: createdAtOf(o) ?? o.dueDate, type: 'Order', ref: o.orderNo, detail: `${o.quantity} × ${o.productConfig}${o.invoice?.number ? ` (invoice ${o.invoice.number})` : ''}`, debit: o.totalAmount, credit: 0 })),
    ...payments.map((p) => ({ date: p.receivedAt, type: 'Payment', ref: orderNoOf(p.order), detail: `${p.method}${p.reference ? ` · ${p.reference}` : ''}`, debit: 0, credit: p.amount })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let balance = 0;
  const rows = entries.map((e) => {
    balance += e.debit - e.credit;
    return [isoDay(e.date), e.type, e.ref, e.detail, e.debit || '', e.credit || '', balance];
  });
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const period = query.from || query.to ? `${query.from ?? 'start'} to ${query.to ?? 'today'}` : 'All time';
  return {
    customerName: customer.name,
    csv: toCsv([
      ['Statement of account'],
      ['Customer', customer.name],
      ['Contact', [customer.contactPerson, customer.phone, customer.email].filter(Boolean).join(' · ')],
      ['Period', period],
      [],
      ['Date', 'Type', 'Order', 'Details', 'Charge', 'Payment', 'Balance'],
      ...rows,
      [],
      ['', '', '', 'Totals', totalDebit, totalCredit, totalDebit - totalCredit],
    ]),
  };
}
