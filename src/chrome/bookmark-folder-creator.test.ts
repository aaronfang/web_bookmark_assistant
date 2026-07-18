import { describe, expect, it, vi } from 'vitest';

import {
  removeCreatedFolderIfEmpty,
  resolveOrCreateBookmarkFolder,
  type BookmarkFolderApi,
} from './bookmark-folder-creator';

function folder(id: string, title: string, parentId = '1') {
  return {
    id,
    title,
    parentId,
    syncing: false,
  } satisfies chrome.bookmarks.BookmarkTreeNode;
}

function createApi(children: chrome.bookmarks.BookmarkTreeNode[] = []) {
  const created = folder('new-folder', 'AI', 'parent');
  const api: BookmarkFolderApi = {
    get: vi.fn().mockResolvedValue([folder('parent', '技术')]),
    getChildren: vi.fn().mockResolvedValue(children),
    create: vi.fn().mockResolvedValue(created),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  return { api, created };
}

describe('resolveOrCreateBookmarkFolder', () => {
  it('reuses a single existing folder after a case-insensitive recheck', async () => {
    const existing = folder('existing', ' ai ', 'parent');
    const { api } = createApi([existing]);
    await expect(
      resolveOrCreateBookmarkFolder('parent', 'AI', api),
    ).resolves.toEqual({ folder: existing, created: false });
    expect(api.create).not.toHaveBeenCalled();
  });

  it('creates one validated child folder', async () => {
    const { api, created } = createApi();
    await expect(
      resolveOrCreateBookmarkFolder('parent', '  AI  ', api),
    ).resolves.toEqual({ folder: created, created: true });
    expect(api.create).toHaveBeenCalledWith({
      parentId: 'parent',
      title: 'AI',
    });
  });

  it('refuses ambiguous duplicates and invalid names', async () => {
    const { api } = createApi([
      folder('a', 'AI', 'parent'),
      folder('b', 'ai', 'parent'),
    ]);
    await expect(
      resolveOrCreateBookmarkFolder('parent', 'AI', api),
    ).rejects.toThrow('多个同名');
    await expect(
      resolveOrCreateBookmarkFolder('parent', '..', api),
    ).rejects.toThrow('名称无效');
  });
});

describe('removeCreatedFolderIfEmpty', () => {
  it('removes only a newly created empty folder', async () => {
    const { api, created } = createApi();
    await removeCreatedFolderIfEmpty({ folder: created, created: true }, api);
    expect(api.remove).toHaveBeenCalledWith(created.id);
  });

  it('preserves reused or non-empty folders', async () => {
    const child = folder('child', 'Bookmark', 'new-folder');
    const { api, created } = createApi([child]);
    await removeCreatedFolderIfEmpty({ folder: created, created: true }, api);
    await removeCreatedFolderIfEmpty({ folder: created, created: false }, api);
    expect(api.remove).not.toHaveBeenCalled();
  });
});
