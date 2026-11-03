'use client';

import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, Empty, Field, Modal, Notice, PageHeader, Spinner, StatCard, errorMessage } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import type { InventoryItem, StockMovement } from '@/lib/types';

type MoveType = 'in' | 'out' | 'adjust';

export default function InventoryPage() {
  const { meta } = useAuth();
  const canManage = meta.permissions.includes('inventory.manage');
  const canMove = meta.permissions.includes('inventory.move');
  const canAdjust = meta.permissions.includes('inventory.adjust');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [sort, setSort] = useState('name');
  const [itemPage, setItemPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [moving, setMoving] = useState<{ item: InventoryItem; type: MoveType } | null>(null);
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);

  useEffect(() => setItemPage(1), [search, category, stock, sort]);
  const itemParams = new URLSearchParams({ page: String(itemPage), limit: '50' });
  if (canManage) itemParams.set('all', '1');
  if (search.trim()) itemParams.set('search', search.trim());
  if (category) itemParams.set('category', category);
  if (stock) itemParams.set('stock', stock);
  if (sort !== 'name') itemParams.set('sort', sort);
  const items = useApi<{ items: InventoryItem[]; total: number; limit: number; lowStockTotal: number; activeTotal: number; categories: string[] }>(`/inventory/items?${itemParams}`);
  const movements = useApi<{ movements: StockMovement[]; total: number; limit: number }>(`/inventory/movements?page=${movementPage}&limit=20`);
  const list = items.data?.items ?? [];
  const low = list.filter((i) => i.active && i.lowStock);
  const categories = items.data?.categories ?? [];
  const refresh = () => {
    items.reload();
    movements.reload();
  };

  return (
    <>
      <PageHeader
        eyebrow="MATERIALS CONTROL"
        title="Inventory & materials"
        subtitle="Fabric, printing consumables, thread, trims and packaging. Record stock received and issued to the floor."
        actions={canManage && <button className="btn primary" onClick={() => setEditing('new')}>＋ Add material</button>}
      />
      <div className="stats">
        <StatCard label="Tracked materials" value={items.data?.activeTotal ?? '—'} note="Active SKUs" icon="▧" />
        <StatCard label="Low-stock alerts" value={items.data?.lowStockTotal ?? '—'} note="Below reorder level" icon="!" tone={items.data?.lowStockTotal ? 'amber' : 'green'} />
        <StatCard label="Stock movements" value={movements.data?.total ?? '—'} note="Recorded movements" icon="↔" />
        <StatCard label="Categories" value={categories.length} icon="▤" />
      </div>
      {low.length > 0 && (
        <Notice tone="warn" style={{ marginBottom: 15 }}>
          <strong>Reorder needed:</strong> {low.map((i) => `${i.name} (${i.onHand} ${i.unit})`).join(', ')}
        </Notice>
      )}
      <div className="toolbar">
        <div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search material or SKU…" aria-label="Search inventory" /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stock status">
          <option value="">All stock levels</option>
          <option value="low">Reorder needed</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort inventory">
          <option value="name">Category and name</option>
          <option value="stock">Lowest stock first</option>
          <option value="updated">Recently updated</option>
        </select>
      </div>
      {items.error && <Notice tone="error">{items.error}</Notice>}
      <div className="card flush" style={{ marginBottom: 16 }}>
        {!items.data ? (
          <Spinner />
        ) : !list.length ? (
          <Empty>No materials yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Material</th><th>SKU</th><th>Category</th><th className="num">Available</th><th className="num">Reorder level</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} style={{ opacity: i.active ? 1 : 0.5 }}>
                    <td><strong>{i.name}</strong></td>
                    <td>{i.sku}</td>
                    <td>{i.category}</td>
                    <td className="num">{i.onHand} {i.unit}</td>
                    <td className="num">{i.reorderLevel} {i.unit}</td>
                    <td><Badge>{!i.active ? 'Inactive' : i.lowStock ? 'Reorder needed' : 'In stock'}</Badge></td>
                    <td>
                      {canMove && <><button className="btn small" onClick={() => setMoving({ item: i, type: 'in' })}>＋ In</button>{' '}
                      <button className="btn small" onClick={() => setMoving({ item: i, type: 'out' })}>− Issue</button>{' '}</>}
                      {canAdjust && <button className="btn small" onClick={() => setMoving({ item: i, type: 'adjust' })}>Count</button>}{' '}
                      {canManage && <button className="btn small" onClick={() => setEditing(i)}>Edit</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {items.data && items.data.total > items.data.limit && <div className="toolbar" style={{ marginTop: -6, marginBottom: 16, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn small" disabled={itemPage <= 1} onClick={() => setItemPage(itemPage - 1)}>← Prev</button>
        <span className="small muted">Page {itemPage} of {Math.ceil(items.data.total / items.data.limit)}</span>
        <button className="btn small" disabled={itemPage >= Math.ceil(items.data.total / items.data.limit)} onClick={() => setItemPage(itemPage + 1)}>Next →</button>
      </div>}

      <section className="card flush">
        <div className="card-head" style={{ padding: '18px 18px 0' }}>
          <div><h2>Recent stock movements</h2><div className="card-sub">Every change is recorded with who made it</div></div>
        </div>
        {!movements.data ? (
          <Spinner />
        ) : !movements.data.movements.length ? (
          <Empty>No movements recorded.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Material</th><th>Type</th><th className="num">Change</th><th className="num">Balance</th><th>Order</th><th>Note</th><th>By</th></tr></thead>
              <tbody>
                {movements.data.movements.map((m) => (
                  <tr key={m.id}>
                    <td>{fmtDateTime(m.createdAt)}</td>
                    <td>{m.item.name}</td>
                    <td>{m.type === 'in' ? 'Received' : m.type === 'out' ? 'Issued' : 'Count adjust'}</td>
                    <td className={`num ${m.change < 0 ? 'red' : 'green'}`}>{m.change > 0 ? '+' : ''}{m.change} {m.item.unit}</td>
                    <td className="num">{m.balanceAfter}</td>
                    <td>{m.order?.orderNo ?? '—'}</td>
                    <td className="wrap">{m.note || '—'}</td>
                    <td>{m.byName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {movements.data && movements.data.total > movements.data.limit && <div className="toolbar" style={{ marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn small" disabled={movementPage <= 1} onClick={() => setMovementPage(movementPage - 1)}>← Prev</button>
        <span className="small muted">Page {movementPage} of {Math.ceil(movements.data.total / movements.data.limit)}</span>
        <button className="btn small" disabled={movementPage >= Math.ceil(movements.data.total / movements.data.limit)} onClick={() => setMovementPage(movementPage + 1)}>Next →</button>
      </div>}

      {moving && <MovementModal {...moving} onClose={() => setMoving(null)} onSaved={() => { setMoving(null); refresh(); }} />}
      {editing && <ItemModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </>
  );
}

function MovementModal({ item, type, onClose, onSaved }: { item: InventoryItem; type: MoveType; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [quantity, setQuantity] = useState(type === 'adjust' ? String(item.onHand) : '');
  const [orderNo, setOrderNo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const titles = { in: 'Record stock received', out: 'Issue stock to production', adjust: 'Stock count adjustment' };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/inventory/items/${item.id}/movements`, { method: 'POST', body: { type, quantity: Number(quantity), note, orderNo: orderNo || undefined } });
      toast(`${item.name} updated`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={titles[type]} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="subtitle" style={{ marginBottom: 14 }}>{item.name} · currently {item.onHand} {item.unit}</div>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-grid">
          <Field label={type === 'adjust' ? `Counted quantity (${item.unit}) *` : `Quantity (${item.unit}) *`}>
            <input type="number" min="0" step="any" required value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
          </Field>
          {type === 'out' && (
            <Field label="For order (optional)" hint="e.g. SS-26124">
              <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
            </Field>
          )}
          <Field label={type === 'adjust' ? 'Reason *' : type === 'in' ? 'Supplier / bill ref.' : 'Note'} full>
            <input required={type === 'adjust'} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ItemModal({ item, onClose, onSaved }: { item: InventoryItem | null; onClose: () => void; onSaved: () => void }) {
  const { meta } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: item?.name ?? '',
    sku: item?.sku ?? '',
    category: item?.category ?? meta.inventoryCategories[0],
    unit: item?.unit ?? 'metres',
    reorderLevel: String(item?.reorderLevel ?? 0),
    openingStock: '0',
    active: item?.active ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = item
      ? { name: form.name, sku: form.sku, category: form.category, unit: form.unit, reorderLevel: Number(form.reorderLevel), active: form.active }
      : { ...form, reorderLevel: Number(form.reorderLevel), openingStock: Number(form.openingStock), active: undefined };
    try {
      await api(item ? `/inventory/items/${item.id}` : '/inventory/items', { method: item ? 'PATCH' : 'POST', body });
      toast(item ? 'Material updated' : 'Material added');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add material'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-grid">
          <Field label="Material name *" full><input required value={form.name} onChange={set('name')} placeholder="e.g. Polyester fabric — Red" /></Field>
          <Field label="SKU *"><input required value={form.sku} onChange={set('sku')} placeholder="FAB-RED-01" /></Field>
          <Field label="Category">
            <select value={form.category} onChange={set('category')}>
              {meta.inventoryCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Unit *"><input required value={form.unit} onChange={set('unit')} placeholder="metres, rolls, pieces…" /></Field>
          <Field label="Reorder level"><input type="number" min="0" step="any" value={form.reorderLevel} onChange={set('reorderLevel')} /></Field>
          {!item && <Field label="Opening stock"><input type="number" min="0" step="any" value={form.openingStock} onChange={set('openingStock')} /></Field>}
          {item && (
            <label className="checkbox-line">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
            </label>
          )}
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
