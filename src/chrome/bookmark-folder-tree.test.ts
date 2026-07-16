import { describe, expect, it } from 'vitest';

import { mockChromeBookmarkTree } from '../test/fixtures/chrome-bookmarks';
import {
  buildBookmarkFolderTree,
  findBookmarkFolder,
} from './bookmark-folder-tree';

describe('buildBookmarkFolderTree', () => {
  it('preserves hierarchy and calculates recursive bookmark totals', () => {
    const folders = buildBookmarkFolderTree(mockChromeBookmarkTree);

    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatchObject({
      id: '1',
      title: 'Bookmarks bar',
      path: ['Bookmarks bar'],
      totalBookmarks: 2,
    });
    expect(folders[0]?.children[0]).toMatchObject({
      id: '11',
      path: ['Bookmarks bar', 'Development'],
      totalBookmarks: 1,
    });
  });

  it('finds a nested folder by Chrome id', () => {
    const folder = findBookmarkFolder(
      buildBookmarkFolderTree(mockChromeBookmarkTree),
      '11',
    );

    expect(folder?.title).toBe('Development');
  });
});
