import { describe, expect, it } from 'vitest';

import { mockChromeBookmarkTree } from '../test/fixtures/chrome-bookmarks';
import {
  collectBookmarkSourceIds,
  isChromeBookmarksUpdatedMessage,
} from './bookmark-events';

describe('collectBookmarkSourceIds', () => {
  it('collects every bookmark in a removed folder subtree', () => {
    expect(collectBookmarkSourceIds(mockChromeBookmarkTree[0]!)).toEqual([
      '10',
      '12',
    ]);
  });
});

describe('isChromeBookmarksUpdatedMessage', () => {
  it('recognizes extension bookmark update messages', () => {
    expect(
      isChromeBookmarksUpdatedMessage({
        type: 'chrome-bookmarks-updated',
        kind: 'created',
      }),
    ).toBe(true);
    expect(isChromeBookmarksUpdatedMessage({ type: 'something-else' })).toBe(
      false,
    );
  });
});
