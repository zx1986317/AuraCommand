import axios from 'axios';
import log from 'electron-log';
import dbHelper from './db';

const OLLAMA_URL_KEY = 'ollama_url';
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

// 本地模型超时策略（毫秒）
const OLLAMA_TIMEOUTS = {
  chat: 180000,          // 对话（推理模型通常更慢）
  chatStream: 300000,    // 流式对话（最长 5 分钟）
  embedding: 60000,      // Embedding
  generate: 180000,      // 文本生成
  ocr: 120000,           // OCR 识别
}

const EMBEDDING_MODEL_KEYWORDS = ['embed', 'embedding', 'bge-m3', 'nomic-embed'];
const NON_CHAT_MODEL_KEYWORDS = ['rerank', 'whisper', 'tts'];

function normalizeModelName(model?: string | null): string {
    return typeof model === 'string' ? model.trim() : '';
}

function findInstalledModelMatch(installed: string[], requested?: string | null): string | null {
    const normalizedRequested = normalizeModelName(requested).toLowerCase();
    if (!normalizedRequested) return null;
    return installed.find((modelName) => normalizeModelName(modelName).toLowerCase() === normalizedRequested) || null;
}

export function isEmbeddingModelName(modelName: string): boolean {
    const normalized = normalizeModelName(modelName).toLowerCase();
    return EMBEDDING_MODEL_KEYWORDS.some(keyword => normalized.includes(keyword));
}

export function isChatModelName(modelName: string): boolean {
    const normalized = normalizeModelName(modelName).toLowerCase();
    return !!normalized && !isEmbeddingModelName(normalized) && !NON_CHAT_MODEL_KEYWORDS.some(keyword => normalized.includes(keyword));
}

export async function resolveAvailableChatModel(preferredModel?: string | null): Promise<string> {
    const requested = normalizeModelName(preferredModel);
    const installed = await listModels();
    const chatModels = installed.filter(isChatModelName);
    const matchedRequested = findInstalledModelMatch(chatModels, requested);

    if (matchedRequested) {
        return matchedRequested;
    }

    const firstChatModel = chatModels[0];
    if (firstChatModel) {
        return firstChatModel;
    }

    throw new Error(requested
        ? `模型 ${requested} 不可用，且当前 Ollama 未检测到其他可用对话模型`
        : '未检测到可用的 Ollama 对话模型，请先在设置中安装至少一个本地对话模型');
}

async function resolveAvailableEmbeddingModel(): Promise<string> {
    const installed = await listModels();
    const embeddingModels = installed.filter(isEmbeddingModelName);
    const firstEmbeddingModel = embeddingModels[0];
    if (firstEmbeddingModel) {
        return firstEmbeddingModel;
    }
    throw new Error('未检测到可用的向量模型，请先在 Ollama 中安装一个 embedding 模型');
}

async function resolveAvailableVisionModel(preferredModel?: string | null): Promise<string> {
    const requested = normalizeModelName(preferredModel);
    const installed = await listModels();
    const matchedRequested = findInstalledModelMatch(installed, requested);
    if (matchedRequested) {
        return matchedRequested;
    }
    const visionModel = await getVisionModel();
    if (visionModel) {
        return visionModel;
    }
    throw new Error('未检测到可用的视觉模型，请先在 Ollama 中安装一个支持图片理解的模型');
}

// GPU 模式配置
export type GpuMode = 'auto' | 'gpu' | 'cpu';
const GPU_MODE_KEY = 'ollama_gpu_mode';

// 模型参数配置
const MODEL_PARAMS_KEY = 'ollama_model_params';
export interface ModelParams {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    num_predict?: number;
    num_ctx?: number;
}

// 获取 Ollama 基础 URL
export async function getOllamaUrl(): Promise<string> {
    try {
        const saved = await dbHelper.getSetting(OLLAMA_URL_KEY);
        if (saved && typeof saved === 'string' && saved.trim()) {
            return saved.trim();
        }
    } catch {}
    return DEFAULT_OLLAMA_URL;
}

// 保存 Ollama URL
export async function setOllamaUrl(url: string): Promise<void> {
    await dbHelper.setSetting(OLLAMA_URL_KEY, JSON.stringify(url.trim() || DEFAULT_OLLAMA_URL));
    log.info(`[Ollama] URL set to: ${url}`);
}

// 获取模型参数
export async function getModelParams(): Promise<ModelParams> {
    try {
        const saved = await dbHelper.getSetting(MODEL_PARAMS_KEY);
        if (saved) {
            if (typeof saved === 'string') return JSON.parse(saved);
            return saved as ModelParams;
        }
    } catch {}
    return {};
}

// 保存模型参数
export async function setModelParams(params: Partial<ModelParams>): Promise<void> {
    const current = await getModelParams();
    const merged = { ...current, ...params };
    await dbHelper.setSetting(MODEL_PARAMS_KEY, JSON.stringify(merged));
    log.info(`[Ollama] Model params updated:`, merged);
}

// 获取 num_gpu 参数值
export function getNumGpuValue(mode: GpuMode): number {
    switch (mode) {
        case 'cpu': return 0;
        case 'gpu': return 999;
        case 'auto':
        default: return 999;
    }
}

// 获取 GPU 模式设置
export async function getGpuMode(): Promise<GpuMode> {
    try {
        const saved = await dbHelper.getSetting(GPU_MODE_KEY);
        log.info(`[Ollama] GPU mode from DB: ${JSON.stringify(saved)}`);
        if (saved && ['auto', 'gpu', 'cpu'].includes(saved)) {
            return saved as GpuMode;
        }
    } catch (err) {
        log.error('[Ollama] Failed to get GPU mode:', err);
    }
    return 'auto';
}

// 保存 GPU 模式设置
export async function setGpuMode(mode: GpuMode): Promise<void> {
    await dbHelper.setSetting(GPU_MODE_KEY, JSON.stringify(mode));
    log.info(`[Ollama] GPU mode set to: ${mode}`);
}

export interface ChatMessage {
   role: 'user' | 'assistant' | 'system';
   content: string;
   images?: string[];
}

export interface ModelStatus {
   category: string;
   recommend: string;
   installed: boolean;
   pullCommand: string;
}

function handleOllamaError(error: any, modelName?: string, operation?: string): never {
    const name = modelName || '当前模型';
    const op = operation || '操作';
    log.error(`[Ollama] ${op} error:`, error);
    const errorMessage = error.response?.data?.error || error.message;
    const status = error.response?.status;
    if (status === 404) {
        throw new Error(`模型 ${name} 未找到，请在终端运行 'ollama pull ${name}'`);
    }
    if (status === 401) {
        throw new Error(`Ollama 认证失败(401)：${errorMessage}`);
    }
    if (status === 403) {
        throw new Error(`Ollama 拒绝访问(403)：${errorMessage}`);
    }
    if (error.code === 'ECONNREFUSED') {
        throw new Error(`Ollama 服务未启动，请在终端运行 'ollama serve'`);
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new Error(`Ollama 请求超时，请检查服务是否正常运行`);
    }
    throw new Error(`Ollama ${op}错误: ${errorMessage}`);
}

export async function generateSummary(text: string, model?: string): Promise<string> {
    const resolvedModel = await resolveAvailableChatModel(model);
    try {
        const prompt = `你是一个高效的个人助手。请对以下内容进行深度提炼，并按以下格式返回：

✨ 【一句话摘要】
(不超过 30 字，概括核心内容)

💡 【关键信息点】
- (列出 2-3 个最重要的信息点)

📅 【后续行动项】
- (如果有日程安排或建议的后续计划，请列出；如果没有则跳过此部分)

---
内容：
${text}`;

        const response = await axios.post(`${(await getOllamaUrl())}/api/generate`, {
            model: resolvedModel,
            prompt: prompt,
            stream: false,
            options: {
                num_gpu: getNumGpuValue(await getGpuMode())
            },
            keep_alive: "1m"
        });
        return response.data.response.trim();
    } catch (error: any) {
        handleOllamaError(error, resolvedModel, 'summary');
    }
}

export interface OllamaChatOptions {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    num_predict?: number;
    num_ctx?: number;
}

export async function generateChat(messages: ChatMessage[], model?: string, options?: OllamaChatOptions): Promise<string> {
    const resolvedModel = await resolveAvailableChatModel(model);
    const ollamaUrl = await getOllamaUrl();
    const modelParams = await getModelParams();
    const requestMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
        images: m.images
    }));
    const baseOptions: Record<string, any> = {
        num_predict: options?.num_predict || options?.max_tokens || modelParams.num_predict || 4096,
        num_ctx: options?.num_ctx || modelParams.num_ctx || 4096,
        num_gpu: getNumGpuValue(await getGpuMode()),
    };
    if (options?.temperature !== undefined || modelParams.temperature !== undefined) {
        baseOptions.temperature = options?.temperature ?? modelParams.temperature;
    }
    if (options?.top_p !== undefined || modelParams.top_p !== undefined) {
        baseOptions.top_p = options?.top_p ?? modelParams.top_p;
    }

    // 检测是否为支持 thinking 的推理模型（与非流式共用）
    const isThinkingModel = /deepseek-r1|qwen3|deepseek-v3\.1|gpt-oss/i.test(resolvedModel)

    const tryChat = async (chatOptions: Record<string, any>, enableThink: boolean = false) => {
        const requestBody: Record<string, any> = {
            model: resolvedModel,
            messages: requestMessages,
            stream: false,
            options: chatOptions,
            keep_alive: "5m"
        }
        if (enableThink && isThinkingModel) {
            requestBody.think = true
        }
        return axios.post(`${ollamaUrl}/api/chat`, requestBody, {
            timeout: OLLAMA_TIMEOUTS.chat,
        });
    };

    try {
        let response;
        let thinkingContent = '';
        try {
            response = await tryChat(baseOptions, true);  // 启用 thinking
        } catch (retryErr: any) {
            if (retryErr?.response?.status !== 400) throw retryErr;
            const errorDetail = retryErr?.response?.data
            let errorMsg = retryErr?.message || '请求失败'
            if (errorDetail) {
                try {
                    const parsed = typeof errorDetail === 'string' ? JSON.parse(errorDetail) : errorDetail
                    if (parsed?.error) errorMsg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)
                } catch { /* ignore */ }
            }
            // 如果是 think 参数不支持，尝试不带 think 重试
            if (errorMsg.includes('think') || errorMsg.includes('thinking')) {
                log.warn(`[Ollama] think:true not supported for ${resolvedModel} (non-stream), retrying without it`)
                try {
                    response = await tryChat(baseOptions, false)
                } catch (noThinkErr: any) {
                    throw new Error(`Ollama 模型 ${resolvedModel} 调用失败：${noThinkErr?.message || '未知错误'}`)
                }
            } else if (errorMsg.includes('exceed') || errorMsg.includes('context size') || errorMsg.includes('n_ctx')) {
                const currentCtx = baseOptions.num_ctx || 4096
                const expandedCtx = Math.min(currentCtx * 2, 16384)
                log.warn(`[Ollama] Context exceeded (${currentCtx}), expanding to ${expandedCtx} and retrying`)
                try {
                    response = await tryChat({ ...baseOptions, num_ctx: expandedCtx }, true)
                } catch (ctxErr: any) {
                    throw new Error(`Ollama 模型 ${resolvedModel} 调用失败(400)：${ctxErr?.response?.data?.error || ctxErr?.message || '未知错误'}`)
                }
            } else {
                throw new Error(`Ollama 模型 ${resolvedModel} 调用失败(400)：${errorMsg}`)
            }
        }
        // 处理 Ollama think API 返回的 thinking 字段
        if (response.data.message?.thinking) {
            thinkingContent = response.data.message.thinking
        }
        let content: string = response.data.message.content || '';
        const endTokenIdx = content.indexOf('<|endoftext|>');
        if (endTokenIdx !== -1) {
            content = content.substring(0, endTokenIdx);
        }
        content = content.replace(/<\|im_start\|>|<\|im_end\|>/g, '');
        return content;
    } catch (error: any) {
        handleOllamaError(error, resolvedModel, 'chat');
    }
}

export async function generateChatStream(
    messages: ChatMessage[], 
    model: string | undefined,
    onChunk: (data: { content?: string, reasoning?: string }) => void,
    signal?: AbortSignal,
    options?: OllamaChatOptions
): Promise<void> {
    const resolvedModel = await resolveAvailableChatModel(model);
    const ollamaUrl = await getOllamaUrl();
    const modelParams = await getModelParams();
    const requestMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
        images: m.images
    }));
    const baseOptions: Record<string, any> = {
        num_predict: options?.num_predict || options?.max_tokens || modelParams.num_predict || 4096,
        num_ctx: options?.num_ctx || modelParams.num_ctx || 4096,
        num_gpu: getNumGpuValue(await getGpuMode()),
    };
    if (options?.temperature !== undefined || modelParams.temperature !== undefined) {
        baseOptions.temperature = options?.temperature ?? modelParams.temperature;
    }
    if (options?.top_p !== undefined || modelParams.top_p !== undefined) {
        baseOptions.top_p = options?.top_p ?? modelParams.top_p;
    }

    // 检测是否为支持 thinking 的推理模型
    const isThinkingModel = /deepseek-r1|qwen3|deepseek-v3\.1|gpt-oss/i.test(resolvedModel)

    const tryStream = async (streamOptions: Record<string, any>, enableThink: boolean = false) => {
        const requestBody: Record<string, any> = {
            model: resolvedModel,
            messages: requestMessages,
            stream: true,
            options: streamOptions,
            keep_alive: "5m"
        }
        // 只对支持的模型添加 think 参数
        if (enableThink && isThinkingModel) {
            requestBody.think = true
        }
        const response = await axios.post(`${ollamaUrl}/api/chat`, requestBody, {
            responseType: 'stream',
            timeout: OLLAMA_TIMEOUTS.chatStream,
            ...(signal ? { signal } : {})
        });
        return response;
    };

    // 辅助：从 Ollama 400 错误中提取具体原因
    const extractOllama400Error = async (err: any): Promise<string> => {
        let errorMsg = err?.message || '请求失败'
        // 流式请求的 response.data 是 stream，需要读取内容
        const respData = err?.response?.data
        if (respData) {
            try {
                if (typeof respData === 'string') {
                    const parsed = JSON.parse(respData)
                    if (parsed?.error) errorMsg = parsed.error
                } else if (respData instanceof ReadableStream || typeof respData?.on === 'function') {
                    // Node.js stream — 收集数据
                    const chunks: string[] = []
                    await new Promise<void>((resolve) => {
                        respData.on('data', (chunk: Buffer) => chunks.push(chunk.toString()))
                        respData.on('end', resolve)
                        respData.on('error', resolve)
                    })
                    const body = chunks.join('')
                    try {
                        const parsed = JSON.parse(body)
                        if (parsed?.error) errorMsg = parsed.error
                    } catch { /* not JSON, use raw */ }
                } else if (typeof respData === 'object') {
                    if (respData.error) errorMsg = respData.error
                }
            } catch { /* ignore */ }
        }
        return errorMsg
    };

    try {
        let response;
        try {
            response = await tryStream(baseOptions, true);  // 启用 thinking
        } catch (retryErr: any) {
            if (retryErr?.response?.status !== 400) throw retryErr;
            const errorMsg = await extractOllama400Error(retryErr)
            // 如果是 think 参数不支持的错误，尝试不带 think 重试
            if (errorMsg.includes('think') || errorMsg.includes('thinking')) {
                log.warn(`[Ollama] think:true not supported for ${resolvedModel}, retrying without it`)
                try {
                    response = await tryStream(baseOptions, false)
                } catch (noThinkErr: any) {
                    throw new Error(`Ollama 模型 ${resolvedModel} 调用失败：${noThinkErr?.message || '未知错误'}`)
                }
            } else if (errorMsg.includes('exceed') || errorMsg.includes('context size') || errorMsg.includes('n_ctx')) {
                const currentCtx = baseOptions.num_ctx || 4096
                const expandedCtx = Math.min(currentCtx * 2, 16384)
                log.warn(`[Ollama] Context exceeded (${currentCtx}), expanding to ${expandedCtx} and retrying`)
                try {
                    response = await tryStream({ ...baseOptions, num_ctx: expandedCtx }, true)
                } catch (ctxErr: any) {
                    const ctxErrorMsg = await extractOllama400Error(ctxErr)
                    throw new Error(`Ollama 模型 ${resolvedModel} 调用失败(400)：${ctxErrorMsg}`)
                }
            } else {
                throw new Error(`Ollama 模型 ${resolvedModel} 调用失败(400)：${errorMsg}`)
            }
        }

        let buffer = '';
        let pendingThink = '';
        let inThinkTag = false;
        return new Promise((resolve, reject) => {
            response.data.on('data', (chunk: Buffer) => {
                buffer += chunk.toString();
                let boundary;
                while ((boundary = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, boundary).trim();
                    buffer = buffer.substring(boundary + 1);
                    if (!line) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.message) {
                            // 处理 Ollama think API 返回的 thinking 字段（推理模型）
                            if (json.message.thinking) {
                                onChunk({ reasoning: json.message.thinking });
                            }
                            
                            let rawContent: string = json.message.content || '';
                            rawContent = rawContent.replace(/<\|endoftext\|>|<\|im_start\|>|<\|im_end\|>/g, '');
                            if (!rawContent) continue;

                            let remaining = rawContent;
                            while (remaining.length > 0) {
                                if (inThinkTag) {
                                    const closeIdx = remaining.indexOf('</think>');
                                    if (closeIdx !== -1) {
                                        pendingThink += remaining.substring(0, closeIdx);
                                        if (pendingThink) onChunk({ reasoning: pendingThink });
                                        pendingThink = '';
                                        inThinkTag = false;
                                        remaining = remaining.substring(closeIdx + '</think>'.length);
                                    } else {
                                        pendingThink += remaining;
                                        remaining = '';
                                    }
                                } else {
                                    const openIdx = remaining.indexOf('<think>');
                                    if (openIdx !== -1) {
                                        const beforeThink = remaining.substring(0, openIdx);
                                        if (beforeThink) onChunk({ content: beforeThink });
                                        const afterOpen = remaining.substring(openIdx + '<think>'.length);
                                        const closeIdx = afterOpen.indexOf('</think>');
                                        if (closeIdx !== -1) {
                                            const reasoning = afterOpen.substring(0, closeIdx);
                                            if (reasoning) onChunk({ reasoning });
                                            remaining = afterOpen.substring(closeIdx + '</think>'.length);
                                        } else {
                                            inThinkTag = true;
                                            pendingThink = afterOpen;
                                            remaining = '';
                                        }
                                    } else {
                                        onChunk({ content: remaining });
                                        remaining = '';
                                    }
                                }
                            }
                        }
                        if (json.done) {
                            if (pendingThink) {
                                onChunk({ reasoning: pendingThink });
                                pendingThink = '';
                            }
                            if (json.done_reason && json.done_reason !== 'stop') {
                                log.info(`[Ollama] Stream done with reason: ${json.done_reason}, total_duration: ${json.total_duration}, eval_count: ${json.eval_count}`)
                            }
                            resolve();
                        }
                    } catch (e) {
                        log.error('[Ollama JSON Parse Error]:', e, 'Line:', line);
                    }
                }
            });

            response.data.on('error', (err: Error) => {
                reject(err);
            });
        });
    } catch (error: any) {
        log.error('Ollama chat stream error:', error);
        throw error;
    }
}

export async function generateEmbedding(text: string): Promise<number[]> {
    // 纯本地 Embedding 生成，云端降级由 modelRouter 统一管理
    const embeddingModel = await resolveAvailableEmbeddingModel();
    try {
        const response = await axios.post(`${(await getOllamaUrl())}/api/embeddings`, {
            model: embeddingModel,
            prompt: text,
            options: {
                num_gpu: getNumGpuValue(await getGpuMode())
            },
            keep_alive: "1m"
        }, {
            timeout: OLLAMA_TIMEOUTS.embedding
        });
        return response.data.embedding;
    } catch (error: any) {
        handleOllamaError(error, embeddingModel, 'embedding');
    }
}

export interface OllamaStatus {
    connected: boolean;
    models: string[];
    chatModelReady: boolean;
    embeddingModelReady: boolean;
    error?: string;
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
    try {
        const response = await axios.get(`${await getOllamaUrl()}/api/tags`, {
            timeout: 3000
        });
        const models: string[] = response.data.models.map((m: any) => m.name);
        const chatModelReady = models.some(isChatModelName);
        const embeddingModelReady = models.some(isEmbeddingModelName);
        return { connected: true, models, chatModelReady, embeddingModelReady };
    } catch (error: any) {
        const errorMsg = error.code === 'ECONNREFUSED'
            ? 'Ollama 服务未启动，请在终端运行 ollama serve'
            : error.code === 'ETIMEDOUT'
            ? '连接 Ollama 超时，请检查服务是否正常运行'
            : `Ollama 连接失败: ${error.message}`;
        return { connected: false, models: [], chatModelReady: false, embeddingModelReady: false, error: errorMsg };
    }
}

export async function listModels(): Promise<string[]> {
    try {
        const response = await axios.get(`${await getOllamaUrl()}/api/tags`);
        return response.data.models.map((m: any) => m.name);
    } catch (error) {
        log.error('Ollama list models error:', error);
        return [];
    }
}

export async function checkModelsStatus(): Promise<ModelStatus[]> {
    const installed = await listModels();
    const chatModel = installed.find(isChatModelName);
    const embeddingModel = installed.find(isEmbeddingModelName);
    const whisperModel = installed.find(m => m.toLowerCase().includes('whisper'));
    return [
        {
            category: '对话模型 (Chat)',
            recommend: chatModel || '请先安装任意对话模型',
            installed: !!chatModel,
            pullCommand: chatModel ? `已安装：${chatModel}` : 'ollama pull <对话模型名>'
        },
        {
            category: '向量模型 (Embedding)',
            recommend: embeddingModel || '请先安装任意向量模型',
            installed: !!embeddingModel,
            pullCommand: embeddingModel ? `已安装：${embeddingModel}` : 'ollama pull <向量模型名>'
        },
        {
            category: '语音转写 (Whisper)',
            recommend: whisperModel || '可选：安装后支持音频转写',
            installed: !!whisperModel,
            pullCommand: whisperModel ? `已安装：${whisperModel}` : 'ollama pull whisper'
        }
    ];
}

export async function getVisionModel(): Promise<string | null> {
    const installed = await listModels();
    for (const modelName of installed) {
        try {
            const response = await axios.post(`${(await getOllamaUrl())}/api/show`, { name: modelName, verbose: false });
            const details = response.data?.details || {};
            const families = Array.isArray(details.families) ? details.families.map((item: any) => String(item).toLowerCase()) : [];
            const normalizedName = modelName.toLowerCase();
            log.info(`[Vision] Model ${modelName} families:`, families);
            if (
                normalizedName.includes('vl') ||
                normalizedName.includes('vision') ||
                normalizedName.includes('llava') ||
                normalizedName.includes('minicpm-v') ||
                families.includes('clip') ||
                families.includes('vision') ||
                families.includes('mllama') ||
                families.some((family: string) => family.includes('vl'))
            ) {
                return modelName;
            }
        } catch (e) {
            log.error(`[Vision] Failed to check model ${modelName}:`, e);
        }
    }
    log.info('[Vision] No vision model found. Installed models:', installed);
    return null;
}

export async function performOCR(imageBase64: string, model?: string, options: { mode?: 'text' | 'table' | 'auto' } = {}): Promise<string> {
    const resolvedModel = await resolveAvailableVisionModel(model);
    try {
        const modePrompt = options.mode === 'table' 
            ? "这是一个包含表格或结构化数据的图片。请精准还原表格结构，使用 Markdown 表格格式输出。确保列对齐，不要遗漏任何数据单元格。只需输出 Markdown 内容，不要解释。" 
            : "请识别这张图片中的文字。如果包含标题、列表或段落，请使用 Markdown 格式保留排版结构。如果包含代码块，请注明语言。只需输出识别到的内容，不要有任何多余的解释。";

        const response = await axios.post(`${(await getOllamaUrl())}/api/generate`, {
            model: resolvedModel,
            prompt: modePrompt,
            images: [imageBase64],
            stream: false,
            options: {
                num_gpu: getNumGpuValue(await getGpuMode())
            },
            keep_alive: "30s" // OCR 模型干完活 30 秒后自动卸载，给对话模型腾显存
        });
        return response.data.response.trim();
    } catch (error: any) {
        handleOllamaError(error, resolvedModel, 'OCR');
    }
}

export async function analyzeScreenshot(imageBase64s: string[], model: string, prompt?: string): Promise<string> {
    const resolvedModel = await resolveAvailableVisionModel(model);
    try {
        const systemPrompt = prompt || '请分析这些截图的内容，提取关键信息并给出结构化总结。';

        const messages: ChatMessage[] = [
            {
                role: 'user',
                content: systemPrompt,
                images: imageBase64s
            }
        ];

        const response = await axios.post(`${(await getOllamaUrl())}/api/chat`, {
            model: resolvedModel,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
                images: m.images
            })),
            stream: false,
            options: { num_predict: 4096, num_gpu: getNumGpuValue(await getGpuMode()) },
            keep_alive: "5m"
        });
        return response.data.message.content.trim();
    } catch (error: any) {
        handleOllamaError(error, resolvedModel, 'analyze screenshot');
    }
}

export async function generate(prompt: string, model?: string): Promise<string> {
    const resolvedModel = await resolveAvailableChatModel(model);
    try {
        const response = await axios.post(`${(await getOllamaUrl())}/api/generate`, {
            model: resolvedModel,
            prompt,
            stream: false,
            options: {
                num_gpu: getNumGpuValue(await getGpuMode())
            },
            keep_alive: "1m"
        });
        return response.data.response.trim();
    } catch (error: any) {
        handleOllamaError(error, resolvedModel, 'generate');
    }
}

export async function pullModel(modelName: string): Promise<string> {
    try {
        const response = await axios.post(`${await getOllamaUrl()}/api/pull`, {
            name: modelName,
            stream: false
        });
        return response.data.status || 'success';
    } catch (error: any) {
        throw new Error(`拉取模型失败: ${error.response?.data?.error || error.message}`);
    }
}

export async function deleteModel(modelName: string): Promise<string> {
    try {
        const response = await axios.delete(`${await getOllamaUrl()}/api/delete`, {
            data: { name: modelName }
        });
        return response.data.status || 'success';
    } catch (error: any) {
        throw new Error(`删除模型失败: ${error.response?.data?.error || error.message}`);
    }
}

export async function getEmbeddings(text: string, model?: string): Promise<number[]> {
    return generateEmbedding(text);
}

export async function analyzeImage(base64Image: string, prompt: string, model?: string): Promise<string> {
    return performOCR(base64Image, model);
}

export async function getModelInfo(modelName: string): Promise<any> {
    try {
        const response = await axios.post(`${await getOllamaUrl()}/api/show`, {
            name: modelName
        });
        return response.data;
    } catch (error: any) {
        throw new Error(`获取模型信息失败: ${error.response?.data?.error || error.message}`);
    }
}

export async function expandQuery(query: string, model?: string): Promise<string[]> {
    try {
        const prompt = `从以下问题中提取2-4个最关键的搜索关键词，用于知识库检索。关键词应覆盖问题的不同角度（如：主题、品牌、术语、编号）。只返回关键词，用逗号分隔，不要解释。\n\n问题: ${query}\n关键词:`;
        const result = await generate(prompt, model);
        return result.split(/[,，、\n]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 30);
    } catch (err) {
        log.warn('[Ollama] expandQuery failed:', err);
        return [];
    }
}

export async function expandQueryWithContext(query: string, history: any[], model?: string): Promise<string[]> {
    try {
        const conversationContext = history.slice(-4).map((m: any) => 
            `${m.role === 'user' ? '用户' : '助手'}: ${String(m.content || '').substring(0, 200)}`
        ).join('\n');

        const hasHistory = history && history.length > 0;

        const prompt = hasHistory 
            ? `你是一个知识库检索优化助手。基于以下对话历史和用户最新问题，生成 2-4 个最适合在本地知识库中检索的关键词或短语。

要求：
1. 关键词应该与用户的便签、文档、笔记等内容相关
2. 结合对话历史理解用户真正想查找的内容
3. 如果问题涉及特定项目、分类、标签，优先使用这些词
4. 只返回关键词，用逗号分隔，不要解释

对话历史：
${conversationContext}

用户最新问题：${query}

检索关键词：`
            : `你是一个知识库检索优化助手。分析用户的问题，生成 2-4 个最适合在本地知识库中检索的关键词或短语。

要求：
1. 分析用户问题的核心主题和关键概念
2. 生成与便签、文档、笔记等内容相关的关键词
3. 如果问题涉及特定项目、技术、分类，优先使用这些词
4. 只返回关键词，用逗号分隔，不要解释

用户问题：${query}

检索关键词：`;

        const result = await generate(prompt, model);
        return result.split(/[,，、\n]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 30);
    } catch (err) {
        log.warn('[Ollama] expandQueryWithContext failed:', err);
        return [];
    }
}

export async function isRunning(): Promise<boolean> {
    try {
        const status = await checkOllamaStatus();
        return status.connected;
    } catch {
        return false;
    }
}

export default {
    generateSummary,
    generateChat,
    generateChatStream,
    generateEmbedding,
    getEmbeddings,
    listModels,
    performOCR,
    analyzeImage,
    analyzeScreenshot,
    checkModelsStatus,
    checkOllamaStatus,
    generate,
    expandQuery,
    expandQueryWithContext,
    pullModel,
    deleteModel,
    getVisionModel,
    getModelInfo,
    isRunning
};
