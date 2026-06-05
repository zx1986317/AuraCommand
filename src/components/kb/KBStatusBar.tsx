import React from 'react';
import { Cpu } from 'lucide-react';

interface KBStatusBarProps {
  filteredTotal: number;
  indexedFileCount: number;
  activeIndexingCount: number;
  selectedTag: string | null;
  selectedPlatformTag: string | null;
  selectedType: string | null;
  onClearTag: () => void;
  onClearPlatformTag: () => void;
  onClearType: () => void;
  onClearAll: () => void;
}

const KBStatusBar: React.FC<KBStatusBarProps> = ({
  filteredTotal,
  indexedFileCount,
  activeIndexingCount,
  selectedTag,
  selectedPlatformTag,
  selectedType,
  onClearTag,
  onClearPlatformTag,
  onClearType,
  onClearAll,
}) => {
  const hasActiveFilters = !!selectedTag || !!selectedPlatformTag || !!selectedType;

  return (
    <div className="flex items-center gap-3 mb-3 text-2xs text-muted">
      <span>{filteredTotal} 个文件</span>
      <span>·</span>
      <span>{indexedFileCount} 已索引</span>
      {activeIndexingCount > 0 && (
        <span className="text-accent flex items-center gap-1">
          <Cpu size={10} className="animate-spin" /> 索引中 {activeIndexingCount}
        </span>
      )}
      {selectedTag && (
        <button onClick={onClearTag} className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-2xs hover:bg-accent/20 transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> {selectedTag} ✕
        </button>
      )}
      {selectedPlatformTag && (
        <button onClick={onClearPlatformTag} className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-2xs hover:bg-accent/20 transition-colors">
          来源: {selectedPlatformTag} ✕
        </button>
      )}
      {selectedType && (
        <button onClick={onClearType} className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-2xs hover:bg-accent/20 transition-colors">
          {selectedType} ✕
        </button>
      )}
      {hasActiveFilters && (
        <button onClick={onClearAll} className="text-2xs text-muted hover:text-accent transition-colors">
          清空筛选
        </button>
      )}
    </div>
  );
};

export default KBStatusBar;
