import { database } from '../db/database';
import type { BookmarkRecord } from '../domain/bookmark';

export const MIN_DOMAIN_BOOKMARKS = 4;
export const MIN_TARGET_FOLDER_BOOKMARKS = 3;
export const MIN_MOVE_CONFIDENCE = 0.75;

export interface FolderMoveSuggestion {
  id: string;
  bookmark: BookmarkRecord;
  hostname: string;
  currentFolderPath: string[];
  targetParentId: string;
  targetFolderPath: string[];
  evidenceCount: number;
  domainBookmarkCount: number;
  confidence: number;
  explanation: string;
}

function comparisonHostname(url: string): string | null {
  try {
    const hostname = new URL(url).hostname
      .toLocaleLowerCase()
      .replace(/^www\./, '');
    return hostname || null;
  } catch {
    return null;
  }
}

export function generateFolderMoveSuggestions(
  bookmarks: readonly BookmarkRecord[],
): FolderMoveSuggestion[] {
  const byHostname = new Map<string, BookmarkRecord[]>();

  for (const bookmark of bookmarks) {
    const hostname = comparisonHostname(bookmark.url);
    if (!hostname || !bookmark.parentId) continue;
    const group = byHostname.get(hostname) ?? [];
    group.push(bookmark);
    byHostname.set(hostname, group);
  }

  const suggestions: FolderMoveSuggestion[] = [];

  for (const [hostname, domainBookmarks] of byHostname) {
    if (domainBookmarks.length < MIN_DOMAIN_BOOKMARKS) continue;

    const byParent = new Map<string, BookmarkRecord[]>();
    for (const bookmark of domainBookmarks) {
      if (!bookmark.parentId) continue;
      const group = byParent.get(bookmark.parentId) ?? [];
      group.push(bookmark);
      byParent.set(bookmark.parentId, group);
    }

    const [dominant] = [...byParent.entries()].sort(
      (left, right) =>
        right[1].length - left[1].length || left[0].localeCompare(right[0]),
    );
    if (!dominant) continue;

    const [targetParentId, targetBookmarks] = dominant;
    const confidence = targetBookmarks.length / domainBookmarks.length;
    if (
      targetBookmarks.length < MIN_TARGET_FOLDER_BOOKMARKS ||
      confidence < MIN_MOVE_CONFIDENCE
    ) {
      continue;
    }

    const targetFolderPath = targetBookmarks[0]?.folderPath ?? [];
    for (const bookmark of domainBookmarks) {
      if (bookmark.parentId === targetParentId) continue;

      suggestions.push({
        id: `move:${bookmark.id}:${targetParentId}`,
        bookmark,
        hostname,
        currentFolderPath: bookmark.folderPath ?? [],
        targetParentId,
        targetFolderPath: [...targetFolderPath],
        evidenceCount: targetBookmarks.length,
        domainBookmarkCount: domainBookmarks.length,
        confidence,
        explanation: `${domainBookmarks.length} 条 ${hostname} 书签中有 ${targetBookmarks.length} 条位于建议文件夹。`,
      });
    }
  }

  return suggestions.sort(
    (left, right) =>
      right.confidence - left.confidence ||
      left.hostname.localeCompare(right.hostname) ||
      left.bookmark.title.localeCompare(right.bookmark.title, 'zh-CN'),
  );
}

export async function generateChromeFolderMoveSuggestions(): Promise<
  FolderMoveSuggestion[]
> {
  const bookmarks = await database.bookmarks
    .where('source')
    .equals('chrome')
    .toArray();
  return generateFolderMoveSuggestions(bookmarks);
}
