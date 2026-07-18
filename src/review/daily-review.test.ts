import { describe, expect, it } from 'vitest';

import type { BookmarkRecord } from '../domain/bookmark';
import { selectDailyReviewBookmarks } from './daily-review';

const bookmark = (
  id: string,
  readingStatus: BookmarkRecord['readingStatus'],
  createdAt: string,
): BookmarkRecord => ({
  id,
  source: 'local',
  title: id,
  url: `https://${id}.test`,
  folderPath: [],
  tags: [],
  note: '',
  readingStatus,
  createdAt,
  updatedAt: createdAt,
});

describe('daily bookmark review', () => {
  it('prefers unread and inbox bookmarks and excludes archived items', () => {
    const result = selectDailyReviewBookmarks([
      bookmark('done', 'completed', '2020-01-01T00:00:00Z'),
      bookmark('inbox', 'inbox', '2024-01-01T00:00:00Z'),
      bookmark('unread', 'unread', '2025-01-01T00:00:00Z'),
      bookmark('archived', 'archived', '2019-01-01T00:00:00Z'),
    ]);
    expect(result.map(({ id }) => id)).toEqual(['unread', 'inbox', 'done']);
  });
});
