import { useEffect, useState } from 'react';

import {
  analyzeChromeBookmarkHealth,
  type BookmarkHealthIssue,
  type BookmarkHealthIssueKind,
} from '../health/bookmark-health';

const ISSUE_RENDER_LIMIT = 100;

const issueLabels: Record<BookmarkHealthIssueKind, string> = {
  'empty-folder': '空文件夹',
  'low-quality-title': '标题待完善',
  'old-bookmark': '长期收藏',
};

type HealthFilter = 'all' | BookmarkHealthIssueKind;

interface BookmarkHealthCheckProps {
  revision: number;
}

export function BookmarkHealthCheck({ revision }: BookmarkHealthCheckProps) {
  const [issues, setIssues] = useState<BookmarkHealthIssue[]>([]);
  const [filter, setFilter] = useState<HealthFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    analyzeChromeBookmarkHealth()
      .then((nextIssues) => {
        if (!cancelled) {
          setIssues(nextIssues);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '健康检查失败');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const count = (kind: BookmarkHealthIssueKind): number =>
    issues.filter((issue) => issue.kind === kind).length;
  const filteredIssues =
    filter === 'all' ? issues : issues.filter((issue) => issue.kind === filter);
  const visibleIssues = filteredIssues.slice(0, ISSUE_RENDER_LIMIT);

  const filters: Array<{ id: HealthFilter; label: string; count: number }> = [
    { id: 'all', label: '全部', count: issues.length },
    {
      id: 'empty-folder',
      label: issueLabels['empty-folder'],
      count: count('empty-folder'),
    },
    {
      id: 'low-quality-title',
      label: issueLabels['low-quality-title'],
      count: count('low-quality-title'),
    },
    {
      id: 'old-bookmark',
      label: issueLabels['old-bookmark'],
      count: count('old-bookmark'),
    },
  ];

  return (
    <section className="health-check" aria-labelledby="health-check-title">
      <header className="health-check__header">
        <div>
          <h2 id="health-check-title">书签健康检查</h2>
          <p>所有结果都是只读提示，不代表书签失效，也不会触发自动整理。</p>
        </div>
        <div className="health-check__summary" aria-live="polite">
          {isLoading ? '正在检查…' : `${issues.length} 条候选`}
        </div>
      </header>

      <div className="health-check__filters" aria-label="健康问题筛选">
        {filters.map((item) => (
          <button
            type="button"
            aria-pressed={filter === item.id}
            className={filter === item.id ? 'is-selected' : undefined}
            key={item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label} <span>{item.count}</span>
          </button>
        ))}
      </div>

      {error ? <p className="status status--error">{error}</p> : null}
      {!isLoading && !error && filteredIssues.length === 0 ? (
        <div className="health-check__empty">此分类没有候选项。</div>
      ) : null}

      <div className="health-issues">
        {visibleIssues.map((issue) => (
          <article
            className={`health-issue health-issue--${issue.kind}`}
            key={issue.id}
          >
            <div className="health-issue__body">
              <span className="health-issue__kind">
                {issueLabels[issue.kind]}
              </span>
              {issue.url ? (
                <a href={issue.url} rel="noreferrer" target="_blank">
                  {issue.title}
                </a>
              ) : (
                <strong>{issue.title}</strong>
              )}
              <p>{issue.description}</p>
            </div>
            <span className="health-issue__path">
              {issue.folderPath.join(' / ') || '未分类'}
            </span>
          </article>
        ))}
      </div>

      {filteredIssues.length > ISSUE_RENDER_LIMIT ? (
        <p className="health-check__limit">
          为保持页面流畅，仅显示前 {ISSUE_RENDER_LIMIT} 条。
        </p>
      ) : null}
    </section>
  );
}
