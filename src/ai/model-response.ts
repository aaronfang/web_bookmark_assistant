export function cleanModelResponse(text: string): string {
  let cleaned = text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/think>/gi, '')
    .trim();

  // An unmatched opening tag means the provider returned reasoning without a
  // reliable final-answer boundary. Discard that suffix instead of exposing it.
  const danglingThinking = cleaned.search(/<think\b[^>]*>/i);
  if (danglingThinking >= 0) {
    cleaned = cleaned.slice(0, danglingThinking).trim();
  }

  const fenced = cleaned.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  return (fenced?.[1] ?? cleaned).trim();
}

export function cleanSummaryResponse(text: string): string {
  return cleanModelResponse(text)
    .replace(/^(?:AI\s*)?摘要\s*[:：]\s*/i, '')
    .trim();
}

export function extractModelJsonObject(text: string): string {
  const cleaned = cleanModelResponse(text);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Model response did not contain a JSON object');
  }
  return cleaned.slice(start, end + 1);
}
