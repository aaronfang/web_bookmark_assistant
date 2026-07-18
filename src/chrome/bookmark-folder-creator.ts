import { isValidNewFolderName } from '../suggestions/ai-folder-match';

export interface BookmarkFolderApi {
  get(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  create(
    details: chrome.bookmarks.CreateDetails,
  ): Promise<chrome.bookmarks.BookmarkTreeNode>;
  remove(id: string): Promise<void>;
}

export interface ResolvedBookmarkFolder {
  folder: chrome.bookmarks.BookmarkTreeNode;
  created: boolean;
}

function normalizedTitle(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

export async function resolveOrCreateBookmarkFolder(
  parentId: string,
  requestedName: string,
  api: BookmarkFolderApi = chrome.bookmarks,
): Promise<ResolvedBookmarkFolder> {
  const name = requestedName.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!isValidNewFolderName(name)) {
    throw new Error('新文件夹名称无效或超过 80 个字符');
  }
  const [parent] = await api.get(parentId);
  if (!parent || parent.url) throw new Error('新文件夹的父目录不存在');

  const existing = (await api.getChildren(parentId)).filter(
    (node) =>
      !node.url && normalizedTitle(node.title) === normalizedTitle(name),
  );
  if (existing.length > 1) {
    throw new Error('父目录中存在多个同名文件夹，请手动选择目标目录');
  }
  if (existing[0]) return { folder: existing[0], created: false };

  const folder = await api.create({ parentId, title: name });
  if (folder.url) throw new Error('Chrome 未能创建书签文件夹');
  return { folder, created: true };
}

export async function removeCreatedFolderIfEmpty(
  resolved: ResolvedBookmarkFolder | null,
  api: BookmarkFolderApi = chrome.bookmarks,
): Promise<void> {
  if (!resolved?.created) return;
  const children = await api.getChildren(resolved.folder.id);
  if (children.length === 0) await api.remove(resolved.folder.id);
}
