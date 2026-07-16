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
    const optionsOpenInTab = await serviceWorker.evaluate(
      () => chrome.runtime.getManifest().options_ui?.open_in_tab,
    );
    expect(optionsOpenInTab).toBe(true);

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
    await expect(page.getByRole('heading', { name: '管理概览' })).toBeVisible();
    await expect(page.getByText('诊断和整理建议均为预览')).toBeVisible();
    const dashboardNavigation = page.getByRole('navigation', {
      name: '管理功能',
    });
    await dashboardNavigation.getByRole('link', { name: '文件夹' }).click();
    await expect(page).toHaveURL(/options\.html#folders$/);
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

    await dashboardNavigation.getByRole('link', { name: '备份与恢复' }).click();
    await expect(page).toHaveURL(/options\.html#backup$/);
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

    await dashboardNavigation.getByRole('link', { name: '文件夹' }).click();
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

    await dashboardNavigation.getByRole('link', { name: '重复检测' }).click();
    const duplicateId = await serviceWorker.evaluate(async () => {
      const [fixtureFolder] = await chrome.bookmarks.search({
        title: 'Phase 0 fixture',
      });
      const duplicate = await chrome.bookmarks.create({
        parentId: fixtureFolder?.id ?? '1',
        title: 'Tracked Example Duplicate',
        url: 'https://example.com/?utm_source=e2e#section',
      });
      return duplicate.id;
    });
    const duplicateDetector = page.locator('.duplicate-detector');
    await expect(
      duplicateDetector.getByText('1 组 · 1 条可选副本'),
    ).toBeVisible();
    await expect(duplicateDetector.getByText('规范化相同')).toBeVisible();
    await expect(duplicateDetector.getByText('2 个书签')).toBeVisible();

    await serviceWorker.evaluate(async (bookmarkId) => {
      await chrome.bookmarks.remove(bookmarkId);
    }, duplicateId);
    await expect(duplicateDetector.getByText('没有发现重复书签')).toBeVisible();

    await dashboardNavigation.getByRole('link', { name: '健康检查' }).click();
    const healthFixtures = await serviceWorker.evaluate(async () => {
      const [fixtureFolder] = await chrome.bookmarks.search({
        title: 'Phase 0 fixture',
      });
      const emptyFolder = await chrome.bookmarks.create({
        parentId: fixtureFolder?.id ?? '1',
        title: 'Health Empty Folder',
      });
      const untitledBookmark = await chrome.bookmarks.create({
        parentId: fixtureFolder?.id ?? '1',
        title: 'Untitled',
        url: 'https://example.com/health-title',
      });
      return {
        emptyFolderId: emptyFolder.id,
        untitledBookmarkId: untitledBookmark.id,
      };
    });
    const healthCheck = page.locator('.health-check');
    await expect(healthCheck.getByText('2 条候选')).toBeVisible();
    await expect(
      healthCheck.getByText('Health Empty Folder', { exact: true }),
    ).toBeVisible();
    await expect(
      healthCheck.getByRole('link', { name: 'Untitled' }),
    ).toBeVisible();
    await expect(
      healthCheck.getByRole('button', { name: '空文件夹 1' }),
    ).toBeVisible();
    await expect(
      healthCheck.getByRole('button', { name: '标题待完善 1' }),
    ).toBeVisible();

    await serviceWorker.evaluate(
      async ({ emptyFolderId, untitledBookmarkId }) => {
        await chrome.bookmarks.remove(untitledBookmarkId);
        await chrome.bookmarks.remove(emptyFolderId);
      },
      healthFixtures,
    );
    await expect(healthCheck.getByText('0 条候选')).toBeVisible();

    await dashboardNavigation.getByRole('link', { name: '整理建议' }).click();
    const suggestionFolders = await serviceWorker.evaluate(async () => {
      const targetFolder = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Docs Majority',
      });
      const sourceFolder = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Docs Other',
      });
      for (const index of [1, 2, 3]) {
        await chrome.bookmarks.create({
          parentId: targetFolder.id,
          title: `Docs Main ${index}`,
          url: `https://organize.example.test/docs/${index}`,
        });
      }
      await chrome.bookmarks.create({
        parentId: sourceFolder.id,
        title: 'Docs Outlier',
        url: 'https://organize.example.test/docs/outlier',
      });
      return {
        sourceFolderId: sourceFolder.id,
        targetFolderId: targetFolder.id,
      };
    });
    const moveSuggestions = page.locator('.move-suggestions');
    await expect(moveSuggestions.getByText('1 条建议')).toBeVisible();
    await expect(
      moveSuggestions.getByRole('link', { name: 'Docs Outlier' }),
    ).toBeVisible();
    await expect(
      moveSuggestions.getByText('75%', { exact: true }),
    ).toBeVisible();
    await expect(
      moveSuggestions.getByText('Bookmarks Bar / Docs Majority'),
    ).toBeVisible();

    await serviceWorker.evaluate(async ({ sourceFolderId, targetFolderId }) => {
      await chrome.bookmarks.removeTree(sourceFolderId);
      await chrome.bookmarks.removeTree(targetFolderId);
    }, suggestionFolders);
    await expect(
      moveSuggestions.getByText('暂无高置信度移动建议'),
    ).toBeVisible();

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
