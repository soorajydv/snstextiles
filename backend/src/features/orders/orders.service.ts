import fs from 'fs';
import { Order, type OrderDoc } from './order.model';
import { Customer } from '../customers/customer.model';
import { Payment } from '../payments/payment.model';
import { getSettings } from '../settings/settings.model';
import { nextSequence } from '../../lib/counter';
import type { AuthUser } from '../../middleware/auth';
import { STAGE_LABELS, STAGES, type Stage } from '../../lib/constants';
import { assertObjectId, badRequest, conflict, escapeRegex, forbidden, notFound, pagination, parse } from '../../lib/http';
import {
  canCompleteStage, computeStatus, currentArtworkVersion, isArtworkApproved, loadOrderForUser, nextStage,
  orderScope, previousStage, serializeOrder,
} from './order.workflow';
import { compressUploadedImage, isInlineSafe, storedFilePath } from '../../lib/uploads';
import { audit } from '../audit/audit.service';
import { sendOrderReadyEmail } from '../../lib/mail';
import {
  advanceSchema, approveSchema, deliverSchema, feedbackSchema, normaliseSpec, sendBackSchema, updateSchema,
  type CreateOrderInput, type PlayerInput,
} from './orders.validation';

export type OrderUploads = Record<string, Express.Multer.File[]> | undefined;

function fileEntry(f: Express.Multer.File, kind: 'jersey' | 'reference' | 'player-list' | 'artwork', user: AuthUser) {
  return { storedName: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size, kind, uploadedBy: user.id };
}

function proofEntry(f: Express.Multer.File, user: AuthUser) {
  return { storedName: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size, uploadedBy: user.id };
}

async function respond(order: OrderDoc, user: AuthUser) {
  await order.populate('customer', 'name phone');
  return { order: serializeOrder(order, user) };
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfToday() {
  return startOfDay(new Date());
}

// ---------- list & read ----------

export async function listOrders(user: AuthUser, query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query);
  const filter: Record<string, unknown> = { ...orderScope(user) };
  const q = query as Record<string, string | undefined>;

  if (q.stage && (STAGES as readonly string[]).includes(q.stage)) {
    // Combine with the role scope rather than overriding it.
    filter.$and = [{ stage: q.stage }];
  }
  if (q.status) filter.status = q.status;
  if (q.source === 'website') filter.source = 'website';
  if (q.source === 'portal') filter.source = { $ne: 'website' };
  if (q.customer && user.role !== 'customer') filter.customer = assertObjectId(q.customer, 'Customer');
  if (q.due === 'overdue') {
    filter.dueDate = { $lt: startOfToday() };
    filter.$and = [...((filter.$and as object[]) ?? []), { stage: { $ne: 'delivered' } }];
  }
  if (q.due === 'soon') {
    const today = startOfToday();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 8);
    filter.dueDate = { $gte: today, $lt: nextWeek };
    filter.$and = [...((filter.$and as object[]) ?? []), { stage: { $ne: 'delivered' } }];
  }
  if (q.search?.trim()) {
    const rx = { $regex: escapeRegex(q.search.trim()), $options: 'i' };
    const customers = await Customer.find({ name: rx }).select('_id').limit(200).lean();
    filter.$or = [{ orderNo: rx }, { teamName: rx }, { customer: { $in: customers.map((c) => c._id) } }];
  }

  const [orders, total] = await Promise.all([
    Order.aggregate([
      { $match: filter },
      ...(q.sort === 'recent' ? [] : q.sort === 'oldest' ? [] : [{ $addFields: { _deadlineState: { $cond: [{ $eq: ['$stage', 'delivered'] }, 1, 0] } } }]),
      { $sort: q.sort === 'recent' ? { createdAt: -1 } : q.sort === 'oldest' ? { createdAt: 1 } : { _deadlineState: 1, dueDate: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customer' } },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    ]),
    Order.countDocuments(filter),
  ]);
  return { orders: orders.map((o) => serializeOrder(o, user)), total, page, limit };
}

export async function getOrder(user: AuthUser, id: string) {
  const order = await loadOrderForUser(id, user);
  return respond(order, user);
}

// ---------- create / update / delete ----------

export async function createOrder(user: AuthUser, body: CreateOrderInput, uploaded: OrderUploads) {
  if (user.role === 'customer' && body.unitRate <= 0) throw badRequest('unitRate: Customers must enter a unit rate greater than zero');
  if (body.advance > body.unitRate * body.quantity) throw badRequest('advance: Advance cannot exceed the order total');
  if (startOfDay(body.dueDate) < startOfToday()) throw badRequest('dueDate: Delivery date cannot be in the past');
  if (body.advance > 0 && body.advanceMethod !== 'Cash' && !uploaded?.advanceProof?.[0]) throw badRequest('advanceProof: Upload proof of payment for non-cash advances');
  if (body.advance === 0 && uploaded?.advanceProof?.[0]) throw badRequest('advanceProof: Add an advance amount before uploading proof');
  if (body.playerListMode === 'image' && !uploaded?.playerListImage?.[0]) throw badRequest('playerListImage: Upload a player list image');
  if (body.playerListMode === 'manual' && uploaded?.playerListImage?.[0]) throw badRequest('playerListImage: Select image mode before uploading a player list image');

  // Resolve customer: customers can only order for themselves.
  let customerId: string;
  if (user.role === 'customer') {
    if (!user.customerId) throw forbidden('Your login is not linked to a customer account');
    customerId = user.customerId;
  } else if (body.customerId) {
    customerId = assertObjectId(body.customerId, 'Customer');
    if (!(await Customer.exists({ _id: customerId }))) throw badRequest('customerId: Customer not found');
  } else if (body.newCustomer) {
    const created = await Customer.create({ name: body.newCustomer.name, phone: body.newCustomer.phone });
    customerId = String(created._id);
    await audit(user, 'customer.created', 'Customer', customerId, `Added customer ${created.name} while creating an order`);
  } else {
    throw badRequest('customerId: Select a customer');
  }
  const customer = await Customer.findById(customerId).lean();

  const isCustomer = user.role === 'customer';
  // Customers submit their quoted rate when placing an order; staff may also set it later.
  const unitRate = body.unitRate;
  const settings = await getSettings();
  const seq = await nextSequence('order', 26101);
  const files = [
    ...(uploaded?.jerseyImage ?? []).map((f) => fileEntry(f, 'jersey', user)),
    ...(uploaded?.files ?? []).map((f) => fileEntry(f, 'reference', user)),
    ...(uploaded?.playerListImage ?? []).map((f) => fileEntry(f, 'player-list', user)),
  ];

  const order = new Order({
    orderNo: `${settings.orderPrefix}-${seq}`,
    customer: customerId,
    teamName: body.teamName || customer?.name || 'Team',
    productConfig: body.productConfig,
    neckType: body.neckType,
    shortsColor: body.shortsColor,
    quantity: body.quantity,
    dueDate: body.dueDate,
    playerListMode: body.playerListMode,
    cuttingStatus: 'pending',
    unitRate,
    totalAmount: unitRate * body.quantity,
    players: body.players,
    comments: body.comments,
    files,
    stage: 'design',
    history: [{ from: null, to: 'design', by: user.id, byName: user.name, note: isCustomer ? 'Order placed by customer' : 'Order registered' }],
    createdBy: user.id,
  });
  order.status = computeStatus(order);
  await order.save();

  if (body.advance > 0) {
    await Payment.create({
      order: order._id,
      customer: customerId,
      amount: body.advance,
      method: body.advanceMethod,
      proof: uploaded?.advanceProof?.[0] ? proofEntry(uploaded.advanceProof[0], user) : undefined,
      note: 'Advance received at order registration',
      recordedBy: user.id,
      status: isCustomer ? 'pending' : 'verified',
      verifiedBy: isCustomer ? null : user.id,
      verifiedAt: isCustomer ? null : new Date(),
    });
    if (!isCustomer) {
      order.amountPaid = body.advance;
      await order.save();
    }
  }

  await audit(user, 'order.created', 'Order', String(order._id), `Created order ${order.orderNo} for ${customer?.name} (${order.quantity} sets)`);
  return respond(order, user);
}

export async function updateOrder(user: AuthUser, rawId: unknown, rawBody: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  const body = parse(updateSchema, rawBody);

  const specFields = ['productConfig', 'neckType', 'shortsColor', 'quantity', 'players'] as const;
  const touchesSpec = specFields.some((f) => body[f] !== undefined);
  if (touchesSpec && order.stage !== 'design') {
    throw conflict('Garment specification can only be changed during Design & confirmation');
  }
  const merged = normaliseSpec({
    productConfig: body.productConfig ?? order.productConfig,
    shortsColor: body.shortsColor ?? order.shortsColor,
    quantity: body.quantity ?? order.quantity,
    players: body.players ?? (order.players.map((p) => ({ ...p })) as PlayerInput[]),
  });
  const nextTotal = (body.unitRate ?? order.unitRate) * (merged.quantity ?? order.quantity);
  if (order.amountPaid > nextTotal + 0.001) {
    throw conflict(`The new order total ${nextTotal} cannot be less than payments already recorded (${order.amountPaid})`);
  }

  if (body.teamName !== undefined) order.teamName = body.teamName;
  if (body.neckType !== undefined) order.neckType = body.neckType;
  if (body.dueDate !== undefined) order.dueDate = body.dueDate;
  if (body.comments !== undefined) order.comments = body.comments;
  if (touchesSpec) {
    order.productConfig = merged.productConfig;
    order.shortsColor = merged.shortsColor ?? '';
    order.quantity = merged.quantity;
    order.set('players', merged.players);
  }
  if (body.unitRate !== undefined) order.unitRate = body.unitRate;
  order.totalAmount = nextTotal;
  order.status = computeStatus(order);
  await order.save();
  await audit(user, 'order.updated', 'Order', String(order._id), `Updated order ${order.orderNo}`);
  return respond(order, user);
}

export async function deleteOrder(user: AuthUser, rawId: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  if (order.stage !== 'design') throw conflict('Only orders still in Design & confirmation can be deleted');
  if (await Payment.exists({ order: order._id })) throw conflict('This order has payments recorded. Remove them first');
  const stored = [...order.files.map((f) => f.storedName), ...order.artworks.map((a) => a.file.storedName)];
  await order.deleteOne();
  for (const name of stored) fs.promises.unlink(storedFilePath(name)).catch(() => undefined);
  await audit(user, 'order.deleted', 'Order', String(order._id), `Deleted order ${order.orderNo}`);
  return { ok: true };
}

// ---------- artwork & approval ----------

export async function uploadArtwork(user: AuthUser, rawId: unknown, file: Express.Multer.File | undefined, rawNote: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  if (!file) throw badRequest('file: Choose an artwork file to upload');
  await compressUploadedImage(file);
  if (order.stage !== 'design') throw conflict('Artwork can only be uploaded during Design & confirmation');
  const version = currentArtworkVersion(order) + 1;
  const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, 1000) : '';
  order.artworks.push({
    version,
    file: fileEntry(file, 'artwork', user),
    note,
    uploadedBy: user.id,
    uploadedByName: user.name,
    uploadedAt: new Date(),
  } as never);
  order.status = computeStatus(order);
  await order.save();
  await audit(user, 'order.artwork_uploaded', 'Order', String(order._id), `Uploaded artwork v${version} for ${order.orderNo}`);
  return respond(order, user);
}

export async function approveArtwork(user: AuthUser, rawId: unknown, rawBody: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  const { version } = parse(approveSchema, rawBody);
  if (order.stage !== 'design') throw conflict('This order is no longer awaiting design approval');
  const current = currentArtworkVersion(order);
  if (current === 0) throw conflict('No artwork has been uploaded yet');
  if (version !== current) throw conflict(`Only the latest artwork (v${current}) can be approved`);
  if (isArtworkApproved(order)) throw conflict(`Artwork v${current} is already approved`);
  order.approval = { version, by: user.id, byName: user.name, onBehalf: user.role !== 'customer', at: new Date() } as never;
  order.status = computeStatus(order);
  await order.save();
  const who = user.role === 'customer' ? 'Customer' : 'Owner (on behalf of customer)';
  await audit(user, 'order.artwork_approved', 'Order', String(order._id), `${who} approved artwork v${version} for ${order.orderNo}`);
  return respond(order, user);
}

export async function addFeedback(user: AuthUser, rawId: unknown, rawBody: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  const { message } = parse(feedbackSchema, rawBody);
  if (order.stage !== 'design') throw conflict('Design feedback is closed for this order');
  const version = currentArtworkVersion(order);
  if (version === 0) throw conflict('No artwork has been uploaded yet');
  order.feedback.push({ version, message, by: user.id, byName: user.name, at: new Date() } as never);
  // Requesting changes withdraws any approval on the current version.
  if (user.role === 'customer' && order.approval?.version === version) {
    order.approval = { version: null, by: null, byName: '', onBehalf: false, at: null } as never;
  }
  order.status = computeStatus(order);
  await order.save();
  await audit(user, 'order.feedback', 'Order', String(order._id), `Feedback on artwork v${version} for ${order.orderNo}`);
  return respond(order, user);
}

// ---------- production workflow ----------

export async function advanceStage(user: AuthUser, rawId: unknown, rawBody: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  const { note, checklistConfirmed } = parse(advanceSchema, rawBody ?? {});
  const from = order.stage as Stage;
  if (from === 'ready') throw conflict('Use the dispatch screen to confirm delivery');
  const to = nextStage(from);
  if (!to) throw conflict('This order is already delivered');
  if (!canCompleteStage(user, from)) throw forbidden(`Only the ${STAGE_LABELS[from]} team or the owner can complete this stage`);
  if (from === 'design' && !isArtworkApproved(order)) {
    throw conflict('Printing cannot start until the customer approves the latest artwork version');
  }
  const cuttingStatus = order.cuttingStatus ?? (from === 'design' ? 'pending' : 'completed');
  if (from === 'design' && cuttingStatus !== 'completed') {
    throw conflict('Printing cannot start until Cutting marks this order complete');
  }
  if (from === 'design' && !checklistConfirmed) {
    throw conflict('Confirm the player list checklist before completing Design');
  }
  order.stage = to;
  order.history.push({ from, to, by: user.id, byName: user.name, note, at: new Date() } as never);
  order.status = computeStatus(order);
  await order.save();
  await audit(user, 'order.stage_advanced', 'Order', String(order._id), `${order.orderNo}: ${STAGE_LABELS[from]} → ${STAGE_LABELS[to]}`);
  if (to === 'ready') {
    const customerDetails = await Customer.findById(order.customer).select('name email').lean();
    if (customerDetails?.email) {
      try {
        await sendOrderReadyEmail({ to: customerDetails.email, customerName: customerDetails.name, orderNo: order.orderNo, quantity: order.quantity, balance: Math.max(0, order.totalAmount - order.amountPaid) });
        await audit(user, 'order.ready_email_sent', 'Order', String(order._id), `Sent ready-for-dispatch email for ${order.orderNo}`);
      } catch (error) {
        console.error(`Ready email failed for ${order.orderNo}`, error);
      }
    }
  }
  return respond(order, user);
}

export async function completeCutting(user: AuthUser, rawId: unknown) {
  if (user.role !== 'owner' && user.role !== 'cutting') throw forbidden('Only the Cutting team or the owner can complete Cutting');
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  if (order.cuttingStatus === 'completed') throw conflict('Cutting is already complete for this order');
  if (order.stage === 'design' && !isArtworkApproved(order)) {
    throw conflict('Cutting cannot move this order to Printing until the customer approves the latest artwork version');
  }
  order.cuttingStatus = 'completed';
  order.cuttingCompletedAt = new Date();
  order.cuttingCompletedByName = user.name;
  await order.save();
  await audit(user, 'order.cutting_completed', 'Order', String(order._id), `Completed Cutting for ${order.orderNo}`);
  return respond(order, user);
}

export async function sendBack(user: AuthUser, rawId: unknown, rawBody: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  const { reason } = parse(sendBackSchema, rawBody);
  const from = order.stage as Stage;
  if (from === 'design' || from === 'delivered') throw conflict('This order cannot be sent back');
  const to = previousStage(from)!;
  order.stage = to;
  order.history.push({ from, to, by: user.id, byName: user.name, note: `Sent back: ${reason}`, at: new Date() } as never);
  order.status = computeStatus(order);
  await order.save();
  await audit(user, 'order.sent_back', 'Order', String(order._id), `${order.orderNo} sent back to ${STAGE_LABELS[to]}: ${reason}`);
  return respond(order, user);
}

export async function deliverOrder(user: AuthUser, rawId: unknown, rawBody: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  const body = parse(deliverSchema, rawBody);
  if (order.stage !== 'ready') throw conflict('Only orders that are ready to dispatch can be delivered');
  if (!order.totalAmount) throw conflict('Set the order price before dispatching');
  const previouslyPacked = order.delivery?.packedQuantity ?? 0;
  const totalPacked = previouslyPacked + body.packedQuantity;
  if (totalPacked > order.quantity) {
    throw badRequest(`packedQuantity: Only ${order.quantity - previouslyPacked} sets remain to be dispatched`);
  }
  const fullyDispatched = totalPacked === order.quantity;
  order.delivery = { ...body, packedQuantity: totalPacked, deliveredAt: new Date(), by: user.id, byName: user.name } as never;
  if (fullyDispatched) order.stage = 'delivered';
  const diff = totalPacked - order.quantity;
  const qtyNote = diff === 0 ? '' : diff < 0 ? ` (short by ${-diff})` : ` (over by ${diff})`;
  if (fullyDispatched) {
    order.history.push({ from: 'ready', to: 'delivered', by: user.id, byName: user.name, note: `Delivered to ${body.recipient} via ${body.method}${qtyNote}`, at: new Date() } as never);
  }
  order.status = computeStatus(order);
  await order.save();
  await audit(user, fullyDispatched ? 'order.delivered' : 'order.partially_dispatched', 'Order', String(order._id), `${order.orderNo} ${fullyDispatched ? 'delivered' : 'partially dispatched'} ${body.packedQuantity} sets to ${body.recipient} (${totalPacked}/${order.quantity})`);
  return respond(order, user);
}

// ---------- invoice ----------

export async function issueInvoice(user: AuthUser, rawId: unknown) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  if (order.invoice?.number) throw conflict(`Invoice ${order.invoice.number} was already issued`);
  if (!order.totalAmount) throw conflict('Set the unit rate before issuing an invoice');
  const settings = await getSettings();
  const year = new Date().getFullYear();
  const seq = await nextSequence(`invoice-${year}`, 1);
  const number = `${settings.invoicePrefix}-${year}-${String(seq).padStart(4, '0')}`;
  order.set('invoice', { number, issuedAt: new Date(), issuedBy: user.id });
  await order.save();
  await audit(user, 'invoice.issued', 'Order', String(order._id), `Issued invoice ${number} for ${order.orderNo}`);
  return respond(order, user);
}

// ---------- private files ----------

/** Finds a stored order file the caller may download and how it should be served. */
export async function getOrderFile(user: AuthUser, rawId: unknown, storedName: string, downloadRequested: boolean) {
  const order = await loadOrderForUser(assertObjectId(rawId, 'Order'), user);
  const name = storedName;
  const file = [...order.files, ...order.artworks.map((a) => a.file)].find((f) => f.storedName === name);
  if (!file) throw notFound('File not found');
  const filePath = storedFilePath(file.storedName);
  if (!fs.existsSync(filePath)) throw notFound('File is missing from storage');
  const inline = isInlineSafe(file.mimeType) && !downloadRequested;
  return { filePath, inline, mimeType: file.mimeType, originalName: file.originalName };
}
