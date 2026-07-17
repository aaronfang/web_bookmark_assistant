import type {
  AiProvider,
  ClassificationResult,
  ContentInput,
  SummaryResult,
} from './provider';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

interface OllamaResponse {
  response?: string;
}

function promptForSummary(input: ContentInput): string {
  return `Summarize this bookmark in one concise sentence.\nTitle: ${input.title}\nURL: ${input.url}\nDescription: ${input.description ?? ''}\nSelected text: ${input.selectedText ?? ''}`;
}

function promptForClassification(input: ContentInput): string {
  return `Classify this bookmark as JSON with keys contentType, tags (array), folderSuggestion, confidence (0-1), explanation.\nTitle: ${input.title}\nURL: ${input.url}\nDescription: ${input.description ?? ''}\nSelected text: ${input.selectedText ?? ''}`;
}

export class OllamaProvider implements AiProvider {
  readonly id = 'ollama';
  private readonly config: Required<OllamaConfig>;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: OllamaConfig,
    fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      model: config.model,
      timeoutMs: config.timeoutMs ?? 30_000,
    };
    this.fetchImpl = fetchImpl;
  }

  async summarize(input: ContentInput): Promise<SummaryResult> {
    const text = await this.generate(promptForSummary(input));
    return { summary: text, confidence: 0.5 };
  }

  async classify(input: ContentInput): Promise<ClassificationResult> {
    const text = await this.generate(promptForClassification(input));
    try {
      const parsed = JSON.parse(text) as Partial<ClassificationResult>;
      return {
        contentType: parsed.contentType ?? 'unknown',
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        ...(parsed.folderSuggestion
          ? { folderSuggestion: parsed.folderSuggestion }
          : {}),
        confidence:
          typeof parsed.confidence === 'number' ? parsed.confidence : 0.25,
        explanation:
          parsed.explanation ?? 'Ollama returned an incomplete classification.',
      };
    } catch {
      throw new Error('Ollama classification response was not valid JSON');
    }
  }

  private async generate(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/api/generate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: this.config.model,
            prompt,
            stream: false,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(
            'Ollama rejected this extension origin (HTTP 403). Configure OLLAMA_ORIGINS and restart Ollama.',
          );
        }
        throw new Error(`Ollama request failed with HTTP ${response.status}`);
      }
      const payload = (await response.json()) as OllamaResponse;
      if (!payload.response?.trim())
        throw new Error('Ollama returned an empty response');
      return payload.response.trim();
    } finally {
      clearTimeout(timer);
    }
  }
}
