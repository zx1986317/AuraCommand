export interface MemoTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  title: string;
  content: string;
  tags: string;
  type: 'note' | 'document';
}

export function resolveTemplate(template: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN');
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return template
    .replace(/\{\{日期\}\}/g, dateStr)
    .replace(/\{\{时间\}\}/g, timeStr)
    .replace(/\{\{日期时间\}\}/g, `${dateStr} ${timeStr}`);
}
