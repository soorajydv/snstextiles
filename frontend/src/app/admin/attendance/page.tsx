'use client';

import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, Empty, Field, Modal, Notice, PageHeader, Spinner, StatCard, errorMessage } from '@/components/ui';
import { appPath } from '@/lib/paths';
import { fmtDateTime } from '@/lib/format';
import type { AttendanceRecord } from '@/lib/types';

type SortField = 'checkIn' | 'checkOut' | 'status';
type UserOption = { id: string; name: string; email: string; role: string };
type AttendanceResponse = { attendance: AttendanceRecord[]; total: number; page: number; limit: number; users: UserOption[] };

function dateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function statusLabel(record: AttendanceRecord) { if (record.status === 'pending') return 'Pending approval'; if (record.status === 'rejected') return 'Rejected'; return record.checkOutAt ? 'Checked out' : 'Checked in'; }

export default function AttendancePage() {
  const { user, meta } = useAuth();
  const toast = useToast();
  const isReviewer = meta.permissions.includes('attendance.approve');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState(() => dateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => dateValue(new Date()));
  const [sort, setSort] = useState<SortField>('checkIn');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<AttendanceRecord | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({ from, to, userId, status, sort, direction });

  useEffect(() => setPage(1), [search, status, userId, from, to, sort, direction]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  const params = new URLSearchParams({ page: String(page), limit: isReviewer ? '50' : '30', sort, direction });
  if (search.trim() && isReviewer) params.set('search', search.trim());
  if (status) params.set('status', status);
  if (userId && isReviewer) params.set('userId', userId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data, error, reload } = useApi<AttendanceResponse>(`/attendance?${params}`);
  const currentAttendance = useApi<AttendanceResponse>(`/attendance?limit=50&userId=${user.id}`);
  const current = currentAttendance.data?.attendance.find((record) => !record.checkOutAt && ['pending', 'approved'].includes(record.status));
  const canCheckIn = meta.permissions.includes('attendance.checkin');
  const canCheckOut = meta.permissions.includes('attendance.checkout');

  async function action(path: string, message: string) {
    setBusy(true);
    try { await api(path, { method: 'POST' }); toast(message); await Promise.all([reload(), currentAttendance.reload()]); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }

  function openExport() { setExportFilters({ from, to, userId, status, sort, direction }); setExportOpen(true); }
  function downloadExport(event: React.FormEvent) {
    event.preventDefault();
    const exportParams = new URLSearchParams({ sort: exportFilters.sort, direction: exportFilters.direction });
    if (exportFilters.from) exportParams.set('from', exportFilters.from);
    if (exportFilters.to) exportParams.set('to', exportFilters.to);
    if (exportFilters.status) exportParams.set('status', exportFilters.status);
    if (exportFilters.userId && isReviewer) exportParams.set('userId', exportFilters.userId);
    if (search.trim() && isReviewer) exportParams.set('search', search.trim());
    window.location.href = appPath(`/api/attendance/export.csv?${exportParams}`);
    setExportOpen(false);
  }

  const records = data?.attendance ?? [];
  const summary = { total: data?.total ?? 0, worked: records.reduce((sum, record) => sum + workedMinutes(record, now), 0), pending: records.filter((record) => record.status === 'pending').length, open: records.filter((record) => record.status === 'approved' && !record.checkOutAt).length };
  const users = data?.users ?? [];
  const exportUserOptions = users.length ? users : (currentAttendance.data?.users ?? []);

  return <div className="attendance-page">
    <PageHeader eyebrow="TIME & ATTENDANCE" title="Attendance" subtitle={isReviewer ? 'Review check-ins and explore attendance history for every employee.' : 'Request check-in approval before starting your shift, then check out when you leave.'} actions={<div className="header-actions">
      {isReviewer && <button className="btn" onClick={openExport}>⇩ Export history</button>}
      {current ? (current.status === 'approved' && canCheckOut ? <button className="btn primary" disabled={busy} onClick={() => action('/attendance/check-out', 'Checked out successfully')}>Check out</button> : <Badge>{current.status === 'pending' ? 'Waiting for admin approval' : 'Check-out unavailable'}</Badge>) : canCheckIn ? <button className="btn primary" disabled={busy} onClick={() => action('/attendance/check-in', 'Check-in request sent for approval')}>Check in</button> : <Badge>Check-in unavailable</Badge>}
    </div>} />
    {error && <Notice tone="error">{error}</Notice>}
    {isReviewer && <div className="stats-grid"><StatCard label="Matching records" value={summary.total} note="For the selected filters" icon="◷" /><StatCard label="Worked time shown" value={formatMinutes(summary.worked)} note="Current page" icon="✓" /><StatCard label="Pending approvals" value={summary.pending} note="Needs review" icon="!" tone={summary.pending ? 'amber' : undefined} /><StatCard label="Open shifts" value={summary.open} note="Awaiting check-out" icon="◷" tone={summary.open ? 'amber' : undefined} /></div>}
    <div className="attendance-filters toolbar" style={{ alignItems: 'end' }}>
      {isReviewer && <div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" aria-label="Search attendance" /></div>}
      {isReviewer && <label className="field"><span>Employee</span><select value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">All employees</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="field"><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label className="field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="pending">Pending approval</option><option value="approved">Approved / checked out</option><option value="rejected">Rejected</option></select></label>
      <label className="field"><span>Sort by</span><select value={sort} onChange={(e) => setSort(e.target.value as SortField)}><option value="checkIn">Check-in time</option><option value="checkOut">Check-out time</option><option value="status">Status</option></select></label>
      <button className="btn" onClick={() => setDirection(direction === 'desc' ? 'asc' : 'desc')}>{direction === 'desc' ? '↓ Newest' : '↑ Oldest'}</button>
    </div>
    {!data ? <Spinner /> : <section className="attendance-history card flush"><div className="attendance-history-head"><div><strong>Attendance history</strong><span>Review check-ins, working hours, and approvals.</span></div><span className="muted small">{data.total} {data.total === 1 ? 'record' : 'records'}</span></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Check in</th><th>Check out</th><th>Worked hrs</th><th>Status</th><th>Approved by</th>{isReviewer && <th>Actions</th>}</tr></thead><tbody>
      {records.map((record) => <tr key={record.id}><td><strong>{record.user.name}</strong><div className="muted small">{record.user.email}</div></td><td>{fmtDateTime(record.checkInAt)}</td><td>{record.checkOutAt ? fmtDateTime(record.checkOutAt) : <span className="muted">—</span>}</td><td>{formatMinutes(workedMinutes(record, now))}</td><td><Badge>{statusLabel(record)}</Badge>{record.rejectionReason && <div className="muted small" style={{ marginTop: 4 }}>{record.rejectionReason}</div>}</td><td>{record.approvedBy?.name ?? <span className="muted">—</span>}</td>{isReviewer && <td>{record.status === 'pending' ? <><button className="btn small primary" onClick={() => action(`/attendance/${record.id}/approve`, 'Check-in approved')}>Approve</button>{' '}<button className="btn small danger" onClick={() => setRejecting(record)}>Reject</button></> : <span className="muted small">No action</span>}</td>}</tr>)}
    </tbody></table>{!records.length && <Empty>No attendance records match these filters.</Empty>}</div></section>}
    {data && data.total > data.limit && <div className="toolbar" style={{ marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}><button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button><span className="small muted">Page {page} of {Math.ceil(data.total / data.limit)}</span><button className="btn small" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => setPage(page + 1)}>Next →</button></div>}
    {rejecting && <RejectModal record={rejecting} onClose={() => setRejecting(null)} onSaved={() => { setRejecting(null); reload(); }} />}
    {exportOpen && <ExportModal filters={exportFilters} users={exportUserOptions} onChange={setExportFilters} onClose={() => setExportOpen(false)} onSubmit={downloadExport} />}
  </div>;
}

function workedMinutes(record: AttendanceRecord, now: number) {
  if (record.status !== 'approved') return 0;
  if (record.workedMinutes && record.workedMinutes > 0) return record.workedMinutes;
  return Math.max(0, Math.floor(((record.checkOutAt ? new Date(record.checkOutAt).getTime() : now) - new Date(record.checkInAt).getTime()) / 60_000));
}
function formatMinutes(minutes: number) { return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`; }

function RejectModal({ record, onClose, onSaved }: { record: AttendanceRecord; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await api(`/attendance/${record.id}/reject`, { method: 'POST', body: { reason } }); onSaved(); } catch (err) { setError(errorMessage(err)); setBusy(false); } }
  return <Modal title={`Reject ${record.user.name}'s check-in`} onClose={onClose}><form onSubmit={submit}>{error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}<Field label="Reason (optional)"><textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a note for the employee" /></Field><div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy}>{busy ? 'Rejecting…' : 'Reject check-in'}</button></div></form></Modal>;
}

function ExportModal({ filters, users, onChange, onClose, onSubmit }: { filters: { from: string; to: string; userId: string; status: string; sort: SortField; direction: 'asc' | 'desc' }; users: UserOption[]; onChange: (filters: { from: string; to: string; userId: string; status: string; sort: SortField; direction: 'asc' | 'desc' }) => void; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const set = (key: keyof typeof filters, value: string) => onChange({ ...filters, [key]: value });
  return <Modal title="Export attendance history" onClose={onClose}><form onSubmit={onSubmit}><Notice>Select the date range and filters for the CSV download.</Notice><div className="form-grid" style={{ marginTop: 14 }}><Field label="From"><input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} /></Field><Field label="To"><input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} /></Field><Field label="Employee"><select value={filters.userId} onChange={(e) => set('userId', e.target.value)}><option value="">All employees</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Status"><select value={filters.status} onChange={(e) => set('status', e.target.value)}><option value="">All statuses</option><option value="pending">Pending approval</option><option value="approved">Approved / checked out</option><option value="rejected">Rejected</option></select></Field><Field label="Sort by"><select value={filters.sort} onChange={(e) => set('sort', e.target.value as SortField)}><option value="checkIn">Check-in time</option><option value="checkOut">Check-out time</option><option value="status">Status</option></select></Field><Field label="Direction"><select value={filters.direction} onChange={(e) => set('direction', e.target.value as 'asc' | 'desc')}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></Field></div><div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Download CSV</button></div></form></Modal>;
}
