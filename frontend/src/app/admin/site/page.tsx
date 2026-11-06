'use client';

import { AppLink as Link } from '@/components/AppLink';
import { useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Empty, Notice, PageHeader, Spinner, StatCard } from '@/components/ui';
import { fmtDate, fmtMoney } from '@/lib/format';

type Overview = {
  counts: { products: number; drafts: number; categories: number; pages: number; posts: number; newEnquiries: number; pendingReviews: number; subscribers: number; websiteOrders: number; openWebsiteOrders: number; remoteImages: number };
  recentOrders: { id: string; orderNo: string; customer: string; productName: string; quantity: number; totalAmount: number; stage: string; createdAt: string }[];
  recentEnquiries: { id: string; type: 'custom' | 'contact'; name: string; status: string; createdAt: string }[];
};

export default function WebsiteOverviewPage() {
  const { meta } = useAuth();
  const { data, error } = useApi<Overview>(meta.permissions.includes('site.view') ? '/site/overview' : null);
  if (!meta.permissions.includes('site.view')) return <Notice tone="error">You do not have permission to manage the website.</Notice>;

  const c = data?.counts;
  return (
    <>
      <PageHeader
        eyebrow="WEBSITE"
        title="Website overview"
        subtitle="Manage the public shop at snstextiles.com — products, content, enquiries and orders placed online."
        actions={<a className="btn" href="/" target="_blank" rel="noreferrer">View website ↗</a>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {!data ? <Spinner /> : (
        <>
          <div className="stats">
            <StatCard label="Open website orders" value={c!.openWebsiteOrders} note={`${c!.websiteOrders} placed online in total`} icon="▤" tone={c!.openWebsiteOrders ? 'amber' : ''} />
            <StatCard label="New enquiries" value={c!.newEnquiries} note="Custom design & contact forms" icon="✉" tone={c!.newEnquiries ? 'amber' : ''} />
            <StatCard label="Products online" value={c!.products} note={`${c!.drafts} draft${c!.drafts === 1 ? '' : 's'} · ${c!.categories} categories`} icon="◈" />
            <StatCard label="Reviews to approve" value={c!.pendingReviews} note={`${c!.subscribers} newsletter subscribers`} icon="★" tone={c!.pendingReviews ? 'amber' : ''} />
          </div>
          {c!.remoteImages > 0 && meta.permissions.includes('site.manage') && (
            <Notice tone="warn" style={{ marginBottom: 16 }}>
              {c!.remoteImages} product{c!.remoteImages === 1 ? '' : 's'} still load images from the old WordPress site. Open <Link href="/site/products">Products</Link> and use <strong>Download old images</strong> so they keep working after the switch.
            </Notice>
          )}
          <div className="grid-main">
            <div className="card">
              <div className="card-head">
                <div><h2>Latest website orders</h2><div className="card-sub">Each cart line becomes a production order.</div></div>
                <Link className="btn small" href="/site/orders">All website orders</Link>
              </div>
              {!data.recentOrders.length ? <Empty>No orders have been placed on the website yet.</Empty> : (
                <div className="table-wrap"><table>
                  <thead><tr><th>Order</th><th>Customer</th><th>Product</th><th className="num">Qty</th><th className="num">Total</th><th>Stage</th></tr></thead>
                  <tbody>
                    {data.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td><Link className="order-id" href={`/orders/${o.id}`}>{o.orderNo}</Link><div className="muted small">{fmtDate(o.createdAt)}</div></td>
                        <td>{o.customer}</td>
                        <td className="wrap">{o.productName}</td>
                        <td className="num">{o.quantity}</td>
                        <td className="num">{fmtMoney(o.totalAmount)}</td>
                        <td><Badge>{o.stage}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
            <div className="stack">
              <div className="card">
                <div className="card-head"><h2>Recent enquiries</h2><Link className="btn small" href="/site/enquiries">Open inbox</Link></div>
                {!data.recentEnquiries.length ? <Empty>No enquiries yet.</Empty> : (
                  <div className="activity">
                    {data.recentEnquiries.map((e) => (
                      <div className="activity-item" key={e.id}>
                        <div className="activity-dot">{e.type === 'custom' ? '✎' : '✉'}</div>
                        <div>
                          <div className="activity-title">{e.name} <Badge>{e.status.replace('_', ' ')}</Badge></div>
                          <div className="activity-time">{e.type === 'custom' ? 'Custom design request' : 'Contact message'} · {fmtDate(e.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card">
                <h2>Manage content</h2>
                <div className="card-sub" style={{ marginBottom: 12 }}>Quick links</div>
                <div className="header-actions">
                  <Link className="btn small" href="/site/products">Products</Link>
                  <Link className="btn small" href="/site/categories">Categories</Link>
                  <Link className="btn small" href="/site/pages">Pages ({c!.pages})</Link>
                  <Link className="btn small" href="/site/pages?tab=blog">Blog ({c!.posts})</Link>
                  <Link className="btn small" href="/site/reviews">Reviews</Link>
                  <Link className="btn small" href="/site/settings">Homepage & settings</Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
