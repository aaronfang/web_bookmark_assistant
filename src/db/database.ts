import Dexie, { type Table } from 'dexie';

import type {
  BookmarkOperation,
  BookmarkRecord,
  BookmarkSnapshot,
} from '../domain/bookmark';

export class BookmarkAssistantDatabase extends Dexie {
  bookmarks!: Table<BookmarkRecord, string>;
  snapshots!: Table<BookmarkSnapshot, string>;
  operations!: Table<BookmarkOperation, string>;

  constructor() {
    super('web-bookmark-assistant');

    this.version(1).stores({
      bookmarks:
        'id, source, sourceId, parentId, url, readingStatus, updatedAt, *tags',
      snapshots: 'id, createdAt',
      operations: 'id, bookmarkId, kind, createdAt, revertedAt',
    });
  }
}

export const database = new BookmarkAssistantDatabase();
