import { database } from '../db/database';
import type { BookmarkRecord } from '../domain/bookmark';

export const OLD_BOOKMARK_DAYS = 730;

export type BookmarkHealthIssueKind =
  'empty-folder' | 'low-quality-title' | 'old-bookmark';

export interface BookmarkHealthIssue {
  id: string;
  kind: BookmarkHealthIssueKind;
  title: string;
  description: string;
  folderPath: string[];
  bookmarkId?: string;
  folderId?: string;
  url?: string;
}

const PLACEHOLDER_TITLES = new Set([
  'untitled',
  'untitled page',
  'new tab',
  '无标题',
  '未命名',
  '未命名页面',
]);

function isLowQualityTitle(bookmark: BookmarkRecord): boolean {
  const title = bookmark.title.trim();
  if (!title || PLACEHOLDER_TITLES.has(title.toLocaleLowerCase())) return true;

  try {
    const url = new URL(bookmark.url);
    const normalizedTitle = title
      .toLocaleLowerCase()
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    const normalizedUrl = bookmark.url
      .trim()
      .toLocaleLowerCase()
      .replace(/\/$/, '');
    const hostname = url.hostname.toLocaleLowerCase().replace(/^www\./, '');

    return normalizedTitle === normalizedUrl || normalizedTitle === hostname;
  } catch {
    return /^https?:\/\//i.test(title);
  }
}

function collectEmptyFolderIssues(
  nodes: readonly chrome.bookmarks.BookmarkTreeNode[],
): BookmarkHealthIssue[] {
  const issues: BookmarkHealthIssue[] = [];

  const visit = (
    node: chrome.bookmarks.BookmarkTreeNode,
    parentPath: readonly string[],
    depth: number,
  ): void => {
    if (node.url) return;

    const isInvisibleRoot = node.parentId === undefined;
    const path = isInvisibleRoot
      ? parentPath
      : [...parentPath, node.title || '未命名文件夹'];
    const children = node.children ?? [];

    // Depth 1 contains Chrome's permanent roots such as Bookmarks bar.
    if (depth >= 2 && children.length === 0) {
      issues.push({
        id: `empty-folder:${node.id}`,
        kind: 'empty-folder',
        title: node.title || '未命名文件夹',
        description: '文件夹中没有书签或子文件夹。',
        folderPath: [...path],
        folderId: node.id,
      });
    }

    children.forEach((child) => visit(child, path, depth + 1));
  };

  nodes.forEach((node) => visit(node, [], 0));
  return issues;
}

export function analyzeBookmarkHealth(
  chromeTree: readonly chrome.bookmarks.BookmarkTreeNode[],
  bookmarks: readonly BookmarkRecord[],
  now = new Date(),
): BookmarkHealthIssue[] {
  const issues = collectEmptyFolderIssues(chromeTree);
  const oldThreshold = now.getTime() - OLD_BOOKMARK_DAYS * 24 * 60 * 60 * 1000;

  for (const bookmark of bookmarks) {
    if (isLowQualityTitle(bookmark)) {
      issues.push({
        id: `low-quality-title:${bookmark.id}`,
        kind: 'low-quality-title',
        title: bookmark.title || '空标题书签',
        description: '标题为空、是占位词，或直接等于网址/域名。',
        folderPath: bookmark.folderPath ?? [],
        bookmarkId: bookmark.id,
        url: bookmark.url,
      });
    }

    const createdAt = Date.parse(bookmark.createdAt);
    if (Number.isFinite(createdAt) && createdAt < oldThreshold) {
      issues.push({
        id: `old-bookmark:${bookmark.id}`,
        kind: 'old-bookmark',
        title: bookmark.title || bookmark.url,
        description: `已收藏超过 ${OLD_BOOKMARK_DAYS} 天，仅按添加时间判断。`,
        folderPath: bookmark.folderPath ?? [],
        bookmarkId: bookmark.id,
        url: bookmark.url,
      });
    }
  }

  const kindOrder: Record<BookmarkHealthIssueKind, number> = {
    'empty-folder': 0,
    'low-quality-title': 1,
    'old-bookmark': 2,
  };
  return issues.sort(
    (left, right) =>
      kindOrder[left.kind] - kindOrder[right.kind] ||
      left.title.localeCompare(right.title, 'zh-CN'),
  );
}

export async function analyzeChromeBookmarkHealth(): Promise<
  BookmarkHealthIssue[]
> {
  const [chromeTree, bookmarks] = await Promise.all([
    chrome.bookmarks.getTree(),
    database.bookmarks.where('source').equals('chrome').toArray(),
  ]);
  return analyzeBookmarkHealth(chromeTree, bookmarks);
}
