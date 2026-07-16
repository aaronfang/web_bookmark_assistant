import { describe, expect, it } from 'vitest';

import type { BookmarkRecord } from '../domain/bookmark';
import {
  generateFolderMoveSuggestions,
  type FolderMoveSuggestion,
} from '../suggestions/folder-move-suggestions';
import {
  buildMoveOperationPlan,
  buildMoveUndoSteps,
} from './move-operation-plan';

function bookmark(
  id: string,
  parentId: string,
  folder: string,
  index: number,
): BookmarkRecord {
  return {
    id: `chrome:${id}`,
    source: 'chrome',
    sourceId: id,
    parentId,
    index,
    title: `Bookmark ${id}`,
    url: `https://docs.example.com/${id}`,
    folderPath: ['Bookmarks bar', folder],
    tags: [],
    note: '',
    readingStatus: 'inbox',
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };
}

function suggestion(): FolderMoveSuggestion {
  const [result] = generateFolderMoveSuggestions([
    bookmark('1', '10', 'Documentation', 0),
    bookmark('2', '10', 'Documentation', 1),
    bookmark('3', '10', 'Documentation', 2),
    bookmark('4', '20', 'Inbox', 7),
  ]);
  if (!result) throw new Error('Expected a move suggestion');
  return result;
}

describe('move operation plans', () => {
  it('requires a snapshot and records the exact before/after locations', () => {
    const plan = buildMoveOperationPlan(
      [suggestion()],
      'snapshot:1',
      '2026-07-16T00:00:00.000Z',
      {
        batchId: 'batch:1',
        operationId: () => 'operation:1',
      },
    );

    expect(plan.batch).toMatchObject({
      id: 'batch:1',
      status: 'planned',
      snapshotId: 'snapshot:1',
      operationCount: 1,
    });
    expect(plan.operations[0]).toMatchObject({
      id: 'operation:1',
      batchId: 'batch:1',
      kind: 'move',
      status: 'pending',
      bookmarkId: 'chrome:4',
      sourceId: '4',
      before: JSON.stringify({ parentId: '20', index: 7 }),
      after: JSON.stringify({ parentId: '10' }),
    });
  });

  it('builds undo steps in reverse execution order', () => {
    const first = suggestion();
    const second: FolderMoveSuggestion = {
      ...first,
      id: 'move:chrome:5:10',
      bookmark: bookmark('5', '30', 'Other', 2),
    };
    const plan = buildMoveOperationPlan(
      [first, second],
      'snapshot:1',
      '2026-07-16T00:00:00.000Z',
      {
        batchId: 'batch:1',
        operationId: (_item, index) => `operation:${index + 1}`,
      },
    );

    const appliedOperations = plan.operations.map((operation) => ({
      ...operation,
      status: 'applied' as const,
    }));
    expect(buildMoveUndoSteps(appliedOperations)).toEqual([
      {
        operationId: 'operation:2',
        bookmarkId: 'chrome:5',
        sourceId: '5',
        parentId: '30',
        index: 2,
      },
      {
        operationId: 'operation:1',
        bookmarkId: 'chrome:4',
        sourceId: '4',
        parentId: '20',
        index: 7,
      },
    ]);
    expect(buildMoveUndoSteps(plan.operations)).toEqual([]);
  });

  it('rejects plans without a snapshot or operations', () => {
    expect(() =>
      buildMoveOperationPlan([suggestion()], '', '2026-07-16T00:00:00.000Z', {
        batchId: 'batch:1',
        operationId: () => 'operation:1',
      }),
    ).toThrow('snapshot');
    expect(() =>
      buildMoveOperationPlan([], 'snapshot:1', '2026-07-16T00:00:00.000Z', {
        batchId: 'batch:1',
        operationId: () => 'operation:1',
      }),
    ).toThrow('At least one');
    const duplicate = suggestion();
    expect(() =>
      buildMoveOperationPlan(
        [duplicate, duplicate],
        'snapshot:1',
        '2026-07-16T00:00:00.000Z',
        {
          batchId: 'batch:1',
          operationId: (_item, index) => `operation:${index}`,
        },
      ),
    ).toThrow('same bookmark twice');
  });
});
