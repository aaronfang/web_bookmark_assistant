import { describe, expect, it } from 'vitest';

import { mockChromeBookmarkTree } from '../test/fixtures/chrome-bookmarks';
import {
  flattenChromeBookmarkTree,
  summarizeBookmarkTree,
} from './bookmark-reader';

describe('summarizeBookmarkTree', () => {
  it('counts bookmarks and folders without counting the invisible root', () => {
    expect(summarizeBookmarkTree(mockChromeBookmarkTree)).toEqual({
      bookmarks: 2,
      folders: 2,
    });
  });
});

describe('flattenChromeBookmarkTree', () => {
  it('creates stable records with their full folder path', () => {
    const records = flattenChromeBookmarkTree(
      mockChromeBookmarkTree,
      '2026-07-16T00:00:00.000Z',
    );

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      id: 'chrome:10',
      sourceId: '10',
      title: 'Example',
      folderPath: ['Bookmarks bar'],
    });
    expect(records[1]).toMatchObject({
      id: 'chrome:12',
      title: 'MDN',
      folderPath: ['Bookmarks bar', 'Development'],
    });
  });
});
