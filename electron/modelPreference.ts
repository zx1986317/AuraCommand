import dbHelper from './db'
import { resolveAvailableChatModel } from './ollama'

const MODEL_SETTING_KEYS = ['selectedModel', 'selected_model'] as const

function normalizeModelName(model?: string | null): string | null {
  const normalized = typeof model === 'string' ? model.trim() : ''
  return normalized || null
}

export async function resolvePreferredModel(explicitModel?: string | null): Promise<string> {
  const directModel = normalizeModelName(explicitModel)
  if (directModel) {
    if (directModel.startsWith('☁️') || directModel.startsWith('☁ ')) return directModel
    return resolveAvailableChatModel(directModel)
  }

  for (const key of MODEL_SETTING_KEYS) {
    const storedModel = normalizeModelName(await dbHelper.getSetting(key))
    if (storedModel) {
      if (storedModel.startsWith('☁️') || storedModel.startsWith('☁ ')) return storedModel
      return resolveAvailableChatModel(storedModel)
    }
  }

  return resolveAvailableChatModel()
}

export async function persistPreferredModel(model?: string | null): Promise<void> {
  const normalized = normalizeModelName(model)
  if (!normalized) return

  await Promise.all(
    MODEL_SETTING_KEYS.map((key) => dbHelper.setSetting(key, JSON.stringify(normalized)))
  )
}
