export interface SearchFilters {
  tag?: string[]
  type?: string
  project?: string
  dateFrom?: string
  dateTo?: string
  dateOp?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | undefined
  dateValue?: string | undefined
}

export interface ParsedQuery {
  cleanQuery: string
  filters: SearchFilters
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const tokens = raw.split(/\s+/).filter(Boolean)
  const filters: SearchFilters = {}
  const cleanTokens: string[] = []

  for (const token of tokens) {
    const tagMatch = token.match(/^tag:(.+)/i)
    if (tagMatch && tagMatch[1]) {
      filters.tag = tagMatch[1].split(/[,，]/).map(t => t.trim()).filter(Boolean)
      continue
    }
    const typeMatch = token.match(/^type:(.+)/i)
    if (typeMatch && typeMatch[1]) {
      const t = typeMatch[1].toLowerCase()
      if (['note', 'document', 'task', 'clip', 'chat', 'memo', 'file', 'schedule'].includes(t)) {
        filters.type = t
      }
      continue
    }
    const projectMatch = token.match(/^project:(.+)/i)
    if (projectMatch && projectMatch[1]) {
      filters.project = projectMatch[1].trim()
      continue
    }
    const dateMatch = token.match(/^date:(>=|<=|>|<|)(\d{4}-\d{2}-\d{2})(?:\.\.(\d{4}-\d{2}-\d{2}))?$/i)
    if (dateMatch) {
      const op = dateMatch[1] || 'eq'
      const val = dateMatch[2]!
      const rangeEnd = dateMatch[3]
      if (rangeEnd) {
        filters.dateFrom = val
        filters.dateTo = rangeEnd
      } else {
        filters.dateOp = op as 'eq' | 'gt' | 'gte' | 'lt' | 'lte'
        filters.dateValue = val
      }
      continue
    }
    cleanTokens.push(token)
  }

  return { cleanQuery: cleanTokens.join(' '), filters }
}

export function applyTagFilter(tableAlias: string, tags: string[]): { clause: string; params: string[] } {
  if (!tags || tags.length === 0) return { clause: '', params: [] }
  const likes = tags.map(() => `${tableAlias}.tags LIKE ?`)
  const params = tags.map(t => `%"${t}"%`)
  return { clause: ` AND (${likes.join(' OR ')})`, params }
}

export function applyTypeFilter(type: string): { clause: string } {
  if (!type) return { clause: '' }
  if (type === 'note') return { clause: " AND n.type IN ('quick_note', 'note')" }
  if (type === 'document') return { clause: " AND n.type = 'document'" }
  if (type === 'memo') return { clause: " AND n.type = 'quick_note'" }
  if (type === 'file') return { clause: '' }
  if (type === 'task') return { clause: '' }
  if (type === 'clip') return { clause: '' }
  if (type === 'chat') return { clause: '' }
  if (type === 'schedule') return { clause: '' }
  return { clause: '' }
}

export function applyProjectFilter(tableAlias: string, project: string): { clause: string; params: string[] } {
  if (!project) return { clause: '', params: [] }
  return {
    clause: ` AND ${tableAlias}.id IN (SELECT item_id FROM project_items WHERE project_name = ? AND item_type IN ('note','document'))`,
    params: [project],
  }
}

export function applyDateFilter(tableAlias: string, filters: SearchFilters): { clause: string; params: string[] } {
  if (filters.dateFrom && filters.dateTo) {
    return {
      clause: ` AND ${tableAlias}.updated_at >= ? AND ${tableAlias}.updated_at < ?`,
      params: [`${filters.dateFrom}T00:00:00`, `${filters.dateTo}T23:59:59`],
    }
  }
  if (filters.dateValue) {
    const opMap: Record<string, string> = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' }
    const op = opMap[filters.dateOp || 'eq']
    if (filters.dateOp === 'eq') {
      return {
        clause: ` AND ${tableAlias}.updated_at >= ? AND ${tableAlias}.updated_at < ?`,
        params: [`${filters.dateValue}T00:00:00`, `${filters.dateValue}T23:59:59`],
      }
    }
    return {
      clause: ` AND ${tableAlias}.updated_at ${op} ?`,
      params: [filters.dateOp === 'lt' || filters.dateOp === 'lte' ? `${filters.dateValue}T00:00:00` : `${filters.dateValue}T23:59:59`],
    }
  }
  return { clause: '', params: [] }
}
