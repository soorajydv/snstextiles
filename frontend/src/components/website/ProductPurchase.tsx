'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { npr } from '@/lib/site-client';
import type { ShopSize, SiteProduct } from '@/lib/types';
import { itemQuantity, useCart, type CartPlayer } from './cart';
import { SiteIcon } from './SiteIcon';

/** Parses "Name, Number, Size" lines (comma or tab separated, as pasted from a spreadsheet). */
export function parseRoster(text: string, sizes: ShopSize[]): CartPlayer[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name = '', number = '', size = ''] = line.split(/\t|,|;/).map((c) => c.trim());
    const upper = size.toUpperCase().replace(/^XXL$/, '2XL').replace(/^XXXL$/, '3XL') as ShopSize;
    return { name: name.slice(0, 60), number: number.slice(0, 6), size: sizes.includes(upper) ? upper : '' };
  });
}

export function ProductPurchase({ product }: { product: SiteProduct }) {
  const router = useRouter();
  const { add } = useCart();
  const [neckType, setNeckType] = useState(product.neckTypes[0] ?? '');
  const [sleeve, setSleeve] = useState(product.sleeves[0] ?? '');
  const [color, setColor] = useState(product.colors[0]?.name ?? '');
  const [sizes, setSizes] = useState<Partial<Record<ShopSize, number>>>({});
  const [teamName, setTeamName] = useState('');
  const [rosterOpen, setRosterOpen] = useState(false);
  const [roster, setRoster] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  const quantity = itemQuantity({ sizes });
  const players = useMemo(() => parseRoster(roster, product.sizes), [roster, product.sizes]);
  const unavailable = product.stockStatus === 'out_of_stock';

  const setSize = (size: ShopSize, value: number) => {
    setAdded(false);
    setSizes((s) => ({ ...s, [size]: Math.max(0, Math.min(5000, Math.floor(value) || 0)) }));
  };

  function addToCart(goToCart: boolean) {
    setError('');
    if (quantity < 1) { setError('Choose how many pieces you need in each size.'); return; }
    if (quantity < product.minQuantity) { setError(`The minimum order for this design is ${product.minQuantity} pieces.`); return; }
    if (players.length > quantity) { setError(`You entered ${players.length} names but only ${quantity} pieces.`); return; }
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0] ?? '',
      unitPrice: product.finalPrice,
      minQuantity: product.minQuantity,
      sizes: Object.fromEntries(Object.entries(sizes).filter(([, q]) => (q ?? 0) > 0)),
      sleeve,
      neckType,
      color,
      teamName: teamName.trim(),
      players,
      notes: notes.trim(),
    });
    setAdded(true);
    if (goToCart) router.push('/checkout');
  }

  return (
    <div className="buy">
      {product.neckTypes.length > 1 && (
        <fieldset className="buy-group">
          <legend>Neck</legend>
          <div className="chips">
            {product.neckTypes.map((n) => <label className="chip" key={n}><input checked={neckType === n} name="neck" onChange={() => setNeckType(n)} type="radio" />{n}</label>)}
          </div>
        </fieldset>
      )}
      {product.sleeves.length > 1 && (
        <fieldset className="buy-group">
          <legend>Sleeves</legend>
          <div className="chips">
            {product.sleeves.map((s) => <label className="chip" key={s}><input checked={sleeve === s} name="sleeve" onChange={() => setSleeve(s)} type="radio" />{s}</label>)}
          </div>
        </fieldset>
      )}
      {product.colors.length > 0 && (
        <fieldset className="buy-group">
          <legend>Colour <span>{color}</span></legend>
          <div className="chips">
            {product.colors.map((c) => (
              <label className={`chip${c.hex ? ' chip-swatch' : ''}`} key={c.name} title={c.name}>
                <input checked={color === c.name} name="color" onChange={() => setColor(c.name)} type="radio" />
                {c.hex ? <><i style={{ background: c.hex }} /><span className="visually-hidden">{c.name}</span></> : c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="buy-group">
        <legend>Sizes &amp; quantity {product.minQuantity > 1 && <span>Minimum {product.minQuantity} pieces</span>}</legend>
        <div className="size-grid">
          {product.sizes.map((size) => (
            <div className="size-cell" key={size}>
              <span>{size}</span>
              <div className="stepper-input">
                <button aria-label={`Fewer ${size}`} disabled={!sizes[size]} onClick={() => setSize(size, (sizes[size] ?? 0) - 1)} type="button"><SiteIcon name="minus" size={14} /></button>
                <input aria-label={`Quantity in size ${size}`} inputMode="numeric" min={0} onChange={(e) => setSize(size, Number(e.target.value))} type="number" value={sizes[size] ?? 0} />
                <button aria-label={`More ${size}`} onClick={() => setSize(size, (sizes[size] ?? 0) + 1)} type="button"><SiteIcon name="plus" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {product.allowPersonalisation && (
        <fieldset className="buy-group">
          <legend>Personalisation <span>optional</span></legend>
          <label className="buy-field">
            <span>Team / club name</span>
            <input maxLength={120} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Kalanki Kings FC" value={teamName} />
          </label>
          <button aria-expanded={rosterOpen} className="link-toggle" onClick={() => setRosterOpen((v) => !v)} type="button">
            <SiteIcon name={rosterOpen ? 'minus' : 'plus'} size={16} /> Add player names &amp; numbers
          </button>
          {rosterOpen && (
            <label className="buy-field">
              <span>One player per line: <code>Name, Number, Size</code> — you can paste from Excel.</span>
              <textarea onChange={(e) => setRoster(e.target.value)} placeholder={'Ram Shrestha, 10, M\nSita Lama, 7, S'} rows={5} value={roster} />
              {players.length > 0 && <small>{players.length} player{players.length === 1 ? '' : 's'} added{players.some((p) => !p.size) ? ' · rows without a valid size use your size breakdown' : ''}</small>}
            </label>
          )}
        </fieldset>
      )}

      <label className="buy-field">
        <span>Notes for our designers <em>optional</em></span>
        <textarea maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Colours, sponsor logos, font style…" rows={2} value={notes} />
      </label>
      {product.allowDesignUpload && <p className="buy-hint"><SiteIcon name="upload" size={16} /> You can upload your logo or artwork at checkout.</p>}

      <div className="buy-total">
        <span>{quantity} piece{quantity === 1 ? '' : 's'} × {npr(product.finalPrice)}</span>
        <strong>{npr(quantity * product.finalPrice)}</strong>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {added && !error && <p className="form-success" role="status"><SiteIcon name="check" size={16} /> Added to your cart. <a href="/cart">View cart</a></p>}
      <div className="buy-actions">
        <button className="site-btn site-btn-dark" disabled={unavailable} onClick={() => addToCart(false)} type="button"><SiteIcon name="bag" size={18} /> Add to cart</button>
        <button className="site-btn" disabled={unavailable} onClick={() => addToCart(true)} type="button">Buy now <SiteIcon name="arrow" /></button>
      </div>
      {unavailable && <p className="form-error">This design is currently unavailable. <a href="/custom-jersey">Request something similar</a>.</p>}
    </div>
  );
}
