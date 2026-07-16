export interface BookmarkFolderNode {
  id: string;
  title: string;
  path: string[];
  bookmarks: chrome.bookmarks.BookmarkTreeNode[];
  children: BookmarkFolderNode[];
  totalBookmarks: number;
}

function buildFolderNode(
  node: chrome.bookmarks.BookmarkTreeNode,
  parentPath: readonly string[],
): BookmarkFolderNode {
  const title = node.title || '未命名文件夹';
  const path = [...parentPath, title];
  const bookmarks = (node.children ?? []).filter((child) => Boolean(child.url));
  const children = (node.children ?? [])
    .filter((child) => !child.url)
    .map((child) => buildFolderNode(child, path));

  return {
    id: node.id,
    title,
    path,
    bookmarks,
    children,
    totalBookmarks:
      bookmarks.length +
      children.reduce((total, child) => total + child.totalBookmarks, 0),
  };
}

export function buildBookmarkFolderTree(
  nodes: readonly chrome.bookmarks.BookmarkTreeNode[],
): BookmarkFolderNode[] {
  return nodes.flatMap((node) => {
    if (node.url) return [];

    if (node.parentId === undefined) {
      return (node.children ?? [])
        .filter((child) => !child.url)
        .map((child) => buildFolderNode(child, []));
    }

    return [buildFolderNode(node, [])];
  });
}

export function findBookmarkFolder(
  folders: readonly BookmarkFolderNode[],
  id: string,
): BookmarkFolderNode | undefined {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const nested = findBookmarkFolder(folder.children, id);
    if (nested) return nested;
  }
  return undefined;
}
