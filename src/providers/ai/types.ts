export interface BookmarkAnalysisInput {
  title: string;
  url: string;
  description?: string;
  text?: string;
}

export interface BookmarkAnalysis {
  summary: string;
  tags: string[];
  suggestedFolder?: string;
  confidence: number;
  explanation: string;
}

export interface AiProvider {
  readonly id: string;
  readonly isLocal: boolean;
  isAvailable(): Promise<boolean>;
  analyze(input: BookmarkAnalysisInput): Promise<BookmarkAnalysis>;
}
