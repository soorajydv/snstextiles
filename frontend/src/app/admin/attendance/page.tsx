'use client';

import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, Empty, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import type { AttendanceRecord } from '@/lib/types';

function statusLabel(record: AttendanceRecord) {
  if (record.status === 'pending') return 'Pending approval';
  if (record.status === 'rejected') return 'Rejected';
  return record.checkOutAt ? 'Checked out' : 'Checked in';
}

export default function AttendancePage() {
  const { user, meta } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, status]);
  const attendanceParams = new URLSearchParams({ page: String(page), limit: meta.permissions.includes('attendance.approve') ? '50' : '30' });
  if (search.trim()) attendanceParams.set('search', search.trim());
  if (status) attendanceParams.set('status', status);
  const { data, error, reload } = useApi<{ attendance: AttendanceRecord[]; total: number; page: number; limit: number }>(`/attendance?${attendanceParams}`);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<AttendanceRecord | null>(null);
  const toast = useToast();
  const isOwner = meta.permissions.includes('attendance.approve');
  const canCheckIn = meta.permissions.includes('attendance.checkin');
  const canCheckOut = meta.permissions.includes('attendance.checkout');
  const current = data?.attendance.find((record) => record.user.id === user.id && !record.checkOutAt && ['pending', 'approved'].includes(record.status));

  async function action(path: string, message: string) {
    setBusy(true);
    try {
      await api(path, { method: 'POST' });
      toast(message);
      await reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="TIME & ATTENDANCE"
        title="Attendance"
        subtitle={isOwner ? 'Review employee check-in requests and track working hours.' : 'Request check-in approval before starting your shift, then check out when you leave.'}
        actions={current ? (
          current.status === 'approved' && canCheckOut ? <button className="btn primary" disabled={busy} onClick={() => action('/attendance/check-out', 'Checked out successfully')}>Check out</button> : <Badge>{current.status === 'pending' ? 'Waiting for admin approval' : 'Check-out unavailable'}</Badge>
        ) : canCheckIn ? <button className="btn primary" disabled={busy} onClick={() => action('/attendance/check-in', 'Check-in request sent for approval')}>Check in</button> : <Badge>Check-in unavailable</Badge>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="toolbar">
        {isOwner && <div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" aria-label="Search attendance" /></div>}
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter attendance status">
          <option value="">All statuses</option>
          <option value="pending">Pending approval</option>
          <option value="approved">Checked in</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {!data ? <Spinner /> : (
        <section className="card flush">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Check in</th><th>Check out</th><th>Status</th><th>Approved by</th>{isOwner && <th>Actions</th>}</tr></thead>
              <tbody>
                {data.attendance.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record.user.name}</strong><div className="muted small">{record.user.email}</div></td>
                    <td>{fmtDateTime(record.checkInAt)}</td>
                    <td>{record.checkOutAt ? fmtDateTime(record.checkOutAt) : <span className="muted">—</span>}</td>
                    <td><Badge>{statusLabel(record)}</Badge>{record.rejectionReason && <div className="muted small" style={{ marginTop: 4 }}>{record.rejectionReason}</div>}</td>
                    <td>{record.approvedBy?.name ?? <span className="muted">—</span>}</td>
                    {isOwner && <td>{record.status === 'pending' ? <><button className="btn small primary" onClick={() => action(`/attendance/${record.id}/approve`, 'Check-in approved')}>Approve</button>{' '}<button className="btn small danger" onClick={() => setRejecting(record)}>Reject</button></> : <span className="muted small">No action</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.attendance.length && <Empty>No attendance records yet.</Empty>}
          </div>
        </section>
      )}
      {data && data.total > data.limit && <div className="toolbar" style={{ marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
        <span className="small muted">Page {page} of {Math.ceil(data.total / data.limit)}</span>
        <button className="btn small" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => setPage(page + 1)}>Next →</button>
      </div>}
      {rejecting && <RejectModal record={rejecting} onClose={() => setRejecting(null)} onSaved={() => { setRejecting(null); reload(); }} />}
    </>
  );
}

function RejectModal({ record, onClose, onSaved }: { record: AttendanceRecord; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/attendance/${record.id}/reject`, { method: 'POST', body: { reason } });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return <Modal title={`Reject ${record.user.name}'s check-in`} onClose={onClose}>
    <form onSubmit={submit}>
      {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
      <Field label="Reason (optional)"><textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a note for the employee" /></Field>
      <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy}>{busy ? 'Rejecting…' : 'Reject check-in'}</button></div>
    </form>
  </Modal>;
}
