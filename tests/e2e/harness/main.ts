import { database } from '../../../src/db/database';
import {
  createMoveOperationPlan,
  saveMoveOperationPlan,
} from '../../../src/operations/move-operation-plan';
import {
  executeStoredMoveOperationBatch,
  MoveExecutionError,
} from '../../../src/operations/move-executor';
import { synchronizeChromeBookmarkMirror } from '../../../src/repositories/chrome-bookmark-repository';
import { createLocalBookmarkSnapshot } from '../../../src/snapshots/bookmark-snapshot';
import type { FolderMoveSuggestion } from '../../../src/suggestions/folder-move-suggestions';

interface HarnessMove {
  sourceId: string;
  targetParentId: string;
}

async function runMoves(moves: HarnessMove[]) {
  await synchronizeChromeBookmarkMirror();
  const snapshot = await createLocalBookmarkSnapshot();
  const suggestions: FolderMoveSuggestion[] = [];

  for (const move of moves) {
    const bookmark = await database.bookmarks.get(`chrome:${move.sourceId}`);
    if (!bookmark) throw new Error(`Missing mirror for ${move.sourceId}`);
    suggestions.push({
      id: `e2e:${move.sourceId}:${move.targetParentId}`,
      bookmark,
      hostname: new URL(bookmark.url).hostname,
      currentFolderPath: bookmark.folderPath,
      targetParentId: move.targetParentId,
      targetFolderPath: [`target:${move.targetParentId}`],
      evidenceCount: 3,
      domainBookmarkCount: 4,
      confidence: 0.75,
      explanation: 'E2E harness move',
    });
  }

  const plan = createMoveOperationPlan(suggestions, snapshot.record.id);
  await saveMoveOperationPlan(plan);
  let error: { message: string; rolledBack: boolean } | null = null;
  try {
    await executeStoredMoveOperationBatch(plan.batch.id);
  } catch (cause: unknown) {
    error = {
      message: cause instanceof Error ? cause.message : 'Unknown failure',
      rolledBack: cause instanceof MoveExecutionError && cause.rolledBack,
    };
  }

  const batch = await database.operationBatches.get(plan.batch.id);
  const operations = await database.operations
    .where('batchId')
    .equals(plan.batch.id)
    .sortBy('sequence');
  const locations = await Promise.all(
    moves.map(async ({ sourceId }) => {
      const [node] = await chrome.bookmarks.get(sourceId);
      return { sourceId, parentId: node?.parentId, index: node?.index };
    }),
  );
  return { batch, operations, locations, error };
}

globalThis.operationHarness = { runMoves };

declare global {
  var operationHarness: {
    runMoves: typeof runMoves;
  };
}
