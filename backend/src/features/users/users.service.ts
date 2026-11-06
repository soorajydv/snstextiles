import bcrypt from 'bcryptjs';
import { User } from './user.model';
import { Customer } from '../customers/customer.model';
import type { AuthUser } from '../../middleware/auth';
import { roleExists } from '../roles/roles.service';
import { assertObjectId, badRequest, conflict, escapeRegex, notFound, pagination } from '../../lib/http';
import { audit } from '../audit/audit.service';
import { sendCustomerRegistrationEmail, sendUserWelcomeEmail } from '../../lib/mail';
import type { CreateUserInput, CustomerDetailsInput, UpdateUserInput } from './users.validation';

const toDto = (u: Record<string, any>) => ({
  id: String(u._id),
  name: u.name,
  username: u.username ?? '',
  email: u.email,
  role: u.role,
  phone: u.phone ?? '',
  active: u.active,
  customer: u.customer && typeof u.customer === 'object' && 'name' in u.customer
    ? { id: String(u.customer._id), name: u.customer.name }
    : null,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

async function resolveCustomerLink(
  role: string,
  customer: string | null | undefined,
  details: CustomerDetailsInput | undefined,
) {
  if (role !== 'customer') return null;
  if (customer) {
    assertObjectId(customer, 'Customer');
    if (!(await Customer.exists({ _id: customer }))) throw badRequest('customer: Customer record not found');
    if (details) await Customer.findByIdAndUpdate(customer, details, { runValidators: true });
    return customer;
  }
  if (!details) throw badRequest('customer: Add customer details for customer accounts');
  const created = await Customer.create(details);
  return String(created._id);
}

export async function listUsers(query: Record<string, string | undefined>) {
  const { page, limit, skip } = pagination(query as Record<string, unknown>, 50);
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.search?.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
    filter.$or = [{ name: rx }, { username: rx }, { email: rx }, { phone: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).populate('customer', 'name').sort({ role: 1, name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { users: users.map(toDto), total, page, limit };
}

export async function createUser(me: AuthUser, body: CreateUserInput) {
  if (!(await roleExists(body.role))) throw badRequest('role: Role not found');
  if (await User.exists({ username: body.username })) throw conflict('username: Username is already taken');
  const createsCustomer = body.role === 'customer' && !body.customer;
  const customer = await resolveCustomerLink(body.role, body.customer, body.customerDetails);
  const user = await User.create({
    name: body.name,
    username: body.username,
    email: body.email,
    phone: body.phone,
    role: body.role,
    customer,
    passwordHash: await bcrypt.hash(body.password, 10),
  });
  await audit(me, 'user.created', 'User', String(user._id), `Created ${body.role} account for ${body.name}`);
  const saved = await User.findById(user._id).populate('customer').lean();
  const customerRecord = saved?.customer && typeof saved.customer === 'object' && 'email' in saved.customer ? saved.customer as Record<string, any> : null;
  let emailSent = false;
  try {
    await sendUserWelcomeEmail({
      name: body.name,
      username: body.username,
      email: body.email,
      phone: body.phone,
      role: body.role,
      customer: saved?.customer && typeof saved.customer === 'object' && 'name' in saved.customer ? String(saved.customer.name) : '',
      password: body.password,
      customerDetails: customerRecord ? {
        contactPerson: String(customerRecord.contactPerson ?? ''),
        phone: String(customerRecord.phone ?? ''),
        email: String(customerRecord.email ?? ''),
        panNumber: String(customerRecord.panNumber ?? ''),
        address: String(customerRecord.address ?? ''),
        notes: String(customerRecord.notes ?? ''),
      } : undefined,
    });
    emailSent = true;
  } catch (error) {
    console.error(`Welcome email failed for ${body.email}`, error);
  }
  let customerEmailSent = false;
  if (createsCustomer && customerRecord?.email && String(customerRecord.email).toLowerCase() !== body.email.toLowerCase()) {
    try {
      await sendCustomerRegistrationEmail({
        name: String(customerRecord.name ?? body.name),
        contactPerson: String(customerRecord.contactPerson ?? ''),
        phone: String(customerRecord.phone ?? ''),
        email: String(customerRecord.email),
        panNumber: String(customerRecord.panNumber ?? ''),
        address: String(customerRecord.address ?? ''),
        notes: String(customerRecord.notes ?? ''),
        username: body.username,
        loginEmail: body.email,
        password: body.password,
      });
      customerEmailSent = true;
    } catch (error) {
      console.error(`Customer registration email failed for ${customerRecord.email}`, error);
    }
  }
  return { user: toDto(saved!), emailSent, customerEmailSent };
}

export async function updateUser(me: AuthUser, id: string, body: UpdateUserInput) {
  if (body.role && !(await roleExists(body.role))) throw badRequest('role: Role not found');
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  if (body.username && await User.exists({ username: body.username, _id: { $ne: id } })) throw conflict('username: Username is already taken');
  if (id === me.id && (body.active === false || (body.role && body.role !== user.role))) {
    throw badRequest('You cannot deactivate or change your own role');
  }
  const role = body.role ?? user.role;
  const customerInput = body.customer === undefined ? (user.customer ? String(user.customer) : null) : body.customer;
  const customer = await resolveCustomerLink(role, customerInput, body.customerDetails);
  if (body.name !== undefined) user.name = body.name;
  if (body.username !== undefined) user.username = body.username;
  if (body.phone !== undefined) user.phone = body.phone;
  if (body.active !== undefined) user.active = body.active;
  user.role = role;
  user.set('customer', customer);
  await user.save();
  await audit(me, 'user.updated', 'User', id, `Updated ${user.name} (${role}${user.active ? '' : ', deactivated'})`);
  const saved = await User.findById(id).populate('customer', 'name').lean();
  return { user: toDto(saved!) };
}

export async function resetUserPassword(me: AuthUser, id: string, password: string) {
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  await audit(me, 'user.password_reset', 'User', id, `Reset password for ${user.name}`);
  return { ok: true };
}

export async function deleteUser(me: AuthUser, id: string) {
  if (id === me.id) throw badRequest('You cannot delete your own account');
  const user = await User.findByIdAndDelete(id).lean();
  if (!user) throw notFound('User not found');
  await audit(me, 'user.deleted', 'User', id, `Deleted ${user.name}'s account`);
  return { ok: true };
}
