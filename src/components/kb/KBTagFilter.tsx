import React from 'react';
import { Tag } from 'lucide-react';

interface KBTagFilterProps {
  allFileTags: string[];
  selectedTagFilter: string | null;
  onSetSelectedTagFilter: (tag: string | null) => void;
}

const KBTagFilter: React.FC<KBTagFilterProps> = ({
  allFileTags, selectedTagFilter, onSetSelectedTagFilter,
}) => {
  if (allFileTags.length === 0) return null;

  return (
    <div className="mb-6 bg-white/50 border border-teal-900/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag size={14} className="text-accent" />
        <span className="text-2xs font-black uppercase tracking-[0.15em] text-muted">标签筛选</span>
        {selectedTagFilter && (
          <button
            onClick={() => onSetSelectedTagFilter(null)}
            className="text-2xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold hover:bg-accent/20 transition-colors"
          >
            清除筛选
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allFileTags.map(tag => (
          <button
            key={tag}
            onClick={() => onSetSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
            className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-colors ${
              selectedTagFilter === tag
                ? 'bg-accent text-white'
                : 'bg-white/70 text-muted border border-teal-900/10 hover:border-accent/30 hover:text-accent'
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default KBTagFilter;