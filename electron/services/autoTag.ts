import * as modelRouter from '../modelRouter'
import dbHelper from '../db'
import { logInfo, logWarn } from '../errorHandler'

export interface AutoTagResult {
  tags: string[]
  category?: string
  project?: string
}

export async function generateTags(
  title: string,
  content: string,
  existingTags: string[],
): Promise<AutoTagResult> {
  const text = `${title}\n${content}`.substring(0, 2000)
  if (!text.trim()) return { tags: [] }

  try {
    const prompt = `你是一个标签推荐助手。根据以下内容，推荐3-5个简洁的标签（每个2-6个字，中文或英文），并判断所属类别（工作/学习/项目/个人/其他）。

要求：
- 标签要能反映内容的核心主题
- 避免过于宽泛的标签（如"笔记"、"记录"）
- 返回格式必须是 JSON，不要其他解释
- 只推荐与现有标签不重复的新标签

现有标签：${existingTags.length > 0 ? existingTags.join(', ') : '无'}

内容：
${text}

JSON 格式：
{"tags": ["标签1", "标签2", "标签3"], "category": "工作|学习|项目|个人|其他"}`

    const response = await modelRouter.chat({
      messages: [{ role: 'user', content: prompt }],
    })

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { tags: [] }

    const parsed = JSON.parse(jsonMatch[0])
    const tags: string[] = (parsed.tags || [])
      .map((t: any) => String(t).trim())
      .filter((t: string) => t.length > 0 && t.length < 20 && !existingTags.includes(t))

    const category = parsed.category && ['工作', '学习', '项目', '个人', '其他'].includes(parsed.category)
      ? parsed.category
      : undefined

    logInfo('[AutoTag] Generated tags:', { tags, category })
    return { tags, category }
  } catch (err: any) {
    logWarn('[AutoTag] Failed to generate tags:', err.message)
    return { tags: [] }
  }
}

export async function classifyProject(
  title: string,
  content: string,
): Promise<string | undefined> {
  try {
    const projects = await dbHelper.allQuery('SELECT DISTINCT project_name FROM project_items ORDER BY project_name')
    const projectNames = projects.map((p: any) => p.project_name).filter(Boolean)
    if (projectNames.length === 0) return undefined

    const text = `${title}\n${content}`.substring(0, 1000)
    const prompt = `根据以下内容，判断它属于哪个项目。可选项：${projectNames.join('、')}

如果与任何项目都不匹配，返回"无"。
只返回项目名称，不要其他解释。

内容：
${text}`

    const response = await modelRouter.chat({
      messages: [{ role: 'user', content: prompt }],
    })

    const match = response.trim()
    if (match === '无' || !projectNames.includes(match)) return undefined
    return match
  } catch (err: any) {
    logWarn('[AutoTag] Failed to classify project:', err.message)
    return undefined
  }
}
