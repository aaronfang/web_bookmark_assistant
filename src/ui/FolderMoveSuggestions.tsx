import { useEffect, useState } from 'react';

import {
  generateChromeFolderMoveSuggestions,
  type FolderMoveSuggestion,
} from '../suggestions/folder-move-suggestions';

const SUGGESTION_RENDER_LIMIT = 100;

interface FolderMoveSuggestionsProps {
  revision: number;
}

function displayPath(path: readonly string[]): string {
  return path.join(' / ') || '未分类';
}

export function FolderMoveSuggestions({
  revision,
}: FolderMoveSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<FolderMoveSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    generateChromeFolderMoveSuggestions()
      .then((nextSuggestions) => {
        if (!cancelled) {
          setSuggestions(nextSuggestions);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '整理建议生成失败');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const visibleSuggestions = suggestions.slice(0, SUGGESTION_RENDER_LIMIT);

  return (
    <section
      className="move-suggestions"
      aria-labelledby="move-suggestions-title"
    >
      <header className="move-suggestions__header">
        <div>
          <h2 id="move-suggestions-title">文件夹移动建议预览</h2>
          <p>
            仅在同一域名至少 75% 集中于一个文件夹时生成建议；当前不能执行移动。
          </p>
        </div>
        <div className="move-suggestions__summary" aria-live="polite">
          {isLoading ? '正在分析…' : `${suggestions.length} 条建议`}
        </div>
      </header>

      {error ? <p className="status status--error">{error}</p> : null}
      {!isLoading && !error && suggestions.length === 0 ? (
        <div className="move-suggestions__empty">暂无高置信度移动建议。</div>
      ) : null}

      <div className="move-suggestion-list">
        {visibleSuggestions.map((suggestion) => (
          <article className="move-suggestion" key={suggestion.id}>
            <div className="move-suggestion__bookmark">
              <a
                href={suggestion.bookmark.url}
                rel="noreferrer"
                target="_blank"
              >
                {suggestion.bookmark.title || suggestion.bookmark.url}
              </a>
              <span>{suggestion.hostname}</span>
            </div>
            <div className="move-suggestion__path">
              <span>{displayPath(suggestion.currentFolderPath)}</span>
              <b aria-hidden="true">→</b>
              <strong>{displayPath(suggestion.targetFolderPath)}</strong>
            </div>
            <div className="move-suggestion__evidence">
              <strong>{Math.round(suggestion.confidence * 100)}%</strong>
              <span>{suggestion.explanation}</span>
            </div>
          </article>
        ))}
      </div>

      {suggestions.length > SUGGESTION_RENDER_LIMIT ? (
        <p className="move-suggestions__limit">
          为保持页面流畅，仅显示前 {SUGGESTION_RENDER_LIMIT} 条。
        </p>
      ) : null}
    </section>
  );
}
