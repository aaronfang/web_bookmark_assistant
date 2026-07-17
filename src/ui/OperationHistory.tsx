import { useEffect, useState } from 'react';

import { database } from '../db/database';
import type { BookmarkOperationBatch } from '../domain/bookmark';

const labels: Record<BookmarkOperationBatch['status'], string> = {
  planned: '计划中',
  executing: '执行中',
  completed: '已完成',
  failed: '失败',
  reverting: '回滚中',
  reverted: '已回滚',
};

interface OperationHistoryProps {
  revision: number;
}

export function OperationHistory({ revision }: OperationHistoryProps) {
  const [batches, setBatches] = useState<BookmarkOperationBatch[]>([]);

  useEffect(() => {
    void database.operationBatches
      .orderBy('createdAt')
      .reverse()
      .limit(50)
      .toArray()
      .then(setBatches);
  }, [revision]);

  return (
    <section
      className="operation-history"
      aria-labelledby="operation-history-title"
    >
      <header className="dashboard-overview__header">
        <h2 id="operation-history-title">操作历史</h2>
        <p>查看整理操作的批次状态和快照关联。当前面板只读。</p>
      </header>
      {batches.length === 0 ? (
        <div className="health-check__empty">还没有记录过整理操作。</div>
      ) : (
        <div className="health-issues">
          {batches.map((batch) => (
            <article className="health-issue" key={batch.id}>
              <div className="health-issue__body">
                <span className="health-issue__kind">
                  {labels[batch.status]}
                </span>
                <strong>{batch.operationCount} 条书签移动</strong>
                <p>
                  {new Date(batch.createdAt).toLocaleString()} · 快照{' '}
                  {batch.snapshotId}
                </p>
                {batch.error ? (
                  <p className="status status--error">{batch.error}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
