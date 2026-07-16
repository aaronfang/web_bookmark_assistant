import { database } from '../db/database';
import type { BookmarkRecord, BookmarkSnapshot } from '../domain/bookmark';

export const BOOKMARK_SNAPSHOT_FORMAT = 'web-bookmark-assistant-snapshot';
export const BOOKMARK_SNAPSHOT_SCHEMA_VERSION = 1;

export interface BookmarkSnapshotDocument {
  format: typeof BOOKMARK_SNAPSHOT_FORMAT;
  schemaVersion: typeof BOOKMARK_SNAPSHOT_SCHEMA_VERSION;
  applicationVersion: string;
  createdAt: string;
  chromeTree: chrome.bookmarks.BookmarkTreeNode[];
  localBookmarks: BookmarkRecord[];
}

export interface CreatedBookmarkSnapshot {
  filename: string;
  json: string;
  document: BookmarkSnapshotDocument;
  record: BookmarkSnapshot;
}

export function buildBookmarkSnapshotDocument(
  chromeTree: chrome.bookmarks.BookmarkTreeNode[],
  localBookmarks: BookmarkRecord[],
  createdAt: string,
  applicationVersion: string,
): BookmarkSnapshotDocument {
  return {
    format: BOOKMARK_SNAPSHOT_FORMAT,
    schemaVersion: BOOKMARK_SNAPSHOT_SCHEMA_VERSION,
    applicationVersion,
    createdAt,
    chromeTree,
    localBookmarks,
  };
}

export function createBookmarkSnapshotFilename(createdAt: string): string {
  const timestamp = createdAt.replace(/[:.]/g, '-');
  return `web-bookmark-assistant-${timestamp}.json`;
}

export async function createLocalBookmarkSnapshot(): Promise<CreatedBookmarkSnapshot> {
  const createdAt = new Date().toISOString();
  const [chromeTree, localBookmarks] = await Promise.all([
    chrome.bookmarks.getTree(),
    database.bookmarks.toArray(),
  ]);
  const document = buildBookmarkSnapshotDocument(
    chromeTree,
    localBookmarks,
    createdAt,
    chrome.runtime.getManifest().version,
  );
  const json = JSON.stringify(document, null, 2);
  const record: BookmarkSnapshot = {
    id: `snapshot:${crypto.randomUUID()}`,
    reason: 'manual-export',
    createdAt,
    payload: json,
  };

  await database.snapshots.put(record);

  return {
    filename: createBookmarkSnapshotFilename(createdAt),
    json,
    document,
    record,
  };
}
