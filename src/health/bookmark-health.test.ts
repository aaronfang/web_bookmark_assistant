import { describe, expect, it } from 'vitest';

import type { BookmarkRecord } from '../domain/bookmark';
import { analyzeBookmarkHealth } from './bookmark-health';

const tree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    syncing: false,
    children: [
      {
        id: '1',
        parentId: '0',
        title: 'Bookmarks bar',
        syncing: false,
        children: [
          {
            id: '11',
            parentId: '1',
            title: 'Empty folder',
            syncing: false,
            children: [],
          },
        ],
      },
      {
        id: '2',
        parentId: '0',
        title: 'Other bookmarks',
        syncing: false,
        children: [],
      },
    ],
  },
];

function bookmark(
  id: string,
  title: string,
  url: string,
  createdAt = '2026-01-01T00:00:00.000Z',
): BookmarkRecord {
  return {
    id: `chrome:${id}`,
    source: 'chrome',
    sourceId: id,
    parentId: '1',
    title,
    url,
    folderPath: ['Bookmarks bar'],
    tags: [],
    note: '',
    readingStatus: 'inbox',
    createdAt,
    updatedAt: createdAt,
  };
}

describe('analyzeBookmarkHealth', () => {
  it('finds user-created empty folders but ignores permanent Chrome roots', () => {
    const issues = analyzeBookmarkHealth(tree, [], new Date('2026-07-16'));

    expect(issues).toEqual([
      expect.objectContaining({
        kind: 'empty-folder',
        title: 'Empty folder',
        folderPath: ['Bookmarks bar', 'Empty folder'],
      }),
    ]);
  });

  it('flags placeholder and URL-like bookmark titles conservatively', () => {
    const issues = analyzeBookmarkHealth(
      [],
      [
        bookmark('1', 'Untitled', 'https://example.com/one'),
        bookmark('2', 'example.com', 'https://example.com/two'),
        bookmark('3', 'Useful Example', 'https://example.com/three'),
      ],
      new Date('2026-07-16'),
    );

    expect(
      issues.filter(({ kind }) => kind === 'low-quality-title'),
    ).toHaveLength(2);
  });

  it('marks bookmarks older than two years as informational candidates', () => {
    const issues = analyzeBookmarkHealth(
      [],
      [
        bookmark(
          '1',
          'Old reference',
          'https://example.com/old',
          '2020-01-01T00:00:00.000Z',
        ),
      ],
      new Date('2026-07-16T00:00:00.000Z'),
    );

    expect(issues).toEqual([
      expect.objectContaining({
        kind: 'old-bookmark',
        title: 'Old reference',
      }),
    ]);
  });
});
