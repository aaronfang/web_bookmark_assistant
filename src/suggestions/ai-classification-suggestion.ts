import type { ClassificationResult } from '../ai/provider';
import type { BookmarkSuggestion } from '../domain/bookmark';

export const LOW_AI_CONFIDENCE_THRESHOLD = 0.7;

export interface AiClassificationProposedChange {
  contentType: string;
  tags: string[];
  folderSuggestion?: string;
}

function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of tags) {
    const tag = value.trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    normalized.push(tag);
  }
  return normalized;
}

export function mergeSuggestedTags(
  existing: readonly string[],
  suggested: readonly string[],
): string[] {
  return normalizeTags([...existing, ...suggested]);
}

export function isLowAiConfidence(confidence: number): boolean {
  return confidence < LOW_AI_CONFIDENCE_THRESHOLD;
}

export function createAiClassificationSuggestion(
  bookmarkId: string,
  result: ClassificationResult,
  accepted: boolean,
  createdAt = new Date().toISOString(),
): BookmarkSuggestion {
  const proposedChange: AiClassificationProposedChange = {
    contentType: result.contentType.trim() || 'unknown',
    tags: normalizeTags(result.tags),
    ...(result.folderSuggestion?.trim()
      ? { folderSuggestion: result.folderSuggestion.trim() }
      : {}),
  };
  const confidence = Number.isFinite(result.confidence)
    ? Math.min(1, Math.max(0, result.confidence))
    : 0;

  return {
    id: `ai-classification:${bookmarkId}:${createdAt}`,
    bookmarkId,
    kind: 'add-tags',
    status: accepted ? 'applied' : 'pending',
    confidence,
    explanation: result.explanation.trim() || 'Provider 未提供分类依据。',
    proposedChange: JSON.stringify(proposedChange),
    createdAt,
    ...(accepted ? { resolvedAt: createdAt } : {}),
  };
}

export function parseAiClassificationProposedChange(
  suggestion: Pick<BookmarkSuggestion, 'kind' | 'proposedChange'>,
): AiClassificationProposedChange | null {
  if (suggestion.kind !== 'add-tags') return null;
  try {
    const parsed = JSON.parse(suggestion.proposedChange) as Partial<
      Record<keyof AiClassificationProposedChange, unknown>
    >;
    if (typeof parsed.contentType !== 'string' || !Array.isArray(parsed.tags)) {
      return null;
    }
    return {
      contentType: parsed.contentType,
      tags: normalizeTags(
        parsed.tags.filter((tag): tag is string => typeof tag === 'string'),
      ),
      ...(typeof parsed.folderSuggestion === 'string' &&
      parsed.folderSuggestion.trim()
        ? { folderSuggestion: parsed.folderSuggestion.trim() }
        : {}),
    };
  } catch {
    return null;
  }
}
