import { describe, expect, it } from 'vitest';

import {
  isDomainExcluded,
  prepareContentInputForAi,
  sanitizeUrlForAi,
} from './privacy';

describe('AI privacy filtering', () => {
  it('removes credentials, sensitive query values and fragments', () => {
    expect(
      sanitizeUrlForAi(
        'https://user:pass@example.com/page?token=secret&lang=zh#private',
      ),
    ).toBe('https://example.com/page?lang=zh');
  });

  it('matches excluded domains and their subdomains', () => {
    expect(
      isDomainExcluded('https://mail.example.com/inbox', ['example.com']),
    ).toBe(true);
    expect(isDomainExcluded('https://example.org', ['example.com'])).toBe(
      false,
    );
  });

  it('refuses content from an excluded domain', () => {
    expect(() =>
      prepareContentInputForAi(
        { title: 'Mail', url: 'https://mail.example.com' },
        { excludedDomains: ['example.com'] },
      ),
    ).toThrow('excluded');
  });
});
