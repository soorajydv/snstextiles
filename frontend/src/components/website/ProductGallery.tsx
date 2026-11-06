'use client';

import { useState } from 'react';
import { siteImage } from '@/lib/site-client';
import type { SiteProduct } from '@/lib/types';
import { ProductImage } from './shop-ui';

export function ProductGallery({ product }: { product: Pick<SiteProduct, 'name' | 'images'> }) {
  const [active, setActive] = useState(0);
  const images = product.images;
  const current = images[active] ? { ...product, images: [images[active]] } : product;
  return (
    <div className="gallery-main">
      <div className="gallery-stage">
        <ProductImage priority product={current} sizes="(min-width: 1024px) 50vw, 100vw" />
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs" role="tablist" aria-label="Product images">
          {images.map((src, i) => (
            <button aria-label={`Image ${i + 1}`} aria-selected={i === active} className={i === active ? 'active' : undefined} key={`${src}-${i}`} onClick={() => setActive(i)} role="tab" type="button">
              <img alt="" loading="lazy" src={siteImage(src)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
