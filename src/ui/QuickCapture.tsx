import { useEffect, useState } from 'react';

import { database } from '../db/database';
import type { ReadingStatus } from '../domain/bookmark';
import { upsertChromeBookmarkMirror } from '../repositories/chrome-bookmark-repository';
import { extractActiveTabMetadata } from '../content/page-metadata-client';
import type { PageMetadata } from '../content/page-metadata';
import { createConfiguredAiProvider } from '../ai/configured-provider';

interface FolderOption {
  id: string;
  label: string;
}

const emptyPageMetadata: PageMetadata = {
  description: '',
  selectedText: '',
  contentExcerpt: '',
};

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
  const [pageMetadata, setPageMetadata] =
    useState<PageMetadata>(emptyPageMetadata);

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
      setPageMetadata(metadata);
      const text = [metadata.description, metadata.selectedText]
        .filter(Boolean)
        .join('\n\n');
      if (text)
        setNote((current) => (current ? `${current}\n\n${text}` : text));
      const parts = [
        metadata.description ? '页面描述' : '',
        metadata.selectedText ? '选中文本' : '',
        metadata.contentExcerpt
          ? `正文摘录（${metadata.contentExcerpt.length} 字）`
          : '',
      ].filter(Boolean);
      setStatus(
        parts.length > 0
          ? `已在本地读取：${parts.join('、')}。`
          : '当前页面没有可读取的文本内容。',
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
      const bookmarks = await database.bookmarks.toArray();
      const tagCounts = new Map<string, number>();
      for (const bookmark of bookmarks) {
        for (const tag of bookmark.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }
      const candidateTags = [...tagCounts]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 30)
        .map(([tag]) => tag);
      const folderPath =
        folders.find((folder) => folder.id === folderId)?.label.split(' / ') ??
        [];
      const result = await provider.classify({
        title,
        url,
        description: pageMetadata.description,
        selectedText: [pageMetadata.selectedText, note.trim()]
          .filter(Boolean)
          .join('\n\n'),
        contentExcerpt: pageMetadata.contentExcerpt,
        candidateTags,
        folderPath,
      });
      setTags(result.tags.join(', '));
      setStatus(`已生成分类建议：${result.contentType}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI 建议生成失败。');
    } finally {
      setAiBusy(false);
    }
  };

  const generateSummary = async (): Promise<void> => {
    const provider = createConfiguredAiProvider();
    if (!provider) {
      setStatus('AI 当前已禁用，请先在管理页的 AI 设置中启用 Provider。');
      return;
    }
    setAiBusy(true);
    try {
      let metadata = pageMetadata;
      if (tabId !== null) {
        try {
          metadata = await extractActiveTabMetadata(tabId);
          setPageMetadata(metadata);
        } catch {
          // Restricted browser pages may reject script injection. Existing
          // metadata, the title and the user's note remain valid inputs.
        }
      }
      const result = await provider.summarize({
        title,
        url,
        description: metadata.description,
        selectedText: [metadata.selectedText, note.trim()]
          .filter(Boolean)
          .join('\n\n'),
        contentExcerpt: metadata.contentExcerpt,
      });
      setNote((current) =>
        current ? `${current}\n\n${result.summary}` : result.summary,
      );
      setStatus('已生成摘要，请确认后保存。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI 摘要生成失败。');
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
        读取页面内容
      </button>
      {pageMetadata.contentExcerpt ? (
        <small className="quick-capture__content-status">
          正文摘录仅保存在当前表单中；只有点击 AI 按钮时才会交给已配置的
          Provider。
        </small>
      ) : null}
      <button
        type="button"
        disabled={aiBusy || !title.trim() || !url.trim()}
        onClick={() => void generateSuggestions()}
      >
        {aiBusy ? '生成中…' : '生成 AI 标签建议'}
      </button>
      <button
        type="button"
        disabled={aiBusy || !title.trim() || !url.trim()}
        onClick={() => void generateSummary()}
      >
        {aiBusy ? '生成中…' : '生成 AI 摘要'}
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
