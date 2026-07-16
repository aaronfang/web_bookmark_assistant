import type { AiProvider, BookmarkAnalysis } from './types';

export class DisabledAiProvider implements AiProvider {
  readonly id = 'disabled';
  readonly isLocal = true;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async analyze(): Promise<BookmarkAnalysis> {
    throw new Error('AI provider is disabled');
  }
}
