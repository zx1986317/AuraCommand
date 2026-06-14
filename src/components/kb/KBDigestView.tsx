import React from 'react'
import { BookOpen, Play, Square, RotateCcw, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import type { DigestSummary, DigestItem } from '../../types'
import { EmptyState } from '../common/EmptyState'

interface KBDigestViewProps {
  summary: DigestSummary | null
  details: DigestItem[]
  selectedDigestCategory: string | null
  selectedDigestFileId: string | null
  progress: { current: number; total: number; fileName: string } | null
  onStartDigest: () => void
  onCancelDigest: () => void
  onClearDigest: () => void
  onSelectCategory: (category: string | null) => void
  onSelectFile: (fileId: string) => void
  getFileIcon: (fileType: string, size?: number) => React.ReactNode
}

const KBDigestView: React.FC<KBDigestViewProps> = ({
  summary,
  details,
  selectedDigestCategory,
  selectedDigestFileId,
  progress,
  onStartDigest,
  onCancelDigest,
  onClearDigest,
  onSelectCategory,
  onSelectFile,
  getFileIcon,
}) => {
  const isRunning = progress !== null

  const groupedByCategory = React.useMemo(() => {
    const map = new Map<string, DigestItem[]>()
    for (const item of details) {
      const cat = item.category || '未分类'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return map
  }, [details])

  const categories = summary?.categories || []

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-accent" />
            <h2 className="text-sm font-bold text-slate-800">知识要点概览</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {isRunning ? (
              <button
                onClick={onCancelDigest}
                className="flex items-center gap-1 px-2.5 py-1.5 text-2xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <Square size={12} /> 停止
              </button>
            ) : summary?.status === 'done' ? (
              <>
                <button
                  onClick={onStartDigest}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-2xs font-medium text-accent bg-accent/5 hover:bg-accent/10 rounded-lg transition-colors"
                >
                  <RotateCcw size={12} /> 重新学习
                </button>
                <button
                  onClick={onClearDigest}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-2xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  清除
                </button>
              </>
            ) : (
              <button
                onClick={onStartDigest}
                className="flex items-center gap-1 px-2.5 py-1.5 text-2xs font-medium text-accent bg-accent/5 hover:bg-accent/10 rounded-lg transition-colors"
              >
                <Play size={12} /> 开始学习
              </button>
            )}
          </div>
        </div>

        {isRunning && progress && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-2xs text-muted mb-1">
              <span>{progress.fileName}</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {summary?.status === 'done' && !isRunning && (
          <div className="flex items-center gap-2 mt-2 text-2xs text-muted">
            <span>已学习 {summary.digestedFiles}/{summary.totalFiles} 个文件</span>
            {summary.lastUpdated && (
              <span>· {new Date(summary.lastUpdated).toLocaleString('zh-CN')}</span>
            )}
          </div>
        )}

        {summary?.status === 'idle' && !isRunning && (
          <p className="text-2xs text-muted mt-2">尚未学习知识库文件，点击"开始学习"让 AI 提取关键信息</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {summary?.status === 'done' && !isRunning && categories.length > 0 && (
          <div className="p-3 space-y-2">
            {categories.map((cat) => {
              const isSelected = selectedDigestCategory === null || selectedDigestCategory === cat.name
              const catFiles = groupedByCategory.get(cat.name) || []

              return (
                <div key={cat.name} className="rounded-xl border border-slate-100 bg-white overflow-hidden">
                  <button
                    onClick={() => onSelectCategory(selectedDigestCategory === cat.name ? null : cat.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors ${
                      isSelected ? 'bg-accent/5 text-accent' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-2xs text-muted">{cat.count} 项</span>
                      {isSelected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>

                  {isSelected && catFiles.length > 0 && (
                    <div className="border-t border-slate-50 divide-y divide-slate-50">
                      {catFiles.map((item) => {
                        const isFileSelected = selectedDigestFileId === item.source_id
                        return (
                          <div key={item.id}>
                            <button
                              onClick={() => onSelectFile(item.source_id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-2xs text-left transition-colors ${
                                isFileSelected ? 'bg-slate-50 text-accent font-medium' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <FileText size={12} className="shrink-0 text-muted" />
                              <span className="truncate">{item.source_title}</span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {summary?.status === 'done' && !isRunning && categories.length === 0 && (
          <EmptyState
            icon={<BookOpen size={32} />}
            title="暂无知识要点"
            description={'点击下方「开始摘要」按钮，让 AI 提取知识库的关键要点'}
          />
        )}

        {summary?.status === 'idle' && !isRunning && (
          <EmptyState
            icon={<BookOpen size={48} />}
            title="知识库尚未学习"
            description="AI 摘要会从知识库文档中提取关键事实、概念和要点"
            action={
              <button
                onClick={onStartDigest}
                className="px-4 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-all"
              >
                <Play size={12} className="inline mr-1" />
                开始摘要
              </button>
            }
          />
        )}
      </div>
    </div>
  )
}

export default KBDigestView
