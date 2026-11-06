import { InventoryItem, StockMovement, INVENTORY_CATEGORIES } from './inventory.model';
import { Supplier } from './supplier.model';
import { Order } from '../orders/order.model';
import type { AuthUser } from '../../middleware/auth';
import { assertObjectId, badRequest, conflict, escapeRegex, notFound, pagination } from '../../lib/http';
import { audit } from '../audit/audit.service';
import type { ItemInput, ItemUpdateInput, MovementInput, SupplierInput } from './inventory.validation';

export async function listSuppliers() {
  const suppliers = await Supplier.find({ active: true }).sort({ name: 1 }).lean();
  return { suppliers: suppliers.map((supplier) => ({ id: String(supplier._id), name: supplier.name, contactPerson: supplier.contactPerson, phone: supplier.phone, email: supplier.email, address: supplier.address, panNumber: supplier.panNumber })) };
}

export async function createSupplier(user: AuthUser, body: SupplierInput) {
  const supplier = await Supplier.create(body);
  await audit(user, 'inventory.supplier_created', 'Supplier', String(supplier._id), `Added supplier ${supplier.name}`);
  return { supplier: { id: String(supplier._id), name: supplier.name } };
}

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

export async function listItems(rawQuery: Record<string, unknown>) {
  const { page, limit, skip } = pagination(rawQuery, 50);
  const includeInactive = rawQuery.all === '1';
  const filter: Record<string, unknown> = includeInactive ? {} : { active: true };
  const query = rawQuery as Record<string, string | undefined>;
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
  return { items: items.map(itemDto), total, page, limit, activeTotal, lowStockTotal, categories: categories.sort() };
}

export async function createItem(user: AuthUser, body: ItemInput) {
  const item = await InventoryItem.create({ ...body, supplier: body.supplierId || null, onHand: body.openingStock });
  if (body.openingStock > 0) {
    await StockMovement.create({ item: item._id, type: 'in', change: body.openingStock, balanceAfter: body.openingStock, note: 'Opening stock', by: user.id, byName: user.name });
  }
  await audit(user, 'inventory.item_created', 'InventoryItem', String(item._id), `Added material ${item.name} (${item.sku})`);
  return { item: itemDto(item.toObject()) };
}

export async function updateItem(user: AuthUser, id: string, body: ItemUpdateInput) {
  const { supplierId, ...itemFields } = body;
  const item = await InventoryItem.findByIdAndUpdate(id, { ...itemFields, ...(supplierId !== undefined ? { supplier: supplierId || null } : {}) }, { returnDocument: 'after', runValidators: true }).populate('supplier', 'name').lean();
  if (!item) throw notFound('Item not found');
  await audit(user, 'inventory.item_updated', 'InventoryItem', id, `Updated material ${item.name}`);
  return { item: itemDto(item) };
}

export async function recordMovement(user: AuthUser, id: string, body: MovementInput) {
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
  return { item: itemDto(updated!), movement: movementDto(movement.toObject()) };
}

export async function listMovements(query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query, 20);
  const filter: Record<string, unknown> = {};
  if (typeof query.item === 'string') filter.item = assertObjectId(query.item, 'Item');
  const [movements, total] = await Promise.all([
    StockMovement.find(filter).populate('item', 'name sku unit').populate('order', 'orderNo').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StockMovement.countDocuments(filter),
  ]);
  return { movements: movements.map(movementDto), total, page, limit };
}
