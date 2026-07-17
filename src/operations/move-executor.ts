import type {
  BookmarkOperation,
  BookmarkOperationBatch,
} from '../domain/bookmark';
import {
  parseMoveLocation,
  type BookmarkMoveLocation,
  type MoveOperationPlan,
} from './move-operation-plan';
import { database } from '../db/database';

export interface MoveExecutorStore {
  getSnapshot(id: string): Promise<unknown | undefined>;
  updateBatch(
    id: string,
    changes: Partial<BookmarkOperationBatch>,
  ): Promise<void>;
  updateOperation(
    id: string,
    changes: Partial<BookmarkOperation>,
  ): Promise<void>;
}

export interface ChromeBookmarkMovePort {
  getBookmark(id: string): Promise<{ parentId?: string; index?: number }>;
  moveBookmark(
    id: string,
    destination: BookmarkMoveLocation,
  ): Promise<{ index?: number }>;
}

export interface MoveExecutorDependencies {
  store: MoveExecutorStore;
  chrome: ChromeBookmarkMovePort;
  now?: () => string;
}

export class MoveExecutionError extends Error {
  readonly rolledBack: boolean;

  constructor(message: string, rolledBack: boolean) {
    super(message);
    this.name = 'MoveExecutionError';
    this.rolledBack = rolledBack;
  }
}

function locationMatches(
  current: { parentId?: string; index?: number },
  expected: BookmarkMoveLocation,
): boolean {
  return (
    current.parentId === expected.parentId &&
    (expected.index === undefined || current.index === expected.index)
  );
}

function locationJson(location: BookmarkMoveLocation): string {
  return JSON.stringify(location);
}

export async function executeMoveOperationPlan(
  plan: MoveOperationPlan,
  dependencies: MoveExecutorDependencies,
): Promise<void> {
  const { store, chrome } = dependencies;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const snapshot = await store.getSnapshot(plan.batch.snapshotId);
  if (!snapshot)
    throw new MoveExecutionError('Required snapshot is missing', false);
  if (plan.batch.status !== 'planned') {
    throw new MoveExecutionError('Only planned batches can be executed', false);
  }

  const applied: BookmarkOperation[] = [];
  await store.updateBatch(plan.batch.id, {
    status: 'executing',
    updatedAt: now(),
  });

  try {
    for (const operation of [...plan.operations].sort(
      (left, right) => left.sequence - right.sequence,
    )) {
      const before = parseMoveLocation(operation.before);
      const current = await chrome.getBookmark(operation.sourceId);
      if (!locationMatches(current, before)) {
        throw new Error(
          `Bookmark ${operation.bookmarkId} changed since the plan was created`,
        );
      }

      const after = parseMoveLocation(operation.after);
      const moved = await chrome.moveBookmark(operation.sourceId, after);
      const appliedAfter: BookmarkMoveLocation = {
        ...after,
        ...(moved.index === undefined ? {} : { index: moved.index }),
      };
      await store.updateOperation(operation.id, {
        status: 'applied',
        after: locationJson(appliedAfter),
      });
      applied.push(operation);
    }

    await store.updateBatch(plan.batch.id, {
      status: 'completed',
      updatedAt: now(),
      completedAt: now(),
    });
  } catch (cause: unknown) {
    const reason = cause instanceof Error ? cause.message : 'Move failed';
    await store.updateBatch(plan.batch.id, {
      status: 'reverting',
      updatedAt: now(),
      error: reason,
    });

    let rollbackError: string | undefined;
    for (const operation of [...applied].reverse()) {
      try {
        await chrome.moveBookmark(
          operation.sourceId,
          parseMoveLocation(operation.before),
        );
        await store.updateOperation(operation.id, {
          status: 'reverted',
          revertedAt: now(),
        });
      } catch (rollbackCause: unknown) {
        rollbackError =
          rollbackCause instanceof Error
            ? rollbackCause.message
            : 'Rollback failed';
        await store.updateOperation(operation.id, {
          status: 'failed',
          error: rollbackError,
        });
        break;
      }
    }

    const finalError = rollbackError
      ? `${reason}; rollback failed: ${rollbackError}`
      : reason;
    const rolledBack = applied.length > 0 && !rollbackError;
    await store.updateBatch(plan.batch.id, {
      status: rollbackError || applied.length === 0 ? 'failed' : 'reverted',
      updatedAt: now(),
      ...(rolledBack ? { revertedAt: now() } : {}),
      error: finalError,
    });
    throw new MoveExecutionError(finalError, rolledBack);
  }
}

export async function executeStoredMoveOperationBatch(
  batchId: string,
): Promise<void> {
  const batch = await database.operationBatches.get(batchId);
  if (!batch) throw new Error(`Operation batch ${batchId} was not found`);
  const operations = await database.operations
    .where('batchId')
    .equals(batchId)
    .sortBy('sequence');

  await executeMoveOperationPlan(
    { batch, operations },
    {
      store: {
        getSnapshot: (id) => database.snapshots.get(id),
        updateBatch: async (id, changes) => {
          await database.operationBatches.update(id, changes);
        },
        updateOperation: async (id, changes) => {
          await database.operations.update(id, changes);
        },
      },
      chrome: {
        getBookmark: async (id) => {
          const [node] = await chrome.bookmarks.get(id);
          if (!node) throw new Error(`Bookmark ${id} was not found`);
          return node;
        },
        moveBookmark: async (id, destination) =>
          chrome.bookmarks.move(id, destination),
      },
    },
  );
}

export async function undoMoveOperationPlan(
  plan: MoveOperationPlan,
  dependencies: MoveExecutorDependencies,
): Promise<void> {
  const { store, chrome } = dependencies;
  const now = dependencies.now ?? (() => new Date().toISOString());
  if (!(await store.getSnapshot(plan.batch.snapshotId))) {
    throw new MoveExecutionError('Required snapshot is missing', false);
  }
  if (plan.batch.status !== 'completed') {
    throw new MoveExecutionError('Only completed batches can be undone', false);
  }

  await store.updateBatch(plan.batch.id, {
    status: 'reverting',
    updatedAt: now(),
  });
  try {
    for (const operation of [...plan.operations].sort(
      (a, b) => b.sequence - a.sequence,
    )) {
      const after = parseMoveLocation(operation.after);
      const current = await chrome.getBookmark(operation.sourceId);
      if (!locationMatches(current, after)) {
        throw new Error(
          `Bookmark ${operation.bookmarkId} changed since execution`,
        );
      }
      await chrome.moveBookmark(
        operation.sourceId,
        parseMoveLocation(operation.before),
      );
      await store.updateOperation(operation.id, {
        status: 'reverted',
        revertedAt: now(),
      });
    }
    await store.updateBatch(plan.batch.id, {
      status: 'reverted',
      updatedAt: now(),
      revertedAt: now(),
    });
  } catch (cause: unknown) {
    const reason = cause instanceof Error ? cause.message : 'Undo failed';
    await store.updateBatch(plan.batch.id, {
      status: 'failed',
      updatedAt: now(),
      error: reason,
    });
    throw new MoveExecutionError(reason, false);
  }
}

export async function undoStoredMoveOperationBatch(
  batchId: string,
): Promise<void> {
  const batch = await database.operationBatches.get(batchId);
  if (!batch) throw new Error(`Operation batch ${batchId} was not found`);
  const operations = await database.operations
    .where('batchId')
    .equals(batchId)
    .sortBy('sequence');
  await undoMoveOperationPlan(
    { batch, operations },
    {
      store: {
        getSnapshot: (id) => database.snapshots.get(id),
        updateBatch: (id, changes) =>
          database.operationBatches.update(id, changes).then(() => undefined),
        updateOperation: (id, changes) =>
          database.operations.update(id, changes).then(() => undefined),
      },
      chrome: {
        getBookmark: async (id) => {
          const [node] = await chrome.bookmarks.get(id);
          if (!node) throw new Error(`Bookmark ${id} was not found`);
          return node;
        },
        moveBookmark: (id, destination) =>
          chrome.bookmarks.move(id, destination),
      },
    },
  );
}
