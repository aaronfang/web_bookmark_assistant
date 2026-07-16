export type BookmarkSource = 'chrome' | 'local' | 'imported';

export type ReadingStatus =
  'inbox' | 'unread' | 'reading' | 'completed' | 'archived';

export interface BookmarkRecord {
  id: string;
  source: BookmarkSource;
  sourceId?: string;
  parentId?: string;
  index?: number;
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
  batchId: string;
  kind: 'create' | 'update' | 'move' | 'archive' | 'delete';
  status: 'pending' | 'applied' | 'reverted' | 'failed';
  bookmarkId: string;
  createdAt: string;
  before?: string;
  after?: string;
  revertedAt?: string;
  error?: string;
}

export type BookmarkOperationBatchStatus =
  'planned' | 'executing' | 'completed' | 'failed' | 'reverting' | 'reverted';

export interface BookmarkOperationBatch {
  id: string;
  kind: 'move';
  status: BookmarkOperationBatchStatus;
  snapshotId: string;
  operationCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  revertedAt?: string;
  error?: string;
}
