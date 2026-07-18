import { useEffect, useState } from 'react';

import { database } from '../db/database';
import type { ReadingStatus } from '../domain/bookmark';
import { upsertChromeBookmarkMirror } from '../repositories/chrome-bookmark-repository';
import { extractActiveTabMetadata } from '../content/page-metadata-client';
import { createConfiguredAiProvider } from '../ai/configured-provider';

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
  const [tabId, setTabId] = useState<number | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      chrome.bookmarks.getTree(),
    ]).then(([tabs, tree]) => {
      const tab = tabs[0];
      setTabId(tab?.id ?? null);
      setTitle(tab?.title ?? '');
      setUrl(tab?.url ?? '');
      const nextFolders = folderOptions(tree);
      setFolders(nextFolders);
      setFolderId(nextFolders[0]?.id ?? '');
    });
  }, []);

  const readMetadata = async (): Promise<void> => {
    if (tabId === null) return;
    try {
      const metadata = await extractActiveTabMetadata(tabId);
      const text = [metadata.description, metadata.selectedText]
        .filter(Boolean)
        .join('\n\n');
      if (text)
        setNote((current) => (current ? `${current}\n\n${text}` : text));
      setStatus(
        text
          ? '已读取页面描述和选中文本。'
          : '当前页面没有可读取的描述或选中文本。',
      );
    } catch {
      setStatus('无法读取当前页面内容，请确认页面允许扩展访问。');
    }
  };

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

  const generateSuggestions = async (): Promise<void> => {
    const provider = createConfiguredAiProvider();
    if (!provider) {
      setStatus('AI 当前已禁用，请先在管理页的 AI 设置中启用 Provider。');
      return;
    }
    setAiBusy(true);
    try {
      const result = await provider.classify({
        title,
        url,
        selectedText: note,
      });
      setTags(result.tags.join(', '));
      setStatus(`已生成分类建议：${result.contentType}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI 建议生成失败。');
    } finally {
      setAiBusy(false);
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
      <button
        type="button"
        onClick={() => void readMetadata()}
        disabled={tabId === null}
      >
        读取页面描述/选中文本
      </button>
      <button
        type="button"
        disabled={aiBusy || !title.trim() || !url.trim()}
        onClick={() => void generateSuggestions()}
      >
        {aiBusy ? '生成中…' : '生成 AI 标签建议'}
      </button>
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
