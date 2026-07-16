import { database } from '../db/database';
import type { BookmarkRecord } from '../domain/bookmark';

export async function countIndependentBookmarks(): Promise<number> {
  return database.bookmarks.where('source').equals('local').count();
}

export async function saveIndependentBookmark(
  input: Pick<BookmarkRecord, 'title' | 'url'> &
    Partial<Pick<BookmarkRecord, 'note' | 'tags' | 'readingStatus'>>,
): Promise<BookmarkRecord> {
  const now = new Date().toISOString();
  const bookmark: BookmarkRecord = {
    id: `local:${crypto.randomUUID()}`,
    source: 'local',
    title: input.title,
    url: input.url,
    tags: input.tags ?? [],
    note: input.note ?? '',
    readingStatus: input.readingStatus ?? 'inbox',
    createdAt: now,
    updatedAt: now,
  };

  await database.bookmarks.put(bookmark);
  return bookmark;
}
