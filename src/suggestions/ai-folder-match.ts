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
