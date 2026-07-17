import { describe, expect, it } from 'vitest';

import {
  AiDisabledError,
  DisabledAiProvider,
  type AiProvider,
} from './provider';

describe('AI provider contract', () => {
  it('is disabled by default and never performs a request', async () => {
    const provider: AiProvider = new DisabledAiProvider();
    await expect(
      provider.summarize({ title: 'Example', url: 'https://example.com' }),
    ).rejects.toBeInstanceOf(AiDisabledError);
    await expect(
      provider.classify({ title: 'Example', url: 'https://example.com' }),
    ).rejects.toBeInstanceOf(AiDisabledError);
    expect(provider.id).toBe('disabled');
  });
});
