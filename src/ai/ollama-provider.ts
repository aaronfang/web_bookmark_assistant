import type {
  AiProvider,
  ClassificationResult,
  ContentInput,
  SummaryResult,
} from './provider';
import { cleanSummaryResponse, extractModelJsonObject } from './model-response';
import { buildChineseSummaryPrompt } from './summary-prompt';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

interface OllamaResponse {
  response?: string;
}

function promptForSummary(input: ContentInput): string {
  return `/no_think\n${buildChineseSummaryPrompt(input)}`;
}

function promptForClassification(input: ContentInput): string {
  return `/no_think\nClassify this bookmark. Return only one JSON object without markdown or reasoning, with keys contentType, tags (array), folderSuggestion, confidence (0-1), explanation. Return 1-3 concise tags, prefer the existing tags when relevant, avoid synonyms and generic tags such as website/article/content, and return an empty array if evidence is insufficient. folderSuggestion must exactly equal one path from Existing folders; return an empty string when none is suitable.\nExisting tags: ${(input.candidateTags ?? []).join(', ')}\nExisting folders:\n${(input.candidateFolders ?? []).join('\n')}\nCurrent folder: ${(input.folderPath ?? []).join(' / ')}\nTitle: ${input.title}\nURL: ${input.url}\nDescription: ${input.description ?? ''}\nSelected text: ${input.selectedText ?? ''}\nPage excerpt: ${input.contentExcerpt ?? ''}`;
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
    const summary = cleanSummaryResponse(text);
    if (!summary) {
      throw new Error('Ollama returned reasoning without a final summary');
    }
    return { summary, confidence: 0.5 };
  }

  async classify(input: ContentInput): Promise<ClassificationResult> {
    const text = await this.generate(promptForClassification(input), true);
    try {
      const parsed = JSON.parse(
        extractModelJsonObject(text),
      ) as Partial<ClassificationResult>;
      return {
        contentType:
          typeof parsed.contentType === 'string'
            ? parsed.contentType
            : 'unknown',
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        ...(typeof parsed.folderSuggestion === 'string' &&
        parsed.folderSuggestion.trim()
          ? { folderSuggestion: parsed.folderSuggestion }
          : {}),
        confidence:
          typeof parsed.confidence === 'number' ? parsed.confidence : 0.25,
        explanation:
          typeof parsed.explanation === 'string'
            ? parsed.explanation
            : 'Ollama returned an incomplete classification.',
      };
    } catch {
      throw new Error('Ollama classification response was not valid JSON');
    }
  }

  private async generate(prompt: string, structured = false): Promise<string> {
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
            ...(structured ? { format: 'json' } : {}),
            options: { temperature: structured ? 0.1 : 0.2 },
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
