import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { Customer } from './customer.model';
import { Order } from '../orders/order.model';
import { User } from '../users/user.model';
import type { AuthUser } from '../../middleware/auth';
import { conflict, escapeRegex, notFound, pagination } from '../../lib/http';
import { audit } from '../audit/audit.service';
import { sendUserWelcomeEmail } from '../../lib/mail';
import type { CreateCustomerInput, UpdateCustomerInput } from './customers.validation';

/** Order count, value and payments per customer in one aggregation. */
async function totalsFor(ids: Types.ObjectId[]) {
  const rows = await Order.aggregate<{ _id: Types.ObjectId; orders: number; total: number; paid: number; active: number }>([
    { $match: { customer: { $in: ids } } },
    {
      $group: {
        _id: '$customer',
        orders: { $sum: 1 },
        total: { $sum: '$totalAmount' },
        paid: { $sum: '$amountPaid' },
        active: { $sum: { $cond: [{ $ne: ['$stage', 'delivered'] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

const toDto = (c: Record<string, any>, t?: { orders: number; total: number; paid: number; active: number }) => ({
  id: String(c._id),
  name: c.name,
  contactPerson: c.contactPerson,
  phone: c.phone,
  email: c.email,
  address: c.address,
  panNumber: c.panNumber,
  notes: c.notes,
  createdAt: c.createdAt,
  orderCount: t?.orders ?? 0,
  activeOrders: t?.active ?? 0,
  orderValue: t?.total ?? 0,
  paid: t?.paid ?? 0,
  outstanding: Math.max(0, (t?.total ?? 0) - (t?.paid ?? 0)),
});

export async function listCustomers(query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query, 50);
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const filter = search
    ? { $or: ['name', 'contactPerson', 'phone', 'email'].map((f) => ({ [f]: { $regex: escapeRegex(search), $options: 'i' } })) }
    : {};
  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ]);
  const totals = await totalsFor(customers.map((c) => c._id));
  return { customers: customers.map((c) => toDto(c, totals.get(String(c._id)))), total, page, limit };
}

export async function getCustomer(id: string) {
  const customer = await Customer.findById(id).lean();
  if (!customer) throw notFound('Customer not found');
  const totals = await totalsFor([customer._id]);
  const orders = await Order.find({ customer: id })
    .select('orderNo teamName quantity stage status dueDate totalAmount amountPaid createdAt')
    .sort({ createdAt: -1 })
    .lean();
  return {
    customer: toDto(customer, totals.get(id)),
    orders: orders.map((o) => ({ ...o, id: String(o._id), _id: undefined, balance: Math.max(0, o.totalAmount - o.amountPaid) })),
  };
}

export async function createCustomer(me: AuthUser, body: CreateCustomerInput) {
  if (await User.exists({ email: body.email })) throw conflict('email: An account already exists with this email');
  if (await User.exists({ username: body.username })) throw conflict('username: Username is already taken');
  const { username, password, ...customerData } = body;
  const customer = await Customer.create(customerData);
  let user;
  try {
    user = await User.create({
      name: body.contactPerson || body.name,
      username,
      email: body.email,
      phone: body.phone,
      role: 'customer',
      customer: customer._id,
      passwordHash: await bcrypt.hash(password, 10),
    });
  } catch (error) {
    await customer.deleteOne();
    throw error;
  }
  await audit(me, 'customer.created', 'Customer', String(customer._id), `Added customer ${customer.name}`);
  await audit(me, 'user.created', 'User', String(user._id), `Created customer account for ${customer.name}`);
  let emailSent = false;
  try {
    await sendUserWelcomeEmail({
      name: body.contactPerson || body.name,
      username,
      email: body.email,
      phone: body.phone,
      role: 'customer',
      customer: body.name,
      password,
      customerDetails: {
        contactPerson: body.contactPerson,
        phone: body.phone,
        email: body.email,
        panNumber: body.panNumber,
        address: body.address,
        notes: body.notes,
      },
    });
    emailSent = true;
  } catch (error) {
    console.error(`Customer welcome email failed for ${body.email}`, error);
  }
  return { customer: toDto(customer.toObject()), user: { id: String(user._id), username: user.username, email: user.email }, emailSent };
}

export async function updateCustomer(me: AuthUser, id: string, body: UpdateCustomerInput) {
  const customer = await Customer.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true }).lean();
  if (!customer) throw notFound('Customer not found');
  await audit(me, 'customer.updated', 'Customer', id, `Updated customer ${customer.name}`);
  const totals = await totalsFor([customer._id]);
  return { customer: toDto(customer, totals.get(id)) };
}

export async function deleteCustomer(me: AuthUser, id: string) {
  if (await Order.exists({ customer: id })) throw conflict('This customer has orders and cannot be deleted');
  if (await User.exists({ customer: id })) throw conflict('Remove the linked customer login before deleting');
  const customer = await Customer.findByIdAndDelete(id).lean();
  if (!customer) throw notFound('Customer not found');
  await audit(me, 'customer.deleted', 'Customer', id, `Deleted customer ${customer.name}`);
  return { ok: true };
}
