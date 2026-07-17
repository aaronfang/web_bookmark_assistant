import { useEffect, useState } from 'react';

import { database } from '../db/database';
import type { ReadingStatus } from '../domain/bookmark';
import { upsertChromeBookmarkMirror } from '../repositories/chrome-bookmark-repository';

interface FolderOption {
  id: string;
  label: string;
}

function folderOptions(
  nodes: readonly chrome.bookmarks.BookmarkTreeNode[],
): FolderOption[] {
  const options: FolderOption[] = [];
  const visit = (
    node: chrome.bookmarks.BookmarkTreeNode,
    path: string[],
  ): void => {
    if (node.url) return;
    const next =
      node.parentId === undefined ? path : [...path, node.title || '未命名'];
    if (node.parentId !== undefined)
      options.push({ id: node.id, label: next.join(' / ') });
    node.children?.forEach((child) => visit(child, next));
  };
  nodes.forEach((node) => visit(node, []));
  return options;
}

export function QuickCapture() {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>('inbox');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      chrome.bookmarks.getTree(),
    ]).then(([tabs, tree]) => {
      const tab = tabs[0];
      setTitle(tab?.title ?? '');
      setUrl(tab?.url ?? '');
      const nextFolders = folderOptions(tree);
      setFolders(nextFolders);
      setFolderId(nextFolders[0]?.id ?? '');
    });
  }, []);

  const save = async (): Promise<void> => {
    if (!title.trim() || !url.trim() || !folderId || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const node = await chrome.bookmarks.create({
        parentId: folderId,
        title: title.trim(),
        url: url.trim(),
      });
      await upsertChromeBookmarkMirror(node);
      await database.bookmarks.update(`chrome:${node.id}`, {
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        note: note.trim(),
        readingStatus,
      });
      setStatus('已保存到 Chrome 书签。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="quick-capture" aria-labelledby="quick-capture-title">
      <h2 id="quick-capture-title">保存当前页面</h2>
      <label>
        标题
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        网址
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <label>
        文件夹
        <select
          value={folderId}
          onChange={(event) => setFolderId(event.target.value)}
        >
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        标签
        <input
          value={tags}
          placeholder="多个标签用逗号分隔"
          onChange={(event) => setTags(event.target.value)}
        />
      </label>
      <label>
        备注
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <label>
        阅读状态
        <select
          value={readingStatus}
          onChange={(event) =>
            setReadingStatus(event.target.value as ReadingStatus)
          }
        >
          <option value="inbox">收件箱</option>
          <option value="unread">待读</option>
          <option value="reading">阅读中</option>
          <option value="completed">已完成</option>
          <option value="archived">已归档</option>
        </select>
      </label>
      <button
        type="button"
        disabled={saving || !title.trim() || !url.trim() || !folderId}
        onClick={() => void save()}
      >
        {saving ? '保存中…' : '保存书签'}
      </button>
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}
