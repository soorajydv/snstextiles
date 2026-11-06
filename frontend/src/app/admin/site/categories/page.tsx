'use client';

import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, Empty, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { ImageInput } from '@/components/site/ImageInputs';
import { assetPath } from '@/lib/paths';
import { sortTree } from '@/lib/siteTree';
import type { SiteCategory } from '@/lib/types';

export default function SiteCategoriesPage() {
  const { meta } = useAuth();
  const toast = useToast();
  const canManage = meta.permissions.includes('site.manage');
  const allowed = meta.permissions.includes('site.view');
  const { data, error, reload } = useApi<{ categories: SiteCategory[] }>(allowed ? '/site/categories' : null);
  const [editing, setEditing] = useState<SiteCategory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SiteCategory | null>(null);
  if (!allowed) return <Notice tone="error">You do not have permission to manage the website.</Notice>;
  const tree = sortTree(data?.categories ?? []);

  async function remove(category: SiteCategory) {
    try {
      await api(`/site/categories/${category.id}`, { method: 'DELETE' });
      toast(`${category.name} deleted`);
      setDeleting(null);
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      <PageHeader
        eyebrow="WEBSITE"
        title="Categories"
        subtitle="Shop menu, category pages and homepage tiles. Sub-categories appear under their parent in the menu."
        actions={canManage && <button className="btn primary" onClick={() => setEditing('new')}>＋ Add category</button>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? <Spinner /> : !tree.length ? <Empty>No categories yet.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Category</th><th>Web address</th><th className="num">Products</th><th>Homepage</th><th>Status</th><th /></tr></thead>
            <tbody>
              {tree.map(({ category: c, depth }) => (
                <tr key={c.id} className="clickable" onClick={() => canManage && setEditing(c)}>
                  <td>
                    <div className="cell-with-thumb" style={{ paddingLeft: depth * 22 }}>
                      {depth > 0 && <span className="category-indent">↳</span>}
                      {c.image ? <img className="site-thumb" src={assetPath(c.image)} alt="" /> : <span className="site-thumb empty">▦</span>}
                      <strong>{c.name}</strong>
                    </div>
                  </td>
                  <td className="muted small">/category/{c.slug}</td>
                  <td className="num">{c.productCount ?? 0}</td>
                  <td>{c.showOnHome ? <span className="pill">Shown</span> : <span className="muted small">—</span>}</td>
                  <td><Badge>{c.published ? 'Active' : 'Inactive'}</Badge></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <a className="btn small" href={`/category/${c.slug}`} target="_blank" rel="noreferrer">↗</a>
                      {canManage && <button className="btn small" onClick={() => setEditing(c)}>Edit</button>}
                      {canManage && <button className="btn small danger" onClick={() => setDeleting(c)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {deleting && <ConfirmModal title="Delete category" message={`Delete ${deleting.name}? Its sub-categories move up a level and its products stay in the shop without this category.`} confirmLabel="Delete category" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
      {editing && <CategoryForm category={editing === 'new' ? null : editing} all={data?.categories ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function CategoryForm({ category, all, onClose, onSaved }: { category: SiteCategory | null; all: SiteCategory[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    parent: category?.parent ?? '',
    description: category?.description ?? '',
    image: category?.image ?? '',
    sortOrder: String(category?.sortOrder ?? 0),
    showOnHome: category?.showOnHome ?? false,
    published: category?.published ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // A category cannot sit under itself or one of its own descendants.
  const blocked = new Set<string>();
  if (category) {
    blocked.add(category.id);
    let added = true;
    while (added) { added = false; for (const c of all) if (c.parent && blocked.has(c.parent) && !blocked.has(c.id)) { blocked.add(c.id); added = true; } }
  }
  const parents = sortTree(all).filter(({ category: c }) => !blocked.has(c.id));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(category ? `/site/categories/${category.id}` : '/site/categories', {
        method: category ? 'PUT' : 'POST',
        body: { ...form, parent: form.parent || null, sortOrder: Number(form.sortOrder) || 0 },
      });
      toast(category ? 'Category updated' : 'Category created');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={category ? `Edit ${category.name}` : 'Add category'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-grid">
          <Field label="Name *"><input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="URL slug" hint="Leave empty to generate from the name."><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></Field>
          <Field label="Parent category">
            <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
              <option value="">— Top level —</option>
              {parents.map(({ category: c, depth }) => <option key={c.id} value={c.id}>{'— '.repeat(depth)}{c.name}</option>)}
            </select>
          </Field>
          <Field label="Sort order"><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field>
          <Field label="Description" full hint="Shown at the top of the category page."><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Tile image" full hint="Used on the homepage category tiles and category page header."><ImageInput value={form.image} onChange={(image) => setForm({ ...form, image })} /></Field>
        </div>
        <div className="toggle-row" style={{ marginTop: 12 }}>
          <label className="checkbox-line"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Show on the website</label>
          <label className="checkbox-line"><input type="checkbox" checked={form.showOnHome} onChange={(e) => setForm({ ...form, showOnHome: e.target.checked })} /> Show as a homepage tile</label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save category'}</button>
        </div>
      </form>
    </Modal>
  );
}
