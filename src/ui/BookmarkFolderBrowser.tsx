import { useEffect, useMemo, useState } from 'react';

import {
  buildBookmarkFolderTree,
  findBookmarkFolder,
  type BookmarkFolderNode,
} from '../chrome/bookmark-folder-tree';

const BOOKMARK_RENDER_LIMIT = 200;

interface FolderTreeItemProps {
  folder: BookmarkFolderNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function FolderTreeItem({ folder, selectedId, onSelect }: FolderTreeItemProps) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={folder.id === selectedId}
        className={folder.id === selectedId ? 'is-selected' : undefined}
        onClick={() => onSelect(folder.id)}
      >
        <span>{folder.title}</span>
        <small>{folder.totalBookmarks}</small>
      </button>
      {folder.children.length > 0 ? (
        <ul>
          {folder.children.map((child) => (
            <FolderTreeItem
              folder={child}
              key={child.id}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

interface BookmarkFolderBrowserProps {
  revision: number;
}

export function BookmarkFolderBrowser({
  revision,
}: BookmarkFolderBrowserProps) {
  const [folders, setFolders] = useState<BookmarkFolderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    chrome.bookmarks
      .getTree()
      .then((tree) => {
        if (cancelled) return;
        const nextFolders = buildBookmarkFolderTree(tree);
        setFolders(nextFolders);
        setSelectedId((currentId) =>
          currentId && findBookmarkFolder(nextFolders, currentId)
            ? currentId
            : (nextFolders[0]?.id ?? null),
        );
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '读取文件夹失败');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const selectedFolder = useMemo(
    () => (selectedId ? findBookmarkFolder(folders, selectedId) : undefined),
    [folders, selectedId],
  );
  const visibleBookmarks =
    selectedFolder?.bookmarks.slice(0, BOOKMARK_RENDER_LIMIT) ?? [];

  return (
    <section className="folder-browser" aria-labelledby="folder-browser-title">
      <header className="folder-browser__header">
        <h2 id="folder-browser-title">书签文件夹</h2>
        <p>按 Chrome 原始层级只读浏览；数字包含所有子文件夹中的书签。</p>
      </header>

      {error ? <p className="status status--error">{error}</p> : null}

      <div className="folder-browser__layout">
        <nav className="folder-tree" aria-label="Chrome 书签文件夹">
          {folders.length > 0 ? (
            <ul>
              {folders.map((folder) => (
                <FolderTreeItem
                  folder={folder}
                  key={folder.id}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </ul>
          ) : (
            <p>没有可显示的书签文件夹。</p>
          )}
        </nav>

        <div className="folder-contents">
          {selectedFolder ? (
            <>
              <div className="folder-contents__heading">
                <h3>{selectedFolder.title}</h3>
                <span>{selectedFolder.path.join(' / ')}</span>
              </div>

              {selectedFolder.children.length > 0 ? (
                <div className="folder-children" aria-label="子文件夹">
                  {selectedFolder.children.map((child) => (
                    <button
                      type="button"
                      key={child.id}
                      onClick={() => setSelectedId(child.id)}
                    >
                      {child.title} · {child.totalBookmarks}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="folder-bookmarks">
                {visibleBookmarks.map((bookmark) => (
                  <a
                    href={bookmark.url}
                    key={bookmark.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <strong>{bookmark.title || bookmark.url}</strong>
                    <span>{bookmark.url}</span>
                  </a>
                ))}
              </div>

              {selectedFolder.bookmarks.length === 0 ? (
                <p className="folder-contents__empty">
                  此文件夹没有直接书签，请选择子文件夹。
                </p>
              ) : null}
              {selectedFolder.bookmarks.length > BOOKMARK_RENDER_LIMIT ? (
                <p className="folder-contents__limit">
                  为保持页面流畅，仅显示前 {BOOKMARK_RENDER_LIMIT} 条直接书签。
                </p>
              ) : null}
            </>
          ) : (
            <p>选择一个文件夹查看内容。</p>
          )}
        </div>
      </div>
    </section>
  );
}
