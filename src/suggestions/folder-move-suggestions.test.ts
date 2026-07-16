import { describe, expect, it } from 'vitest';

import type { BookmarkRecord } from '../domain/bookmark';
import {
  buildFolderMoveBatchPreview,
  generateFolderMoveSuggestions,
} from './folder-move-suggestions';

function bookmark(
  id: string,
  parentId: string,
  folder: string,
  url: string,
): BookmarkRecord {
  return {
    id: `chrome:${id}`,
    source: 'chrome',
    sourceId: id,
    parentId,
    title: `Bookmark ${id}`,
    url,
    folderPath: ['Bookmarks bar', folder],
    tags: [],
    note: '',
    readingStatus: 'inbox',
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };
}

describe('generateFolderMoveSuggestions', () => {
  it('suggests a high-confidence target for a domain outlier', () => {
    const suggestions = generateFolderMoveSuggestions([
      bookmark('1', '10', 'Documentation', 'https://docs.example.com/one'),
      bookmark('2', '10', 'Documentation', 'https://docs.example.com/two'),
      bookmark('3', '10', 'Documentation', 'https://docs.example.com/three'),
      bookmark('4', '20', 'Inbox', 'https://docs.example.com/four'),
    ]);

    expect(suggestions).toEqual([
      expect.objectContaining({
        id: 'move:chrome:4:10',
        hostname: 'docs.example.com',
        targetParentId: '10',
        targetFolderPath: ['Bookmarks bar', 'Documentation'],
        confidence: 0.75,
      }),
    ]);
  });

  it('does not guess when evidence or concentration is insufficient', () => {
    expect(
      generateFolderMoveSuggestions([
        bookmark('1', '10', 'One', 'https://docs.example.com/one'),
        bookmark('2', '10', 'One', 'https://docs.example.com/two'),
        bookmark('3', '20', 'Two', 'https://docs.example.com/three'),
        bookmark('4', '20', 'Two', 'https://docs.example.com/four'),
      ]),
    ).toEqual([]);
  });

  it('keeps subdomains separate and ignores malformed URLs', () => {
    expect(
      generateFolderMoveSuggestions([
        bookmark('1', '10', 'One', 'not a url'),
        bookmark('2', '10', 'One', 'https://a.example.com/one'),
        bookmark('3', '10', 'One', 'https://b.example.com/two'),
        bookmark('4', '20', 'Two', 'https://example.com/three'),
      ]),
    ).toEqual([]);
  });

  it('builds a non-executable batch preview with unique folders', () => {
    const suggestions = generateFolderMoveSuggestions([
      bookmark('1', '10', 'Documentation', 'https://docs.example.com/one'),
      bookmark('2', '10', 'Documentation', 'https://docs.example.com/two'),
      bookmark('3', '10', 'Documentation', 'https://docs.example.com/three'),
      bookmark('4', '20', 'Inbox', 'https://docs.example.com/four'),
    ]);
    const preview = buildFolderMoveBatchPreview(suggestions);

    expect(preview).toMatchObject({
      bookmarkCount: 1,
      sourceFolders: ['Bookmarks bar / Inbox'],
      targetFolders: ['Bookmarks bar / Documentation'],
      snapshotRequired: true,
      executionAvailable: false,
    });
  });
});
