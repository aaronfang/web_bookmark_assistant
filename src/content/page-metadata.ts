export interface PageMetadata {
  description: string;
  selectedText: string;
}

export function readPageMetadata(): PageMetadata {
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute('content')
      ?.trim() ?? '';
  return {
    description,
    selectedText: window.getSelection()?.toString().trim() ?? '',
  };
}
