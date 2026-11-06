'use client';

import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { ConfirmModal, Empty, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { appPath } from '@/lib/paths';

type Subscriber = { id: string; email: string; active: boolean; source: string; createdAt: string };

export default function SiteSubscribersPage() {
  const { meta } = useAuth();
  const toast = useToast();
  const allowed = meta.permissions.includes('site.view');
  const canManage = meta.permissions.includes('site.manage');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Subscriber | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  const qs = new URLSearchParams({ page: String(page), limit: '100' });
  if (debounced) qs.set('search', debounced);
  const { data, error, reload } = useApi<{ subscribers: Subscriber[]; total: number; limit: number }>(allowed ? `/site/subscribers?${qs}` : null);
  if (!allowed) return <Notice tone="error">You do not have permission to manage the website.</Notice>;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  async function remove(s: Subscriber) {
    try { await api(`/site/subscribers/${s.id}`, { method: 'DELETE' }); toast('Subscriber removed'); setDeleting(null); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      <PageHeader
        eyebrow="WEBSITE"
        title="Newsletter subscribers"
        subtitle="People who signed up in the website footer. Export the list to use in your email tool."
        actions={<a className="btn" href={appPath('/api/site/subscribers/export')}>Export CSV</a>}
      />
      <div className="toolbar"><div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email…" aria-label="Search subscribers" /></div></div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? <Spinner /> : !data.subscribers.length ? <Empty>No subscribers yet.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Email</th><th>Signed up</th><th /></tr></thead>
            <tbody>
              {data.subscribers.map((s) => (
                <tr key={s.id}>
                  <td><a href={`mailto:${s.email}`}>{s.email}</a></td>
                  <td className="small">{fmtDate(s.createdAt)}</td>
                  <td>{canManage && <button className="btn small danger" onClick={() => setDeleting(s)}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {data && (
        <div className="toolbar" style={{ marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="subtitle">{data.total} subscriber{data.total === 1 ? '' : 's'}</div>
          {pages > 1 && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span className="small muted">Page {page} of {pages}</span>
            <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>}
        </div>
      )}
      {deleting && <ConfirmModal title="Remove subscriber" message={`Remove ${deleting.email} from the newsletter list?`} confirmLabel="Remove" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
    </>
  );
}
