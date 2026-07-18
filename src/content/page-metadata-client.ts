import {
  collectRawPageMetadata,
  normalizePageMetadata,
  type PageMetadata,
} from './page-metadata';

export async function extractActiveTabMetadata(
  tabId: number,
): Promise<PageMetadata> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectRawPageMetadata,
  });
  return normalizePageMetadata(
    result?.result ?? {
      description: '',
      selectedText: '',
      contentText: '',
    },
  );
}
