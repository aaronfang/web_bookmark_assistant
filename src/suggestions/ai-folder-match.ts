export interface BookmarkFolderCandidate {
  id: string;
  label: string;
  path: string[];
}

export interface AiFolderMatch {
  folder: BookmarkFolderCandidate;
  kind: 'exact-path' | 'unique-suffix';
  confidence: number;
}

export interface NewBookmarkFolderProposal {
  name: string;
  parent: BookmarkFolderCandidate;
}

function normalizeSegment(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function suggestionSegments(value: string): string[] {
  return value
    .replace(/^\s*(?:文件夹建议|folder suggestion)\s*[:：]\s*/i, '')
    .replace(/^[`'“”"]+|[`'“”"]+$/g, '')
    .split(/\s*(?:\/|\\|>|→)\s*/)
    .map(normalizeSegment)
    .filter(Boolean);
}

function displaySuggestionSegments(value: string): string[] {
  return value
    .replace(/^\s*(?:文件夹建议|folder suggestion)\s*[:：]\s*/i, '')
    .replace(/^[`'“”"]+|[`'“”"]+$/g, '')
    .split(/\s*(?:\/|\\|>|→)\s*/)
    .map((segment) => segment.normalize('NFKC').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function isValidNewFolderName(value: string): boolean {
  const name = value.normalize('NFKC').trim();
  const hasControlCharacter = [...name].some(
    (character) => character.charCodeAt(0) < 32,
  );
  return (
    name.length > 0 &&
    name.length <= 80 &&
    name !== '.' &&
    name !== '..' &&
    !hasControlCharacter &&
    !name.includes('/') &&
    !name.includes('\\')
  );
}

function normalizedPath(folder: BookmarkFolderCandidate): string[] {
  return folder.path.map(normalizeSegment).filter(Boolean);
}

function endsWithPath(path: readonly string[], suffix: readonly string[]) {
  if (suffix.length > path.length) return false;
  const offset = path.length - suffix.length;
  return suffix.every((segment, index) => path[offset + index] === segment);
}

export function matchAiFolderSuggestion(
  suggestion: string,
  folders: readonly BookmarkFolderCandidate[],
): AiFolderMatch | null {
  const segments = suggestionSegments(suggestion);
  if (segments.length === 0) return null;

  const candidates = folders.map((folder) => ({
    folder,
    path: normalizedPath(folder),
  }));
  const exact = candidates.filter(
    ({ path }) =>
      path.length === segments.length && endsWithPath(path, segments),
  );
  if (exact.length === 1) {
    return { folder: exact[0]!.folder, kind: 'exact-path', confidence: 1 };
  }
  if (exact.length > 1) return null;

  const suffix = candidates.filter(({ path }) => endsWithPath(path, segments));
  if (suffix.length !== 1) return null;
  return {
    folder: suffix[0]!.folder,
    kind: 'unique-suffix',
    confidence: segments.length > 1 ? 0.9 : 0.8,
  };
}

export function buildNewFolderProposal(
  suggestion: string,
  folders: readonly BookmarkFolderCandidate[],
  currentFolderId: string,
): NewBookmarkFolderProposal | null {
  if (matchAiFolderSuggestion(suggestion, folders)) return null;
  const segments = displaySuggestionSegments(suggestion);
  const name = segments.at(-1) ?? '';
  if (!isValidNewFolderName(name)) return null;

  let parent = folders.find(({ id }) => id === currentFolderId);
  if (segments.length > 1) {
    const parentMatch = matchAiFolderSuggestion(
      segments.slice(0, -1).join(' / '),
      folders,
    );
    if (parentMatch) parent = parentMatch.folder;
  }
  return parent ? { name, parent } : null;
}

export function folderCandidatesForAi(
  folders: readonly BookmarkFolderCandidate[],
  currentFolderId: string,
  limit = 100,
): string[] {
  if (limit <= 0) return [];
  const selected = folders.slice(0, Math.max(0, limit));
  const current = folders.find(({ id }) => id === currentFolderId);
  if (current && !selected.some(({ id }) => id === current.id)) {
    selected.splice(Math.max(0, selected.length - 1), 1, current);
  }
  return selected.map(({ label }) => label.replace(/\s+/g, ' ').trim());
}
