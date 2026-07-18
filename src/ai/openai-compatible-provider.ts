import type {
  AiProvider,
  ClassificationResult,
  ContentInput,
  SummaryResult,
} from './provider';
import { cleanSummaryResponse, extractModelJsonObject } from './model-response';
import { buildChineseSummaryPrompt } from './summary-prompt';

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly id = 'openai-compatible';
  private readonly config: Required<OpenAiCompatibleConfig>;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: OpenAiCompatibleConfig,
    fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs ?? 30_000,
    };
    this.fetchImpl = fetchImpl;
  }

  async summarize(input: ContentInput): Promise<SummaryResult> {
    const response = await this.complete(buildChineseSummaryPrompt(input));
    const summary = cleanSummaryResponse(response);
    if (!summary) {
      throw new Error(
        'OpenAI-compatible provider returned reasoning without a final summary',
      );
    }
    return { summary, confidence: 0.5 };
  }

  async classify(input: ContentInput): Promise<ClassificationResult> {
    const response = await this.complete(
      `Classify this bookmark as JSON with keys contentType, tags (array), folderSuggestion, confidence (0-1), explanation. Return 1-3 concise tags, prefer existing tags when relevant, avoid synonyms and generic tags, and return an empty array if evidence is insufficient. folderSuggestion must exactly equal one path from Existing folders; return an empty string when none is suitable.\nExisting tags: ${(input.candidateTags ?? []).join(', ')}\nExisting folders:\n${(input.candidateFolders ?? []).join('\n')}\nCurrent folder: ${(input.folderPath ?? []).join(' / ')}\nTitle: ${input.title}\nURL: ${input.url}\nDescription: ${input.description ?? ''}\nSelected text: ${input.selectedText ?? ''}\nPage excerpt: ${input.contentExcerpt ?? ''}`,
    );
    try {
      const parsed = JSON.parse(
        extractModelJsonObject(response),
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
            : 'Provider returned an incomplete classification.',
      };
    } catch {
      throw new Error(
        'OpenAI-compatible classification response was not valid JSON',
      );
    }
  }

  private async complete(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok)
        throw new Error(
          `OpenAI-compatible request failed with HTTP ${response.status}`,
        );
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content)
        throw new Error(
          'OpenAI-compatible provider returned an empty response',
        );
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}
