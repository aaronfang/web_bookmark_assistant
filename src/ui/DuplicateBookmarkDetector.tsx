import { useEffect, useState } from 'react';

import {
  findChromeDuplicateBookmarkGroups,
  type DuplicateBookmarkGroup,
} from '../duplicates/duplicate-bookmarks';

const GROUP_RENDER_LIMIT = 50;

interface DuplicateBookmarkDetectorProps {
  revision: number;
}

export function DuplicateBookmarkDetector({
  revision,
}: DuplicateBookmarkDetectorProps) {
  const [groups, setGroups] = useState<DuplicateBookmarkGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    findChromeDuplicateBookmarkGroups()
      .then((nextGroups) => {
        if (!cancelled) {
          setGroups(nextGroups);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '重复检测失败');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const duplicateCopies = groups.reduce(
    (total, group) => total + group.bookmarks.length - 1,
    0,
  );
  const visibleGroups = groups.slice(0, GROUP_RENDER_LIMIT);

  return (
    <section className="duplicate-detector" aria-labelledby="duplicates-title">
      <header className="duplicate-detector__header">
        <div>
          <h2 id="duplicates-title">重复书签检测</h2>
          <p>仅生成只读候选，不会自动合并或删除 Chrome 书签。</p>
        </div>
        <div className="duplicate-detector__summary" aria-live="polite">
          {isLoading
            ? '正在检测…'
            : `${groups.length} 组 · ${duplicateCopies} 条可选副本`}
        </div>
      </header>

      {error ? <p className="status status--error">{error}</p> : null}
      {!isLoading && !error && groups.length === 0 ? (
        <div className="duplicate-detector__empty">没有发现重复书签。</div>
      ) : null}

      <div className="duplicate-groups">
        {visibleGroups.map((group) => (
          <article className="duplicate-group" key={group.normalizedUrl}>
            <header>
              <span
                className={`duplicate-group__badge duplicate-group__badge--${group.matchType}`}
              >
                {group.matchType === 'exact' ? '完全相同' : '规范化相同'}
              </span>
              <strong>{group.bookmarks.length} 个书签</strong>
            </header>
            <code>{group.normalizedUrl}</code>
            <ul>
              {group.bookmarks.map((bookmark) => (
                <li key={bookmark.id}>
                  <a href={bookmark.url} rel="noreferrer" target="_blank">
                    {bookmark.title || bookmark.url}
                  </a>
                  <span>
                    {(bookmark.folderPath ?? []).join(' / ') || '未分类'}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {groups.length > GROUP_RENDER_LIMIT ? (
        <p className="duplicate-detector__limit">
          为保持页面流畅，仅显示前 {GROUP_RENDER_LIMIT} 组。
        </p>
      ) : null}
    </section>
  );
}
