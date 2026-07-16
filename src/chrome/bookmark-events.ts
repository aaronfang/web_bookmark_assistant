import {
  refreshChromeBookmarkMirror,
  removeChromeBookmarkMirrors,
  synchronizeChromeBookmarkMirror,
  upsertChromeBookmarkMirror,
} from '../repositories/chrome-bookmark-repository';

export const CHROME_BOOKMARKS_UPDATED = 'chrome-bookmarks-updated';

export type ChromeBookmarkUpdateKind =
  'created' | 'changed' | 'moved' | 'removed' | 'imported';

export interface ChromeBookmarksUpdatedMessage {
  type: typeof CHROME_BOOKMARKS_UPDATED;
  kind: ChromeBookmarkUpdateKind;
}

export function isChromeBookmarksUpdatedMessage(
  message: unknown,
): message is ChromeBookmarksUpdatedMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === CHROME_BOOKMARKS_UPDATED
  );
}

export function collectBookmarkSourceIds(
  node: chrome.bookmarks.BookmarkTreeNode,
): string[] {
  const ids: string[] = [];

  const visit = (current: chrome.bookmarks.BookmarkTreeNode): void => {
    if (current.url) ids.push(current.id);
    current.children?.forEach(visit);
  };

  visit(node);
  return ids;
}

let updateQueue: Promise<void> = Promise.resolve();

async function notifyPages(kind: ChromeBookmarkUpdateKind): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: CHROME_BOOKMARKS_UPDATED,
      kind,
    } satisfies ChromeBookmarksUpdatedMessage);
  } catch {
    // No extension page is open; the database update is still complete.
  }
}

function enqueueUpdate(
  kind: ChromeBookmarkUpdateKind,
  update: () => Promise<unknown>,
): void {
  updateQueue = updateQueue
    .then(update, update)
    .then(() => notifyPages(kind))
    .catch((error: unknown) => {
      console.error(`Unable to process Chrome bookmark ${kind} event`, error);
    });
}

export function registerChromeBookmarkEventListeners(): void {
  chrome.bookmarks.onCreated.addListener((_id, node) => {
    enqueueUpdate('created', () => upsertChromeBookmarkMirror(node));
  });

  chrome.bookmarks.onChanged.addListener((id) => {
    enqueueUpdate('changed', () => refreshChromeBookmarkMirror(id));
  });

  chrome.bookmarks.onMoved.addListener((id) => {
    enqueueUpdate('moved', () => refreshChromeBookmarkMirror(id));
  });

  chrome.bookmarks.onRemoved.addListener((_id, removeInfo) => {
    enqueueUpdate('removed', () =>
      removeChromeBookmarkMirrors(collectBookmarkSourceIds(removeInfo.node)),
    );
  });

  chrome.bookmarks.onImportEnded.addListener(() => {
    enqueueUpdate('imported', () => synchronizeChromeBookmarkMirror());
  });
}
