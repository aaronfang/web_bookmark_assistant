import { describe, expect, it } from 'vitest';

import { mockChromeBookmarkTree } from '../test/fixtures/chrome-bookmarks';
import {
  buildBookmarkSnapshotDocument,
  createBookmarkSnapshotFilename,
} from './bookmark-snapshot';

describe('bookmark snapshot format', () => {
  it('builds a versioned document containing the original Chrome tree', () => {
    const document = buildBookmarkSnapshotDocument(
      mockChromeBookmarkTree,
      [],
      '2026-07-16T12:34:56.789Z',
      '0.1.0',
    );

    expect(document).toMatchObject({
      format: 'web-bookmark-assistant-snapshot',
      schemaVersion: 1,
      applicationVersion: '0.1.0',
      createdAt: '2026-07-16T12:34:56.789Z',
      chromeTree: mockChromeBookmarkTree,
      localBookmarks: [],
    });
  });

  it('creates a filesystem-safe timestamped filename', () => {
    expect(createBookmarkSnapshotFilename('2026-07-16T12:34:56.789Z')).toBe(
      'web-bookmark-assistant-2026-07-16T12-34-56-789Z.json',
    );
  });
});
