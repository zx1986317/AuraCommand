import React from 'react';
import { Search, Upload, PanelRightClose, PanelRightOpen, CheckSquare, Clipboard } from 'lucide-react';

interface KBSearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onImportFiles: () => void;
  copilotCollapsed: boolean;
  onCopilotToggle: () => void;
  isSelectMode?: boolean;
  onToggleSelectMode?: () => void;
  selectedCount?: number;
  onImportFromClipboard?: () => void;
}

const KBSearchBar: React.FC<KBSearchBarProps> = ({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  viewMode,
  onViewModeChange,
  onImportFiles,
  copilotCollapsed,
  onCopilotToggle,
  isSelectMode = false,
  onToggleSelectMode,
  selectedCount = 0,
  onImportFromClipboard,
}) => {
  return (
    <div className="flex items-center gap-3 mb-4">
      {isSelectMode ? (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-bold text-accent">已选择 {selectedCount} 项</span>
          <button
            onClick={onToggleSelectMode}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            退出多选
          </button>
        </div>
      ) : (
        <form onSubmit={onSearchSubmit} className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text" value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="搜索知识库..."
            className="w-full pl-9 pr-4 py-2 bg-white/60 border border-teal-900/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </form>
      )}
      <div className="flex items-center gap-1 bg-white/40 border border-teal-900/10 rounded-xl p-0.5">
        <button onClick={() => onViewModeChange('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
        <button onClick={() => onViewModeChange('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
      {!isSelectMode && (
        <button
          onClick={onToggleSelectMode}
          className="p-2 border border-teal-900/10 bg-white/60 rounded-xl hover:bg-teal-900/5 transition-all"
          title="多选模式"
        >
          <CheckSquare size={14} className="text-muted" />
        </button>
      )}
      <button onClick={onImportFiles} className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-all">
        <Upload size={14} /> 导入
      </button>
      {onImportFromClipboard && (
        <button
          onClick={onImportFromClipboard}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-all"
        >
          <Clipboard size={14} /> 从剪贴板
        </button>
      )}
      <button
        onClick={onCopilotToggle}
        className="p-2 border border-teal-900/10 bg-white/60 rounded-xl hover:bg-teal-900/5 transition-all"
        title={copilotCollapsed ? '展开详情' : '收起详情'}
      >
        {copilotCollapsed ? <PanelRightOpen size={14} className="text-muted" /> : <PanelRightClose size={14} className="text-muted" />}
      </button>
    </div>
  );
};

export default KBSearchBar;
