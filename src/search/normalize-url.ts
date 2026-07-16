const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref_src',
]);

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || TRACKING_PARAMETERS.has(key)) {
      url.searchParams.delete(key);
    }
  }

  url.hostname = url.hostname.toLowerCase();

  if (url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/$/, '');
  }

  url.searchParams.sort();
  return url.toString();
}
