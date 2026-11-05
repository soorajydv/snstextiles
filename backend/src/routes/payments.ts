import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Payment } from '../models/Payment';
import { Order } from '../models/Order';
import { currentUser, requirePermission } from '../middleware/auth';
import { PAYMENT_METHODS } from '../lib/constants';
import { assertObjectId, badRequest, conflict, notFound, pagination, parse } from '../lib/http';
import { loadOrderForUser } from '../lib/workflow';
import { audit } from '../lib/audit';
import { compressUploadedImage, removeStoredFile, removeUploadedFiles, storedFilePath, upload } from '../lib/uploads';
import { publicUrl } from '../lib/urls';

const router = Router();

/** Keeps the cached order.amountPaid in sync with the payment ledger. */
export async function recomputePaid(orderId: Types.ObjectId | string) {
  const [row] = await Payment.aggregate<{ total: number }>([
    { $match: { order: new Types.ObjectId(String(orderId)) } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  await Order.updateOne({ _id: orderId }, { $set: { amountPaid: row?.total ?? 0 } });
}

const toDto = (p: Record<string, any>) => ({
  id: String(p._id),
  amount: p.amount,
  method: p.method,
  reference: p.reference,
  note: p.note,
  proof: p.proof?.storedName ? { originalName: p.proof.originalName, size: p.proof.size, url: publicUrl(`/api/payments/${String(p._id)}/proof`) } : null,
  receivedAt: p.receivedAt,
  order: p.order && typeof p.order === 'object' && 'orderNo' in p.order ? { id: String(p.order._id), orderNo: p.order.orderNo } : { id: String(p.order), orderNo: '' },
  customer: p.customer && typeof p.customer === 'object' && 'name' in p.customer ? { id: String(p.customer._id), name: p.customer.name } : { id: String(p.customer), name: '' },
  recordedBy: p.recordedBy && typeof p.recordedBy === 'object' && 'name' in p.recordedBy ? p.recordedBy.name : '',
});

router.get('/', requirePermission('payments.view'), async (req, res) => {
  const user = currentUser(req);
  const { limit, skip, page } = pagination(req.query as Record<string, unknown>, 100);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.order === 'string') {
    // Scope check via the order itself.
    const order = await loadOrderForUser(assertObjectId(req.query.order, 'Order'), user);
    filter.order = order._id;
  }
  if (user.role === 'customer') filter.customer = user.customerId;
  else if (typeof req.query.customer === 'string') filter.customer = assertObjectId(req.query.customer, 'Customer');

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
  res.json({ payments: payments.map(toDto), total, page, limit });
});

const createSchema = z.object({
  orderId: z.string(),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
  receivedAt: z.coerce.date().optional(),
});

function proofEntry(file: Express.Multer.File, user: ReturnType<typeof currentUser>) {
  return { storedName: file.filename, originalName: file.originalname, mimeType: file.mimetype, size: file.size, uploadedBy: user.id };
}

router.post('/', requirePermission('payments.record'), upload.single('proof'), async (req, res) => {
  const user = currentUser(req);
  const uploaded = req.file;
  try {
    if (uploaded) await compressUploadedImage(uploaded);
    const body = parse(createSchema, req.body);
    const order = await loadOrderForUser(assertObjectId(body.orderId, 'Order'), user);
    if (!order.totalAmount) throw conflict('Set the order price before recording payments');
    const balance = order.totalAmount - order.amountPaid;
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
    });
    await recomputePaid(order._id);
    await audit(user, 'payment.recorded', 'Payment', String(payment._id), `Recorded ${body.method} payment of ${body.amount} for ${order.orderNo}`);
    const saved = await Payment.findById(payment._id).populate('order', 'orderNo').populate('customer', 'name').populate('recordedBy', 'name').lean();
    res.status(201).json({ payment: toDto(saved!) });
  } catch (error) {
    removeUploadedFiles(uploaded ? [uploaded] : undefined);
    throw error;
  }
});

router.get('/:id/proof', requirePermission('payments.view'), async (req, res) => {
  const user = currentUser(req);
  const payment = await Payment.findById(assertObjectId(req.params.id, 'Payment')).lean();
  if (!payment?.proof?.storedName) throw notFound('Payment proof not found');
  await loadOrderForUser(assertObjectId(String(payment.order), 'Order'), user);
  res.type(payment.proof.mimeType || 'application/octet-stream').sendFile(storedFilePath(payment.proof.storedName), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

router.delete('/:id', requirePermission('payments.delete'), async (req, res) => {
  const user = currentUser(req);
  const id = assertObjectId(req.params.id, 'Payment');
  const payment = await Payment.findById(id).populate('order', 'orderNo');
  if (!payment) throw notFound('Payment not found');
  removeStoredFile(payment.proof?.storedName);
  await payment.deleteOne();
  const orderRef = payment.order as unknown as { _id: Types.ObjectId; orderNo: string };
  await recomputePaid(orderRef._id);
  await audit(user, 'payment.deleted', 'Payment', id, `Deleted payment of ${payment.amount} on ${orderRef.orderNo}`);
  res.json({ ok: true });
});

export default router;
