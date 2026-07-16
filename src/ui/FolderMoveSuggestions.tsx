import { useEffect, useState } from 'react';

import {
  buildFolderMoveBatchPreview,
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setSelectedIds(new Set());
    setIsPreviewOpen(false);

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
  const selectedSuggestions = suggestions.filter((suggestion) =>
    selectedIds.has(suggestion.id),
  );
  const allVisibleSelected =
    visibleSuggestions.length > 0 &&
    visibleSuggestions.every((suggestion) => selectedIds.has(suggestion.id));
  const preview = buildFolderMoveBatchPreview(selectedSuggestions);

  const toggleSuggestion = (id: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIsPreviewOpen(false);
  };

  const toggleAllVisible = (): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const suggestion of visibleSuggestions) {
        if (allVisibleSelected) next.delete(suggestion.id);
        else next.add(suggestion.id);
      }
      return next;
    });
    setIsPreviewOpen(false);
  };

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

      {visibleSuggestions.length > 0 ? (
        <div className="move-suggestions__selection">
          <label>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
            />
            选择当前显示的建议
          </label>
          <button
            type="button"
            disabled={selectedSuggestions.length === 0}
            onClick={() => setIsPreviewOpen(true)}
          >
            预览所选建议（{selectedSuggestions.length}）
          </button>
        </div>
      ) : null}

      <div className="move-suggestion-list">
        {visibleSuggestions.map((suggestion) => (
          <article
            className={`move-suggestion${selectedIds.has(suggestion.id) ? ' is-selected' : ''}`}
            key={suggestion.id}
          >
            <input
              type="checkbox"
              aria-label={`选择 ${suggestion.bookmark.title || suggestion.bookmark.url}`}
              checked={selectedIds.has(suggestion.id)}
              onChange={() => toggleSuggestion(suggestion.id)}
            />
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

      {isPreviewOpen ? (
        <section
          className="move-batch-preview"
          aria-labelledby="move-batch-preview-title"
        >
          <header>
            <div>
              <span>只读预览</span>
              <h3 id="move-batch-preview-title">批量移动预览</h3>
            </div>
            <button type="button" onClick={() => setIsPreviewOpen(false)}>
              关闭预览
            </button>
          </header>

          <div className="move-batch-preview__summary">
            <div>
              <strong>{preview.bookmarkCount}</strong>
              <span>条书签</span>
            </div>
            <div>
              <strong>{preview.sourceFolders.length}</strong>
              <span>个来源文件夹</span>
            </div>
            <div>
              <strong>{preview.targetFolders.length}</strong>
              <span>个目标文件夹</span>
            </div>
          </div>

          <ul className="move-batch-preview__items">
            {preview.suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <strong>
                  {suggestion.bookmark.title || suggestion.bookmark.url}
                </strong>
                <span>{displayPath(suggestion.currentFolderPath)}</span>
                <b aria-hidden="true">→</b>
                <span>{displayPath(suggestion.targetFolderPath)}</span>
              </li>
            ))}
          </ul>

          <div className="move-batch-preview__safety">
            正式开放执行前，每个批次必须先创建快照、写入操作日志并支持撤销。
          </div>
          <button type="button" disabled>
            执行移动（尚未开放）
          </button>
        </section>
      ) : null}
    </section>
  );
}
