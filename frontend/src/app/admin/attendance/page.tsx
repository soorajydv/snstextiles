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
type Direction = 'asc' | 'desc';
type ViewMode = 'table' | 'calendar';
type UserOption = { id: string; name: string; email: string; role: string };
type Summary = { records: number; employees: number; workedMinutes: number; openMinutes: number; pending: number; open: number; rejected: number };
type AttendanceResponse = { attendance: AttendanceRecord[]; total: number; page: number; limit: number; summary?: Summary; users: UserOption[] };

/** Sort and direction combined into one choice. */
const SORTS: { value: string; label: string; sort: SortField; direction: Direction }[] = [
  { value: 'checkIn-desc', label: 'Newest check-in first', sort: 'checkIn', direction: 'desc' },
  { value: 'checkIn-asc', label: 'Oldest check-in first', sort: 'checkIn', direction: 'asc' },
  { value: 'checkOut-desc', label: 'Latest check-out first', sort: 'checkOut', direction: 'desc' },
  { value: 'status-asc', label: 'Status (pending first)', sort: 'status', direction: 'asc' },
];

function dateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function statusLabel(record: AttendanceRecord) { if (record.status === 'pending') return 'Pending approval'; if (record.status === 'rejected') return 'Rejected'; return record.checkOutAt ? 'Checked out' : 'On shift'; }
function formatMinutes(minutes: number) { return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`; }
function workedMinutes(record: AttendanceRecord, now: number) {
  if (record.status !== 'approved') return 0;
  if (record.workedMinutes && record.workedMinutes > 0) return record.workedMinutes;
  return Math.max(0, Math.floor(((record.checkOutAt ? new Date(record.checkOutAt).getTime() : now) - new Date(record.checkInAt).getTime()) / 60_000));
}
function dateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function presetRange(preset: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today': return { from: dateValue(now), to: dateValue(now) };
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { from: dateValue(start), to: dateValue(now) };
    }
    case 'last-month': return { from: dateValue(new Date(y, m - 1, 1)), to: dateValue(new Date(y, m, 0)) };
    default: return { from: dateValue(new Date(y, m, 1)), to: dateValue(now) };
  }
}

export default function AttendancePage() {
  const { user, meta } = useAuth();
  const toast = useToast();
  const isReviewer = meta.permissions.includes('attendance.approve');
  const canCheckIn = meta.permissions.includes('attendance.checkin');
  const canCheckOut = meta.permissions.includes('attendance.checkout');
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState('');
  const [{ from, to }, setRange] = useState(() => presetRange('month'));
  const [sortValue, setSortValue] = useState(SORTS[0].value);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<AttendanceRecord | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const { sort, direction } = SORTS.find((s) => s.value === sortValue) ?? SORTS[0];

  useEffect(() => setPage(1), [status, userId, from, to, sortValue]);
  useEffect(() => {
    if (!from) return;
    const date = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(date.getTime())) setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [from]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const params = new URLSearchParams({ page: String(page), limit: isReviewer ? '50' : '30', sort, direction });
  if (viewMode === 'calendar') params.set('all', 'true');
  if (status) params.set('status', status);
  if (userId && isReviewer) params.set('userId', userId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data, error, reload } = useApi<AttendanceResponse>(`/attendance?${params}`);
  const mine = useApi<AttendanceResponse>(`/attendance?limit=5&userId=${user.id}`);
  const current = mine.data?.attendance.find((record) => !record.checkOutAt && ['pending', 'approved'].includes(record.status));

  async function action(path: string, message: string) {
    setBusy(true);
    try { await api(path, { method: 'POST' }); toast(message); await Promise.all([reload(), mine.reload()]); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }

  const records = data?.attendance ?? [];
  const summary = data?.summary;
  const users = data?.users ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const filtersActive = Boolean(status || userId);

  return (
    <div className="attendance-page">
      <PageHeader
        eyebrow="TIME & ATTENDANCE"
        title="Attendance"
        subtitle={isReviewer ? 'Approve check-ins and review working hours for every employee.' : 'Request check-in approval when you start your shift and check out when you leave.'}
        actions={isReviewer && <button className="btn" onClick={() => setExportOpen(true)}>⇩ Export CSV</button>}
      />
      {error && <Notice tone="error">{error}</Notice>}

      {(canCheckIn || canCheckOut || current) && (
        <section className={`card shift-card ${current ? `is-${current.status}` : ''}`}>
          <div className="shift-status">
            <span className="shift-dot" aria-hidden="true" />
            <div>
              <div className="eyebrow">Your shift today</div>
              {!current ? (
                <strong>Not checked in</strong>
              ) : current.status === 'pending' ? (
                <strong>Waiting for approval <span className="muted small">· requested {fmtDateTime(current.checkInAt)}</span></strong>
              ) : (
                <strong>On shift for {formatMinutes(workedMinutes(current, now))} <span className="muted small">· since {fmtDateTime(current.checkInAt)}</span></strong>
              )}
            </div>
          </div>
          <div>
            {current ? (
              current.status === 'approved' && canCheckOut
                ? <button className="btn primary" disabled={busy} onClick={() => action('/attendance/check-out', 'Checked out successfully')}>Check out</button>
                : <Badge>{current.status === 'pending' ? 'Pending approval' : 'Check-out unavailable'}</Badge>
            ) : canCheckIn
              ? <button className="btn primary" disabled={busy} onClick={() => action('/attendance/check-in', 'Check-in request sent for approval')}>Check in</button>
              : <Badge>Check-in unavailable</Badge>}
          </div>
        </section>
      )}

      {isReviewer && (
        <div className="stats">
          <StatCard label="Shifts" value={summary?.records ?? '—'} note={summary ? `${summary.employees} employee${summary.employees === 1 ? '' : 's'}` : ' '} icon="◷" />
          <StatCard label="Hours worked" value={summary ? formatMinutes(summary.workedMinutes) : '—'} note={summary?.openMinutes ? `+ ${formatMinutes(summary.openMinutes)} on open shifts` : 'Completed shifts'} icon="✓" tone="green" />
          <StatCard label="Pending approvals" value={summary?.pending ?? '—'} note="Check-ins to review" icon="!" tone={summary?.pending ? 'amber' : ''} />
          <StatCard label="On shift now" value={summary?.open ?? '—'} note="Awaiting check-out" icon="◷" tone={summary?.open ? 'amber' : ''} />
        </div>
      )}
      {isReviewer && summary && summary.pending > 0 && status !== 'pending' && (
        <Notice tone="warn" style={{ marginBottom: 14 }}>
          {summary.pending} check-in{summary.pending === 1 ? ' is' : 's are'} waiting for approval. <button className="link-btn" onClick={() => setStatus('pending')}>Show pending only</button>
        </Notice>
      )}

      <section className="filter-bar card" aria-label="Attendance filters">
        {isReviewer && (
          <label className="field filter-wide">
            <span>Employee</span>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">All employees</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        <label className="field"><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => setRange({ from: e.target.value, to })} /></label>
        <label className="field"><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => setRange({ from, to: e.target.value })} /></label>
        <label className="field"><span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="field"><span>Sort</span>
          <select value={sortValue} onChange={(e) => setSortValue(e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <div className="filter-presets">
          <span>Period</span>
          <div>
            {[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['last-month', 'Last month']].map(([key, label]) => (
              <button key={key} type="button" className="chip-btn" onClick={() => setRange(presetRange(key))}>{label}</button>
            ))}
            {filtersActive && <button type="button" className="link-btn" onClick={() => { setStatus(''); setUserId(''); }}>Clear filters</button>}
          </div>
        </div>
      </section>

      <section className="card flush attendance-results">
        <div className="billing-results-head">
          <div className="tabs" role="tablist" aria-label="Attendance view">
            <button role="tab" aria-selected={viewMode === 'table'} className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>Table</button>
            <button role="tab" aria-selected={viewMode === 'calendar'} className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>Calendar</button>
          </div>
          <span className="muted small">{data ? `${data.total} ${data.total === 1 ? 'shift' : 'shifts'}` : ''}</span>
        </div>
        {!data ? <Spinner /> : viewMode === 'calendar' ? (
          <AttendanceCalendar month={calendarMonth} now={now} records={records} onMonthChange={setCalendarMonth} />
        ) : !records.length ? <Empty>No attendance records for this period.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr>{isReviewer && <th>Employee</th>}<th>Check in</th><th>Check out</th><th className="num">Worked</th><th>Status</th><th>Approved by</th>{isReviewer && <th />}</tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    {isReviewer && <td><strong>{record.user.name}</strong><div className="muted small">{record.user.email}</div></td>}
                    <td>{fmtDateTime(record.checkInAt)}</td>
                    <td>{record.checkOutAt ? fmtDateTime(record.checkOutAt) : <span className="muted">—</span>}</td>
                    <td className="num">{record.status === 'approved' ? formatMinutes(workedMinutes(record, now)) : <span className="muted">—</span>}</td>
                    <td className="wrap"><Badge>{statusLabel(record)}</Badge>{record.rejectionReason && <div className="muted small" style={{ marginTop: 4 }}>{record.rejectionReason}</div>}</td>
                    <td>{record.approvedBy?.name ?? <span className="muted">—</span>}</td>
                    {isReviewer && (
                      <td>
                        {record.status === 'pending' && (
                          <div className="table-actions">
                            <button className="btn small primary" onClick={() => action(`/attendance/${record.id}/approve`, 'Check-in approved')}>Approve</button>
                            <button className="btn small danger" onClick={() => setRejecting(record)}>Reject</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {viewMode === 'table' && pages > 1 && (
          <div className="billing-pager">
            <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span className="small muted">Page {page} of {pages}</span>
            <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        )}
      </section>

      {rejecting && <RejectModal record={rejecting} onClose={() => setRejecting(null)} onSaved={() => { setRejecting(null); reload(); }} />}
      {exportOpen && <ExportModal initial={{ from, to, userId, status, sortValue }} users={users} onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function AttendanceCalendar({ records, month, now, onMonthChange }: { records: AttendanceRecord[]; month: Date; now: number; onMonthChange: (month: Date) => void }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => (index < firstDay ? null : index - firstDay + 1));
  const recordsByDay = new Map<string, AttendanceRecord[]>();
  records.forEach((record) => {
    const key = dateKey(record.checkInAt);
    recordsByDay.set(key, [...(recordsByDay.get(key) ?? []), record]);
  });
  const label = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="attendance-calendar">
      <div className="attendance-calendar-head">
        <span className="muted small">Check-ins per day for the selected filters</span>
        <div className="attendance-calendar-nav">
          <button className="btn small" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))} type="button" aria-label="Previous month">←</button>
          <strong>{label}</strong>
          <button className="btn small" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))} type="button" aria-label="Next month">→</button>
        </div>
      </div>
      <div className="attendance-calendar-scroll">
        <div className="attendance-calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="attendance-calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <div className="attendance-calendar-day is-empty" key={`empty-${index}`} />;
            const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRecords = recordsByDay.get(key) ?? [];
            const today = dateKey(new Date(now).toISOString()) === key;
            return (
              <div className={`attendance-calendar-day${today ? ' is-today' : ''}`} key={key}>
                <span className="attendance-calendar-date">{day}</span>
                {dayRecords.map((record) => (
                  <div className={`attendance-calendar-entry is-${record.status}`} key={record.id}>
                    <strong>{record.user.name}</strong>
                    <small>{record.checkOutAt ? formatMinutes(workedMinutes(record, now)) : statusLabel(record)}</small>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RejectModal({ record, onClose, onSaved }: { record: AttendanceRecord; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await api(`/attendance/${record.id}/reject`, { method: 'POST', body: { reason } }); onSaved(); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  return (
    <Modal title={`Reject ${record.user.name}'s check-in`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <Field label="Reason (optional)"><textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a note for the employee" /></Field>
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy}>{busy ? 'Rejecting…' : 'Reject check-in'}</button></div>
      </form>
    </Modal>
  );
}

function ExportModal({ initial, users, onClose }: { initial: { from: string; to: string; userId: string; status: string; sortValue: string }; users: UserOption[]; onClose: () => void }) {
  const [filters, setFilters] = useState(initial);
  const set = (key: keyof typeof filters, value: string) => setFilters({ ...filters, [key]: value });

  function download(event: React.FormEvent) {
    event.preventDefault();
    const { sort, direction } = SORTS.find((s) => s.value === filters.sortValue) ?? SORTS[0];
    const qs = new URLSearchParams({ sort, direction });
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    if (filters.status) qs.set('status', filters.status);
    if (filters.userId) qs.set('userId', filters.userId);
    window.location.href = appPath(`/api/attendance/export.csv?${qs}`);
    onClose();
  }

  return (
    <Modal title="Export attendance" onClose={onClose}>
      <form onSubmit={download}>
        <p className="subtitle" style={{ marginTop: 0 }}>Download a CSV with check-in, check-out, worked hours and approval details.</p>
        <div className="form-grid">
          <Field label="From"><input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} /></Field>
          <Field label="To"><input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} /></Field>
          <Field label="Employee">
            <select value={filters.userId} onChange={(e) => set('userId', e.target.value)}>
              <option value="">All employees</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field label="Sort" full>
            <select value={filters.sortValue} onChange={(e) => set('sortValue', e.target.value)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Download CSV</button></div>
      </form>
    </Modal>
  );
}
