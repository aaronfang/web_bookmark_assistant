import type { BookmarkRecord } from '../domain/bookmark';

export function selectDailyReviewBookmarks(
  bookmarks: readonly BookmarkRecord[],
  limit = 3,
): BookmarkRecord[] {
  const priority: Record<BookmarkRecord['readingStatus'], number> = {
    unread: 0,
    inbox: 1,
    reading: 2,
    completed: 3,
    archived: 4,
  };
  return [...bookmarks]
    .filter((bookmark) => bookmark.readingStatus !== 'archived')
    .sort(
      (left, right) =>
        priority[left.readingStatus] - priority[right.readingStatus] ||
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}
