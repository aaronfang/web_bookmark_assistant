export interface ChromeBookmarkSummary {
  folders: number;
  bookmarks: number;
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
