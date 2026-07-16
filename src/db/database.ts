import Dexie, { type Table } from 'dexie';

import type {
  BookmarkOperation,
  BookmarkRecord,
  BookmarkSnapshot,
  BookmarkSuggestion,
  BookmarkTag,
} from '../domain/bookmark';

export class BookmarkAssistantDatabase extends Dexie {
  bookmarks!: Table<BookmarkRecord, string>;
  snapshots!: Table<BookmarkSnapshot, string>;
  operations!: Table<BookmarkOperation, string>;
  tags!: Table<BookmarkTag, string>;
  suggestions!: Table<BookmarkSuggestion, string>;

  constructor() {
    super('web-bookmark-assistant');

    this.version(1).stores({
      bookmarks:
        'id, source, sourceId, parentId, url, readingStatus, updatedAt, *tags',
      snapshots: 'id, createdAt',
      operations: 'id, bookmarkId, kind, createdAt, revertedAt',
    });

    this.version(2).stores({
      bookmarks:
        'id, source, sourceId, parentId, url, readingStatus, updatedAt, *tags',
      snapshots: 'id, createdAt',
      operations: 'id, bookmarkId, kind, createdAt, revertedAt',
      tags: 'id, &normalizedName, updatedAt',
      suggestions: 'id, bookmarkId, kind, status, createdAt',
    });
  }
}

export const database = new BookmarkAssistantDatabase();
