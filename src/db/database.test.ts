import { describe, expect, it } from 'vitest';

import { database } from './database';

describe('BookmarkAssistantDatabase schema', () => {
  it('includes versioned batch and step operation logs', () => {
    expect(database.verno).toBe(4);
    expect(database.tables.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'operationBatches',
        'operations',
        'snapshots',
        'linkHealth',
      ]),
    );
  });
});
