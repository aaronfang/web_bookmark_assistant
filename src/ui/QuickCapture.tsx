import { useEffect, useState } from 'react';

import { createConfiguredAiProvider } from '../ai/configured-provider';
import type { ClassificationResult } from '../ai/provider';
import { extractActiveTabMetadata } from '../content/page-metadata-client';
import type { PageMetadata } from '../content/page-metadata';
import { database } from '../db/database';
import type { ReadingStatus } from '../domain/bookmark';
import { upsertChromeBookmarkMirror } from '../repositories/chrome-bookmark-repository';
import {
  createAiClassificationSuggestion,
  isLowAiConfidence,
  mergeSuggestedTags,
} from '../suggestions/ai-classification-suggestion';

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
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [classificationAccepted, setClassificationAccepted] = useState(false);
  const clearClassification = (): void => {
    setClassification(null);
    setClassificationAccepted(false);
  };

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
      clearClassification();
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
      const bookmarkId = `chrome:${node.id}`;
      await database.transaction(
        'rw',
        database.bookmarks,
        database.suggestions,
        async () => {
          await database.bookmarks.update(bookmarkId, {
            tags: tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
            note: note.trim(),
            readingStatus,
          });
          if (classification) {
            await database.suggestions.put(
              createAiClassificationSuggestion(
                bookmarkId,
                classification,
                classificationAccepted,
              ),
            );
          }
        },
      );
      setStatus(
        classification && !classificationAccepted
          ? '已保存书签；未采用的分类建议已进入 AI 待整理箱。'
          : '已保存到 Chrome 书签。',
      );
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
    clearClassification();
    try {
      let metadata = pageMetadata;
      if (tabId !== null) {
        try {
          metadata = await extractActiveTabMetadata(tabId);
          setPageMetadata(metadata);
        } catch {
          // Classification can still use the title, URL and existing form data.
        }
      }
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
        description: metadata.description,
        selectedText: [metadata.selectedText, note.trim()]
          .filter(Boolean)
          .join('\n\n'),
        contentExcerpt: metadata.contentExcerpt,
        candidateTags,
        folderPath,
      });
      setClassification(result);
      setClassificationAccepted(false);
      setStatus(
        isLowAiConfidence(result.confidence)
          ? '分类建议置信度较低；保存书签后会进入 AI 待整理箱。'
          : '已生成分类建议，请查看依据并确认是否采用。',
      );
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
          onChange={(event) => {
            setTitle(event.target.value);
            clearClassification();
          }}
        />
      </label>
      <label>
        网址
        <input
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            clearClassification();
          }}
        />
      </label>
      <label>
        文件夹
        <select
          value={folderId}
          onChange={(event) => {
            setFolderId(event.target.value);
            clearClassification();
          }}
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
          onChange={(event) => {
            setNote(event.target.value);
            clearClassification();
          }}
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
      {classification ? (
        <section
          className="quick-capture__ai-suggestion"
          aria-label="AI 分类建议"
        >
          <header>
            <strong>{classification.contentType}</strong>
            <span
              className={
                isLowAiConfidence(classification.confidence)
                  ? 'is-low-confidence'
                  : undefined
              }
            >
              {Math.round(
                Math.min(1, Math.max(0, classification.confidence)) * 100,
              )}
              %
            </span>
          </header>
          <p>{classification.explanation}</p>
          {classification.tags.length > 0 ? (
            <div className="ai-tag-list">
              {classification.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : (
            <small>Provider 没有给出足够可靠的标签。</small>
          )}
          {classification.folderSuggestion ? (
            <small>文件夹建议：{classification.folderSuggestion}</small>
          ) : null}
          <button
            type="button"
            disabled={classification.tags.length === 0}
            onClick={() => {
              const existing = tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
              setTags(
                mergeSuggestedTags(existing, classification.tags).join(', '),
              );
              setClassificationAccepted(true);
              setStatus('已采用 AI 标签；保存书签后会记录置信度和依据。');
            }}
          >
            {classificationAccepted ? '已采用标签' : '采用这些标签'}
          </button>
        </section>
      ) : null}
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
