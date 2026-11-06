import type { SiteCategory } from './types';

/** Flattens categories into parent → child order with a depth for indentation. */
export function sortTree(categories: SiteCategory[]) {
  const children = new Map<string | null, SiteCategory[]>();
  for (const c of categories) {
    const key = c.parent && categories.some((p) => p.id === c.parent) ? c.parent : null;
    children.set(key, [...(children.get(key) ?? []), c]);
  }
  const out: { category: SiteCategory; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of (children.get(parent) ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
      out.push({ category: c, depth });
      if (depth < 6) walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
