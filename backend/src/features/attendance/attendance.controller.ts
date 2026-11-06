import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { parse } from '../../lib/http';
import { approveCheckIn, checkIn, checkOut, exportAttendance, listAttendance, rejectCheckIn } from './attendance.service';
import { rejectionSchema } from './attendance.validation';

export async function listAttendanceController(req: Request, res: Response) {
  const result = await listAttendance(currentUser(req), req.query as Record<string, unknown>);
  res.json({ attendance: result.records, total: result.total, page: result.page, limit: result.limit, users: result.users });
}

const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function formatWorkedHours(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export async function exportAttendanceController(req: Request, res: Response) {
  const records = await exportAttendance(currentUser(req), req.query as Record<string, unknown>);
  const header = ['Employee', 'Email', 'Role', 'Check in', 'Check out', 'Worked hrs', 'Status', 'Approved by', 'Rejection reason'];
  const rows = records.map((record) => [record.user.name, record.user.email, record.user.role, record.checkInAt, record.checkOutAt ?? '', formatWorkedHours(record.workedMinutes), record.status, record.approvedBy?.name ?? '', record.rejectionReason]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\ufeff' + csv);
}

export async function checkInController(req: Request, res: Response) {
  res.status(201).json({ attendance: await checkIn(currentUser(req)) });
}

export async function checkOutController(req: Request, res: Response) {
  res.json({ attendance: await checkOut(currentUser(req)) });
}

export async function approveCheckInController(req: Request, res: Response) {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
  res.json({ attendance: await approveCheckIn(currentUser(req), id) });
}

export async function rejectCheckInController(req: Request, res: Response) {
  const { reason } = parse(rejectionSchema, req.body);
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
  res.json({ attendance: await rejectCheckIn(currentUser(req), id, reason) });
}
