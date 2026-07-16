import {
  flattenChromeBookmarkTree,
  summarizeBookmarkTree,
  toChromeBookmarkRecord,
  type ChromeBookmarkSummary,
} from '../chrome/bookmark-reader';
import { database } from '../db/database';
import type { BookmarkRecord } from '../domain/bookmark';

let activeSynchronization: Promise<ChromeBookmarkSummary> | undefined;

async function readFolderPath(parentId: string | undefined): Promise<string[]> {
  const folderPath: string[] = [];
  let currentId = parentId;

  while (currentId !== undefined) {
    const [folder] = await chrome.bookmarks.get(currentId);
    if (!folder) break;

    if (folder.parentId !== undefined && folder.title) {
      folderPath.unshift(folder.title);
    }
    currentId = folder.parentId;
  }

  return folderPath;
}

async function synchronize(): Promise<ChromeBookmarkSummary> {
  const tree = await chrome.bookmarks.getTree();
  const summary = summarizeBookmarkTree(tree);
  const incoming = flattenChromeBookmarkTree(tree);

  await database.transaction('rw', database.bookmarks, async () => {
    const existing = await database.bookmarks
      .where('source')
      .equals('chrome')
      .toArray();
    const existingBySourceId = new Map(
      existing.map((bookmark) => [bookmark.sourceId, bookmark]),
    );
    const merged: BookmarkRecord[] = incoming.map((bookmark) => {
      const previous = existingBySourceId.get(bookmark.sourceId);

      if (!previous) {
        return bookmark;
      }

      return {
        ...bookmark,
        tags: previous.tags,
        note: previous.note,
        readingStatus: previous.readingStatus,
      };
    });

    await database.bookmarks.where('source').equals('chrome').delete();
    await database.bookmarks.bulkPut(merged);
  });

  return summary;
}

export function synchronizeChromeBookmarkMirror(): Promise<ChromeBookmarkSummary> {
  activeSynchronization ??= synchronize().finally(() => {
    activeSynchronization = undefined;
  });
  return activeSynchronization;
}

export async function upsertChromeBookmarkMirror(
  node: chrome.bookmarks.BookmarkTreeNode,
): Promise<void> {
  if (!node.url) {
    await synchronizeChromeBookmarkMirror();
    return;
  }

  const folderPath = await readFolderPath(node.parentId);
  const incoming = toChromeBookmarkRecord(node, folderPath);
  if (!incoming) return;

  const previous = await database.bookmarks.get(incoming.id);
  await database.bookmarks.put(
    previous
      ? {
          ...incoming,
          tags: previous.tags,
          note: previous.note,
          readingStatus: previous.readingStatus,
        }
      : incoming,
  );
}

export async function refreshChromeBookmarkMirror(id: string): Promise<void> {
  try {
    const [node] = await chrome.bookmarks.get(id);
    if (node) {
      await upsertChromeBookmarkMirror(node);
    }
  } catch {
    await database.bookmarks.delete(`chrome:${id}`);
  }
}

export async function removeChromeBookmarkMirrors(
  sourceIds: readonly string[],
): Promise<void> {
  await database.bookmarks.bulkDelete(
    sourceIds.map((sourceId) => `chrome:${sourceId}`),
  );
}
