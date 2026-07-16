import { database } from '../db/database';
import type { BookmarkRecord } from '../domain/bookmark';
import { normalizeUrl } from '../search/normalize-url';

export type DuplicateMatchType = 'exact' | 'normalized';

export interface DuplicateBookmarkGroup {
  normalizedUrl: string;
  matchType: DuplicateMatchType;
  bookmarks: BookmarkRecord[];
}

export function findDuplicateBookmarkGroups(
  bookmarks: readonly BookmarkRecord[],
): DuplicateBookmarkGroup[] {
  const groups = new Map<string, BookmarkRecord[]>();

  for (const bookmark of bookmarks) {
    try {
      const normalizedUrl = normalizeUrl(bookmark.url);
      const group = groups.get(normalizedUrl) ?? [];
      group.push(bookmark);
      groups.set(normalizedUrl, group);
    } catch {
      // Bookmarklets and malformed URLs are excluded from automatic grouping.
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedUrl, group]): DuplicateBookmarkGroup => ({
      normalizedUrl,
      matchType:
        new Set(group.map((bookmark) => bookmark.url)).size === 1
          ? 'exact'
          : 'normalized',
      bookmarks: [...group].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.title.localeCompare(right.title, 'zh-CN'),
      ),
    }))
    .sort(
      (left, right) =>
        right.bookmarks.length - left.bookmarks.length ||
        left.normalizedUrl.localeCompare(right.normalizedUrl),
    );
}

export async function findChromeDuplicateBookmarkGroups(): Promise<
  DuplicateBookmarkGroup[]
> {
  const bookmarks = await database.bookmarks
    .where('source')
    .equals('chrome')
    .toArray();
  return findDuplicateBookmarkGroups(bookmarks);
}
