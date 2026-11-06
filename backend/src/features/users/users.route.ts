import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from './user.model';
import { Customer } from '../customers/customer.model';
import { currentUser, requirePermission } from '../../middleware/auth';
import { roleExists } from '../roles/roles.service';
import { assertObjectId, badRequest, conflict, escapeRegex, notFound, pagination, parse } from '../../lib/http';
import { audit } from '../audit/audit.service';
import { sendCustomerRegistrationEmail, sendUserWelcomeEmail } from '../../lib/mail';

const router = Router();
router.use(requirePermission('users.manage'));

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

const customerDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Customer / club name is required'),
  contactPerson: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.union([z.email(), z.literal('')]).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  panNumber: z.string().trim().max(30).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
});

async function resolveCustomerLink(
  role: string,
  customer: string | null | undefined,
  details: z.infer<typeof customerDetailsSchema> | undefined,
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

router.get('/', async (req, res) => {
  const { page, limit, skip } = pagination(req.query as Record<string, unknown>, 50);
  const query = req.query as Record<string, string | undefined>;
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
  res.json({ users: users.map(toDto), total, page, limit });
});

const createSchema = z.object({
  name: z.string().trim().min(2),
  username: z.string().trim().toLowerCase().min(3, 'Username must be at least 3 characters').max(40).regex(/^[a-z0-9._-]+$/, 'Use only letters, numbers, dots, underscores or hyphens'),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'Use at least 8 characters'),
  role: z.string().trim().toLowerCase().min(2).max(40),
  phone: z.string().trim().max(30).optional().default(''),
  customer: z.string().nullish(),
  customerDetails: customerDetailsSchema.optional(),
});

router.post('/', async (req, res) => {
  const me = currentUser(req);
  const body = parse(createSchema, req.body);
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
  res.status(201).json({ user: toDto(saved!), emailSent, customerEmailSent });
});

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  username: z.string().trim().toLowerCase().min(3, 'Username must be at least 3 characters').max(40).regex(/^[a-z0-9._-]+$/, 'Use only letters, numbers, dots, underscores or hyphens').optional(),
  role: z.string().trim().toLowerCase().min(2).max(40).optional(),
  phone: z.string().trim().max(30).optional(),
  active: z.boolean().optional(),
  customer: z.string().nullish(),
  customerDetails: customerDetailsSchema.optional(),
});

router.patch('/:id', async (req, res) => {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'User');
  const body = parse(updateSchema, req.body);
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
  res.json({ user: toDto(saved!) });
});

router.post('/:id/reset-password', async (req, res) => {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'User');
  const { password } = parse(z.object({ password: z.string().min(8, 'Use at least 8 characters') }), req.body);
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  await audit(me, 'user.password_reset', 'User', id, `Reset password for ${user.name}`);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'User');
  if (id === me.id) throw badRequest('You cannot delete your own account');
  const user = await User.findByIdAndDelete(id).lean();
  if (!user) throw notFound('User not found');
  await audit(me, 'user.deleted', 'User', id, `Deleted ${user.name}'s account`);
  res.json({ ok: true });
});

export default router;
