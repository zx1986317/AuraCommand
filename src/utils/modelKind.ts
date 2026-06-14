/**
 * P1 #7：AI 消息 model badge 共享工具
 * - 统一云端/本地/未知三种模型类型判断
 * - 给 hook（费用预估）和组件（消息 badge）共用
 */
export type ModelKind = 'cloud' | 'local' | 'unknown';

// 仅当字符串以这些 token 整体开头（不是包含）才视为本地特征
// 注意：要避免 `qwen-max` 这种云端命名被 `qwen` 误判为本地
const LOCAL_EXACT_PREFIXES = [
  'llama',
  'mistral',
  'mixtral',
  'gemma',
  'phi',
  'phi-',
  'yi',
  'vicuna',
  'orca',
  'falcon',
  'baichuan',
  'chatglm',
  'olmo',
  'tinyllama',
  'starcoder',
  'codellama',
  'wizardlm',
  'solar',
  'openchat',
  'nous',
  'dolphin',
  'zephyr',
  'starling',
  'hermes',
  'yarn',
];

// 真正以"整体字符串包含"形式匹配的本地特征（这些 token 不会和云端命名冲突）
const LOCAL_CONTAINS = [
  'command-r',
  'deepseek-r', // deepseek-r1 / deepseek-r1-distill 是本地，cloudModelId 区分 deepseek-chat/reasoner
  'minicpm',
  'llava',
  'gemma3',
  'internvl',
  'cogvlm',
];

// 注意：qwen2 / qwen2.5 / qwen3 本地版用 "contains" 匹配；但 qwen-max / qwen-plus / qwen-turbo 是云端
// 由下方的 CLOUD_PREFIXES 先吃掉，避免冲突
const LOCAL_QWEN_PATTERNS = ['qwen2', 'qwen2.5', 'qwen3'];

function looksLikeLocal(modelName: string): boolean {
  const lower = (modelName || '').toLowerCase();
  if (LOCAL_EXACT_PREFIXES.some(p => lower.startsWith(p))) return true;
  if (LOCAL_CONTAINS.some(p => lower.includes(p))) return true;
  if (LOCAL_QWEN_PATTERNS.some(p => lower.includes(p))) return true;
  return false;
}

const CLOUD_PREFIXES = [
  'gpt-',
  'claude',
  'gemini-',
  'glm-',
  'spark-',
  'ernie-',
  'hunyuan-',
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
  'qwen-vl',
  'qwen3-vl',
  'qwen3.7-',
  'qwen3.5-omni',
  'deepseek-chat',
  'deepseek-reasoner',
  'cogview',
  'wanx',
  'wan2',
  'mimo-',
];

/**
 * 判断模型属于哪一类
 * 优先级：
 *  1. 显式 cloudModelId 提供 → 云端
 *  2. modelName 以 '☁️' 开头 → 云端
 *  3. 命中云端前缀命名（gpt-/claude/qwen-max 等）→ 云端
 *  4. 命中本地特征命名（llama/qwen2/mistral 等）→ 本地
 *  5. 否则 → 未知
 */
export function getModelKind(modelName: string | undefined | null, cloudModelId?: string | null): ModelKind {
  if (cloudModelId) return 'cloud';
  if (!modelName) return 'unknown';
  if (modelName.startsWith('☁️')) return 'cloud';

  const lower = modelName.toLowerCase();
  if (CLOUD_PREFIXES.some(p => lower.startsWith(p))) return 'cloud';
  if (looksLikeLocal(modelName)) return 'local';
  return 'unknown';
}
