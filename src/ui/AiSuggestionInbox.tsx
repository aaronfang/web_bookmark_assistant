import { useEffect, useState } from 'react';

import { database } from '../db/database';
import type { BookmarkRecord, BookmarkSuggestion } from '../domain/bookmark';
import { invalidateBookmarkSearchIndex } from '../search/bookmark-search';
import {
  isLowAiConfidence,
  mergeSuggestedTags,
  parseAiClassificationProposedChange,
  type AiClassificationProposedChange,
} from '../suggestions/ai-classification-suggestion';

interface AiSuggestionInboxProps {
  revision: number;
}

interface InboxEntry {
  suggestion: BookmarkSuggestion;
  bookmark: BookmarkRecord;
  proposedChange: AiClassificationProposedChange;
}

async function readInboxEntries(): Promise<InboxEntry[]> {
  const suggestions = await database.suggestions
    .where('status')
    .equals('pending')
    .toArray();
  const bookmarks = await database.bookmarks.bulkGet(
    suggestions.map(({ bookmarkId }) => bookmarkId),
  );
  const entries: InboxEntry[] = [];
  suggestions.forEach((suggestion, index) => {
    const bookmark = bookmarks[index];
    const proposedChange = parseAiClassificationProposedChange(suggestion);
    if (bookmark && proposedChange) {
      entries.push({ suggestion, bookmark, proposedChange });
    }
  });
  return entries.sort((left, right) =>
    right.suggestion.createdAt.localeCompare(left.suggestion.createdAt),
  );
}

export function AiSuggestionInbox({ revision }: AiSuggestionInboxProps) {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async (): Promise<void> => {
    setEntries(await readInboxEntries());
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readInboxEntries()
      .then((next) => {
        if (!cancelled) {
          setEntries(next);
          setError(null);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '读取建议失败');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const apply = async (entry: InboxEntry): Promise<void> => {
    setBusyId(entry.suggestion.id);
    setError(null);
    try {
      await database.transaction(
        'rw',
        database.bookmarks,
        database.suggestions,
        async () => {
          const bookmark = await database.bookmarks.get(entry.bookmark.id);
          const suggestion = await database.suggestions.get(
            entry.suggestion.id,
          );
          if (!bookmark || suggestion?.status !== 'pending') return;
          const resolvedAt = new Date().toISOString();
          await database.bookmarks.update(bookmark.id, {
            tags: mergeSuggestedTags(bookmark.tags, entry.proposedChange.tags),
            updatedAt: resolvedAt,
          });
          await database.suggestions.update(suggestion.id, {
            status: 'applied',
            resolvedAt,
          });
        },
      );
      invalidateBookmarkSearchIndex();
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '应用建议失败');
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (suggestionId: string): Promise<void> => {
    setBusyId(suggestionId);
    setError(null);
    try {
      await database.suggestions.update(suggestionId, {
        status: 'dismissed',
        resolvedAt: new Date().toISOString(),
      });
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '忽略建议失败');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="ai-inbox" aria-labelledby="ai-inbox-title">
      <header className="move-suggestions__header">
        <div>
          <h2 id="ai-inbox-title">AI 待整理箱</h2>
          <p>保存尚未采用的分类结果；低置信度建议不会自动写入标签。</p>
        </div>
        <div className="move-suggestions__summary" aria-live="polite">
          {loading ? '正在读取…' : `${entries.length} 条待确认`}
        </div>
      </header>
      {error ? <p className="status status--error">{error}</p> : null}
      {!loading && !error && entries.length === 0 ? (
        <div className="move-suggestions__empty">暂无待确认的 AI 建议。</div>
      ) : null}
      <div className="ai-inbox__list">
        {entries.map((entry) => (
          <article className="ai-inbox__item" key={entry.suggestion.id}>
            <div className="ai-inbox__bookmark">
              <a href={entry.bookmark.url} target="_blank" rel="noreferrer">
                {entry.bookmark.title || entry.bookmark.url}
              </a>
              <span>{entry.bookmark.folderPath.join(' / ') || '未分类'}</span>
            </div>
            <div className="ai-inbox__proposal">
              <div>
                <strong>{entry.proposedChange.contentType}</strong>
                <span
                  className={
                    isLowAiConfidence(entry.suggestion.confidence)
                      ? 'is-low-confidence'
                      : undefined
                  }
                >
                  {Math.round(entry.suggestion.confidence * 100)}%
                </span>
              </div>
              <p>{entry.suggestion.explanation}</p>
              <div className="ai-tag-list">
                {entry.proposedChange.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              {entry.proposedChange.folderSuggestion ? (
                <small>
                  文件夹建议：{entry.proposedChange.folderSuggestion}
                </small>
              ) : null}
            </div>
            <div className="ai-inbox__actions">
              <button
                type="button"
                disabled={
                  busyId !== null || entry.proposedChange.tags.length === 0
                }
                onClick={() => void apply(entry)}
              >
                {busyId === entry.suggestion.id ? '处理中…' : '应用标签'}
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void dismiss(entry.suggestion.id)}
              >
                忽略
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
