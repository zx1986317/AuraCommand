import React from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, Search, Trash2, Plus, Filter, Sparkles, Clock } from 'lucide-react'
import { logger } from '../utils/logger'
import { EmptyState } from '../components/common/EmptyState'

interface Memory {
  id: string
  category: string
  content: string
  source: string
  relevance: number
  created_at: string
  updated_at: string
  last_accessed: string
}

const CATEGORIES = ['偏好', '习惯', '个人信息', '工作', '其他', 'general']

const MemoryPage: React.FC = () => {
  const [memories, setMemories] = React.useState<Memory[]>([])
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [newMemory, setNewMemory] = React.useState({ category: '其他', content: '', relevance: 5 })

  const loadMemories = React.useCallback(async () => {
    if (!window.ipcRenderer) return
    try {
      let result: Memory[]
      if (searchQuery.trim()) {
        result = await window.ipcRenderer.invoke('search-ai-memories', { query: searchQuery.trim() })
      } else {
        result = await window.ipcRenderer.invoke('get-ai-memories')
      }
      setMemories(result || [])
    } catch (err) {
      logger.error('Failed to load memories', err)
    }
  }, [searchQuery])

  React.useEffect(() => { loadMemories() }, [loadMemories])

  const filteredMemories = React.useMemo(() => {
    let items = memories
    if (selectedCategory) {
      items = items.filter(m => m.category === selectedCategory)
    }
    return items
  }, [memories, selectedCategory])

  const categoryCounts = React.useMemo(() => {
    const map = new Map<string, number>()
    memories.forEach(m => map.set(m.category, (map.get(m.category) || 0) + 1))
    return map
  }, [memories])

  const handleDelete = async (id: string) => {
    if (!window.ipcRenderer) return
    try {
      await window.ipcRenderer.invoke('delete-ai-memory', { id })
      setMemories(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      logger.error('Failed to delete memory', err)
    }
  }

  const handleAdd = async () => {
    if (!window.ipcRenderer || !newMemory.content.trim()) return
    try {
      await window.ipcRenderer.invoke('save-ai-memory', {
        category: newMemory.category,
        content: newMemory.content.trim(),
        relevance: newMemory.relevance,
      })
      setShowAddModal(false)
      setNewMemory({ category: '其他', content: '', relevance: 5 })
      await loadMemories()
    } catch (err) {
      logger.error('Failed to save memory', err)
    }
  }

  const relevanceColor = (r: number) => {
    if (r >= 8) return 'text-emerald-600'
    if (r >= 5) return 'text-amber-600'
    return 'text-slate-400'
  }

  const tierBadge = (r: number) => {
    if (r >= 9) return <span className="px-1 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">可引用</span>
    if (r >= 5) return <span className="px-1 py-0.5 rounded text-2xs font-bold bg-amber-100 text-amber-700 border border-amber-200">仅背景</span>
    return <span className="px-1 py-0.5 rounded text-2xs font-bold bg-slate-100 text-slate-500 border border-slate-200">隐藏</span>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex gap-3"
    >
      <div className="w-52 flex-shrink-0 flex flex-col gap-3">
        <div className="bg-white/40 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit size={16} className="text-accent" />
            <span className="text-2xs font-bold text-muted uppercase tracking-wider">记忆管理</span>
          </div>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-2xs transition-all ${
              !selectedCategory ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-slate-50'
            }`}
          >
            <span>全部</span>
            <span className="text-xs text-muted">{memories.length}</span>
          </button>
          {CATEGORIES.filter(c => categoryCounts.has(c)).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-2xs transition-all ${
                selectedCategory === cat ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-slate-50'
              }`}
            >
              <span>{cat}</span>
              <span className="text-xs text-muted">{categoryCounts.get(cat)}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white rounded-xl text-xs font-medium hover:bg-accent/90 transition-all"
        >
          <Plus size={14} /> 添加记忆
        </button>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Search size={14} className="text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索记忆..."
              className="flex-1 text-xs outline-none bg-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-muted hover:text-foreground">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filteredMemories.length === 0 ? (
            <EmptyState
              icon={<BrainCircuit size={32} />}
              title="暂无记忆"
              description="对话中会自动提取关键事实，也可以在此手动添加。"
              action={
                <button className="mt-2 px-4 py-2 rounded-xl bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 transition-all">
                  + 手动添加记忆
                </button>
              }
            />
          ) : (
            <div className="space-y-2">
              {filteredMemories.map(memory => (
                <div
                  key={memory.id}
                  className="group bg-white border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-1.5 py-0.5 rounded-md bg-accent/10 text-xs font-bold text-accent">
                          {memory.category}
                        </span>
                        {memory.source === 'auto' && (
                          <span className="text-amber-400" title="自动提取"><Sparkles size={10} /></span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{memory.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-2xs text-muted">
                        <span className={`font-medium ${relevanceColor(memory.relevance)}`}>
                          关联度 {memory.relevance}/10
                        </span>
                        {tierBadge(memory.relevance)}
                        <span className="flex items-center gap-1">
                          <Clock size={9} />
                          {new Date(memory.updated_at || memory.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(memory.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted hover:text-red-500 transition-all shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-foreground mb-4">添加记忆</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-2xs text-muted mb-1">分类</label>
                <select
                  value={newMemory.category}
                  onChange={e => setNewMemory(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-2xs text-muted mb-1">内容</label>
                <textarea
                  value={newMemory.content}
                  onChange={e => setNewMemory(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="输入记忆内容..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-2xs text-muted mb-1">关联度 (1-10)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={newMemory.relevance}
                  onChange={e => setNewMemory(prev => ({ ...prev, relevance: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <span className="text-xs text-muted">{newMemory.relevance}/10</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs text-muted hover:bg-slate-50 rounded-lg">取消</button>
              <button
                onClick={handleAdd}
                disabled={!newMemory.content.trim()}
                className="px-4 py-2 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-30"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default MemoryPage
