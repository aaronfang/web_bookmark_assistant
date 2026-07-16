import { database } from '../db/database';
import type { BookmarkRecord } from '../domain/bookmark';

const DEFAULT_RESULT_LIMIT = 50;

export interface BookmarkSearchDocument {
  bookmark: BookmarkRecord;
  title: string;
  url: string;
  folder: string;
  metadata: string;
  searchable: string;
}

let cachedSearchIndex: Promise<BookmarkSearchDocument[]> | undefined;

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase();
}

export function filterBookmarks(
  bookmarks: readonly BookmarkRecord[],
  query: string,
  limit = DEFAULT_RESULT_LIMIT,
): BookmarkRecord[] {
  return searchBookmarkIndex(buildBookmarkSearchIndex(bookmarks), query, limit);
}

export function buildBookmarkSearchIndex(
  bookmarks: readonly BookmarkRecord[],
): BookmarkSearchDocument[] {
  return bookmarks.map((bookmark) => {
    const title = normalizeSearchText(bookmark.title);
    const url = normalizeSearchText(bookmark.url);
    const folder = normalizeSearchText((bookmark.folderPath ?? []).join(' / '));
    const metadata = normalizeSearchText(
      `${bookmark.tags.join(' ')} ${bookmark.note}`,
    );

    return {
      bookmark,
      title,
      url,
      folder,
      metadata,
      searchable: `${title}\n${url}\n${folder}\n${metadata}`,
    };
  });
}

export function searchBookmarkIndex(
  index: readonly BookmarkSearchDocument[],
  query: string,
  limit = DEFAULT_RESULT_LIMIT,
): BookmarkRecord[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  return index
    .map((document) => {
      if (!terms.every((term) => document.searchable.includes(term))) {
        return null;
      }

      let score = 0;
      for (const term of terms) {
        if (document.title.startsWith(term)) score += 8;
        else if (document.title.includes(term)) score += 5;
        if (document.folder.includes(term)) score += 3;
        if (document.url.includes(term)) score += 2;
        if (document.metadata.includes(term)) score += 1;
      }

      return { bookmark: document.bookmark, score };
    })
    .filter(
      (result): result is { bookmark: BookmarkRecord; score: number } =>
        result !== null,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.bookmark.title.localeCompare(right.bookmark.title, 'zh-CN'),
    )
    .slice(0, limit)
    .map(({ bookmark }) => bookmark);
}

export function invalidateBookmarkSearchIndex(): void {
  cachedSearchIndex = undefined;
}

async function loadBookmarkSearchIndex(): Promise<BookmarkSearchDocument[]> {
  cachedSearchIndex ??= database.bookmarks
    .toArray()
    .then(buildBookmarkSearchIndex);
  return cachedSearchIndex;
}

export async function searchBookmarks(
  query: string,
): Promise<BookmarkRecord[]> {
  const index = await loadBookmarkSearchIndex();
  return searchBookmarkIndex(index, query);
}
