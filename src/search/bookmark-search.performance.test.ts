import { describe, expect, it } from 'vitest';

import type { BookmarkRecord } from '../domain/bookmark';
import {
  buildBookmarkSearchIndex,
  searchBookmarkIndex,
} from './bookmark-search';

const BOOKMARK_COUNT = 20_000;

function createLargeBookmarkLibrary(): BookmarkRecord[] {
  return Array.from({ length: BOOKMARK_COUNT }, (_, index) => ({
    id: `chrome:${index}`,
    source: 'chrome' as const,
    sourceId: String(index),
    parentId: String(Math.floor(index / 100)),
    title: `Documentation Bookmark ${index}`,
    url: `https://docs${index % 100}.example.com/article/${index}`,
    folderPath: ['Bookmarks bar', `Collection ${index % 200}`],
    tags: index % 3 === 0 ? ['reference'] : [],
    note: index % 5 === 0 ? 'Read later' : '',
    readingStatus: 'inbox' as const,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  }));
}

describe('large bookmark search performance', () => {
  it('indexes and searches 20,000 bookmarks within the Phase 1 budget', () => {
    const bookmarks = createLargeBookmarkLibrary();

    const indexStartedAt = performance.now();
    const index = buildBookmarkSearchIndex(bookmarks);
    const indexDuration = performance.now() - indexStartedAt;

    const searchStartedAt = performance.now();
    const results = searchBookmarkIndex(index, 'documentation reference');
    const searchDuration = performance.now() - searchStartedAt;

    expect(index).toHaveLength(BOOKMARK_COUNT);
    expect(results).toHaveLength(50);
    expect(indexDuration).toBeLessThan(1_000);
    expect(searchDuration).toBeLessThan(250);
  });
});
