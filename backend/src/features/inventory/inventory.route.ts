import { Router } from 'express';
import { z } from 'zod';
import { InventoryItem, StockMovement, INVENTORY_CATEGORIES } from './inventory.model';
import { Order } from '../orders/order.model';
import { currentUser, requireAnyPermission, requirePermission } from '../../middleware/auth';
import { assertObjectId, badRequest, conflict, escapeRegex, notFound, pagination, parse } from '../../lib/http';
import { audit } from '../audit/audit.service';
import { Supplier } from './supplier.model';

const router = Router();
router.use(requirePermission('inventory.view'));

router.get('/suppliers', async (_req, res) => {
  const suppliers = await Supplier.find({ active: true }).sort({ name: 1 }).lean();
  res.json({ suppliers: suppliers.map((supplier) => ({ id: String(supplier._id), name: supplier.name, contactPerson: supplier.contactPerson, phone: supplier.phone, email: supplier.email, address: supplier.address, panNumber: supplier.panNumber })) });
});

const supplierSchema = z.object({ name: z.string().trim().min(2).max(120), contactPerson: z.string().trim().max(120).optional().default(''), phone: z.string().trim().max(40).optional().default(''), email: z.string().trim().email().optional().or(z.literal('')).default(''), address: z.string().trim().max(300).optional().default(''), panNumber: z.string().trim().max(30).optional().default('') });

router.post('/suppliers', requirePermission('inventory.manage'), async (req, res) => {
  const user = currentUser(req);
  const supplier = await Supplier.create(parse(supplierSchema, req.body));
  await audit(user, 'inventory.supplier_created', 'Supplier', String(supplier._id), `Added supplier ${supplier.name}`);
  res.status(201).json({ supplier: { id: String(supplier._id), name: supplier.name } });
});

const itemDto = (i: Record<string, any>) => ({
  id: String(i._id),
  name: i.name,
  sku: i.sku,
  category: i.category,
  unit: i.unit,
  onHand: i.onHand,
  reorderLevel: i.reorderLevel,
  active: i.active,
  supplier: i.supplier && typeof i.supplier === 'object' && 'name' in i.supplier ? { id: String(i.supplier._id), name: i.supplier.name } : null,
  lowStock: i.onHand < i.reorderLevel,
  updatedAt: i.updatedAt,
});

const movementDto = (m: Record<string, any>) => ({
  id: String(m._id),
  item: m.item && typeof m.item === 'object' && 'name' in m.item ? { id: String(m.item._id), name: m.item.name, sku: m.item.sku, unit: m.item.unit } : { id: String(m.item) },
  type: m.type,
  change: m.change,
  balanceAfter: m.balanceAfter,
  order: m.order && typeof m.order === 'object' && 'orderNo' in m.order ? { id: String(m.order._id), orderNo: m.order.orderNo } : null,
  note: m.note,
  byName: m.byName,
  createdAt: m.createdAt,
});

router.get('/items', async (req, res) => {
  const { page, limit, skip } = pagination(req.query as Record<string, unknown>, 50);
  const includeInactive = req.query.all === '1';
  const filter: Record<string, unknown> = includeInactive ? {} : { active: true };
  const query = req.query as Record<string, string | undefined>;
  if (query.category && (INVENTORY_CATEGORIES as readonly string[]).includes(query.category)) filter.category = query.category;
  if (query.search?.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
    filter.$or = [{ name: rx }, { sku: rx }];
  }
  if (query.stock === 'low') filter.$expr = { $lt: ['$onHand', '$reorderLevel'] };
  const sort: Record<string, 1 | -1> = query.sort === 'stock' ? { onHand: 1, name: 1 } : query.sort === 'updated' ? { updatedAt: -1, name: 1 } : { category: 1, name: 1 };
  const [items, total, activeTotal, lowStockTotal, categories] = await Promise.all([
    InventoryItem.find(filter).populate('supplier', 'name').sort(sort).skip(skip).limit(limit).lean(),
    InventoryItem.countDocuments(filter),
    InventoryItem.countDocuments({ ...filter, active: true }),
    InventoryItem.countDocuments({ ...(includeInactive ? {} : { active: true }), $expr: { $lt: ['$onHand', '$reorderLevel'] } }),
    InventoryItem.distinct('category', includeInactive ? {} : { active: true }),
  ]);
  res.json({ items: items.map(itemDto), total, page, limit, activeTotal, lowStockTotal, categories: categories.sort() });
});

const itemSchema = z.object({
  name: z.string().trim().min(2),
  sku: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9-_]+$/, 'Use letters, numbers and dashes only'),
  category: z.enum(INVENTORY_CATEGORIES).default('Other'),
  unit: z.string().trim().min(1).max(20),
  reorderLevel: z.coerce.number().min(0).default(0),
  openingStock: z.coerce.number().min(0).optional().default(0),
  supplierId: z.string().nullish(),
});

router.post('/items', requirePermission('inventory.manage'), async (req, res) => {
  const user = currentUser(req);
  const body = parse(itemSchema, req.body);
  const item = await InventoryItem.create({ ...body, supplier: body.supplierId || null, onHand: body.openingStock });
  if (body.openingStock > 0) {
    await StockMovement.create({ item: item._id, type: 'in', change: body.openingStock, balanceAfter: body.openingStock, note: 'Opening stock', by: user.id, byName: user.name });
  }
  await audit(user, 'inventory.item_created', 'InventoryItem', String(item._id), `Added material ${item.name} (${item.sku})`);
  res.status(201).json({ item: itemDto(item.toObject()) });
});

router.patch('/items/:id', requirePermission('inventory.manage'), async (req, res) => {
  const user = currentUser(req);
  const id = assertObjectId(req.params.id, 'Item');
  const body = parse(itemSchema.omit({ openingStock: true }).partial().extend({ active: z.boolean().optional() }), req.body);
  const { supplierId, ...itemFields } = body;
  const item = await InventoryItem.findByIdAndUpdate(id, { ...itemFields, ...(supplierId !== undefined ? { supplier: supplierId || null } : {}) }, { returnDocument: 'after', runValidators: true }).populate('supplier', 'name').lean();
  if (!item) throw notFound('Item not found');
  await audit(user, 'inventory.item_updated', 'InventoryItem', id, `Updated material ${item.name}`);
  res.json({ item: itemDto(item) });
});

const movementSchema = z.object({
  type: z.enum(['in', 'out', 'adjust']),
  /** For in/out: quantity moved. For adjust: the counted quantity on hand. */
  quantity: z.coerce.number().min(0),
  note: z.string().trim().max(300).optional().default(''),
  orderNo: z.string().trim().optional(),
});

router.post('/items/:id/movements', requireAnyPermission('inventory.move', 'inventory.adjust'), async (req, res) => {
  const user = currentUser(req);
  const id = assertObjectId(req.params.id, 'Item');
  const body = parse(movementSchema, req.body);
  if (body.type !== 'adjust' && body.quantity <= 0) throw badRequest('quantity: Enter a quantity greater than zero');
  if (body.type === 'adjust' && !user.permissions.includes('inventory.adjust')) throw conflict('You do not have permission to make stock count adjustments');
  if (body.type === 'adjust' && !body.note) throw badRequest('note: Give a reason for the adjustment');

  let orderId = null;
  if (body.orderNo) {
    const order = await Order.findOne({ orderNo: body.orderNo.toUpperCase() }).select('_id').lean();
    if (!order) throw badRequest(`orderNo: Order ${body.orderNo} not found`);
    orderId = order._id;
  }

  const existing = await InventoryItem.findById(id).lean();
  if (!existing) throw notFound('Item not found');

  let updated;
  if (body.type === 'adjust') {
    updated = await InventoryItem.findByIdAndUpdate(id, { $set: { onHand: body.quantity } }, { returnDocument: 'after' }).lean();
  } else {
    const change = body.type === 'in' ? body.quantity : -body.quantity;
    // Conditional update prevents stock from going negative under concurrent issues.
    const guard = body.type === 'out' ? { onHand: { $gte: body.quantity } } : {};
    updated = await InventoryItem.findOneAndUpdate({ _id: id, ...guard }, { $inc: { onHand: change } }, { returnDocument: 'after' }).lean();
    if (!updated) throw conflict(`Only ${existing.onHand} ${existing.unit} available`);
  }
  const change = body.type === 'adjust' ? body.quantity - existing.onHand : body.type === 'in' ? body.quantity : -body.quantity;
  const movement = await StockMovement.create({
    item: id, type: body.type, change, balanceAfter: updated!.onHand, order: orderId, note: body.note, by: user.id, byName: user.name,
  });
  await audit(user, `inventory.stock_${body.type}`, 'InventoryItem', id, `${body.type.toUpperCase()} ${change > 0 ? '+' : ''}${change} ${existing.unit} ${existing.name}`);
  res.status(201).json({ item: itemDto(updated!), movement: movementDto(movement.toObject()) });
});

router.get('/movements', async (req, res) => {
  const { page, limit, skip } = pagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.item === 'string') filter.item = assertObjectId(req.query.item, 'Item');
  const [movements, total] = await Promise.all([
    StockMovement.find(filter).populate('item', 'name sku unit').populate('order', 'orderNo').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StockMovement.countDocuments(filter),
  ]);
  res.json({ movements: movements.map(movementDto), total, page, limit });
});

export default router;
