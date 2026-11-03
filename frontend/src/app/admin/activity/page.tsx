'use client';

import { useEffect, useState } from 'react';
import { useApi, api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Empty, Field, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { roleLabel, fmtDateTime } from '@/lib/format';
import type { AuditEntry, Role } from '@/lib/types';

const PAGE_SIZE = 50;

export default function ActivityPage() {
  const { meta, settings, refreshSettings } = useAuth();
  const toast = useToast();
  const canManageSettings = meta.permissions.includes('settings.manage');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [action, setAction] = useState('');
  const [retention, setRetention] = useState(String(settings.auditRetentionDays));
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionError, setRetentionError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [debouncedSearch, action]);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (action) params.set('action', action);
  const { data, error } = useApi<{ logs: AuditEntry[]; total: number; limit: number; actions: string[] }>(`/audit?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  async function saveRetention(e: React.FormEvent) {
    e.preventDefault();
    setSavingRetention(true);
    setRetentionError('');
    try {
      await api('/settings/audit-retention', { method: 'PATCH', body: { auditRetentionDays: Number(retention) } });
      await refreshSettings();
      toast('Audit-log retention saved');
    } catch (err) {
      setRetentionError(errorMessage(err));
    } finally {
      setSavingRetention(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTABILITY"
        title="Audit log"
        subtitle="Every critical action: who did it and when. Entries cannot be edited."
        actions={canManageSettings && <button className="btn small" type="button" onClick={() => document.getElementById('audit-retention-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} aria-label="Open audit log retention settings" title="Audit log retention settings"><Icon name="settings" size={15} /> Retention settings</button>}
      />
      <div className="toolbar">
        <div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actor, action, entity or details…" aria-label="Search audit log" /></div>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
          <option value="">All actions</option>
          {(data?.actions ?? []).sort().map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? <Spinner /> : !data.logs.length ? <Empty>No matching activity found.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>{data.logs.map((l) => <tr key={l.id}>
                <td>{fmtDateTime(l.at)}</td>
                <td>{l.actorName}<div className="muted small">{l.actorRole ? roleLabel(l.actorRole as Role) : ''}</div></td>
                <td><code className="small">{l.action}</code></td>
                <td className="wrap">{l.summary}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      {data && <div className="toolbar" style={{ marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="small muted">{data.total} entr{data.total === 1 ? 'y' : 'ies'}</span>
        {pages > 1 && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button>
          <span className="small muted">Page {page} of {pages}</span>
          <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older →</button>
        </div>}
      </div>}
      {canManageSettings && <section id="audit-retention-card" className="card" style={{ marginTop: 16, maxWidth: 900, scrollMarginTop: 24 }}>
        <div className="card-head"><div><h3>Audit log retention</h3><div className="card-sub">Manage how long activity history is kept in the database.</div></div></div>
        <Notice tone="warn" style={{ marginBottom: 16 }}>
          <strong>Database storage notice</strong><br />
          Audit logs are automatically deleted after the selected number of days to control database storage as activity grows. A shorter period saves more space but leaves less historical audit information. MongoDB performs cleanup in the background, so deletion may happen shortly after the retention period ends.
        </Notice>
        {retentionError && <Notice tone="error" style={{ marginBottom: 14 }}>{retentionError}</Notice>}
        <form onSubmit={saveRetention} style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
          <Field label="Audit log retention (days)" hint="Older audit entries are automatically removed after this period."><input type="number" min={1} max={3650} value={retention} onChange={(e) => setRetention(e.target.value)} /></Field>
          <button className="btn primary" disabled={savingRetention}>{savingRetention ? 'Saving…' : 'Save retention'}</button>
        </form>
      </section>}
    </>
  );
}
