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
      provider.summarize({
        title: 'Example',
        url: 'https://example.com',
        contentExcerpt: 'Important page content.',
      }),
    ).resolves.toMatchObject({ summary: 'A summary.' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer secret' }),
      }),
    );
    const request = fetcher.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as {
      messages: Array<{ content: string }>;
    };
    const prompt = body.messages[0]?.content ?? '';
    expect(prompt).toContain('用简体中文写一段有信息量的摘要');
    expect(prompt).toContain('正文摘录：Important page content.');
    expect(prompt).not.toContain('https://example.com');
  });

  it('removes thinking blocks from summaries', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '<think>private reasoning</think>\nA concise final summary.',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new OpenAiCompatibleProvider(
      {
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'secret',
        model: 'reasoning-model',
      },
      fetcher,
    );

    await expect(
      provider.summarize({ title: 'Example', url: 'https://example.com' }),
    ).resolves.toMatchObject({ summary: 'A concise final summary.' });
  });
});
