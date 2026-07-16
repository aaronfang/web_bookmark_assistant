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
  folderPath: string[];
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

export interface BookmarkTag {
  id: string;
  name: string;
  normalizedName: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookmarkSuggestionKind =
  'add-tags' | 'move' | 'rename' | 'archive' | 'merge-duplicate';

export interface BookmarkSuggestion {
  id: string;
  bookmarkId: string;
  kind: BookmarkSuggestionKind;
  status: 'pending' | 'accepted' | 'dismissed' | 'applied';
  confidence: number;
  explanation: string;
  proposedChange: string;
  createdAt: string;
  resolvedAt?: string;
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
