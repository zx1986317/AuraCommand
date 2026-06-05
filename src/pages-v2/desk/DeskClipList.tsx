import React from 'react';
import { Clipboard, Plus, CheckSquare, Loader2 } from 'lucide-react';

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
          {clipsLoading && <Loader2 size={12} className="animate-spin text-gray-300" />}
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
        {clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Clipboard size={28} className="text-gray-200 mb-2" />
            <p className="text-2xs text-gray-400 mb-2">暂无截图</p>
            <button
              onClick={() => setShowAddClipModal(true)}
              className="text-2xs text-purple-500 hover:text-purple-600 font-medium"
            >
              + 添加截图
            </button>
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