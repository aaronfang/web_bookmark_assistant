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
      provider.summarize({ title: 'Example', url: 'https://example.com' }),
    ).resolves.toEqual({ summary: 'A concise summary.', confidence: 0.5 });
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/generate',
      expect.objectContaining({ method: 'POST' }),
    );
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
      provider.classify({ title: 'Example', url: 'https://example.com' }),
    ).rejects.toThrow('not valid JSON');
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
      provider.classify({ title: 'Example', url: 'https://example.com' }),
    ).resolves.toMatchObject({
      contentType: 'article',
      tags: ['AI'],
      confidence: 0.9,
    });
  });
});
