import { useEffect, useState } from 'react';

import { isChromeBookmarksUpdatedMessage } from '../chrome/bookmark-events';
import { readChromeBookmarkSummary } from '../chrome/bookmark-reader';
import { synchronizeChromeBookmarkMirror } from '../repositories/chrome-bookmark-repository';
import { countIndependentBookmarks } from '../repositories/local-bookmark-repository';
import { invalidateBookmarkSearchIndex } from '../search/bookmark-search';
import { BookmarkFolderBrowser } from './BookmarkFolderBrowser';
import { BookmarkSearch } from './BookmarkSearch';
import { DuplicateBookmarkDetector } from './DuplicateBookmarkDetector';
import { SnapshotExport } from './SnapshotExport';

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
  const [bookmarkRevision, setBookmarkRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const updateStats = (
      loadChromeStats: () => Promise<{
        bookmarks: number;
        folders: number;
      }>,
    ): void => {
      Promise.all([loadChromeStats(), countIndependentBookmarks()])
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
    };

    updateStats(synchronizeChromeBookmarkMirror);

    const handleMessage = (message: unknown): void => {
      if (!isChromeBookmarksUpdatedMessage(message)) return;

      invalidateBookmarkSearchIndex();
      updateStats(readChromeBookmarkSummary);
      setBookmarkRevision((revision) => revision + 1);
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(handleMessage);
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

      {surface === 'sidepanel' && stats ? (
        <BookmarkSearch revision={bookmarkRevision} />
      ) : null}

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

      {surface === 'options' && stats ? (
        <>
          <BookmarkFolderBrowser revision={bookmarkRevision} />
          <DuplicateBookmarkDetector revision={bookmarkRevision} />
          <SnapshotExport />
        </>
      ) : null}

      <section className="notice">
        <h2>安全基线已启用</h2>
        <p>
          当前版本只读取并建立本地搜索索引，不会移动、修改或删除任何 Chrome
          书签。
        </p>
        <ul className="permission-list">
          <li>
            <strong>书签</strong>：只用于读取书签树；当前没有 Chrome
            书签写入路径。
          </li>
          <li>
            <strong>侧边栏</strong>：用于从工具栏打开主要界面。
          </li>
        </ul>
      </section>
    </main>
  );
}
