import type { BookmarkRecord } from '../domain/bookmark';
import { database } from '../db/database';

export const LINK_CHECK_TIMEOUT_MS = 8_000;

export type LinkHealthStatus =
  | 'healthy'
  | 'redirected'
  | 'auth-required'
  | 'not-found'
  | 'server-error'
  | 'timeout'
  | 'network-error';

export interface LinkHealthResult {
  bookmarkId: string;
  url: string;
  status: LinkHealthStatus;
  httpStatus?: number;
  checkedAt: string;
  message: string;
}

function classify(status: number): LinkHealthStatus {
  if (status === 401 || status === 403) return 'auth-required';
  if (status === 404 || status === 410) return 'not-found';
  if (status >= 500) return 'server-error';
  if (status >= 300 && status < 400) return 'redirected';
  return status >= 200 && status < 300 ? 'healthy' : 'network-error';
}

export async function checkBookmarkLink(
  bookmark: Pick<BookmarkRecord, 'id' | 'url'>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = LINK_CHECK_TIMEOUT_MS,
): Promise<LinkHealthResult> {
  const checkedAt = new Date().toISOString();
  let protocol: string;
  try {
    protocol = new URL(bookmark.url).protocol;
  } catch {
    return {
      bookmarkId: bookmark.id,
      url: bookmark.url,
      status: 'network-error',
      checkedAt,
      message: '网址格式无效，未发起网络请求。',
    };
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    return {
      bookmarkId: bookmark.id,
      url: bookmark.url,
      status: 'network-error',
      checkedAt,
      message: `不支持 ${protocol.replace(':', '')} 协议，未发起网络请求。`,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(bookmark.url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });
    const status = classify(response.status);
    return {
      bookmarkId: bookmark.id,
      url: bookmark.url,
      status,
      httpStatus: response.status,
      checkedAt,
      message:
        status === 'healthy'
          ? '链接可访问。'
          : status === 'redirected'
            ? '链接发生重定向，需人工确认目标。'
            : `HTTP ${response.status}。`,
    };
  } catch (error) {
    const status =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'timeout'
        : 'network-error';
    return {
      bookmarkId: bookmark.id,
      url: bookmark.url,
      status,
      checkedAt,
      message:
        status === 'timeout' ? '请求超时。' : '网络请求失败或被浏览器阻止。',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkBookmarkLinks(
  bookmarks: readonly Pick<BookmarkRecord, 'id' | 'url'>[],
  fetchImpl?: typeof fetch,
  persist: (results: readonly LinkHealthResult[]) => Promise<unknown> = (
    results,
  ) => database.linkHealth.bulkPut(results),
): Promise<LinkHealthResult[]> {
  const results = await Promise.all(
    bookmarks.map((bookmark) => checkBookmarkLink(bookmark, fetchImpl)),
  );
  await persist(results);
  return results;
}

export async function checkStoredChromeBookmarkLinks(): Promise<
  LinkHealthResult[]
> {
  const bookmarks = await database.bookmarks
    .where('source')
    .equals('chrome')
    .toArray();
  return checkBookmarkLinks(bookmarks);
}
