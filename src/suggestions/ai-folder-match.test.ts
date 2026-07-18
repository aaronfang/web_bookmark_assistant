import { describe, expect, it } from 'vitest';

import {
  buildNewFolderProposal,
  folderCandidatesForAi,
  isValidNewFolderName,
  matchAiFolderSuggestion,
  type BookmarkFolderCandidate,
} from './ai-folder-match';

const folders: BookmarkFolderCandidate[] = [
  { id: '1', label: '书签栏 / 技术 / AI', path: ['书签栏', '技术', 'AI'] },
  { id: '2', label: '书签栏 / 阅读', path: ['书签栏', '阅读'] },
  { id: '3', label: '其他书签 / 阅读', path: ['其他书签', '阅读'] },
  { id: '4', label: '书签栏 / 技术', path: ['书签栏', '技术'] },
];

describe('matchAiFolderSuggestion', () => {
  it('matches an exact existing path', () => {
    expect(matchAiFolderSuggestion('书签栏 / 技术 / AI', folders)).toEqual({
      folder: folders[0],
      kind: 'exact-path',
      confidence: 1,
    });
  });

  it('matches a unique path suffix and common separators', () => {
    expect(matchAiFolderSuggestion('文件夹建议：技术 > AI', folders)).toEqual({
      folder: folders[0],
      kind: 'unique-suffix',
      confidence: 0.9,
    });
  });

  it('refuses ambiguous leaf names and unknown folders', () => {
    expect(matchAiFolderSuggestion('阅读', folders)).toBeNull();
    expect(matchAiFolderSuggestion('新建目录', folders)).toBeNull();
  });
});

describe('folderCandidatesForAi', () => {
  it('bounds candidates while retaining the current folder', () => {
    expect(folderCandidatesForAi(folders, '3', 2)).toEqual([
      '书签栏 / 技术 / AI',
      '其他书签 / 阅读',
    ]);
  });
});

describe('buildNewFolderProposal', () => {
  it('proposes one new child under a matched existing parent', () => {
    expect(
      buildNewFolderProposal('书签栏 / 技术 / 前端', folders, '2'),
    ).toEqual({ name: '前端', parent: folders[3] });
  });

  it('uses the confirmed current folder when only a new name is returned', () => {
    expect(buildNewFolderProposal('稍后研究', folders, '2')).toEqual({
      name: '稍后研究',
      parent: folders[1],
    });
  });

  it('does not propose an already existing or invalid folder', () => {
    expect(buildNewFolderProposal('技术 / AI', folders, '2')).toBeNull();
    expect(isValidNewFolderName('..')).toBe(false);
    expect(isValidNewFolderName('a/b')).toBe(false);
    expect(isValidNewFolderName('a'.repeat(81))).toBe(false);
  });
});
