import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/user.model';
import { Customer } from '../models/Customer';
import { currentUser, requirePermission } from '../middleware/auth';
import { roleExists } from '../lib/roles';
import { assertObjectId, badRequest, conflict, escapeRegex, notFound, pagination, parse } from '../lib/http';
import { audit } from '../lib/audit';
import { sendUserWelcomeEmail } from '../lib/mail';

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

async function checkCustomerLink(role: string, customer: string | null | undefined) {
  if (role !== 'customer') return null;
  if (!customer) throw badRequest('customer: Customer accounts must be linked to a customer record');
  assertObjectId(customer, 'Customer');
  if (!(await Customer.exists({ _id: customer }))) throw badRequest('customer: Customer record not found');
  return customer;
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
});

router.post('/', async (req, res) => {
  const me = currentUser(req);
  const body = parse(createSchema, req.body);
  if (!(await roleExists(body.role))) throw badRequest('role: Role not found');
  if (await User.exists({ username: body.username })) throw conflict('username: Username is already taken');
  const customer = await checkCustomerLink(body.role, body.customer);
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
  const saved = await User.findById(user._id).populate('customer', 'name').lean();
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
    });
    emailSent = true;
  } catch (error) {
    console.error(`Welcome email failed for ${body.email}`, error);
  }
  res.status(201).json({ user: toDto(saved!), emailSent });
});

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.string().trim().toLowerCase().min(2).max(40).optional(),
  phone: z.string().trim().max(30).optional(),
  active: z.boolean().optional(),
  customer: z.string().nullish(),
});

router.patch('/:id', async (req, res) => {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'User');
  const body = parse(updateSchema, req.body);
  if (body.role && !(await roleExists(body.role))) throw badRequest('role: Role not found');
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  if (id === me.id && (body.active === false || (body.role && body.role !== user.role))) {
    throw badRequest('You cannot deactivate or change your own role');
  }
  const role = body.role ?? user.role;
  const customerInput = body.customer === undefined ? (user.customer ? String(user.customer) : null) : body.customer;
  const customer = await checkCustomerLink(role, customerInput);
  if (body.name !== undefined) user.name = body.name;
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
