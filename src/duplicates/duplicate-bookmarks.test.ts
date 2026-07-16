import { describe, expect, it } from 'vitest';

import type { BookmarkRecord } from '../domain/bookmark';
import { findDuplicateBookmarkGroups } from './duplicate-bookmarks';

function bookmark(id: string, url: string): BookmarkRecord {
  return {
    id: `chrome:${id}`,
    source: 'chrome',
    sourceId: id,
    parentId: '1',
    title: `Bookmark ${id}`,
    url,
    folderPath: ['Bookmarks bar'],
    tags: [],
    note: '',
    readingStatus: 'inbox',
    createdAt: `2026-07-16T00:00:0${id}.000Z`,
    updatedAt: '2026-07-16T00:00:00.000Z',
  };
}

describe('findDuplicateBookmarkGroups', () => {
  it('detects identical original URLs', () => {
    const groups = findDuplicateBookmarkGroups([
      bookmark('1', 'https://example.com/article'),
      bookmark('2', 'https://example.com/article'),
      bookmark('3', 'https://unique.example.com/'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      normalizedUrl: 'https://example.com/article',
      matchType: 'exact',
    });
  });

  it('detects URLs that only differ by tracking data or fragments', () => {
    const groups = findDuplicateBookmarkGroups([
      bookmark('1', 'https://example.com/article?id=42'),
      bookmark(
        '2',
        'https://EXAMPLE.com/article/?utm_source=newsletter&id=42#intro',
      ),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      normalizedUrl: 'https://example.com/article?id=42',
      matchType: 'normalized',
    });
  });

  it('ignores malformed URLs and unique bookmarks', () => {
    expect(
      findDuplicateBookmarkGroups([
        bookmark('1', 'not a url'),
        bookmark('2', 'https://example.com/one'),
        bookmark('3', 'https://example.com/two'),
      ]),
    ).toEqual([]);
  });
});
