export const PAGE_DESCRIPTION_LIMIT = 1_000;
export const PAGE_SELECTION_LIMIT = 4_000;
export const PAGE_CONTENT_EXCERPT_LIMIT = 6_000;

export interface RawPageMetadata {
  description: string;
  selectedText: string;
  contentText: string;
}

export interface PageMetadata {
  description: string;
  selectedText: string;
  contentExcerpt: string;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function truncateText(value: string, limit: number): string {
  const normalized = normalizeText(value);
  if (normalized.length <= limit) return normalized;

  const prefix = normalized.slice(0, limit - 1);
  const lastBoundary = Math.max(
    prefix.lastIndexOf('\n'),
    prefix.lastIndexOf(' '),
  );
  const truncated =
    lastBoundary >= Math.floor(limit * 0.8)
      ? prefix.slice(0, lastBoundary)
      : prefix;
  return `${truncated.trimEnd()}…`;
}

export function normalizePageMetadata(raw: RawPageMetadata): PageMetadata {
  return {
    description: truncateText(raw.description, PAGE_DESCRIPTION_LIMIT),
    selectedText: truncateText(raw.selectedText, PAGE_SELECTION_LIMIT),
    contentExcerpt: truncateText(raw.contentText, PAGE_CONTENT_EXCERPT_LIMIT),
  };
}

/**
 * Runs inside the active tab through chrome.scripting.executeScript.
 * Keep this function self-contained because Chrome serializes its body.
 */
export function collectRawPageMetadata(): RawPageMetadata {
  const description =
    document
      .querySelector(
        'meta[name="description"], meta[property="og:description"]',
      )
      ?.getAttribute('content') ?? '';
  const selectedText = window.getSelection()?.toString() ?? '';
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>('article, main, [role="main"]'),
  );
  const normalizeForScore = (value: string): string =>
    value.replace(/\s+/g, ' ').trim();
  const bestRoot = roots.reduce<HTMLElement | null>((best, current) => {
    if (!best) return current;
    return normalizeForScore(current.innerText).length >
      normalizeForScore(best.innerText).length
      ? current
      : best;
  }, null);
  const source = bestRoot ?? document.body;
  let contentText = '';

  if (source) {
    const clean = source.cloneNode(true) as HTMLElement;
    clean
      .querySelectorAll(
        'script, style, noscript, nav, footer, header, aside, form, dialog, [aria-hidden="true"]',
      )
      .forEach((node) => node.remove());
    contentText = clean.innerText || clean.textContent || '';
  }

  // Bound data while it crosses from the page into the extension context.
  return {
    description: description.slice(0, 2_000),
    selectedText: selectedText.slice(0, 8_000),
    contentText: contentText.slice(0, 12_000),
  };
}

export function readPageMetadata(): PageMetadata {
  return normalizePageMetadata(collectRawPageMetadata());
}
