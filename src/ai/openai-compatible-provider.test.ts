import { describe, expect, it, vi } from 'vitest';

import { OpenAiCompatibleProvider } from './openai-compatible-provider';

describe('OpenAiCompatibleProvider', () => {
  it('uses the chat completions contract with a bearer token', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'A summary.' } }] }),
          { status: 200 },
        ),
      );
    const provider = new OpenAiCompatibleProvider(
      {
        baseUrl: 'https://api.deepseek.com/v1/',
        apiKey: 'secret',
        model: 'deepseek-chat',
      },
      fetcher,
    );
    await expect(
      provider.summarize({ title: 'Example', url: 'https://example.com' }),
    ).resolves.toMatchObject({ summary: 'A summary.' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer secret' }),
      }),
    );
  });
});
