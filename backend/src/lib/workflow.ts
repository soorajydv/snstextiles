import { Types } from 'mongoose';
import { FINANCE_ROLES, ROLE_STAGES, STAGE_DEPARTMENT, STAGE_LABELS, STAGES, type Stage } from './constants';
import type { AuthUser } from '../middleware/auth';
import type { OrderAttrs, OrderDoc } from '../models/Order';
import { forbidden, notFound } from './http';
import { Order } from '../models/Order';

type OrderLike = Pick<OrderAttrs, 'artworks' | 'approval' | 'feedback' | 'stage'>;

export function currentArtworkVersion(o: Pick<OrderAttrs, 'artworks'>): number {
  return o.artworks.reduce((max, a) => Math.max(max, a.version), 0);
}

/** Artwork is approved only when the customer (or owner on their behalf) approved the latest version. */
export function isArtworkApproved(o: Pick<OrderAttrs, 'artworks' | 'approval'>): boolean {
  const v = currentArtworkVersion(o);
  return v > 0 && o.approval?.version === v;
}

export function computeStatus(o: OrderLike): string {
  switch (o.stage as Stage) {
    case 'design': {
      const v = currentArtworkVersion(o);
      if (v === 0) return 'Design in progress';
      if (isArtworkApproved(o)) return 'Design approved';
      if (o.feedback.some((f) => f.version === v)) return 'Changes requested';
      return 'Awaiting approval';
    }
    case 'printing':
    case 'stitching':
      return 'In production';
    case 'finishing':
      return 'Quality check';
    case 'ready':
      return 'Ready to dispatch';
    case 'delivered':
      return 'Delivered';
    default:
      return 'Unknown';
  }
}

export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

export function previousStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  return i > 0 ? STAGES[i - 1] : null;
}

/** Owner can complete any production stage; departments only their own. Dispatch is owner-only. */
export function canCompleteStage(user: AuthUser, stage: Stage): boolean {
  if (stage === 'ready' || stage === 'delivered') return user.role === 'owner';
  return user.role === 'owner' || STAGE_DEPARTMENT[stage] === user.role || (!ROLE_STAGES[user.role] && user.permissions.includes('orders.stage.complete'));
}

/** Row-level visibility: customers see their own orders, departments see their queues. */
export function orderScope(user: AuthUser): Record<string, unknown> {
  // ObjectId (not string) so the filter also works inside aggregation $match stages.
  if (user.role === 'customer') return { customer: new Types.ObjectId(user.customerId ?? '000000000000000000000000') };
  if (user.role === 'cutting') return { stage: 'design', cuttingStatus: { $ne: 'completed' } };
  const stages = ROLE_STAGES[user.role];
  if (stages) return { stage: { $in: stages } };
  return {};
}

export async function loadOrderForUser(id: string, user: AuthUser): Promise<OrderDoc> {
  const order = await Order.findOne({ _id: id, ...orderScope(user) });
  if (!order) throw notFound('Order not found');
  return order;
}

export function assertCanSeeMoney(user: AuthUser) {
  if (!FINANCE_ROLES.includes(user.role)) throw forbidden();
}

export function fileUrl(orderId: string, storedName: string) {
  return `/api/orders/${orderId}/files/${storedName}`;
}

/** Shapes an order for the API, hiding financial fields from production roles. */
type SerializableOrder = Pick<OrderAttrs, 'artworks' | 'approval'> & { toObject?(opts?: object): unknown };

export function serializeOrder(order: SerializableOrder, user: AuthUser) {
  const o = (typeof order.toObject === 'function' ? order.toObject({ versionKey: false }) : order) as Record<string, any>;
  const id = String(o._id);
  const currentVersion = currentArtworkVersion(order);
  const customer = o.customer && typeof o.customer === 'object' && 'name' in o.customer
    ? { id: String(o.customer._id), name: o.customer.name, phone: o.customer.phone ?? '' }
    : { id: String(o.customer), name: '' };

  const withUrl = (f: Record<string, any>) => ({ ...f, url: fileUrl(id, f.storedName) });

  const cuttingStatus = o.cuttingStatus ?? (o.stage === 'design' ? 'pending' : 'completed');
  const result: Record<string, any> = {
    id,
    orderNo: o.orderNo,
    customer,
    teamName: o.teamName,
    productConfig: o.productConfig,
    neckType: o.neckType,
    shortsColor: o.shortsColor,
    quantity: o.quantity,
    dueDate: o.dueDate,
    cuttingStatus,
    cuttingCompletedAt: o.cuttingCompletedAt,
    playerListMode: o.playerListMode ?? 'manual',
    players: o.players,
    comments: o.comments,
    files: (o.files ?? []).map(withUrl),
    artworks: (o.artworks ?? []).map((a: Record<string, any>) => ({ ...a, file: withUrl(a.file) })),
    currentVersion,
    approved: isArtworkApproved(order),
    approval: o.approval,
    feedback: o.feedback,
    stage: o.stage,
    stageLabel: STAGE_LABELS[o.stage as Stage],
    status: o.status,
    history: o.history,
    delivery: o.delivery,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
  if (user.permissions.includes('payments.view') || FINANCE_ROLES.includes(user.role)) {
    result.unitRate = o.unitRate;
    result.totalAmount = o.totalAmount;
    result.amountPaid = o.amountPaid;
    result.balance = Math.max(0, (o.totalAmount ?? 0) - (o.amountPaid ?? 0));
    result.invoice = o.invoice;
  }
  return result;
}
