import { describe, expect, it } from 'vitest';

import {
  normalizePageMetadata,
  PAGE_CONTENT_EXCERPT_LIMIT,
  PAGE_DESCRIPTION_LIMIT,
  PAGE_SELECTION_LIMIT,
} from './page-metadata';

describe('normalizePageMetadata', () => {
  it('normalizes page text while preserving paragraph boundaries', () => {
    expect(
      normalizePageMetadata({
        description: '  A   useful page  ',
        selectedText: ' first line\n\n second   line ',
        contentText: ' paragraph one\n\n\n paragraph   two ',
      }),
    ).toEqual({
      description: 'A useful page',
      selectedText: 'first line\nsecond line',
      contentExcerpt: 'paragraph one\nparagraph two',
    });
  });

  it('bounds every field before it can be sent to a provider', () => {
    const metadata = normalizePageMetadata({
      description: 'd'.repeat(PAGE_DESCRIPTION_LIMIT + 100),
      selectedText: 's'.repeat(PAGE_SELECTION_LIMIT + 100),
      contentText: 'c'.repeat(PAGE_CONTENT_EXCERPT_LIMIT + 100),
    });

    expect(metadata.description).toHaveLength(PAGE_DESCRIPTION_LIMIT);
    expect(metadata.selectedText).toHaveLength(PAGE_SELECTION_LIMIT);
    expect(metadata.contentExcerpt).toHaveLength(PAGE_CONTENT_EXCERPT_LIMIT);
    expect(metadata.contentExcerpt.endsWith('…')).toBe(true);
  });
});
