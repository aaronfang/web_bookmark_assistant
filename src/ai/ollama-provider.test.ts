import { describe, expect, it, vi } from 'vitest';

import { OllamaProvider } from './ollama-provider';

describe('OllamaProvider', () => {
  it('sends a non-streaming summary request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ response: 'A concise summary.' }), {
        status: 200,
      }),
    );
    const provider = new OllamaProvider(
      { baseUrl: 'http://127.0.0.1:11434/', model: 'llama3' },
      fetcher,
    );
    await expect(
      provider.summarize({
        title: 'Example',
        url: 'https://example.com',
        contentExcerpt: 'Important page content.',
      }),
    ).resolves.toEqual({ summary: 'A concise summary.', confidence: 0.5 });
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/generate',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = fetcher.mock.calls[0]?.[1];
    const prompt = String(JSON.parse(String(request?.body)).prompt);
    expect(prompt).toContain('用简体中文写一段有信息量的摘要');
    expect(prompt).toContain('正文摘录：Important page content.');
    expect(prompt).not.toContain('https://example.com');
  });

  it('rejects malformed classification JSON', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ response: 'not json' }), { status: 200 }),
      );
    const provider = new OllamaProvider(
      { baseUrl: 'http://localhost:11434', model: 'llama3' },
      fetcher,
    );
    await expect(
      provider.classify({
        title: 'Example',
        url: 'https://example.com',
        candidateFolders: ['书签栏 / 技术 / AI', '书签栏 / 阅读'],
      }),
    ).rejects.toThrow('not valid JSON');
  });

  it('removes thinking blocks from summaries', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          response:
            '<think>I should inspect the page.</think>\nAI 摘要：一段更完整的中文总结。',
        }),
        { status: 200 },
      ),
    );
    const provider = new OllamaProvider(
      { baseUrl: 'http://localhost:11434', model: 'qwen3:8b' },
      fetcher,
    );

    await expect(
      provider.summarize({ title: 'Example', url: 'https://example.com' }),
    ).resolves.toEqual({
      summary: '一段更完整的中文总结。',
      confidence: 0.5,
    });
  });

  it('rejects a summary containing only an unfinished thinking block', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ response: '<think>reasoning only' }), {
        status: 200,
      }),
    );
    const provider = new OllamaProvider(
      { baseUrl: 'http://localhost:11434', model: 'qwen3:8b' },
      fetcher,
    );

    await expect(
      provider.summarize({ title: 'Example', url: 'https://example.com' }),
    ).rejects.toThrow('without a final summary');
  });

  it('parses Qwen reasoning and fenced JSON responses', async () => {
    const response =
      '<think>internal reasoning</think>\n```json\n{"contentType":"article","tags":["AI"],"confidence":0.9,"explanation":"Relevant"}\n```';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ response }), { status: 200 }),
      );
    const provider = new OllamaProvider(
      { baseUrl: 'http://localhost:11434', model: 'qwen3:8b' },
      fetcher,
    );
    await expect(
      provider.classify({
        title: 'Example',
        url: 'https://example.com',
        candidateFolders: ['书签栏 / 技术 / AI', '书签栏 / 阅读'],
      }),
    ).resolves.toMatchObject({
      contentType: 'article',
      tags: ['AI'],
      confidence: 0.9,
    });
    const request = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      format: 'json',
      options: { temperature: 0.1 },
    });
    expect(String(JSON.parse(String(request?.body)).prompt)).toContain(
      'Existing folders:\n书签栏 / 技术 / AI\n书签栏 / 阅读',
    );
  });
});
