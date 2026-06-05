import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import log from 'electron-log';
import { getOllamaUrl, listModels } from './ollama';

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus', '.webm', '.mp4',
]);

export function isAudioFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

export async function isWhisperAvailable(): Promise<{ available: boolean; model?: string; reason?: string }> {
  try {
    const models = await listModels();
    const whisperModel = models.find(m => m.toLowerCase().includes('whisper'));
    if (whisperModel) {
      return { available: true, model: whisperModel };
    }
    return { available: false, reason: '未安装 Whisper 模型。请运行 ollama pull whisper 安装。' };
  } catch {
    return { available: false, reason: 'Ollama 服务未运行' };
  }
}

export async function whisperTranscribe(
  audioFilePath: string,
  options?: { model?: string; language?: string }
): Promise<{ text: string; duration?: number; language?: string }> {
  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`音频文件不存在: ${audioFilePath}`);
  }

  const availability = await isWhisperAvailable();
  if (!availability.available) {
    throw new Error(availability.reason || 'Whisper 模型不可用');
  }

  const model = options?.model || availability.model!;
  const ollamaUrl = await getOllamaUrl();

  const fileBuffer = fs.readFileSync(audioFilePath);
  const fileName = path.basename(audioFilePath);
  const ext = path.extname(audioFilePath).toLowerCase().replace('.', '');
  const mimeTypeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wma: 'audio/x-ms-wma',
    opus: 'audio/opus',
    webm: 'audio/webm',
    mp4: 'video/mp4',
  };
  const mimeType = mimeTypeMap[ext] || 'audio/mpeg';

  try {
    const formData = new FormData();
    formData.append('model', model);
    formData.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);
    if (options?.language) {
      formData.append('language', options.language);
    }

    const response = await axios.post(`${ollamaUrl}/api/audio/transcriptions`, formData, {
      timeout: 300000,
    });

    const text = response.data?.text?.trim() || '';
    log.info(`[Whisper] Transcribed ${fileName}: ${text.length} chars`);

    return {
      text,
      language: response.data?.language,
    };
  } catch (error: any) {
    const errMsg = error?.response?.data?.error || error?.message || '未知错误';
    log.error(`[Whisper] Transcription failed for ${fileName}:`, errMsg);

    if (error?.response?.status === 404) {
      throw new Error(`Whisper 模型 "${model}" 未找到，请运行 ollama pull ${model}`);
    }
    throw new Error(`音频转写失败: ${errMsg}`);
  }
}
