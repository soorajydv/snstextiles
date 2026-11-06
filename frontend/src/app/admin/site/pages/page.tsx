'use client';

import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, Empty, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { ImageInput } from '@/components/site/ImageInputs';
import { fmtDate, toInputDate } from '@/lib/format';
import { renderMarkdown } from '@/lib/markdown';
import { assetPath } from '@/lib/paths';
import type { SitePage, SitePost } from '@/lib/types';

export default function SitePagesPage() {
  const { meta } = useAuth();
  const [tab, setTab] = useState<'pages' | 'blog'>('pages');
  useEffect(() => { if (new URLSearchParams(window.location.search).get('tab') === 'blog') setTab('blog'); }, []);
  if (!meta.permissions.includes('site.view')) return <Notice tone="error">You do not have permission to manage the website.</Notice>;
  return (
    <>
      <PageHeader eyebrow="WEBSITE" title="Pages & blog" subtitle="About us, policies and other pages, plus blog posts for the Journal." />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'pages'} className={tab === 'pages' ? 'active' : ''} onClick={() => setTab('pages')}>Pages</button>
        <button role="tab" aria-selected={tab === 'blog'} className={tab === 'blog' ? 'active' : ''} onClick={() => setTab('blog')}>Blog posts</button>
      </div>
      {tab === 'pages' ? <PagesTab /> : <BlogTab />}
    </>
  );
}

function MarkdownEditor({ value, onChange, rows = 14 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <div className="tabs" style={{ marginBottom: 8 }}>
        <button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>Write</button>
        <button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}>Preview</button>
      </div>
      {preview
        ? <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(value || '_Nothing yet_', assetPath) }} />
        : <div className="field"><textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></div>}
      <small className="muted">Markdown: <code>## Heading</code> · <code>- bullet</code> · <code>**bold**</code> · <code>[link](https://…)</code> · <code>![image](url)</code></small>
    </div>
  );
}

function PagesTab() {
  const { meta } = useAuth();
  const toast = useToast();
  const canManage = meta.permissions.includes('site.manage');
  const { data, error, reload } = useApi<{ pages: SitePage[] }>('/site/pages');
  const [editing, setEditing] = useState<SitePage | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SitePage | null>(null);

  async function remove(page: SitePage) {
    try { await api(`/site/pages/${page.id}`, { method: 'DELETE' }); toast('Page deleted'); setDeleting(null); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      {canManage && <div className="toolbar" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={() => setEditing('new')}>＋ New page</button></div>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? <Spinner /> : !data.pages.length ? <Empty>No pages yet.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Page</th><th>Address</th><th>Footer link</th><th>Status</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {data.pages.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => canManage && setEditing(p)}>
                  <td><strong>{p.title}</strong>{p.excerpt && <div className="muted small">{p.excerpt}</div>}</td>
                  <td className="muted small">/{p.slug}</td>
                  <td>{p.showInFooter ? 'Yes' : '—'}</td>
                  <td><Badge>{p.published ? 'Active' : 'Draft'}</Badge></td>
                  <td className="small">{fmtDate(p.updatedAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}><div className="table-actions">
                    {p.published && <a className="btn small" href={`/${p.slug}`} target="_blank" rel="noreferrer">↗</a>}
                    {canManage && <button className="btn small danger" onClick={() => setDeleting(p)}>Delete</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {editing && <PageForm page={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {deleting && <ConfirmModal title="Delete page" message={`Delete “${deleting.title}”? Links to /${deleting.slug} will stop working.`} confirmLabel="Delete page" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
    </>
  );
}

function PageForm({ page, onClose, onSaved }: { page: SitePage | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: page?.title ?? '', slug: page?.slug ?? '', excerpt: page?.excerpt ?? '', content: page?.content ?? '',
    published: page?.published ?? true, showInFooter: page?.showInFooter ?? true, seoTitle: page?.seoTitle ?? '', seoDescription: page?.seoDescription ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api(page ? `/site/pages/${page.id}` : '/site/pages', { method: page ? 'PUT' : 'POST', body: form });
      toast(page ? 'Page saved' : 'Page created'); onSaved();
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  return (
    <Modal title={page ? `Edit ${page.title}` : 'New page'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-grid">
          <Field label="Title *"><input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Web address" hint="e.g. about → snstextiles.com/about. Leave empty to use the title."><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></Field>
          <Field label="Intro line" full><input maxLength={400} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><MarkdownEditor value={form.content} onChange={(content) => setForm({ ...form, content })} /></div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label="SEO title"><input maxLength={160} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></Field>
          <Field label="SEO description"><input maxLength={320} value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></Field>
        </div>
        <div className="toggle-row" style={{ marginTop: 12 }}>
          <label className="checkbox-line"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Published</label>
          <label className="checkbox-line"><input type="checkbox" checked={form.showInFooter} onChange={(e) => setForm({ ...form, showInFooter: e.target.checked })} /> Link in the footer</label>
        </div>
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save page'}</button></div>
      </form>
    </Modal>
  );
}

function BlogTab() {
  const { meta } = useAuth();
  const toast = useToast();
  const canManage = meta.permissions.includes('site.manage');
  const { data, error, reload } = useApi<{ posts: SitePost[]; total: number }>('/site/posts?limit=200');
  const [editing, setEditing] = useState<SitePost | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SitePost | null>(null);

  async function remove(post: SitePost) {
    try { await api(`/site/posts/${post.id}`, { method: 'DELETE' }); toast('Post deleted'); setDeleting(null); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      {canManage && <div className="toolbar" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={() => setEditing('new')}>＋ New post</button></div>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? <Spinner /> : !data.posts.length ? <Empty>No blog posts yet.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Post</th><th>Published</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.posts.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => canManage && setEditing(p)}>
                  <td><div className="cell-with-thumb">{p.coverImage ? <img className="site-thumb" src={assetPath(p.coverImage)} alt="" /> : <span className="site-thumb empty">✎</span>}<div><strong>{p.title}</strong><div className="muted small">/blog/{p.slug}</div></div></div></td>
                  <td className="small">{fmtDate(p.publishedAt)}</td>
                  <td><Badge>{p.published ? (new Date(p.publishedAt) > new Date() ? 'Scheduled' : 'Active') : 'Draft'}</Badge></td>
                  <td onClick={(e) => e.stopPropagation()}><div className="table-actions">
                    {p.published && <a className="btn small" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">↗</a>}
                    {canManage && <button className="btn small danger" onClick={() => setDeleting(p)}>Delete</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {editing && <PostForm post={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {deleting && <ConfirmModal title="Delete post" message={`Delete “${deleting.title}”?`} confirmLabel="Delete post" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
    </>
  );
}

function PostForm({ post, onClose, onSaved }: { post: SitePost | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: post?.title ?? '', slug: post?.slug ?? '', excerpt: post?.excerpt ?? '', content: post?.content ?? '', coverImage: post?.coverImage ?? '',
    tags: (post?.tags ?? []).join(', '), authorName: post?.authorName ?? 'SNS Textiles', published: post?.published ?? true,
    publishedAt: toInputDate(post?.publishedAt ? new Date(post.publishedAt) : new Date()), seoTitle: post?.seoTitle ?? '', seoDescription: post?.seoDescription ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api(post ? `/site/posts/${post.id}` : '/site/posts', { method: post ? 'PUT' : 'POST', body: { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) } });
      toast(post ? 'Post saved' : 'Post created'); onSaved();
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  return (
    <Modal title={post ? 'Edit post' : 'New blog post'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-grid">
          <Field label="Title *" full><input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Web address" hint="Leave empty to use the title."><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></Field>
          <Field label="Publish date" hint="Future dates are scheduled."><input type="date" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} /></Field>
          <Field label="Summary" full hint="Shown on the blog list and in search results."><textarea rows={2} maxLength={600} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></Field>
          <Field label="Cover image" full><ImageInput value={form.coverImage} onChange={(coverImage) => setForm({ ...form, coverImage })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><MarkdownEditor value={form.content} onChange={(content) => setForm({ ...form, content })} rows={16} /></div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label="Tags"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="teamwear, football" /></Field>
          <Field label="Author"><input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></Field>
          <Field label="SEO title"><input maxLength={160} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></Field>
          <Field label="SEO description"><input maxLength={320} value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></Field>
        </div>
        <label className="checkbox-line" style={{ marginTop: 12 }}><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Published</label>
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save post'}</button></div>
      </form>
    </Modal>
  );
}
