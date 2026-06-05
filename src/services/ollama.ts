import { logger } from '../utils/logger';

const OLLAMA_HOST = 'http://localhost:11434';

function isEmbeddingModelName(modelName: string): boolean {
    const normalized = String(modelName || '').toLowerCase();
    return normalized.includes('embed') || normalized.includes('embedding') || normalized.includes('bge-m3') || normalized.includes('nomic-embed');
}

function findInstalledModelMatch(installed: string[], requested?: string): string | null {
    const normalizedRequested = String(requested || '').trim().toLowerCase();
    if (!normalizedRequested) return null;
    return installed.find((modelName) => String(modelName || '').trim().toLowerCase() === normalizedRequested) || null;
}

async function resolveAvailableChatModel(model?: string): Promise<string> {
    const requested = String(model || '').trim();
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
        signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models: string[] = (data.models || []).map((m: any) => m.name);
    const chatModels = models.filter((name: string) => !isEmbeddingModelName(name));
    const matchedRequested = findInstalledModelMatch(chatModels, requested);

    if (matchedRequested) {
        return matchedRequested;
    }
    const firstChatModel = chatModels[0];
    if (firstChatModel) {
        return firstChatModel;
    }
    throw new Error('未检测到可用的 Ollama 对话模型');
}

export interface OllamaStatus {
    connected: boolean;
    chatModelReady: boolean;
    embeddingModelReady: boolean;
    error?: string;
}

interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}

export const ollamaService = {
    async checkStatus(): Promise<OllamaStatus> {
        try {
            const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
                signal: AbortSignal.timeout(3000)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const models: string[] = (data.models || []).map((m: any) => m.name);
            return {
                connected: true,
                chatModelReady: models.some(m => !isEmbeddingModelName(m)),
                embeddingModelReady: models.some(m => isEmbeddingModelName(m))
            };
        } catch {
            return { connected: false, chatModelReady: false, embeddingModelReady: false, error: 'Ollama 服务未响应' };
        }
    },

    async chat(prompt: string, model?: string): Promise<string> {
        try {
            const resolvedModel = await resolveAvailableChatModel(model);
            const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: resolvedModel,
                    prompt,
                    stream: false,
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.statusText}`);
            }

            const data: OllamaResponse = await response.json();
            return data.response;
        } catch (error: any) {
            logger.error('Failed to call Ollama:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return '⚠️ AI 引擎未连接 — Ollama 服务似乎未启动。请在终端运行 `ollama serve` 后重试。';
            }
            return 'AI 响应失败，请检查 Ollama 是否启动。';
        }
    },

    async generateSummary(content: string): Promise<string> {
        const prompt = `请为以下内容生成一个简短的摘要（不超过 50 字）：\n\n${content}`;
        return this.chat(prompt);
    }
};
