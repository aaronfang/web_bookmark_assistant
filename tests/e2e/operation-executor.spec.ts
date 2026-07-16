import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

test('executes and rolls back moves in an isolated Chrome profile', async () => {
  test.skip(
    process.env.WBA_E2E_HARNESS !== '1',
    'The executor harness only exists in the isolated E2E build',
  );

  const extensionPath = resolve('.output-e2e/chrome-mv3');
  const profilePath = await mkdtemp(join(tmpdir(), 'bookmark-operations-e2e-'));
  const context = await chromium.launchPersistentContext(profilePath, {
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
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/e2e-harness.html`);
    await page.waitForFunction(() => 'operationHarness' in globalThis);

    const successFixture = await serviceWorker.evaluate(async () => {
      const source = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Executor success source',
      });
      const target = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Executor success target',
      });
      const bookmark = await chrome.bookmarks.create({
        parentId: source.id,
        title: 'Executor success bookmark',
        url: 'https://executor.example.test/success',
      });
      return { bookmarkId: bookmark.id, targetId: target.id };
    });

    const success = await page.evaluate(
      async ({ bookmarkId, targetId }) =>
        globalThis.operationHarness.runMoves([
          { sourceId: bookmarkId, targetParentId: targetId },
        ]),
      successFixture,
    );
    expect(success).toMatchObject({
      batch: { status: 'completed' },
      operations: [{ status: 'applied' }],
      locations: [
        {
          sourceId: successFixture.bookmarkId,
          parentId: successFixture.targetId,
        },
      ],
      error: null,
    });

    const rollbackFixture = await serviceWorker.evaluate(async () => {
      const sourceOne = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Rollback source one',
      });
      const sourceTwo = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Rollback source two',
      });
      const target = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Rollback target',
      });
      const first = await chrome.bookmarks.create({
        parentId: sourceOne.id,
        title: 'Rollback first',
        url: 'https://executor.example.test/rollback-one',
      });
      const second = await chrome.bookmarks.create({
        parentId: sourceTwo.id,
        title: 'Rollback second',
        url: 'https://executor.example.test/rollback-two',
      });
      return {
        firstId: first.id,
        firstSourceId: sourceOne.id,
        secondId: second.id,
        secondSourceId: sourceTwo.id,
        targetId: target.id,
      };
    });

    const rollback = await page.evaluate(
      async ({ firstId, secondId, targetId }) =>
        globalThis.operationHarness.runMoves([
          { sourceId: firstId, targetParentId: targetId },
          { sourceId: secondId, targetParentId: 'missing-folder-id' },
        ]),
      rollbackFixture,
    );
    expect(rollback.batch?.status).toBe('reverted');
    expect(rollback.operations.map(({ status }) => status)).toEqual([
      'reverted',
      'pending',
    ]);
    expect(rollback.error).toMatchObject({ rolledBack: true });
    expect(rollback.locations).toEqual([
      expect.objectContaining({
        sourceId: rollbackFixture.firstId,
        parentId: rollbackFixture.firstSourceId,
      }),
      expect.objectContaining({
        sourceId: rollbackFixture.secondId,
        parentId: rollbackFixture.secondSourceId,
      }),
    ]);
  } finally {
    await context.close();
    await rm(profilePath, { force: true, recursive: true });
  }
});
