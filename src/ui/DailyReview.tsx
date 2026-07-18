import { useEffect, useState } from 'react';

import { database } from '../db/database';
import type { BookmarkRecord } from '../domain/bookmark';
import { selectDailyReviewBookmarks } from '../review/daily-review';

export function DailyReview() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);

  useEffect(() => {
    void database.bookmarks.toArray().then((items) => {
      setBookmarks(selectDailyReviewBookmarks(items));
    });
  }, []);

  return (
    <section className="daily-review" aria-labelledby="daily-review-title">
      <header className="dashboard-overview__header">
        <h2 id="daily-review-title">今天重新看看</h2>
        <p>优先展示待读、收件箱和较早收藏的书签。</p>
      </header>
      {bookmarks.length === 0 ? (
        <div className="health-check__empty">暂时没有可回顾的书签。</div>
      ) : (
        <div className="health-issues">
          {bookmarks.map((bookmark) => (
            <article className="health-issue" key={bookmark.id}>
              <div className="health-issue__body">
                <span className="health-issue__kind">
                  {bookmark.readingStatus}
                </span>
                <a href={bookmark.url} target="_blank" rel="noreferrer">
                  {bookmark.title || bookmark.url}
                </a>
                <p>{bookmark.folderPath.join(' / ') || '未分类'}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
