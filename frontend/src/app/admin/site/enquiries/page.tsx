'use client';

import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, Empty, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { assetPath } from '@/lib/paths';
import type { SiteEnquiry } from '@/lib/types';

const STATUS_LABEL: Record<SiteEnquiry['status'], string> = { new: 'New', in_progress: 'In progress', closed: 'Closed' };

export default function SiteEnquiriesPage() {
  const { meta } = useAuth();
  const toast = useToast();
  const allowed = meta.permissions.includes('site.enquiries');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<SiteEnquiry | null>(null);
  const [deleting, setDeleting] = useState<SiteEnquiry | null>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [type, status, debounced]);

  const qs = new URLSearchParams({ page: String(page), limit: '50' });
  if (type) qs.set('type', type);
  if (status) qs.set('status', status);
  if (debounced) qs.set('search', debounced);
  const { data, error, reload } = useApi<{ enquiries: SiteEnquiry[]; total: number; limit: number }>(allowed ? `/site/enquiries?${qs}` : null);
  if (!allowed) return <Notice tone="error">You do not have permission to view website enquiries.</Notice>;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  async function remove(enquiry: SiteEnquiry) {
    try {
      await api(`/site/enquiries/${enquiry.id}`, { method: 'DELETE' });
      toast('Enquiry deleted');
      setDeleting(null);
      setViewing(null);
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      <PageHeader eyebrow="WEBSITE" title="Enquiries" subtitle="Custom design requests and contact messages sent from the website." />
      <div className="toolbar">
        <div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, team or message…" aria-label="Search enquiries" /></div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          <option value="custom">Custom design</option>
          <option value="contact">Contact</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? <Spinner /> : !data.enquiries.length ? <Empty>No enquiries match this view.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>From</th><th>Type</th><th>Message</th><th>Files</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>
              {data.enquiries.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => setViewing(e)}>
                  <td><strong>{e.name}</strong><div className="muted small">{e.email}{e.phone ? ` · ${e.phone}` : ''}</div></td>
                  <td>{e.type === 'custom' ? 'Custom design' : 'Contact'}</td>
                  <td className="wrap small" style={{ maxWidth: 360 }}>{e.team && <strong>{e.team}: </strong>}{e.message.length > 120 ? `${e.message.slice(0, 120)}…` : e.message}</td>
                  <td className="num">{e.files.length || '—'}</td>
                  <td className="small">{fmtDate(e.createdAt)}</td>
                  <td><Badge>{STATUS_LABEL[e.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {data && pages > 1 && (
        <div className="toolbar" style={{ marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="small muted">Page {page} of {pages}</span>
          <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
      {viewing && <EnquiryDetail enquiry={viewing} onClose={() => setViewing(null)} onSaved={(next) => { setViewing(next); reload(); }} onDelete={() => setDeleting(viewing)} />}
      {deleting && <ConfirmModal title="Delete enquiry" message={`Delete the enquiry from ${deleting.name}, including attached files?`} confirmLabel="Delete" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
    </>
  );
}

function EnquiryDetail({ enquiry, onClose, onSaved, onDelete }: { enquiry: SiteEnquiry; onClose: () => void; onSaved: (e: SiteEnquiry) => void; onDelete: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState(enquiry.status);
  const [notes, setNotes] = useState(enquiry.notes);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const result = await api<{ enquiry: SiteEnquiry }>(`/site/enquiries/${enquiry.id}`, { method: 'PATCH', body: { status, notes } });
      toast('Enquiry updated');
      onSaved(result.enquiry);
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  }

  const reply = `mailto:${enquiry.email}?subject=${encodeURIComponent(`Re: your ${enquiry.type === 'custom' ? 'custom jersey request' : 'message'} to SNS Textiles`)}`;
  return (
    <Modal title={enquiry.type === 'custom' ? 'Custom design request' : 'Contact message'} onClose={onClose} wide>
      <div className="two-col">
        <div>
          <div className="kv"><span>Name</span><strong>{enquiry.name}</strong></div>
          <div className="kv"><span>Email</span><strong><a href={`mailto:${enquiry.email}`}>{enquiry.email}</a></strong></div>
          <div className="kv"><span>Phone</span><strong>{enquiry.phone ? <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a> : '—'}</strong></div>
          {enquiry.team && <div className="kv"><span>Team / organisation</span><strong>{enquiry.team}</strong></div>}
        </div>
        <div>
          {enquiry.product && <div className="kv"><span>Product</span><strong>{enquiry.product}</strong></div>}
          {enquiry.quantity && <div className="kv"><span>Quantity</span><strong>{enquiry.quantity}</strong></div>}
          {enquiry.neededBy && <div className="kv"><span>Needed by</span><strong>{fmtDate(enquiry.neededBy)}</strong></div>}
          <div className="kv"><span>Received</span><strong>{fmtDateTime(enquiry.createdAt)}</strong></div>
        </div>
      </div>
      {enquiry.subject && <h3 style={{ marginTop: 16 }}>{enquiry.subject}</h3>}
      <div className="notice" style={{ marginTop: 14, whiteSpace: 'pre-wrap', fontSize: 13 }}>{enquiry.message}</div>
      {enquiry.files.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3>Attachments</h3>
          <div className="file-list">
            {enquiry.files.map((f) => (
              <a className="file-link" key={f.url} href={assetPath(f.url)} target="_blank" rel="noreferrer">
                {f.mimeType.startsWith('image/') ? <img className="file-thumb" src={assetPath(f.url)} alt="" /> : <span>📎</span>}
                <span>{f.originalName}</span><span className="muted small">{Math.round(f.size / 1024)} KB</span>
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="form-grid" style={{ marginTop: 16 }}>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as SiteEnquiry['status'])}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Internal notes" full><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Quoted NPR 1,200 per set, waiting for logo…" /></Field>
      </div>
      <div className="form-actions" style={{ justifyContent: 'space-between' }}>
        <button className="btn danger" onClick={onDelete}>Delete</button>
        <div style={{ display: 'flex', gap: 9 }}>
          <a className="btn" href={reply}>Reply by email</a>
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}
