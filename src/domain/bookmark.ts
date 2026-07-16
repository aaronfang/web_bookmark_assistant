export type BookmarkSource = 'chrome' | 'local' | 'imported';

export type ReadingStatus =
  'inbox' | 'unread' | 'reading' | 'completed' | 'archived';

export interface BookmarkRecord {
  id: string;
  source: BookmarkSource;
  sourceId?: string;
  parentId?: string;
  title: string;
  url: string;
  tags: string[];
  note: string;
  readingStatus: ReadingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkSnapshot {
  id: string;
  reason: string;
  createdAt: string;
  payload: string;
}

export interface BookmarkOperation {
  id: string;
  kind: 'create' | 'update' | 'move' | 'archive' | 'delete';
  bookmarkId: string;
  createdAt: string;
  before?: string;
  after?: string;
  revertedAt?: string;
}
