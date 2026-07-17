import type { PageMetadata } from './page-metadata';

export async function extractActiveTabMetadata(
  tabId: number,
): Promise<PageMetadata> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const description =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content')
          ?.trim() ?? '';
      return {
        description,
        selectedText: window.getSelection()?.toString().trim() ?? '',
      };
    },
  });
  return result?.result ?? { description: '', selectedText: '' };
}
