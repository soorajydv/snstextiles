import { Order } from '../orders/order.model';
import { InventoryItem } from '../inventory/inventory.model';
import { AuditLog } from '../audit/audit.model';
import { getSettings } from '../settings/settings.model';
import type { AuthUser } from '../../middleware/auth';
import { FINANCE_ROLES, STAGES } from '../../lib/constants';
import { orderScope, serializeOrder } from '../orders/order.workflow';
import { startOfToday } from '../orders/orders.service';
import type { RecentOrdersSort } from './dashboard.validation';

export async function getDashboard(user: AuthUser, recentOrdersSort: RecentOrdersSort) {
  const scope = orderScope(user);
  const settings = await getSettings();
  const today = startOfToday();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + settings.dueSoonDays + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const notDelivered: Record<string, unknown> = { ...scope, $and: [{ stage: { $ne: 'delivered' } }] };

  const [stageRows, money, awaitingApproval, dueSoon, overdue, deliveredThisMonth, recent, approvals, dueSoonOrders] = await Promise.all([
    Order.aggregate<{ _id: string; n: number }>([{ $match: scope }, { $group: { _id: '$stage', n: { $sum: 1 } } }]),
    Order.aggregate<{ total: number; paid: number }>([
      { $match: scope },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' } } },
    ]),
    Order.countDocuments({ ...scope, $and: [{ stage: 'design' }, { status: { $in: ['Awaiting approval', 'Changes requested'] } }] }),
    Order.countDocuments({ ...notDelivered, dueDate: { $gte: today, $lt: soon } }),
    Order.countDocuments({ ...notDelivered, dueDate: { $lt: today } }),
    Order.countDocuments({ ...scope, $and: [{ stage: 'delivered' }, { 'delivery.deliveredAt': { $gte: monthStart } }] }),
    Order.find(scope).populate('customer', 'name phone').sort(recentOrdersSort === 'recent' ? { createdAt: -1 } : { dueDate: 1, createdAt: -1 }).limit(6),
    Order.find({ ...scope, $and: [{ stage: 'design' }, { status: { $in: ['Awaiting approval', 'Changes requested', 'Design in progress'] } }] })
      .populate('customer', 'name phone').sort({ dueDate: 1 }).limit(5),
    Order.find({ ...notDelivered, dueDate: { $lt: soon } }).populate('customer', 'name phone').sort({ dueDate: 1 }).limit(6),
  ]);

  const byStage = Object.fromEntries(STAGES.map((s) => [s, stageRows.find((r) => r._id === s)?.n ?? 0]));
  const active = STAGES.filter((s) => s !== 'delivered').reduce((sum, s) => sum + byStage[s], 0);

  const result: Record<string, unknown> = {
    counts: { active, awaitingApproval, dueSoon, overdue, readyToDispatch: byStage.ready, deliveredThisMonth },
    byStage,
    dueSoonDays: settings.dueSoonDays,
    recentOrders: recent.map((o) => serializeOrder(o, user)),
    approvals: approvals.map((o) => serializeOrder(o, user)),
    dueSoonOrders: dueSoonOrders.map((o) => serializeOrder(o, user)),
  };

  if (user.permissions.includes('payments.view') || FINANCE_ROLES.includes(user.role)) {
    const total = money[0]?.total ?? 0;
    const paid = money[0]?.paid ?? 0;
    result.money = { orderValue: total, collected: paid, outstanding: Math.max(0, total - paid) };
  }
  if (user.role !== 'customer') {
    result.lowStock = await InventoryItem.countDocuments({ active: true, $expr: { $lt: ['$onHand', '$reorderLevel'] } });
  }
  if (user.permissions.includes('audit.view')) {
    const logs = await AuditLog.find({ action: { $ne: 'auth.login' } }).sort({ createdAt: -1 }).limit(8).lean();
    result.activity = logs.map((l) => ({ id: String(l._id), actorName: l.actorName, action: l.action, summary: l.summary, at: l.createdAt }));
  }
  return result;
}
