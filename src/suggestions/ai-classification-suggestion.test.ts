import { describe, expect, it } from 'vitest';

import {
  createAiClassificationSuggestion,
  isLowAiConfidence,
  mergeSuggestedTags,
  parseAiClassificationProposedChange,
} from './ai-classification-suggestion';

describe('AI classification suggestions', () => {
  it('persists confidence, explanation and proposed changes for review', () => {
    const suggestion = createAiClassificationSuggestion(
      'chrome:42',
      {
        contentType: 'article',
        tags: ['AI', ' ai ', '开发'],
        folderSuggestion: '技术 / AI',
        confidence: 0.48,
        explanation: '正文信息有限，需要人工确认。',
      },
      false,
      '2026-07-18T12:00:00.000Z',
    );

    expect(suggestion).toMatchObject({
      bookmarkId: 'chrome:42',
      kind: 'add-tags',
      status: 'pending',
      confidence: 0.48,
      explanation: '正文信息有限，需要人工确认。',
    });
    expect(parseAiClassificationProposedChange(suggestion)).toEqual({
      contentType: 'article',
      tags: ['AI', '开发'],
      folderSuggestion: '技术 / AI',
    });
  });

  it('marks an explicitly adopted suggestion as applied', () => {
    const suggestion = createAiClassificationSuggestion(
      'chrome:42',
      {
        contentType: 'tool',
        tags: ['工具'],
        confidence: 1.4,
        explanation: '功能明确。',
      },
      true,
      '2026-07-18T12:00:00.000Z',
    );

    expect(suggestion.status).toBe('applied');
    expect(suggestion.confidence).toBe(1);
    expect(suggestion.resolvedAt).toBe('2026-07-18T12:00:00.000Z');
  });

  it('merges tags without case-insensitive duplicates', () => {
    expect(mergeSuggestedTags(['AI', '前端'], [' ai ', '工具'])).toEqual([
      'AI',
      '前端',
      '工具',
    ]);
    expect(isLowAiConfidence(0.69)).toBe(true);
    expect(isLowAiConfidence(0.7)).toBe(false);
  });

  it('rejects malformed stored changes', () => {
    expect(
      parseAiClassificationProposedChange({
        kind: 'add-tags',
        proposedChange: '{bad json',
      }),
    ).toBeNull();
  });
});
