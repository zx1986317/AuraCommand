import React from 'react';
import { ipcService } from '../services/ipc';
import { logger } from './logger';

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return React.createElement(
    React.Fragment,
    null,
    ...parts.map((part, i) =>
      regex.test(part)
        ? React.createElement('mark', { key: i, className: 'bg-yellow-200/50 text-yellow-900 rounded px-0.5' }, part)
        : part
    )
  );
}

/**
 * 文件导入工具
 * 从文件选择对话框到导入完成的完整流程
 */
export async function importFiles(
  loadFiles: () => Promise<void>,
  setNotification: (n: { message: string; type: 'success' | 'error' }) => void,
): Promise<void> {
  try {
    const result = await ipcService.invoke('select-file-dialog');
    if (result && result.filePaths && result.filePaths.length > 0) {
      for (const filePath of result.filePaths) {
        await ipcService.invoke('import-files', { filePaths: [filePath] });
      }
      await loadFiles();
      setNotification({ message: `成功导入 ${result.filePaths.length} 个文件`, type: 'success' });
    }
  } catch (err) {
    logger.error('Failed to import files', err);
    setNotification({ message: '导入文件失败', type: 'error' });
  }
}

/**
 * 导出聊天消息为 Markdown 文件
 */
export async function exportMessage(message: { role: string; content: string; id?: string; timestamp?: string; reasoning?: string }): Promise<void> {
  const content = message.role === 'user'
    ? `### 🙋 用户\n\n${message.content}\n\n`
    : `### 🤖 AI 助手\n\n${message.content}\n\n`;
  await ipcService.invoke('save-markdown-file', { content, message: '导出成功' });
}

/**
 * 导出完整聊天记录为 Markdown 文件
 */
export async function exportChatMessages(
  messages: Array<{ role: string; content: string; id?: string; timestamp?: string; reasoning?: string }>,
  filename: string = `chat-export-${new Date().toISOString().slice(0, 10)}.md`,
): Promise<void> {
  const content = messages.map((msg) =>
    msg.role === 'user'
      ? `### 🙋 用户\n\n${msg.content}\n\n`
      : `### 🤖 AI 助手\n\n${msg.content}\n\n`
  ).join('');

  await ipcService.invoke('save-markdown-file', { content, filename, message: '聊天记录导出成功' });
}

/**
 * 导航到来源项目（便签/文档/任务/文件）
 */
export async function navigateToSource(
  sourceType: string,
  sourceId: string,
  actions: {
    setActiveTab?: (tab: string) => void;
    setDeskDefaultTab?: (tab: string) => void;
    setSourceNoteToOpen?: (source: { type: string; id: string }) => void;
    setPdfViewerState?: (state: { fileId: string; fileName: string }) => void;
  },
): Promise<void> {
  switch (sourceType) {
    case 'note':
    case 'document':
    case 'quick_note':
      actions.setActiveTab?.('desk');
      actions.setDeskDefaultTab?.(sourceType === 'document' ? 'documents' : 'notes');
      actions.setSourceNoteToOpen?.({ type: sourceType === 'document' ? 'document' : 'note', id: sourceId });
      break;

    case 'task':
      actions.setActiveTab?.('tasks');
      break;

    case 'file':
      try {
        const fileInfo = await ipcService.invoke('get-file-info', { fileId: sourceId });
        if (fileInfo) {
          const ext = (fileInfo.file_type || '').toLowerCase();
          if (ext === '.pdf') {
            actions.setPdfViewerState?.({ fileId: fileInfo.id, fileName: fileInfo.file_name });
          } else {
            await ipcService.invoke('open-path', { path: fileInfo.file_path });
          }
        }
      } catch (err) {
        logger.error('Failed to open file source:', err);
      }
      break;

    default:
      logger.warn(`Unknown source type: ${sourceType}`);
  }
}
