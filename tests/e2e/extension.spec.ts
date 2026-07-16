import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

test('loads fixture bookmarks in an isolated Chrome profile', async () => {
  const extensionPath = resolve('.output/chrome-mv3');
  const profilePath = await mkdtemp(join(tmpdir(), 'bookmark-assistant-e2e-'));
  const context = await chromium.launchPersistentContext(profilePath, {
    acceptDownloads: true,
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(serviceWorker.url()).host;

    await serviceWorker.evaluate(async () => {
      const folder = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Phase 0 fixture',
      });
      await chrome.bookmarks.create({
        parentId: folder.id,
        title: 'Example',
        url: 'https://example.com/',
      });
      await chrome.bookmarks.create({
        parentId: folder.id,
        title: 'MDN',
        url: 'https://developer.mozilla.org/',
      });
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await expect(page.getByRole('heading', { name: '书签管理' })).toBeVisible();
    await expect(
      page
        .locator('.stats article', { hasText: 'Chrome 书签' })
        .locator('strong'),
    ).toHaveText('2');
    await expect(page.getByText('当前没有 Chrome 书签写入路径')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '书签文件夹' }),
    ).toBeVisible();
    const folderNavigation = page.getByRole('navigation', {
      name: 'Chrome 书签文件夹',
    });
    await folderNavigation
      .getByRole('button', { name: /^Phase 0 fixture 2$/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Phase 0 fixture', level: 3 }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /MDN/ })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 JSON 快照' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(download.suggestedFilename()).toMatch(
      /^web-bookmark-assistant-.+\.json$/,
    );
    expect(downloadPath).not.toBeNull();

    const snapshot = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
      format: string;
      schemaVersion: number;
      localBookmarks: Array<{ title: string }>;
    };
    expect(snapshot.format).toBe('web-bookmark-assistant-snapshot');
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.localBookmarks.map(({ title }) => title)).toEqual(
      expect.arrayContaining(['Example', 'MDN']),
    );
    await expect(page.getByText('已导出 2 条本地索引记录')).toBeVisible();

    const liveFolderId = await serviceWorker.evaluate(async () => {
      const folder = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Live folder tree',
      });
      return folder.id;
    });
    await expect(
      folderNavigation.getByRole('button', { name: /^Live folder tree 0$/ }),
    ).toBeVisible();
    await serviceWorker.evaluate(async (folderId) => {
      await chrome.bookmarks.remove(folderId);
    }, liveFolderId);
    await expect(
      folderNavigation.getByRole('button', { name: /^Live folder tree 0$/ }),
    ).toHaveCount(0);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.getByRole('searchbox', { name: '搜索书签' }).fill('MDN');
    await expect(page.getByRole('link', { name: /MDN/ })).toBeVisible();
    await expect(
      page.getByText('Phase 0 fixture', { exact: false }),
    ).toBeVisible();

    const liveFixture = await serviceWorker.evaluate(async () => {
      const [fixtureFolder] = await chrome.bookmarks.search({
        title: 'Phase 0 fixture',
      });
      const targetFolder = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Moved fixture',
      });
      const bookmark = await chrome.bookmarks.create({
        parentId: fixtureFolder?.id ?? '1',
        title: 'Live Event Bookmark',
        url: 'https://example.com/live-event',
      });
      return { bookmarkId: bookmark.id, targetFolderId: targetFolder.id };
    });

    await page.getByRole('searchbox', { name: '搜索书签' }).fill('Live Event');
    await expect(
      page.getByRole('link', { name: /Live Event Bookmark/ }),
    ).toBeVisible();

    await serviceWorker.evaluate(async ({ bookmarkId, targetFolderId }) => {
      await chrome.bookmarks.move(bookmarkId, { parentId: targetFolderId });
    }, liveFixture);
    await expect(
      page.getByText('Moved fixture', { exact: false }),
    ).toBeVisible();

    await serviceWorker.evaluate(async (bookmarkId) => {
      await chrome.bookmarks.update(bookmarkId, {
        title: 'Live Event Renamed',
      });
    }, liveFixture.bookmarkId);
    await expect(
      page.getByRole('link', { name: /Live Event Renamed/ }),
    ).toBeVisible();

    await serviceWorker.evaluate(async (bookmarkId) => {
      await chrome.bookmarks.remove(bookmarkId);
    }, liveFixture.bookmarkId);
    await expect(
      page.getByRole('link', { name: /Live Event Renamed/ }),
    ).toHaveCount(0);
  } finally {
    await context.close();
    await rm(profilePath, { force: true, recursive: true });
  }
});
