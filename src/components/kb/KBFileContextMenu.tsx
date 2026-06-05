import React from 'react';
import { Eye, FolderMinus, Folder } from 'lucide-react';

interface KBFileContextMenuProps {
  contextMenu: { fileId: string; x: number; y: number } | null;
  kbFolders: { id: string; name: string }[];
  onPreview: (fileId: string) => void;
  onMoveToFolder: (fileId: string, folderId: string) => void;
  onRemoveFromFolder: (fileId: string) => void;
  onClose: () => void;
}

const KBFileContextMenu: React.FC<KBFileContextMenuProps> = ({
  contextMenu,
  kbFolders,
  onPreview,
  onMoveToFolder,
  onRemoveFromFolder,
  onClose,
}) => {
  if (!contextMenu) return null;

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        className="fixed z-50 bg-white border border-teal-900/10 rounded-xl shadow-lg py-1.5 w-48"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        <button
          onClick={() => { onPreview(contextMenu.fileId); onClose(); }}
          className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-teal-900/5 flex items-center gap-2"
        >
          <Eye size={12} className="text-accent" /> 预览文件
        </button>
        <div className="border-t border-teal-900/10 my-1" />
        <div className="px-3 py-1 text-2xs text-muted font-medium border-b border-teal-900/10 mb-1">移动到文件夹</div>
        {kbFolders.map(folder => (
          <button
            key={folder.id}
            onClick={() => { onMoveToFolder(contextMenu.fileId, folder.id); onClose(); }}
            className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-teal-900/5 flex items-center gap-2"
          >
            <Folder size={12} className="text-accent" /> {folder.name}
          </button>
        ))}
        {kbFolders.length === 0 && (
          <div className="px-3 py-1.5 text-2xs text-muted">暂无文件夹</div>
        )}
        <div className="border-t border-teal-900/10 mt-1 pt-1">
          <button
            onClick={() => { onRemoveFromFolder(contextMenu.fileId); onClose(); }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
          >
            <FolderMinus size={12} /> 取消归类
          </button>
        </div>
      </div>
    </>
  );
};

export default KBFileContextMenu;
