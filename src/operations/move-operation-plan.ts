import { database } from '../db/database';
import type {
  BookmarkOperation,
  BookmarkOperationBatch,
} from '../domain/bookmark';
import type { FolderMoveSuggestion } from '../suggestions/folder-move-suggestions';

export interface BookmarkMoveLocation {
  parentId: string;
  index?: number;
}

export interface MoveOperationPlan {
  batch: BookmarkOperationBatch;
  operations: BookmarkOperation[];
}

export interface MoveUndoStep extends BookmarkMoveLocation {
  operationId: string;
  bookmarkId: string;
}

interface MoveOperationPlanIds {
  batchId: string;
  operationId: (suggestion: FolderMoveSuggestion, index: number) => string;
}

function serializeLocation(location: BookmarkMoveLocation): string {
  return JSON.stringify(location);
}

function parseLocation(serialized: string | undefined): BookmarkMoveLocation {
  if (!serialized) throw new Error('Move operation is missing location data');

  const value: unknown = JSON.parse(serialized);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('parentId' in value) ||
    typeof value.parentId !== 'string' ||
    ('index' in value &&
      value.index !== undefined &&
      typeof value.index !== 'number')
  ) {
    throw new Error('Move operation contains invalid location data');
  }

  return {
    parentId: value.parentId,
    ...('index' in value && typeof value.index === 'number'
      ? { index: value.index }
      : {}),
  };
}

export function buildMoveOperationPlan(
  suggestions: readonly FolderMoveSuggestion[],
  snapshotId: string,
  createdAt: string,
  ids: MoveOperationPlanIds,
): MoveOperationPlan {
  if (!snapshotId) throw new Error('A snapshot is required for a move plan');
  if (suggestions.length === 0) {
    throw new Error('At least one move suggestion is required');
  }
  if (
    new Set(suggestions.map((suggestion) => suggestion.bookmark.id)).size !==
    suggestions.length
  ) {
    throw new Error('A move plan cannot contain the same bookmark twice');
  }

  const operations: BookmarkOperation[] = suggestions.map(
    (suggestion, index) => {
      const sourceParentId = suggestion.bookmark.parentId;
      if (!sourceParentId) {
        throw new Error(`Bookmark ${suggestion.bookmark.id} has no parent`);
      }

      return {
        id: ids.operationId(suggestion, index),
        batchId: ids.batchId,
        kind: 'move',
        status: 'pending',
        bookmarkId: suggestion.bookmark.id,
        createdAt,
        before: serializeLocation({
          parentId: sourceParentId,
          ...(suggestion.bookmark.index === undefined
            ? {}
            : { index: suggestion.bookmark.index }),
        }),
        after: serializeLocation({ parentId: suggestion.targetParentId }),
      };
    },
  );

  return {
    batch: {
      id: ids.batchId,
      kind: 'move',
      status: 'planned',
      snapshotId,
      operationCount: operations.length,
      createdAt,
      updatedAt: createdAt,
    },
    operations,
  };
}

export function createMoveOperationPlan(
  suggestions: readonly FolderMoveSuggestion[],
  snapshotId: string,
): MoveOperationPlan {
  const createdAt = new Date().toISOString();
  const batchId = `batch:${crypto.randomUUID()}`;
  return buildMoveOperationPlan(suggestions, snapshotId, createdAt, {
    batchId,
    operationId: () => `operation:${crypto.randomUUID()}`,
  });
}

export function buildMoveUndoSteps(
  operations: readonly BookmarkOperation[],
): MoveUndoStep[] {
  return operations
    .filter((operation) => operation.status === 'applied')
    .reverse()
    .map((operation) => ({
      operationId: operation.id,
      bookmarkId: operation.bookmarkId,
      ...parseLocation(operation.before),
    }));
}

export async function saveMoveOperationPlan(
  plan: MoveOperationPlan,
): Promise<void> {
  const snapshot = await database.snapshots.get(plan.batch.snapshotId);
  if (!snapshot) {
    throw new Error('Cannot save a move plan without its snapshot');
  }
  if (plan.batch.operationCount !== plan.operations.length) {
    throw new Error('Move plan operation count does not match its batch');
  }
  if (plan.batch.status !== 'planned') {
    throw new Error('Only planned move batches can be saved');
  }
  if (
    plan.operations.some(
      (operation) =>
        operation.batchId !== plan.batch.id ||
        operation.kind !== 'move' ||
        operation.status !== 'pending',
    )
  ) {
    throw new Error('Move plan contains an invalid pending operation');
  }

  await database.transaction(
    'rw',
    database.operationBatches,
    database.operations,
    async () => {
      await database.operationBatches.add(plan.batch);
      await database.operations.bulkAdd(plan.operations);
    },
  );
}
