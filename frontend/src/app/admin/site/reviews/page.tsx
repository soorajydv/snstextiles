'use client';

import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, Empty, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { SiteReview } from '@/lib/types';

export default function SiteReviewsPage() {
  const { meta } = useAuth();
  const toast = useToast();
  const allowed = meta.permissions.includes('site.reviews.view');
  const canModerate = meta.permissions.includes('site.reviews.moderate');
  const canDelete = meta.permissions.includes('site.reviews.delete');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<SiteReview | null>(null);
  const qs = new URLSearchParams({ page: String(page), limit: '50' });
  if (status) qs.set('status', status);
  const { data, error, reload } = useApi<{ reviews: SiteReview[]; total: number; limit: number }>(allowed ? `/site/reviews?${qs}` : null);
  if (!allowed) return <Notice tone="error">You do not have permission to view product reviews.</Notice>;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  async function setReviewStatus(review: SiteReview, next: 'approved' | 'rejected') {
    try { await api(`/site/reviews/${review.id}`, { method: 'PATCH', body: { status: next } }); toast(next === 'approved' ? 'Review published' : 'Review hidden'); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  }
  async function remove(review: SiteReview) {
    try { await api(`/site/reviews/${review.id}`, { method: 'DELETE' }); toast('Review deleted'); setDeleting(null); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      <PageHeader eyebrow="WEBSITE" title="Product reviews" subtitle="Reviews appear on product pages only after you approve them." />
      <div className="tabs">
        {[['pending', 'Waiting for approval'], ['approved', 'Published'], ['rejected', 'Hidden'], ['', 'All']].map(([key, label]) => (
          <button key={key} className={status === key ? 'active' : ''} onClick={() => { setStatus(key); setPage(1); }}>{label}</button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? <Spinner /> : !data.reviews.length ? <Empty>No reviews here.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Review</th><th>Product</th><th>Date</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.reviews.map((r) => (
                <tr key={r.id}>
                  <td className="wrap" style={{ maxWidth: 440 }}>
                    <div><span className="rating-stars" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> <strong>{r.name}</strong> <span className="muted small">{r.email}</span></div>
                    <div className="small" style={{ marginTop: 4 }}>{r.body}</div>
                  </td>
                  <td className="small">{r.product ? <a href={`/product/${r.product.slug}`} target="_blank" rel="noreferrer">{r.product.name}</a> : '—'}</td>
                  <td className="small">{fmtDate(r.createdAt)}</td>
                  <td><Badge>{r.status === 'approved' ? 'Active' : r.status === 'pending' ? 'Pending' : 'Inactive'}</Badge></td>
                  <td>{(canModerate || canDelete) && (
                    <div className="table-actions">
                      {canModerate && r.status !== 'approved' && <button className="btn small primary" onClick={() => setReviewStatus(r, 'approved')}>Approve</button>}
                      {canModerate && r.status !== 'rejected' && <button className="btn small" onClick={() => setReviewStatus(r, 'rejected')}>Hide</button>}
                      {canDelete && <button className="btn small danger" onClick={() => setDeleting(r)}>Delete</button>}
                    </div>
                  )}</td>
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
      {deleting && <ConfirmModal title="Delete review" message={`Delete the review by ${deleting.name}?`} confirmLabel="Delete" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
    </>
  );
}
