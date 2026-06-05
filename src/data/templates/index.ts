import type { MemoTemplate } from '../templateTypes';
import { NOTE_TEMPLATES } from './notes';
import { PRODUCT_TEMPLATES } from './product';
import { TECH_TEMPLATES } from './tech';
import { ANALYSIS_TEMPLATES } from './analysis';
import { MANAGEMENT_TEMPLATES } from './management';

export { NOTE_TEMPLATES } from './notes';
export { PRODUCT_TEMPLATES } from './product';
export { TECH_TEMPLATES } from './tech';
export { ANALYSIS_TEMPLATES } from './analysis';
export { MANAGEMENT_TEMPLATES } from './management';

export const DOCUMENT_TEMPLATES: MemoTemplate[] = [
  ...PRODUCT_TEMPLATES,
  ...TECH_TEMPLATES,
  ...ANALYSIS_TEMPLATES,
  ...MANAGEMENT_TEMPLATES,
];

export const MEMO_TEMPLATES: MemoTemplate[] = [...NOTE_TEMPLATES, ...DOCUMENT_TEMPLATES];

export const TEMPLATE_CATEGORIES = Array.from(new Set(MEMO_TEMPLATES.map(t => t.category)));

export function getTemplatesByType(type: 'note' | 'document'): MemoTemplate[] {
  if (type === 'note') return NOTE_TEMPLATES;
  if (type === 'document') return DOCUMENT_TEMPLATES;
  return MEMO_TEMPLATES;
}
