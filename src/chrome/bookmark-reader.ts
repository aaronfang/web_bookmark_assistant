import type { BookmarkRecord } from '../domain/bookmark';

export interface ChromeBookmarkSummary {
  folders: number;
  bookmarks: number;
}

export function toChromeBookmarkRecord(
  node: chrome.bookmarks.BookmarkTreeNode,
  folderPath: readonly string[],
  synchronizedAt = new Date().toISOString(),
): BookmarkRecord | null {
  if (!node.url) {
    return null;
  }

  const createdAt = node.dateAdded
    ? new Date(node.dateAdded).toISOString()
    : synchronizedAt;

  return {
    id: `chrome:${node.id}`,
    source: 'chrome',
    sourceId: node.id,
    ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
    title: node.title,
    url: node.url,
    folderPath: [...folderPath],
    tags: [],
    note: '',
    readingStatus: 'inbox',
    createdAt,
    updatedAt: synchronizedAt,
  };
}

export function flattenChromeBookmarkTree(
  nodes: readonly chrome.bookmarks.BookmarkTreeNode[],
  synchronizedAt = new Date().toISOString(),
): BookmarkRecord[] {
  const bookmarks: BookmarkRecord[] = [];

  const visit = (
    node: chrome.bookmarks.BookmarkTreeNode,
    folderPath: readonly string[],
  ): void => {
    const bookmark = toChromeBookmarkRecord(node, folderPath, synchronizedAt);
    if (bookmark) {
      bookmarks.push(bookmark);
      return;
    }

    const isInvisibleRoot = node.parentId === undefined;
    const childPath = isInvisibleRoot
      ? folderPath
      : [...folderPath, node.title];
    node.children?.forEach((child) => visit(child, childPath));
  };

  nodes.forEach((node) => visit(node, []));
  return bookmarks;
}

export function summarizeBookmarkTree(
  nodes: readonly chrome.bookmarks.BookmarkTreeNode[],
): ChromeBookmarkSummary {
  const summary: ChromeBookmarkSummary = { folders: 0, bookmarks: 0 };

  const visit = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    if (node.url) {
      summary.bookmarks += 1;
    } else if (node.parentId !== undefined) {
      summary.folders += 1;
    }

    node.children?.forEach(visit);
  };

  nodes.forEach(visit);
  return summary;
}

export async function readChromeBookmarkSummary(): Promise<ChromeBookmarkSummary> {
  const tree = await chrome.bookmarks.getTree();
  return summarizeBookmarkTree(tree);
}
