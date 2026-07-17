import type { ContentInput } from './provider';

const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'api_key',
  'apikey',
  'auth',
  'authorization',
  'code',
  'key',
  'password',
  'session',
  'session_id',
  'token',
]);

export interface AiPrivacySettings {
  excludedDomains: string[];
}

export function sanitizeUrlForAi(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLocaleLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function isDomainExcluded(
  rawUrl: string,
  excludedDomains: readonly string[],
): boolean {
  try {
    const hostname = new URL(rawUrl).hostname.toLocaleLowerCase();
    return excludedDomains.some((domain) => {
      const normalized = domain.trim().toLocaleLowerCase().replace(/^\./, '');
      return (
        normalized &&
        (hostname === normalized || hostname.endsWith(`.${normalized}`))
      );
    });
  } catch {
    return true;
  }
}

export function prepareContentInputForAi(
  input: ContentInput,
  settings: AiPrivacySettings,
): ContentInput {
  if (isDomainExcluded(input.url, settings.excludedDomains)) {
    throw new Error('This domain is excluded from AI requests');
  }
  return { ...input, url: sanitizeUrlForAi(input.url) };
}
