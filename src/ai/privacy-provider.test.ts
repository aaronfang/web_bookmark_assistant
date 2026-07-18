import { describe, expect, it, vi } from 'vitest';

import { PrivacyAwareAiProvider } from './privacy-provider';
import type { AiProvider } from './provider';

describe('PrivacyAwareAiProvider', () => {
  it('sanitizes input before delegating', async () => {
    const inner: AiProvider = {
      id: 'test',
      summarize: vi.fn().mockResolvedValue({ summary: 'ok', confidence: 1 }),
      classify: vi
        .fn()
        .mockResolvedValue({
          contentType: 'article',
          tags: [],
          confidence: 1,
          explanation: 'ok',
        }),
    };
    const provider = new PrivacyAwareAiProvider(inner, { excludedDomains: [] });
    await provider.summarize({
      title: 'Test',
      url: 'https://example.com?a=1&token=secret#x',
    });
    expect(inner.summarize).toHaveBeenCalledWith({
      title: 'Test',
      url: 'https://example.com/?a=1',
    });
  });
});
