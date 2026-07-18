export interface ContentInput {
  title: string;
  url: string;
  description?: string;
  selectedText?: string;
  contentExcerpt?: string;
  candidateTags?: string[];
  candidateFolders?: string[];
  folderPath?: string[];
}

export interface SummaryResult {
  summary: string;
  confidence: number;
}

export interface ClassificationResult {
  contentType: string;
  tags: string[];
  folderSuggestion?: string;
  confidence: number;
  explanation: string;
}

export interface AiProvider {
  readonly id: string;
  summarize(input: ContentInput): Promise<SummaryResult>;
  classify(input: ContentInput): Promise<ClassificationResult>;
}

export class AiDisabledError extends Error {
  constructor() {
    super('AI Provider is disabled');
    this.name = 'AiDisabledError';
  }
}

export class DisabledAiProvider implements AiProvider {
  readonly id = 'disabled';

  async summarize(): Promise<SummaryResult> {
    throw new AiDisabledError();
  }

  async classify(): Promise<ClassificationResult> {
    throw new AiDisabledError();
  }
}

export const defaultAiProvider: AiProvider = new DisabledAiProvider();
