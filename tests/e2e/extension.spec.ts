import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

test('loads fixture bookmarks in an isolated Chrome profile', async () => {
  const extensionPath = resolve(
    process.env.WBA_E2E_HARNESS === '1'
      ? '.output-e2e/chrome-mv3'
      : '.output/chrome-mv3',
  );
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

    const aiSuggestionBookmarkId = await serviceWorker.evaluate(async () => {
      const [bookmark] = await chrome.bookmarks.search({ title: 'Example' });
      return `chrome:${bookmark!.id}`;
    });
    await page.evaluate(async (bookmarkId) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('web-bookmark-assistant');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('suggestions', 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.objectStore('suggestions').put({
          id: 'ai-classification:e2e',
          bookmarkId,
          kind: 'add-tags',
          status: 'pending',
          confidence: 0.42,
          explanation: '正文证据有限，需要人工确认。',
          proposedChange: JSON.stringify({
            contentType: 'article',
            tags: ['AI', '开发'],
            folderSuggestion: '技术 / AI',
          }),
          createdAt: '2026-07-18T12:00:00.000Z',
        });
      });
      db.close();
    }, aiSuggestionBookmarkId);
    await dashboardNavigation.getByRole('link', { name: 'AI 待整理' }).click();
    const aiInbox = page.locator('.ai-inbox');
    await expect(
      aiInbox.getByRole('heading', { name: 'AI 待整理箱' }),
    ).toBeVisible();
    await expect(aiInbox.getByText('42%')).toBeVisible();
    await expect(
      aiInbox.getByText('正文证据有限，需要人工确认。'),
    ).toBeVisible();
    await aiInbox.getByRole('button', { name: '应用标签' }).click();
    await expect(aiInbox.getByText('0 条待确认')).toBeVisible();
    const appliedTags = await page.evaluate(async (bookmarkId) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('web-bookmark-assistant');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const bookmark = await new Promise<{ tags?: string[] } | undefined>(
        (resolve, reject) => {
          const request = db
            .transaction('bookmarks', 'readonly')
            .objectStore('bookmarks')
            .get(bookmarkId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );
      db.close();
      return bookmark?.tags ?? [];
    }, aiSuggestionBookmarkId);
    expect(appliedTags).toEqual(expect.arrayContaining(['AI', '开发']));

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
      const outlier = await chrome.bookmarks.create({
        parentId: sourceFolder.id,
        title: 'Docs Outlier',
        url: 'https://organize.example.test/docs/outlier',
      });
      return {
        sourceFolderId: sourceFolder.id,
        targetFolderId: targetFolder.id,
        outlierId: outlier.id,
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
    await moveSuggestions
      .getByRole('checkbox', { name: '选择 Docs Outlier' })
      .check();
    await moveSuggestions
      .getByRole('button', { name: '预览所选建议（1）' })
      .click();
    const movePreview = moveSuggestions.locator('.move-batch-preview');
    await expect(
      movePreview.getByRole('heading', { name: '批量移动预览' }),
    ).toBeVisible();
    await expect(
      movePreview.getByText('执行会先下载并保存 JSON 快照'),
    ).toBeVisible();
    await expect(
      movePreview.getByRole('button', { name: '创建快照并执行移动' }),
    ).toBeEnabled();

    const executionDownload = page.waitForEvent('download');
    await movePreview
      .getByRole('button', { name: '创建快照并执行移动' })
      .click();
    const executionSnapshot = await executionDownload;
    expect(executionSnapshot.suggestedFilename()).toMatch(
      /^web-bookmark-assistant-.+\.json$/,
    );
    await expect(
      moveSuggestions.getByText('已完成 1 条书签移动'),
    ).toBeVisible();
    const executedLocation = await serviceWorker.evaluate(
      async (bookmarkId) => {
        const [node] = await chrome.bookmarks.get(bookmarkId);
        return node?.parentId;
      },
      suggestionFolders.outlierId,
    );
    expect(executedLocation).toBe(suggestionFolders.targetFolderId);

    await serviceWorker.evaluate(async ({ sourceFolderId, targetFolderId }) => {
      await chrome.bookmarks.removeTree(sourceFolderId);
      await chrome.bookmarks.removeTree(targetFolderId);
    }, suggestionFolders);
    await expect(
      moveSuggestions.getByText('暂无高置信度移动建议'),
    ).toBeVisible();
    await expect(movePreview).toHaveCount(0);

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

    const fixtureFolderId = await serviceWorker.evaluate(async () => {
      const [folder] = await chrome.bookmarks.search({
        title: 'Phase 0 fixture',
      });
      return folder!.id;
    });
    await page.evaluate(() => {
      localStorage.setItem(
        'wba-ai-settings',
        JSON.stringify({
          provider: 'openai-compatible',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'e2e-key',
          model: 'e2e-model',
          excludedDomains: [],
        }),
      );
    });
    let classificationPrompt = '';
    let returnedFolderSuggestion = 'Phase 0 fixture';
    await page.route(
      'https://api.example.com/v1/chat/completions',
      async (route) => {
        const request = route.request().postDataJSON() as {
          messages?: Array<{ content?: string }>;
        };
        classificationPrompt = request.messages?.[0]?.content ?? '';
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    contentType: 'article',
                    tags: ['AI'],
                    folderSuggestion: returnedFolderSuggestion,
                    confidence: 0.88,
                    explanation: '与现有技术收藏目录匹配。',
                  }),
                },
              },
            ],
          }),
        });
      },
    );
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByLabel('标题').fill('AI folder match fixture');
    await page.getByLabel('网址').fill('https://example.com/ai-folder-match');
    await page.getByRole('button', { name: '生成 AI 标签建议' }).click();
    await expect(
      page.getByText('建议保存到：', { exact: false }),
    ).toContainText('Phase 0 fixture');
    await page.getByRole('button', { name: '采用文件夹建议' }).click();
    await expect(page.getByLabel('文件夹')).toHaveValue(fixtureFolderId);
    expect(classificationPrompt).toContain('Existing folders:');
    expect(classificationPrompt).toContain('Phase 0 fixture');

    returnedFolderSuggestion = 'Phase 0 fixture / AI 新分类';
    await page.getByLabel('标题').fill('AI new folder fixture');
    await page.getByLabel('网址').fill('https://example.com/ai-new-folder');
    await page.getByRole('button', { name: '生成 AI 标签建议' }).click();
    await expect(page.getByText('建议新建文件夹')).toBeVisible();
    await expect(page.getByLabel('名称')).toHaveValue('AI 新分类');
    await expect(page.getByLabel('父目录')).toHaveValue(fixtureFolderId);
    await page.getByRole('button', { name: '确认新建并采用' }).click();
    await page.getByRole('button', { name: '保存书签' }).click();
    await expect(page.getByText('已保存书签', { exact: false })).toBeVisible();
    const createdFolderResult = await serviceWorker.evaluate(async () => {
      const folders = await chrome.bookmarks.search({ title: 'AI 新分类' });
      const bookmarks = await chrome.bookmarks.search({
        title: 'AI new folder fixture',
      });
      return {
        folderId: folders[0]?.id,
        folderParentId: folders[0]?.parentId,
        bookmarkId: bookmarks[0]?.id,
        bookmarkParentId: bookmarks[0]?.parentId,
      };
    });
    expect(createdFolderResult.folderParentId).toBe(fixtureFolderId);
    expect(createdFolderResult.bookmarkParentId).toBe(
      createdFolderResult.folderId,
    );
    await serviceWorker.evaluate(async ({ bookmarkId, folderId }) => {
      if (bookmarkId) await chrome.bookmarks.remove(bookmarkId);
      if (folderId) await chrome.bookmarks.remove(folderId);
    }, createdFolderResult);
  } finally {
    await context.close();
    await rm(profilePath, { force: true, recursive: true });
  }
});
