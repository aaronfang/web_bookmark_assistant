import { describe, expect, it } from 'vitest';

import { mockChromeBookmarkTree } from '../test/fixtures/chrome-bookmarks';
import { summarizeBookmarkTree } from './bookmark-reader';

describe('summarizeBookmarkTree', () => {
  it('counts bookmarks and folders without counting the invisible root', () => {
    expect(summarizeBookmarkTree(mockChromeBookmarkTree)).toEqual({
      bookmarks: 2,
      folders: 2,
    });
  });
});
