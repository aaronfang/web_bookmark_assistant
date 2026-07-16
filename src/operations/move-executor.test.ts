import { describe, expect, it } from 'vitest';

import type {
  BookmarkOperation,
  BookmarkOperationBatch,
} from '../domain/bookmark';
import { generateFolderMoveSuggestions } from '../suggestions/folder-move-suggestions';
import {
  buildMoveOperationPlan,
  type MoveOperationPlan,
} from './move-operation-plan';
import {
  executeMoveOperationPlan,
  type ChromeBookmarkMovePort,
  type MoveExecutorStore,
} from './move-executor';

interface FakeLocation {
  parentId: string;
  index: number;
}

class FakeStore implements MoveExecutorStore {
  readonly snapshots = new Set(['snapshot:1']);
  readonly batches = new Map<string, BookmarkOperationBatch>();
  readonly operations = new Map<string, BookmarkOperation>();

  constructor(plan: MoveOperationPlan) {
    this.batches.set(plan.batch.id, plan.batch);
    for (const operation of plan.operations) {
      this.operations.set(operation.id, operation);
    }
  }

  async getSnapshot(id: string): Promise<unknown | undefined> {
    return this.snapshots.has(id) ? { id } : undefined;
  }

  async updateBatch(
    id: string,
    changes: Partial<BookmarkOperationBatch>,
  ): Promise<void> {
    const batch = this.batches.get(id);
    if (!batch) throw new Error('batch not found');
    this.batches.set(id, { ...batch, ...changes });
  }

  async updateOperation(
    id: string,
    changes: Partial<BookmarkOperation>,
  ): Promise<void> {
    const operation = this.operations.get(id);
    if (!operation) throw new Error('operation not found');
    this.operations.set(id, { ...operation, ...changes });
  }
}

class FakeChrome implements ChromeBookmarkMovePort {
  readonly locations = new Map<string, FakeLocation>();
  moveCalls = 0;
  failOnMoveCall: number | undefined;

  async getBookmark(id: string): Promise<FakeLocation> {
    const location = this.locations.get(id);
    if (!location) throw new Error(`missing ${id}`);
    return { ...location };
  }

  async moveBookmark(
    id: string,
    destination: { parentId: string; index?: number },
  ): Promise<{ index: number }> {
    this.moveCalls += 1;
    if (this.moveCalls === this.failOnMoveCall) {
      throw new Error('simulated Chrome move failure');
    }
    const location = {
      parentId: destination.parentId,
      index: destination.index ?? 0,
    };
    this.locations.set(id, location);
    return { index: location.index };
  }
}

function createPlan(): MoveOperationPlan {
  const [suggestion] = generateFolderMoveSuggestions([
    {
      id: 'chrome:1',
      source: 'chrome',
      sourceId: '1',
      parentId: '10',
      index: 2,
      title: 'Docs one',
      url: 'https://docs.example.com/one',
      folderPath: ['Bookmarks bar', 'Docs'],
      tags: [],
      note: '',
      readingStatus: 'inbox',
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    },
    {
      id: 'chrome:2',
      source: 'chrome',
      sourceId: '2',
      parentId: '10',
      index: 3,
      title: 'Docs two',
      url: 'https://docs.example.com/two',
      folderPath: ['Bookmarks bar', 'Docs'],
      tags: [],
      note: '',
      readingStatus: 'inbox',
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    },
    {
      id: 'chrome:3',
      source: 'chrome',
      sourceId: '3',
      parentId: '10',
      index: 4,
      title: 'Docs three',
      url: 'https://docs.example.com/three',
      folderPath: ['Bookmarks bar', 'Docs'],
      tags: [],
      note: '',
      readingStatus: 'inbox',
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    },
    {
      id: 'chrome:4',
      source: 'chrome',
      sourceId: '4',
      parentId: '20',
      index: 7,
      title: 'Docs outlier',
      url: 'https://docs.example.com/four',
      folderPath: ['Bookmarks bar', 'Inbox'],
      tags: [],
      note: '',
      readingStatus: 'inbox',
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    },
  ]);
  if (!suggestion) throw new Error('expected suggestion');

  return buildMoveOperationPlan(
    [suggestion],
    'snapshot:1',
    '2026-07-16T00:00:00.000Z',
    { batchId: 'batch:1', operationId: () => 'operation:1' },
  );
}

describe('executeMoveOperationPlan', () => {
  it('completes a move and records applied state', async () => {
    const plan = createPlan();
    const store = new FakeStore(plan);
    const chrome = new FakeChrome();
    chrome.locations.set('4', { parentId: '20', index: 7 });

    await executeMoveOperationPlan(plan, { store, chrome });

    expect(chrome.locations.get('4')).toEqual({
      parentId: '10',
      index: 0,
    });
    expect(store.batches.get('batch:1')?.status).toBe('completed');
    expect(store.operations.get('operation:1')?.status).toBe('applied');
  });

  it('rolls back applied steps when a later move fails', async () => {
    const plan = createPlan();
    const second = {
      ...plan.operations[0]!,
      id: 'operation:2',
      sequence: 1,
      bookmarkId: 'chrome:5',
      sourceId: '5',
      before: JSON.stringify({ parentId: '30', index: 4 }),
    };
    const expandedPlan = {
      batch: { ...plan.batch, operationCount: 2 },
      operations: [plan.operations[0]!, second],
    };
    const store = new FakeStore(expandedPlan);
    const chrome = new FakeChrome();
    chrome.locations.set('4', { parentId: '20', index: 7 });
    chrome.locations.set('5', { parentId: '30', index: 4 });
    chrome.failOnMoveCall = 2;

    await expect(
      executeMoveOperationPlan(expandedPlan, { store, chrome }),
    ).rejects.toMatchObject({ rolledBack: true });
    expect(chrome.locations.get('4')).toEqual({
      parentId: '20',
      index: 7,
    });
    expect(store.batches.get('batch:1')?.status).toBe('reverted');
    expect(store.operations.get('operation:1')?.status).toBe('reverted');
    expect(store.operations.get('operation:2')?.status).toBe('pending');
  });

  it('refuses a bookmark changed after planning without moving it', async () => {
    const plan = createPlan();
    const store = new FakeStore(plan);
    const chrome = new FakeChrome();
    chrome.locations.set('4', { parentId: 'changed', index: 7 });

    await expect(
      executeMoveOperationPlan(plan, { store, chrome }),
    ).rejects.toMatchObject({
      rolledBack: false,
    });
    expect(chrome.moveCalls).toBe(0);
    expect(store.batches.get('batch:1')?.status).toBe('failed');
  });
});
