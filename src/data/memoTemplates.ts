export type { MemoTemplate } from './templateTypes';
export { resolveTemplate } from './templateTypes';
export {
  NOTE_TEMPLATES,
  DOCUMENT_TEMPLATES,
  MEMO_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplatesByType,
} from './templates';

export function buildTemplateRecommendationPrompt(
  recentNoteTitles: string[],
  recentDocumentTitles: string[],
  timeLabel: string
): string {
  const noteSection = recentNoteTitles.length > 0
    ? `最近便签标题: ${recentNoteTitles.join(', ')}`
    : '';
  const docSection = recentDocumentTitles.length > 0
    ? `最近文档标题: ${recentDocumentTitles.join(', ')}`
    : '';
  return `当前时间: ${timeLabel}\n${noteSection}\n${docSection}\n\n根据以上上下文，推荐最合适的模板ID列表。返回JSON数组格式，例如: ["template-id-1", "template-id-2"]。只返回JSON数组，不要其他内容。`;
}
