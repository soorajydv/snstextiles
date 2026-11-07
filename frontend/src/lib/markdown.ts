/**
 * Minimal, safe Markdown → HTML for website pages, posts and product descriptions.
 * All input is HTML-escaped first; only a known subset of Markdown is turned back into tags.
 * Supports: # headings, paragraphs, - / 1. lists, > quotes, **bold**, *italic*, `code`,
 * [links](url), ![images](url), --- rules and line breaks.
 */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function safeUrl(raw: string, resolve?: (url: string) => string) {
  const url = raw.trim().replace(/&amp;/g, '&');
  if (/^(https?:|mailto:|tel:)/i.test(url) || url.startsWith('/') || url.startsWith('#')) return escapeHtml(resolve ? resolve(url) : url);
  return '#';
}

function inline(text: string, resolve?: (url: string) => string) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => `<img src="${safeUrl(src, resolve)}" alt="${alt}" loading="lazy" />`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
      const url = safeUrl(href);
      const external = /^https?:/i.test(url);
      return `<a href="${url}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?;:])/g, '$1<em>$2</em>');
}

export function renderMarkdown(source: string, resolveImage?: (url: string) => string): string {
  const lines = escapeHtml(source.replace(/\r\n/g, '\n')).split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${inline(paragraph.join('<br />'), resolveImage)}</p>`); paragraph = []; } };
  const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i, resolveImage)}</li>`).join('')}</${list.type}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${inline(quote.join('<br />'), resolveImage)}</blockquote>`); quote = []; } };
  const flushAll = () => { flushParagraph(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushAll(); continue; }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { flushAll(); const level = Math.min(4, heading[1].length + 1); out.push(`<h${level}>${inline(heading[2], resolveImage)}</h${level}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushAll(); out.push('<hr />'); continue; }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph(); flushQuote();
      const type = bullet ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    const q = /^&gt;\s?(.*)$/.exec(line);
    if (q) { flushParagraph(); flushList(); quote.push(q[1]); continue; }
    if (list) flushList();
    if (quote.length) flushQuote();
    paragraph.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

/** Plain-text excerpt for meta descriptions and cards. */
export function markdownToText(source: string, max = 160) {
  const text = source.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`-]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
