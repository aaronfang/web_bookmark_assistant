import { describe, expect, it } from 'vitest';

import { normalizeUrl } from './normalize-url';

describe('normalizeUrl', () => {
  it('removes fragments and common tracking parameters', () => {
    expect(
      normalizeUrl(
        'https://Example.com/article/?utm_source=newsletter&id=42#section',
      ),
    ).toBe('https://example.com/article?id=42');
  });

  it('sorts query parameters without deleting content parameters', () => {
    expect(normalizeUrl('https://example.com/search?b=2&a=1')).toBe(
      'https://example.com/search?a=1&b=2',
    );
  });
});
