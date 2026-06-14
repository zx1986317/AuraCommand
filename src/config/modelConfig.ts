export interface ModelInfo {
  alias: string
  tags: string[]
}

const CLOUD_MODEL_CONFIG: Record<string, ModelInfo> = {
  'qwen3.7-max': { alias: '通义千问3.7 Max', tags: ['深度推理', '长文本'] },
  'qwen3.7-plus': { alias: '通义千问3.7 Plus', tags: ['快速对话', '性价比'] },
  'qwen3.7-flash': { alias: '通义千问3.7 Flash', tags: ['超快速', '轻量'] },
  'qwen3.5-omni-plus': { alias: '通义千问3.5 Omni Plus', tags: ['全模态', '视觉理解'] },
  'qwen3.5-omni-flash': { alias: '通义千问3.5 Omni Flash', tags: ['全模态', '快速'] },
  'qwen-vl-max': { alias: '通义千问VL Max', tags: ['视觉理解', '图片识别'] },
  'qwen-vl-plus': { alias: '通义千问VL Plus', tags: ['视觉理解', '快速'] },
  'qwen3-vl-plus': { alias: '通义千问3 VL Plus', tags: ['视觉理解', '多模态'] },
  'qwen3-vl-flash': { alias: '通义千问3 VL Flash', tags: ['视觉理解', '轻量'] },
  'deepseek-chat': { alias: 'DeepSeek Chat', tags: ['快速对话', '代码生成'] },
  'deepseek-reasoner': { alias: 'DeepSeek Reasoner', tags: ['深度推理', '思维链'] },
  'gpt-4o': { alias: 'GPT-4o', tags: ['多模态', '视觉理解'] },
  'gpt-4o-mini': { alias: 'GPT-4o Mini', tags: ['快速对话', '性价比'] },
  'gpt-4-turbo': { alias: 'GPT-4 Turbo', tags: ['深度推理', '长文本'] },
  'gpt-3.5-turbo': { alias: 'GPT-3.5 Turbo', tags: ['快速对话', '轻量'] },
  'claude-3-opus': { alias: 'Claude 3 Opus', tags: ['深度推理', '长文本'] },
  'claude-3-sonnet': { alias: 'Claude 3 Sonnet', tags: ['快速对话', '性价比'] },
  'claude-3-haiku': { alias: 'Claude 3 Haiku', tags: ['超快速', '轻量'] },
  'claude-3.5-sonnet': { alias: 'Claude 3.5 Sonnet', tags: ['快速对话', '代码生成'] },
  'gemini-pro': { alias: 'Gemini Pro', tags: ['深度推理', '多语言'] },
  'gemini-pro-vision': { alias: 'Gemini Pro Vision', tags: ['视觉理解', '多模态'] },
  'mimo-v2.5': { alias: '小米MiMo v2.5', tags: ['全模态', '视觉理解'] },
  'glm-4': { alias: '智谱GLM-4', tags: ['深度推理', '中文优化'] },
  'glm-4v': { alias: '智谱GLM-4V', tags: ['视觉理解', '多模态'] },
  'spark-max': { alias: '讯飞星火 Max', tags: ['深度推理', '中文优化'] },
  'ernie-4.0': { alias: '百度文心4.0', tags: ['深度推理', '中文优化'] },
  'hunyuan-pro': { alias: '腾讯混元 Pro', tags: ['深度推理', '中文优化'] },
}

function inferLocalModelTags(modelName: string): string[] {
  const normalized = modelName.toLowerCase()

  if (normalized.includes('embed') || normalized.includes('embedding')) {
    return ['嵌入模型']
  }

  if (
    normalized.includes('vision') ||
    normalized.includes('vl') ||
    normalized.includes('llava') ||
    normalized.includes('minicpm-v') ||
    normalized.includes('gemma3') ||  // gemma3 支持 clip family 图片理解
    normalized.includes('internvl') ||
    normalized.includes('cogvlm')
  ) {
    return ['视觉模型']
  }

  if (normalized.includes('coder') || normalized.includes('code') || normalized.includes('deepseek-coder') || normalized.includes('codellama')) {
    return ['代码生成']
  }

  if (normalized.includes('reason') || normalized.includes('r1') || normalized.includes('think') || normalized.includes('qwq') || normalized.includes('glm-z1')) {
    return ['推理模型']
  }

  if (normalized.includes('whisper')) {
    return ['语音转写']
  }

  return ['本地模型']
}

export function getModelInfo(modelName: string): ModelInfo {
  const cleanName = modelName.replace(/^☁️\s*/, '').split('·')[0]?.trim() || modelName

  if (modelName.startsWith('☁️')) {
    const cloudMatch = Object.entries(CLOUD_MODEL_CONFIG).find(([key]) =>
      cleanName.toLowerCase().includes(key.toLowerCase())
    )
    if (cloudMatch) return cloudMatch[1]

    return {
      alias: cleanName,
      tags: ['云端模型']
    }
  }

  return {
    alias: cleanName,
    tags: inferLocalModelTags(cleanName)
  }
}
