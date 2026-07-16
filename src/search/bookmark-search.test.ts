import { describe, expect, it } from 'vitest';

import type { BookmarkRecord } from '../domain/bookmark';
import { filterBookmarks } from './bookmark-search';

const bookmarks: BookmarkRecord[] = [
  {
    id: 'chrome:1',
    source: 'chrome',
    sourceId: '1',
    parentId: '10',
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/',
    folderPath: ['Bookmarks bar', 'Development'],
    tags: ['reference'],
    note: '',
    readingStatus: 'inbox',
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  },
  {
    id: 'chrome:2',
    source: 'chrome',
    sourceId: '2',
    parentId: '20',
    title: '示例网站',
    url: 'https://example.com/',
    folderPath: ['其他书签', '收件箱'],
    tags: [],
    note: '稍后阅读',
    readingStatus: 'unread',
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  },
];

describe('filterBookmarks', () => {
  it('matches title, URL and folder path case-insensitively', () => {
    expect(filterBookmarks(bookmarks, 'mdn development')).toEqual([
      bookmarks[0],
    ]);
    expect(filterBookmarks(bookmarks, 'EXAMPLE')).toEqual([bookmarks[1]]);
    expect(filterBookmarks(bookmarks, '收件箱')).toEqual([bookmarks[1]]);
  });

  it('returns no default results for an empty query', () => {
    expect(filterBookmarks(bookmarks, '   ')).toEqual([]);
  });
});
