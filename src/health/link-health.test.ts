import { describe, expect, it, vi } from 'vitest';

import { checkBookmarkLink, checkBookmarkLinks } from './link-health';

describe('link health checks', () => {
  it('classifies HTTP and network outcomes without mutating bookmarks', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 404 }));
    await expect(
      checkBookmarkLink({ id: 'chrome:1', url: 'https://x.test' }, fetcher),
    ).resolves.toMatchObject({
      status: 'not-found',
      httpStatus: 404,
    });
    fetcher.mockRejectedValueOnce(new DOMException('timeout', 'AbortError'));
    await expect(
      checkBookmarkLink({ id: 'chrome:1', url: 'https://x.test' }, fetcher, 1),
    ).resolves.toMatchObject({ status: 'timeout' });
  });

  it('persists the complete result set after checking links', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const persist = vi.fn().mockResolvedValue(undefined);

    const results = await checkBookmarkLinks(
      [
        { id: 'chrome:1', url: 'https://one.test' },
        { id: 'chrome:2', url: 'https://two.test' },
      ],
      fetcher,
      persist,
    );

    expect(results).toHaveLength(2);
    expect(persist).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(results);
  });
});
