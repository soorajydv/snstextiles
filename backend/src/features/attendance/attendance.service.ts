import { Types } from 'mongoose';
import { audit } from '../../lib/audit';
import { badRequest, conflict, escapeRegex, notFound, pagination } from '../../lib/http';
import { User } from '../../models/user.model';
import type { AuthUser } from '../../middleware/auth';
import { Attendance, type AttendanceStatus } from './attendance.model';

function toDto(record: Record<string, any>) {
  const user = record.user && typeof record.user === 'object' ? record.user : null;
  const approver = record.approvedBy && typeof record.approvedBy === 'object' ? record.approvedBy : null;
  const workedMinutes = record.status === 'approved' && record.checkOutAt
    ? Math.max(0, Math.floor((new Date(record.checkOutAt).getTime() - new Date(record.checkInAt).getTime()) / 60000))
    : 0;
  return {
    id: String(record._id),
    user: {
      id: String(user?._id ?? record.user),
      name: user?.name ?? 'Unknown user',
      email: user?.email ?? '',
      role: user?.role ?? '',
    },
    checkInAt: record.checkInAt,
    checkOutAt: record.checkOutAt,
    status: record.status as AttendanceStatus,
    approvedAt: record.approvedAt,
    approvedBy: approver ? { id: String(approver._id), name: approver.name } : null,
    rejectionReason: record.rejectionReason ?? '',
    createdAt: record.createdAt,
    workedMinutes,
  };
}

function dateRange(query: Record<string, string | undefined>) {
  const filter: Record<string, unknown> = {};
  if (query.from) {
    const from = new Date(`${query.from}T00:00:00`);
    if (Number.isNaN(from.getTime())) throw badRequest('from: Invalid start date');
    filter.$gte = from;
  }
  if (query.to) {
    const to = new Date(`${query.to}T23:59:59.999`);
    if (Number.isNaN(to.getTime())) throw badRequest('to: Invalid end date');
    filter.$lte = to;
  }
  if (Object.keys(filter).length) return { checkInAt: filter };
  return {};
}

function sortFor(query: Record<string, string | undefined>) {
  const direction = query.direction === 'asc' ? 1 : -1;
  const field = query.sort === 'checkOut' ? 'checkOutAt' : query.sort === 'status' ? 'status' : 'checkInAt';
  return { [field]: direction } as Record<string, 1 | -1>;
}

async function attendanceFilter(user: AuthUser, query: Record<string, string | undefined>) {
  const canReviewAll = user.permissions.includes('attendance.approve');
  const filter: Record<string, unknown> = canReviewAll ? {} : { user: user.id };
  if (query.userId && canReviewAll) {
    if (!Types.ObjectId.isValid(query.userId)) throw badRequest('userId: Invalid user');
    filter.user = query.userId;
  }
  if (query.status && ['pending', 'approved', 'rejected'].includes(query.status)) filter.status = query.status;
  if (query.search?.trim() && canReviewAll) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').limit(200).lean();
    const matchingUsers = { user: { $in: users.map((item) => item._id) } };
    if (filter.user) filter.$and = [{ user: filter.user }, matchingUsers];
    else filter.user = matchingUsers.user;
  }
  const range = dateRange(query);
  if (range.checkInAt) filter.checkInAt = range.checkInAt;
  return { filter, canReviewAll };
}

export async function listAttendance(user: AuthUser, query: Record<string, unknown>) {
  const q = query as Record<string, string | undefined>;
  const { filter, canReviewAll } = await attendanceFilter(user, q);
  const { page, limit, skip } = pagination(query, canReviewAll ? 50 : 30);
  const [records, total] = await Promise.all([
    Attendance.find(filter).populate('user', 'name email role').populate('approvedBy', 'name').sort(sortFor(q)).skip(skip).limit(limit).lean(),
    Attendance.countDocuments(filter),
  ]);
  const users = canReviewAll ? await User.find({ active: true, role: { $ne: 'customer' } }).select('name email role').sort({ name: 1 }).lean() : [];
  return { records: records.map(toDto), total, page, limit, users: users.map((item) => ({ id: String(item._id), name: item.name, email: item.email, role: item.role })) };
}

export async function exportAttendance(user: AuthUser, query: Record<string, unknown>) {
  const q = query as Record<string, string | undefined>;
  const { filter } = await attendanceFilter(user, q);
  const records = await Attendance.find(filter).populate('user', 'name email role').populate('approvedBy', 'name').sort(sortFor(q)).lean();
  return records.map(toDto);
}

export async function checkIn(user: AuthUser) {
  const openRecord = await Attendance.exists({ user: user.id, checkOutAt: null, status: { $in: ['pending', 'approved'] } });
  if (openRecord) throw conflict('You already have an open attendance record');

  const record = await Attendance.create({ user: user.id, status: 'pending' });
  await audit(user, 'attendance.checkin_requested', 'Attendance', String(record._id), `${user.name} requested check-in approval`);
  const saved = await Attendance.findById(record._id).populate('user', 'name email role').lean();
  return toDto(saved!);
}

export async function checkOut(user: AuthUser) {
  const record = await Attendance.findOne({ user: user.id, status: 'approved', checkOutAt: null }).sort({ checkInAt: -1 });
  if (!record) {
    const pending = await Attendance.exists({ user: user.id, status: 'pending', checkOutAt: null });
    if (pending) throw badRequest('Your check-in is waiting for admin approval');
    throw badRequest('You do not have an approved check-in to check out from');
  }
  record.checkOutAt = new Date();
  await record.save();
  await audit(user, 'attendance.checkout', 'Attendance', String(record._id), `${user.name} checked out`);
  const saved = await Attendance.findById(record._id).populate('user', 'name email role').populate('approvedBy', 'name').lean();
  return toDto(saved!);
}

export async function approveCheckIn(admin: AuthUser, id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound('Attendance record not found');
  const record = await Attendance.findById(id);
  if (!record) throw notFound('Attendance record not found');
  if (record.status !== 'pending') throw badRequest('Only pending check-ins can be approved');
  record.status = 'approved';
  record.approvedAt = new Date();
  record.approvedBy = new Types.ObjectId(admin.id);
  record.rejectionReason = '';
  await record.save();
  const employee = await User.findById(record.user).select('name').lean();
  await audit(admin, 'attendance.checkin_approved', 'Attendance', id, `Approved check-in for ${employee?.name ?? 'user'}`);
  const saved = await Attendance.findById(id).populate('user', 'name email role').populate('approvedBy', 'name').lean();
  return toDto(saved!);
}

export async function rejectCheckIn(admin: AuthUser, id: string, reason: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound('Attendance record not found');
  const record = await Attendance.findById(id);
  if (!record) throw notFound('Attendance record not found');
  if (record.status !== 'pending') throw badRequest('Only pending check-ins can be rejected');
  record.status = 'rejected';
  record.rejectionReason = reason;
  await record.save();
  const employee = await User.findById(record.user).select('name').lean();
  await audit(admin, 'attendance.checkin_rejected', 'Attendance', id, `Rejected check-in for ${employee?.name ?? 'user'}`);
  const saved = await Attendance.findById(id).populate('user', 'name email role').populate('approvedBy', 'name').lean();
  return toDto(saved!);
}
