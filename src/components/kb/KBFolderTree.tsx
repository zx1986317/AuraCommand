import React, { useState } from 'react';
import { FolderOpen, FolderTree, ChevronRight, ChevronDown, Plus, MoreVertical, Edit3, Trash2, Link } from 'lucide-react';

interface KBFolder {
  id: string;
  name: string;
  parent_id?: string;
  sort_order: number;
}

interface KBFolderTreeProps {
  folders: KBFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => Promise<any>;
  onRenameFolder: (id: string, name: string) => void | Promise<void>;
  onDeleteFolder: (id: string) => void | Promise<void>;
}

const KBFolderTree: React.FC<KBFolderTreeProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  // 构建树形结构
  const buildTree = (parentId?: string): KBFolder[] => {
    return folders
      .filter(f => f.parent_id === parentId || (!f.parent_id && !parentId))
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await onRenameFolder(id, editName.trim());
    setEditingFolder(null);
    setEditName('');
  };

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId });
  };

  const hasChildren = (folderId: string) => folders.some(f => f.parent_id === folderId);

  const renderFolderNode = (folderList: KBFolder[], depth: number = 0): React.ReactNode => {
    return folderList.map(folder => {
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolderId === folder.id;
      const children = buildTree(folder.id);
      const childCount = children.length;
      const isEditing = editingFolder === folder.id;

      return (
        <div key={folder.id}>
          <div
            onContextMenu={(e) => handleContextMenu(e, folder.id)}
            className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
              isSelected ? 'bg-accent/10 text-accent font-bold' : 'hover:bg-white/60 text-muted'
            }`}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            <button
              onClick={() => toggleFolder(folder.id)}
              className="w-4 h-4 flex items-center justify-center"
            >
              {childCount > 0 ? (
                isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
              ) : (
                <span className="w-3" />
              )}
            </button>
            <button
              onClick={() => onSelectFolder(isSelected ? null : folder.id)}
              className="flex-1 flex items-center gap-1.5 min-w-0"
            >
              <FolderOpen size={12} className={isSelected ? 'text-accent' : 'text-muted'} />
              {isEditing ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRename(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(folder.id);
                    if (e.key === 'Escape') setEditingFolder(null);
                  }}
                  className="w-20 bg-white border border-accent/30 rounded px-1 py-0.5 text-xs outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate">{folder.name}</span>
              )}
            </button>
          </div>
          {isExpanded && childCount > 0 && renderFolderNode(children, depth + 1)}
        </div>
      );
    });
  };

  const rootFolders = buildTree();

  return (
    <div className="xl:col-span-1 order-2 xl:order-1">
      <div className="bg-white/50 border border-teal-900/10 rounded-3xl shadow-glass p-4 h-full max-h-[700px] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted flex items-center gap-1.5">
            <FolderTree size={12} className="text-accent" />
            文件夹
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewFolderInput(true)}
              className="p-1 rounded-lg hover:bg-accent/10 text-accent transition-colors"
              title="新建文件夹"
            >
              <Plus size={12} />
            </button>
            {selectedFolderId && (
              <button
                onClick={() => onSelectFolder(null)}
                className="text-2xs text-accent hover:underline"
              >
                全部
              </button>
            )}
          </div>
        </div>

        {showNewFolderInput && (
          <div className="flex items-center gap-1 mb-2 px-2">
            <FolderOpen size={12} className="text-muted" />
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => {
                if (newFolderName.trim()) handleCreateFolder();
                else setShowNewFolderInput(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowNewFolderInput(false);
              }}
              placeholder="文件夹名称"
              className="flex-1 bg-white border border-teal-900/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-accent/50"
            />
          </div>
        )}

        {rootFolders.length === 0 ? (
          <div className="text-center py-6 text-muted">
            <FolderOpen size={16} className="mx-auto mb-2" />
            <p className="text-2xs">暂无文件夹</p>
            <p className="text-2xs mt-1">点击 + 创建</p>
          </div>
        ) : renderFolderNode(rootFolders)}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[150]"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-[160] bg-white border border-teal-900/10 rounded-xl shadow-lg py-1 min-w-[120px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                const folder = folders.find(f => f.id === contextMenu.folderId);
                if (folder) {
                  setEditingFolder(folder.id);
                  setEditName(folder.name);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted hover:bg-teal-900/5 transition-colors"
            >
              <Edit3 size={12} />
              重命名
            </button>
            <button
              onClick={() => {
                onDeleteFolder(contextMenu.folderId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} />
              删除
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default KBFolderTree;