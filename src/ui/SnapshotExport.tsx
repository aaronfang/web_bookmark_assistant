import { useState } from 'react';

import { createLocalBookmarkSnapshot } from '../snapshots/bookmark-snapshot';
import { downloadJson } from '../snapshots/download-json';

export function SnapshotExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportSnapshot = async (): Promise<void> => {
    setIsExporting(true);
    setMessage(null);
    setError(null);

    try {
      const snapshot = await createLocalBookmarkSnapshot();
      downloadJson(snapshot.filename, snapshot.json);
      setMessage(
        `已导出 ${snapshot.document.localBookmarks.length} 条本地索引记录。`,
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '快照导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="snapshot-export" aria-labelledby="snapshot-title">
      <div>
        <h2 id="snapshot-title">本地书签快照</h2>
        <p>
          导出完整 Chrome 书签树以及本地标签、备注和阅读状态，不会上传数据。
        </p>
        <p className="snapshot-export__warning">
          文件包含完整网址，可能带有敏感查询参数，请妥善保存。
        </p>
      </div>
      <button
        type="button"
        disabled={isExporting}
        onClick={() => void exportSnapshot()}
      >
        {isExporting ? '正在生成…' : '导出 JSON 快照'}
      </button>
      {message ? <p className="status status--success">{message}</p> : null}
      {error ? <p className="status status--error">{error}</p> : null}
    </section>
  );
}
