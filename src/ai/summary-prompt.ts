import type { ContentInput } from './provider';

export function buildChineseSummaryPrompt(input: ContentInput): string {
  return `请根据以下网页内容，用简体中文写一段有信息量的摘要。
要求：
- 使用 2–4 句话，约 100–200 个中文字符。
- 说明页面的核心主题、实际用途和关键要点；有具体数据或功能时应优先保留。
- 不要复述网址或域名，不要输出“AI 摘要”等标签，不要使用 Markdown。
- 只依据提供的内容；信息不足时说明能够确认的内容，不要编造事实。
- 只返回最终摘要，不要输出思考过程或其他说明。

标题：${input.title}
页面描述：${input.description ?? ''}
选中文本：${input.selectedText ?? ''}
正文摘录：${input.contentExcerpt ?? ''}`;
}
