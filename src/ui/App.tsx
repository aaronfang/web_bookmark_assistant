import { useEffect, useState } from 'react';

import { readChromeBookmarkSummary } from '../chrome/bookmark-reader';
import { countIndependentBookmarks } from '../repositories/local-bookmark-repository';

type Surface = 'popup' | 'sidepanel' | 'newtab' | 'options';

interface AppProps {
  surface: Surface;
}

interface LibraryStats {
  chromeBookmarks: number;
  chromeFolders: number;
  independentBookmarks: number;
}

const titles: Record<Surface, string> = {
  popup: '快速收藏',
  sidepanel: '书签助手',
  newtab: '今日回顾',
  options: '书签管理',
};

export function App({ surface }: AppProps) {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([readChromeBookmarkSummary(), countIndependentBookmarks()])
      .then(([chromeSummary, independentBookmarks]) => {
        if (!cancelled) {
          setStats({
            chromeBookmarks: chromeSummary.bookmarks,
            chromeFolders: chromeSummary.folders,
            independentBookmarks,
          });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '读取书签失败');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={`app app--${surface}`}>
      <header className="app__header">
        <span className="app__eyebrow">Web Bookmark Assistant</span>
        <h1>{titles[surface]}</h1>
        <p>本地优先 · 当前为只读模式 · AI 未启用</p>
      </header>

      {error ? <p className="status status--error">{error}</p> : null}

      <section className="stats" aria-label="书签概况">
        <article>
          <strong>{stats?.chromeBookmarks ?? '—'}</strong>
          <span>Chrome 书签</span>
        </article>
        <article>
          <strong>{stats?.chromeFolders ?? '—'}</strong>
          <span>Chrome 文件夹</span>
        </article>
        <article>
          <strong>{stats?.independentBookmarks ?? '—'}</strong>
          <span>独立书签</span>
        </article>
      </section>

      <section className="notice">
        <h2>安全基线已启用</h2>
        <p>当前版本只读取书签数量，不会移动、修改或删除任何 Chrome 书签。</p>
      </section>
    </main>
  );
}
