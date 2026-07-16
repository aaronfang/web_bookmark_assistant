import { useEffect, useState } from 'react';

import type { BookmarkRecord } from '../domain/bookmark';
import { searchBookmarks } from '../search/bookmark-search';

function displayHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

interface BookmarkSearchProps {
  revision: number;
}

export function BookmarkSearch({ revision }: BookmarkSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookmarkRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setError(null);

    const timer = window.setTimeout(() => {
      searchBookmarks(query)
        .then((bookmarks) => {
          if (!cancelled) {
            setResults(bookmarks);
            setIsSearching(false);
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setError(cause instanceof Error ? cause.message : '搜索失败');
            setIsSearching(false);
          }
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, revision]);

  const hasQuery = Boolean(query.trim());

  return (
    <section className="search-panel" aria-label="搜索 Chrome 书签">
      <label htmlFor="bookmark-search">搜索书签</label>
      <input
        id="bookmark-search"
        type="search"
        autoComplete="off"
        autoFocus
        value={query}
        placeholder="输入标题、网址或文件夹…"
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="search-summary" aria-live="polite">
        {isSearching
          ? '正在搜索…'
          : hasQuery
            ? `找到 ${results.length} 条结果${results.length === 50 ? '（最多显示 50 条）' : ''}`
            : '输入关键词开始搜索，支持空格组合多个关键词。'}
      </div>

      {error ? <p className="status status--error">{error}</p> : null}

      {!isSearching && hasQuery && results.length === 0 && !error ? (
        <div className="empty-state">没有匹配的书签，试试标题或域名。</div>
      ) : null}

      <div className="search-results">
        {results.map((bookmark) => {
          const folderPath = bookmark.folderPath ?? [];

          return (
            <a
              className="bookmark-result"
              href={bookmark.url}
              key={bookmark.id}
              rel="noreferrer"
              target="_blank"
            >
              <span className="bookmark-result__title">
                {bookmark.title || displayHost(bookmark.url)}
              </span>
              <span className="bookmark-result__url">{bookmark.url}</span>
              <span className="bookmark-result__folder">
                {folderPath.length > 0 ? folderPath.join(' / ') : '未分类'}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
