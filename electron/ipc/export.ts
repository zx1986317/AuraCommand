/**
 * 文件导出相关 IPC 处理器
 */
import { dialog } from 'electron';
import fs from 'fs';
import { IpcModule, IpcContext } from './index';
import { parseMarkdownToDocx, parseContentToXlsx, parseContentToPptx } from '../exportService';
import {
  ExportFileSchema,
  validateInput,
} from './schemas';
import {
  withErrorHandling,
  logInfo,
  logWarn,
  ErrorCategory,
  ErrorLevel,
  AppError,
} from '../errorHandler';

export function createExportModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin();
  const extensions: Record<string, { name: string; ext: string }> = {
    docx: { name: 'Word 文档', ext: 'docx' },
    xlsx: { name: 'Excel 工作簿', ext: 'xlsx' },
    pptx: { name: 'PowerPoint 演示文稿', ext: 'pptx' },
  };

  return {
    'export-file': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const win = getWin();
        if (!win) {
          throw new AppError('窗口未找到', ErrorCategory.IPC, ErrorLevel.ERROR);
        }

        const validated = validateInput(ExportFileSchema, params, 'export-file');
        const { content, format, title } = validated;

        const { name, ext } = extensions[format] ?? { name: '文件', ext: 'bin' };
        const defaultName = `${title || '导出文件'}.${ext}`;

        const result = await dialog.showSaveDialog(win, {
          title: `导出为 ${name}`,
          defaultPath: defaultName,
          filters: [{ name, extensions: [ext] }],
        });

        if (result.canceled || !result.filePath) {
          logWarn('用户取消导出操作', { format, title });
          return { success: false, canceled: true };
        }

        let buffer: Buffer;
        switch (format) {
          case 'docx':
            buffer = await parseMarkdownToDocx(content, title);
            break;
          case 'xlsx':
            buffer = parseContentToXlsx(content, title);
            break;
          case 'pptx':
            buffer = await parseContentToPptx(content, title);
            break;
          default:
            throw new AppError(`不支持的格式: ${format}`, ErrorCategory.VALIDATION, ErrorLevel.ERROR);
        }

        fs.writeFileSync(result.filePath, buffer);
        logInfo('文件导出成功', { format, filePath: result.filePath });
        return { success: true, filePath: result.filePath };
      }, 'export-file', getWin());
    },
  };
}
