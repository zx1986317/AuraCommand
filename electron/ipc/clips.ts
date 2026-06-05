/**
 * 剪贴板片段相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index';
import dbHelper from '../db';
import * as modelRouter from '../modelRouter';
import { performLocalOCR } from '../ocr';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { clipboard } from 'electron';
import { isPathWithinVault } from '../pathSecurity';
import {
  SaveClipSchema,
  UpdateClipDescriptionSchema,
  CreateClipGroupSchema,
  AddClipsToGroupSchema,
  RemoveClipFromGroupSchema,
  GetClipsInGroupSchema,
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

export function createClipsModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin();
  const clipsDir = path.join(ctx.vaultPath, 'clips');
  if (!fs.existsSync(clipsDir)) {
    fs.mkdirSync(clipsDir, { recursive: true });
  }

  function loadClipImageData(clip: any) {
    let imageData = null;
    if (clip.thumbnail_path && fs.existsSync(clip.thumbnail_path)) {
      try {
        const buffer = fs.readFileSync(clip.thumbnail_path);
        imageData = `data:image/png;base64,${buffer.toString('base64')}`;
      } catch {}
    }
    return {
      ...clip,
      tags: clip.tags ? JSON.parse(clip.tags) : [],
      user_description: clip.user_description || null,
      image_data: imageData,
    };
  }

  return {
    'get-clips': async () => {
      return withErrorHandling(async () => {
        const clips = await dbHelper.allQuery(
          `SELECT * FROM clips ORDER BY created_at DESC LIMIT 50`
        );
        return (clips || []).map(loadClipImageData);
      }, 'get-clips');
    },

    'update-clip-description': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(UpdateClipDescriptionSchema, params, 'update-clip-description');
        await dbHelper.runQuery(
          `UPDATE clips SET user_description = ? WHERE id = ?`,
          [validated.description || null, validated.id]
        );
        logInfo('Clip description updated', { id: validated.id });
        return { success: true };
      }, 'update-clip-description', getWin());
    },

    'read-clipboard-image-preview': async () => {
      return withErrorHandling(async () => {
        const image = clipboard.readImage();
        if (image.isEmpty()) {
          throw new AppError('剪贴板中没有图片，请先截图', ErrorCategory.VALIDATION, ErrorLevel.WARNING);
        }
        const base64 = image.toDataURL();
        return { image: base64 };
      }, 'read-clipboard-image-preview');
    },

    'read-clipboard-image': async () => {
      return withErrorHandling(async () => {
        const image = clipboard.readImage();
        if (image.isEmpty()) {
          throw new AppError('剪贴板中没有图片', ErrorCategory.VALIDATION, ErrorLevel.WARNING);
        }
        const base64 = image.toDataURL();
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${id}.png`;
        const filePath = path.join(clipsDir, fileName);
        fs.writeFileSync(filePath, buffer);

        // 不再进行 AI 分析，保存原始截图
        await dbHelper.runQuery(
          `INSERT INTO clips (id, type, content, thumbnail_path, ocr_text, ai_description, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, 'image', filePath, filePath, null, '截图', '[]', now]
        );

        logInfo('Clipboard image saved', { id });
        return {
          id,
          type: 'image',
          thumbnail_path: filePath,
          ocr_text: null,
          ai_description: '截图',
          tags: [],
          created_at: now,
        };
      }, 'read-clipboard-image', getWin());
    },

    'save-clip': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveClipSchema, params, 'save-clip');
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        let thumbnailPath: string | null = null;
        let ocrText: string | null = null;
        let aiDescription: string | null = null;
        let tags: string[] = [];

        if (validated.type === 'image' && validated.content.startsWith('data:image')) {
          const base64Data = validated.content.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `${id}.png`;
          const filePath = path.join(clipsDir, fileName);
          fs.writeFileSync(filePath, buffer);
          thumbnailPath = filePath;

          // 不再自动分析图片内容，由用户手动添加描述
          aiDescription = '截图';
        }

        await dbHelper.runQuery(
          `INSERT INTO clips (id, type, content, thumbnail_path, ocr_text, ai_description, user_description, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, validated.type, validated.type === 'image' ? thumbnailPath : validated.content, thumbnailPath, ocrText, aiDescription, validated.userDescription || null, JSON.stringify(tags), now]
        );

        logInfo('Clip saved', { id, type: validated.type });
        return {
          id,
          type: validated.type,
          content: validated.type === 'image' ? thumbnailPath : validated.content,
          thumbnail_path: thumbnailPath,
          ocr_text: ocrText,
          ai_description: aiDescription,
          user_description: validated.userDescription || null,
          tags,
          created_at: now,
        };
      }, 'save-clip', getWin());
    },

    'delete-clip': async (_: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的 Clip ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING);
        }
        const clip = await dbHelper.getQuery('SELECT * FROM clips WHERE id = ?', [id]);
        if (clip?.thumbnail_path && fs.existsSync(clip.thumbnail_path)) {
          fs.unlinkSync(clip.thumbnail_path);
        }
        await dbHelper.runQuery('DELETE FROM clips WHERE id = ?', [id]);
        logInfo('Clip deleted', { id });
        return { success: true };
      }, 'delete-clip', getWin());
    },

    'clear-old-clips': async () => {
      return withErrorHandling(async () => {
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
        const oldClips = await dbHelper.allQuery('SELECT * FROM clips WHERE created_at < ?', [thirtyDaysAgo]);
        for (const clip of oldClips || []) {
          if (clip.thumbnail_path && fs.existsSync(clip.thumbnail_path)) {
            fs.unlinkSync(clip.thumbnail_path);
          }
        }
        await dbHelper.runQuery('DELETE FROM clips WHERE created_at < ?', [thirtyDaysAgo]);
        logInfo('Old clips cleared', { deleted: oldClips?.length || 0 });
        return { success: true, deleted: oldClips?.length || 0 };
      }, 'clear-old-clips');
    },

    // ===== Clip Groups =====
    'get-clip-groups': async () => {
      return withErrorHandling(async () => {
        const groups = await dbHelper.allQuery(
          `SELECT * FROM clip_groups ORDER BY created_at DESC`
        );
        // 获取每个组的截图数量
        for (const group of groups || []) {
          const countResult = await dbHelper.getQuery(
            `SELECT COUNT(*) as count FROM clip_group_items WHERE group_id = ?`,
            [group.id]
          );
          group.clip_count = countResult?.count || 0;
        }
        return groups || [];
      }, 'get-clip-groups');
    },

    'create-clip-group': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(CreateClipGroupSchema, params, 'create-clip-group');
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        await dbHelper.runQuery(
          `INSERT INTO clip_groups (id, name, description, created_at) VALUES (?, ?, ?, ?)`,
          [id, validated.name, validated.description || null, now]
        );
        logInfo('Clip group created', { id, name: validated.name });
        return { id, name: validated.name, description: validated.description, created_at: now, clip_count: 0 };
      }, 'create-clip-group', getWin());
    },

    'delete-clip-group': async (_: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的 Clip Group ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING);
        }
        await dbHelper.runQuery('DELETE FROM clip_group_items WHERE group_id = ?', [id]);
        await dbHelper.runQuery('DELETE FROM clip_groups WHERE id = ?', [id]);
        logInfo('Clip group deleted', { id });
        return { success: true };
      }, 'delete-clip-group', getWin());
    },

    'add-clips-to-group': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(AddClipsToGroupSchema, params, 'add-clips-to-group');
        const now = Math.floor(Date.now() / 1000);
        for (const clipId of validated.clipIds) {
          // 检查是否已存在
          const existing = await dbHelper.getQuery(
            `SELECT id FROM clip_group_items WHERE group_id = ? AND clip_id = ?`,
            [validated.groupId, clipId]
          );
          if (!existing) {
            const itemId = uuidv4();
            await dbHelper.runQuery(
              `INSERT INTO clip_group_items (id, group_id, clip_id, created_at) VALUES (?, ?, ?, ?)`,
              [itemId, validated.groupId, clipId, now]
            );
          }
        }
        logInfo('Clips added to group', { groupId: validated.groupId, count: validated.clipIds.length });
        return { success: true };
      }, 'add-clips-to-group', getWin());
    },

    'remove-clip-from-group': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(RemoveClipFromGroupSchema, params, 'remove-clip-from-group');
        await dbHelper.runQuery(
          `DELETE FROM clip_group_items WHERE group_id = ? AND clip_id = ?`,
          [validated.groupId, validated.clipId]
        );
        logInfo('Clip removed from group', { groupId: validated.groupId, clipId: validated.clipId });
        return { success: true };
      }, 'remove-clip-from-group', getWin());
    },

    'get-clips-in-group': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(GetClipsInGroupSchema, params, 'get-clips-in-group');
        const items = await dbHelper.allQuery(
          `SELECT c.*, gi.id as item_id FROM clip_group_items gi
           JOIN clips c ON gi.clip_id = c.id
           WHERE gi.group_id = ?
           ORDER BY gi.created_at DESC`,
          [validated.groupId]
        );
        return (items || []).map(loadClipImageData);
      }, 'get-clips-in-group');
    },

    'clipboard-ocr': async (_: any, params: { imageBase64: string; cloudModelId?: string }) => {
      return withErrorHandling(async () => {
        if (!params?.imageBase64) {
          throw new AppError('缺少图片数据', ErrorCategory.VALIDATION, ErrorLevel.WARNING);
        }

        const base64Data = params.imageBase64.replace(/^data:image\/\w+;base64,/, '');

        try {
          const localText = await performLocalOCR(base64Data);
          if (localText && localText.length > 0) {
            logInfo('Clipboard OCR: local OCR success', { length: localText.length });
            return { text: localText };
          }
        } catch (localErr: any) {
          logWarn('Clipboard OCR: local OCR failed, falling back to AI', { error: localErr?.message });
        }

        try {
          const ocrResult = await modelRouter.chat({
            cloudModelId: params.cloudModelId,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: '请识别这张图片中的所有文字，按原始排版输出。只输出识别到的文字，不要解释。' },
                  { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Data}` } },
                ],
              },
            ],
          });
          return { text: ocrResult.trim() };
        } catch (ocrErr: any) {
          const message = ocrErr?.message || '未知错误';
          logWarn('OCR AI fallback also failed', { error: message });
          return { text: '', error: `OCR 识别失败：${message}` };
        }
      }, 'clipboard-ocr');
    },

    'save-ocr-to-note': async (_: any, params: { title: string; content: string }) => {
      return withErrorHandling(async () => {
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        const memoContent = params.content || '';
        const memoTitle = params.title || 'OCR 识别结果';

        await dbHelper.runQuery(
          `INSERT INTO memos (id, type, title, content, tags, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, 'quick_note', memoTitle, memoContent, '[]', 0, now, now]
        );

        logInfo('OCR result saved as note', { id });
        return { success: true, id };
      }, 'save-ocr-to-note', getWin());
    },

    'save-ocr-to-kb': async (_: any, params: { title: string; content: string }) => {
      return withErrorHandling(async () => {
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        const vaultPath = ctx.vaultPath;
        const fileName = `ocr-${id}.txt`;
        const filePath = path.join(vaultPath, 'Files', fileName);
        fs.writeFileSync(filePath, params.content || '', 'utf-8');

        await dbHelper.runQuery(
          `INSERT INTO files (id, file_name, file_path, file_type, file_size, title, is_indexed, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, fileName, filePath, '.txt', Buffer.byteLength(params.content || ''), params.title || 'OCR 识别结果', 0, now]
        );

        logInfo('OCR result saved to KB', { id });
        return { success: true, id };
      }, 'save-ocr-to-kb', getWin());
    },

    'copy-clip-to-clipboard': async (_: any, params: { thumbnailPath: string }) => {
      return withErrorHandling(async () => {
        if (!params.thumbnailPath || !isPathWithinVault(params.thumbnailPath, ctx.vaultPath)) {
          return { success: false, error: '路径不在工作区范围内' };
        }
        const { nativeImage } = await import('electron');
        const image = nativeImage.createFromPath(params.thumbnailPath);
        if (!image.isEmpty()) {
          clipboard.writeImage(image);
          return { success: true };
        }
        return { success: false, error: 'Empty image' };
      }, 'copy-clip-to-clipboard', getWin());
    },
  };
}
