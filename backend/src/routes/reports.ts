import { Router } from 'express';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { requirePermission } from '../middleware/auth';
import { STAGE_LABELS, STAGES, type Stage } from '../lib/constants';
import { Attendance } from '../features/attendance/attendance.model';

const router = Router();
router.use(requirePermission('reports.view'));

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

router.get('/summary', async (req, res) => {
  const months = Math.min(24, Math.max(1, Number(req.query.months) || 6));
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [stageRows, monthlyOrders, monthlyPayments, receivables, delivered, products] = await Promise.all([
    Order.aggregate<{ _id: string; n: number; qty: number }>([{ $group: { _id: '$stage', n: { $sum: 1 }, qty: { $sum: '$quantity' } } }]),
    Order.aggregate<{ _id: { y: number; m: number }; n: number; value: number; qty: number }>([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, n: { $sum: 1 }, value: { $sum: '$totalAmount' }, qty: { $sum: '$quantity' } } },
    ]),
    Payment.aggregate<{ _id: { y: number; m: number }; amount: number }>([
      { $match: { receivedAt: { $gte: from }, $or: [{ status: 'verified' }, { status: { $exists: false } }] } },
      { $group: { _id: { y: { $year: '$receivedAt' }, m: { $month: '$receivedAt' } }, amount: { $sum: '$amount' } } },
    ]),
    Order.aggregate<{ _id: unknown; name: string; outstanding: number; orders: number }>([
      { $project: { customer: 1, outstanding: { $subtract: ['$totalAmount', '$amountPaid'] } } },
      { $match: { outstanding: { $gt: 0 } } },
      { $group: { _id: '$customer', outstanding: { $sum: '$outstanding' }, orders: { $sum: 1 } } },
      { $sort: { outstanding: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { outstanding: 1, orders: 1, name: { $ifNull: [{ $arrayElemAt: ['$c.name', 0] }, 'Unknown'] } } },
    ]),
    Order.find({ stage: 'delivered', 'delivery.deliveredAt': { $ne: null } }).select('dueDate createdAt delivery.deliveredAt').lean(),
    Order.aggregate<{ _id: string; n: number; qty: number }>([
      { $group: { _id: '$productConfig', n: { $sum: 1 }, qty: { $sum: '$quantity' } } },
      { $sort: { qty: -1 } },
    ]),
  ]);

  const monthly = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const o = monthlyOrders.find((r) => r._id.y === d.getFullYear() && r._id.m === d.getMonth() + 1);
    const p = monthlyPayments.find((r) => r._id.y === d.getFullYear() && r._id.m === d.getMonth() + 1);
    monthly.push({ month: monthKey(d), orders: o?.n ?? 0, sets: o?.qty ?? 0, orderValue: o?.value ?? 0, collected: p?.amount ?? 0 });
  }

  let onTime = 0;
  let leadDays = 0;
  for (const o of delivered) {
    const deliveredAt = new Date(o.delivery!.deliveredAt!);
    const due = new Date(o.dueDate);
    due.setHours(23, 59, 59, 999);
    if (deliveredAt <= due) onTime++;
    leadDays += (deliveredAt.getTime() - new Date(o.createdAt).getTime()) / 86_400_000;
  }

  res.json({
    byStage: STAGES.map((s) => {
      const r = stageRows.find((x) => x._id === s);
      return { stage: s, label: STAGE_LABELS[s], orders: r?.n ?? 0, sets: r?.qty ?? 0 };
    }),
    monthly,
    receivables: receivables.map((r) => ({ customerId: String(r._id), name: r.name, outstanding: r.outstanding, orders: r.orders })),
    delivery: {
      delivered: delivered.length,
      onTime,
      onTimeRate: delivered.length ? onTime / delivered.length : null,
      avgLeadDays: delivered.length ? leadDays / delivered.length : null,
    },
    products: products.map((p) => ({ product: p._id, orders: p.n, sets: p.qty })),
  });
});

router.get('/attendance', async (req, res) => {
  const now = new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = req.query.to ? new Date(String(req.query.to)) : now;
  to.setHours(23, 59, 59, 999);
  const rows = await Attendance.find({ checkInAt: { $gte: from, $lte: to } }).populate('user', 'name email role').sort({ checkInAt: -1 }).lean();
  const records = rows.map((row) => {
    const user = row.user as unknown as { _id: unknown; name: string; email: string; role: string };
    const end = row.checkOutAt ? new Date(row.checkOutAt).getTime() : null;
    const workedMinutes = row.status === 'approved' && end ? Math.max(0, Math.floor((end - new Date(row.checkInAt).getTime()) / 60000)) : 0;
    return { id: String(row._id), user: { id: String(user?._id ?? row.user), name: user?.name ?? 'Unknown', email: user?.email ?? '', role: user?.role ?? '' }, checkInAt: row.checkInAt, checkOutAt: row.checkOutAt, workedMinutes, status: row.status };
  });
  res.json({ records, summary: { records: records.length, workedMinutes: records.reduce((sum, row) => sum + row.workedMinutes, 0), pending: records.filter((row) => row.status === 'pending').length, missingCheckout: records.filter((row) => row.status === 'approved' && !row.checkOutAt).length } });
});

router.get('/payments', async (req, res) => {
  const now = new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = req.query.to ? new Date(String(req.query.to)) : now;
  to.setHours(23, 59, 59, 999);
  const rows = await Payment.aggregate<{ _id: { customer: unknown; status: string }; amount: number; payments: number; name: string }>([
    { $match: { receivedAt: { $gte: from, $lte: to } } },
    { $group: { _id: { customer: '$customer', status: { $ifNull: ['$status', 'verified'] } }, amount: { $sum: '$amount' }, payments: { $sum: 1 } } },
    { $sort: { amount: -1 } },
    { $lookup: { from: 'customers', localField: '_id.customer', foreignField: '_id', as: 'customer' } },
    { $project: { customerId: '$_id.customer', status: '$_id.status', amount: 1, payments: 1, name: { $ifNull: [{ $arrayElemAt: ['$customer.name', 0] }, 'Unknown'] } } },
  ]);
  res.json({ rows: rows.map((row) => ({ customerId: String(row._id.customer), name: row.name, status: row._id.status, amount: row.amount, payments: row.payments })) });
});

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/orders.csv', async (_req, res) => {
  const orders = await Order.find().populate('customer', 'name').sort({ createdAt: -1 }).lean();
  const header = ['Order', 'Customer', 'Team', 'Product', 'Neck', 'Quantity', 'Stage', 'Status', 'Due date', 'Unit rate', 'Total', 'Paid', 'Balance', 'Invoice', 'Created', 'Delivered'];
  const rows = orders.map((o) => [
    o.orderNo,
    (o.customer as unknown as { name?: string })?.name ?? '',
    o.teamName,
    o.productConfig,
    o.neckType,
    o.quantity,
    STAGE_LABELS[o.stage as Stage],
    o.status,
    new Date(o.dueDate).toISOString().slice(0, 10),
    o.unitRate,
    o.totalAmount,
    o.amountPaid,
    Math.max(0, o.totalAmount - o.amountPaid),
    o.invoice?.number ?? '',
    new Date(o.createdAt).toISOString().slice(0, 10),
    o.delivery?.deliveredAt ? new Date(o.delivery.deliveredAt).toISOString().slice(0, 10) : '',
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + csv);
});

export default router;
