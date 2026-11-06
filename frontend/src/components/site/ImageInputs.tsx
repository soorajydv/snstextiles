'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { assetPath } from '@/lib/paths';
import { useToast } from '@/components/Toast';
import { errorMessage } from '@/components/ui';

const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

export async function uploadSiteImages(files: File[]): Promise<string[]> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  const result = await api<{ media: { url: string }[] }>('/site/media', { method: 'POST', form });
  return result.media.map((m) => m.url);
}

/** Ordered image list with upload, paste-a-URL, reorder and remove. The first image is the cover. */
export function ImageListInput({ value, onChange, max = 12, disabled }: { value: string[]; onChange: (next: string[]) => void; max?: number; disabled?: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const room = max - value.length;
    if (room <= 0) { toast(`You can add up to ${max} images`, 'error'); return; }
    setBusy(true);
    try {
      const urls = await uploadSiteImages(Array.from(files).slice(0, room));
      onChange([...value, ...urls]);
      toast(`${urls.length} image${urls.length === 1 ? '' : 's'} uploaded`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  function addUrl() {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) { toast('Paste a full image link starting with https://', 'error'); return; }
    onChange([...value, trimmed].slice(0, max));
    setUrl('');
  }

  return (
    <div className="image-list-input">
      {value.length > 0 && (
        <div className="image-tiles">
          {value.map((src, i) => (
            <div className="image-tile" key={`${src}-${i}`}>
              <img src={assetPath(src)} alt="" />
              {i === 0 && <span className="image-cover">Cover</span>}
              {!disabled && (
                <div className="image-tile-actions">
                  <button type="button" className="icon-btn" title="Move left" onClick={() => move(i, i - 1)} disabled={i === 0}>‹</button>
                  <button type="button" className="icon-btn" title="Move right" onClick={() => move(i, i + 1)} disabled={i === value.length - 1}>›</button>
                  <button type="button" className="icon-btn danger" title="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!disabled && value.length < max && (
        <div className="image-list-controls">
          <button type="button" className="btn small" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Uploading…' : '＋ Upload images'}</button>
          <input ref={input} type="file" accept={IMAGE_TYPES} multiple hidden onChange={(e) => upload(e.target.files)} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an image URL" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} />
          <button type="button" className="btn small" onClick={addUrl} disabled={!url.trim()}>Add</button>
        </div>
      )}
    </div>
  );
}

/** Single optional image (category tile, hero, blog cover…). */
export function ImageInput({ value, onChange, disabled }: { value: string; onChange: (next: string) => void; disabled?: boolean }) {
  return <ImageListInput value={value ? [value] : []} onChange={(next) => onChange(next[next.length - 1] ?? '')} max={1} disabled={disabled} />;
}
