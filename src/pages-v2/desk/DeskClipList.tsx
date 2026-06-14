import React from 'react';
import { Clipboard, Plus, CheckSquare } from 'lucide-react';
import { Skeleton } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';

export interface DeskClipListProps {
  clips: any[];
  clipsLoading: boolean;
  clipSelectionMode: boolean;
  setClipSelectionMode: (v: boolean) => void;
  selectedClipIds: Set<string>;
  setSelectedClipIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  previewClip: any | null;
  setPreviewClip: (clip: any | null) => void;
  setShowAddClipModal: (v: boolean) => void;
}

const DeskClipList: React.FC<DeskClipListProps> = ({
  clips, clipsLoading,
  clipSelectionMode, setClipSelectionMode,
  selectedClipIds, setSelectedClipIds,
  previewClip, setPreviewClip,
  setShowAddClipModal,
}) => {
  return (
    <div className="w-56 flex-shrink-0 flex flex-col bg-white/40 backdrop-blur-sm border-x border-gray-100 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">{clips.length} 张截图</span>
        <div className="flex items-center gap-1">
          {clipsLoading && (
            <span className="inline-flex items-center gap-1 text-2xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              加载中
            </span>
          )}
          {clips.length > 0 && (
            <button
              onClick={() => setClipSelectionMode(!clipSelectionMode)}
              className={`p-1 rounded text-xs transition-colors ${clipSelectionMode ? 'text-purple-600 bg-purple-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="多选"
            >
              <CheckSquare size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {clips.length === 0 && !clipsLoading ? (
          <EmptyState
            compact
            icon={<Clipboard size={20} />}
            title="暂无截图"
            description="用 Ctrl+Shift+S 截屏或点击下方按钮添加"
            action={
              <button
                onClick={() => setShowAddClipModal(true)}
                className="text-2xs text-purple-500 hover:text-purple-600 font-bold"
              >
                + 添加截图
              </button>
            }
          />
        ) : clipsLoading && clips.length === 0 ? (
          <div className="grid grid-cols-2 gap-1.5" aria-label="截图加载中">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rect" width="100%" height={80} className="rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {clips.map(clip => (
              <div
                key={clip.id}
                onClick={() => {
                  if (clipSelectionMode) {
                    setSelectedClipIds(prev => {
                      const next = new Set(prev);
                      if (next.has(clip.id)) next.delete(clip.id);
                      else next.add(clip.id);
                      return next;
                    });
                  } else {
                    setPreviewClip(clip);
                  }
                }}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:shadow-sm ${
                  previewClip?.id === clip.id
                    ? 'border-purple-400 shadow-sm'
                    : clipSelectionMode && selectedClipIds.has(clip.id)
                      ? 'border-purple-500 shadow-sm'
                      : 'border-transparent hover:border-purple-200'
                }`}
              >
                {clip.image_data && (
                  <img src={clip.image_data} alt="" className="w-full h-20 object-cover" />
                )}
                {clipSelectionMode && selectedClipIds.has(clip.id) && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xs">✓</span>
                  </div>
                )}
                {clip.user_description && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1 py-0.5">
                    <p className="text-2xs text-white truncate">{clip.user_description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-2 pb-2">
        <button
          onClick={() => setShowAddClipModal(true)}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-500 text-white rounded-lg text-2xs font-medium hover:bg-purple-600 hover:shadow-md transition-all"
        >
          <Plus size={12} />
          添加截图
        </button>
      </div>
    </div>
  );
};

export default DeskClipList;