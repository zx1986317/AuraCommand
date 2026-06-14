import React from 'react';
import {
  Database, FolderOpen, FolderPlus, FolderMinus, Folder,
  MoreVertical, Trash2, Plus, ChevronDown, Tag, BookOpen, BrainCircuit
} from 'lucide-react';

interface KBFolder {
  id: string;
  name: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
}

interface KBNavigationPanelProps {
  kbFolders: KBFolder[];
  files: any[];
  selectedVirtualFolder: string | null | 'uncategorized';
  selectedTag: string | null;
  selectedType: string | null;
  fileTags: string[];
  fileTypeOptions: [string, number][];
  getFileIcon: (fileType: string, size?: number) => React.ReactNode;
  onSelectVirtualFolder: (folder: string | null | 'uncategorized') => void;
  onSelectTag: (tag: string | null) => void;
  onSelectType: (type: string | null) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  showDigestView: boolean;
  digestStatus: 'idle' | 'running' | 'done';
  digestCount: number;
  digestTotal: number;
  onToggleDigestView: () => void;
}

const KBNavigationPanel: React.FC<KBNavigationPanelProps> = ({
  kbFolders, files, selectedVirtualFolder, selectedTag, selectedType,
  fileTags, fileTypeOptions, getFileIcon,
  onSelectVirtualFolder, onSelectTag, onSelectType,
  onCreateFolder, onDeleteFolder,
  showDigestView, digestStatus, digestCount, digestTotal, onToggleDigestView,
}) => {
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [showFolderDialog, setShowFolderDialog] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [folderMenuId, setFolderMenuId] = React.useState<string | null>(null);
  const [parentFolderId, setParentFolderId] = React.useState<string | null>(null);

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };

  const buildFolderTree = () => {
    const folderMap = new Map<string, KBFolder & { children: KBFolder[] }>();
    kbFolders.forEach(f => folderMap.set(f.id, { ...f, children: [] }));
    const roots: KBFolder[] = [];
    kbFolders.forEach(f => {
      if (f.parent_id && folderMap.has(f.parent_id)) {
        folderMap.get(f.parent_id)!.children.push(f);
      } else {
        roots.push(f);
      }
    });
    return roots;
  };

  const renderFolderItem = (folder: KBFolder, depth: number = 0) => {
    const folderInfo = folderMap.get(folder.id);
    const hasChildren = folderInfo && folderInfo.children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedVirtualFolder === folder.id;
    const fileCount = files.filter(f => f.folder_id === folder.id).length;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer group transition-all ${
            isSelected ? 'bg-accent/10 text-accent' : 'hover:bg-teal-900/5 text-foreground'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => onSelectVirtualFolder(folder.id)}
        >
          {hasChildren && (
            <button onClick={(e) => { e.stopPropagation(); toggleFolderExpand(folder.id); }} className="p-0.5 rounded hover:bg-teal-900/10 text-muted transition-all">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronDown size={12} className="rotate-[-90deg]" />}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}
          <Folder size={14} className={isSelected ? 'text-accent' : 'text-muted'} />
          <span className="text-2xs font-medium flex-1 truncate">{folder.name}</span>
          <span className="text-xs text-muted">{fileCount}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setFolderMenuId(folder.id); }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-teal-900/10 text-muted transition-all"
          >
            <MoreVertical size={10} />
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {folderInfo!.children.map(child => renderFolderItem(child, depth + 1))}
          </div>
        )}
        {folderMenuId === folder.id && (
          <div className="fixed inset-0 z-50" onClick={() => setFolderMenuId(null)}>
            <div
              className="absolute bg-white border border-teal-900/10 rounded-xl shadow-lg py-1 w-36"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => { setParentFolderId(folder.id); setShowFolderDialog(true); setFolderMenuId(null); }}
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-teal-900/5 flex items-center gap-2"
              >
                <FolderPlus size={12} className="text-accent" /> 新建子文件夹
              </button>
              <button
                onClick={() => { onDeleteFolder(folder.id); setFolderMenuId(null); }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={12} /> 删除文件夹
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const roots = buildFolderTree();
  const folderMap = new Map<string, KBFolder & { children: KBFolder[] }>();
  kbFolders.forEach(f => folderMap.set(f.id, { ...f, children: [] }));
  kbFolders.forEach(f => {
    if (f.parent_id && folderMap.has(f.parent_id)) {
      folderMap.get(f.parent_id)!.children.push(f);
    }
  });

  return (
    <div className="w-52 flex-shrink-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
      {/* 虚拟文件夹 */}
      <div className="bg-white/40 border border-teal-900/10 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-bold text-muted uppercase tracking-wider">文件夹</span>
          <button
            onClick={() => { setParentFolderId(null); setShowFolderDialog(true); }}
            className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent transition-all"
          >
            <Plus size={12} />
          </button>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
            selectedVirtualFolder === null && selectedVirtualFolder !== 'uncategorized' ? 'bg-accent/10 text-accent' : 'hover:bg-teal-900/5 text-foreground'
          }`}
          onClick={() => onSelectVirtualFolder(null)}
        >
          <FolderOpen size={14} className={selectedVirtualFolder === null && selectedVirtualFolder !== 'uncategorized' ? 'text-accent' : 'text-muted'} />
          <span className="text-2xs font-medium">全部文件</span>
          <span className="text-xs text-muted ml-auto">{files.length}</span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
            selectedVirtualFolder === 'uncategorized' ? 'bg-accent/10 text-accent' : 'hover:bg-teal-900/5 text-foreground'
          }`}
          onClick={() => onSelectVirtualFolder('uncategorized')}
        >
          <FolderMinus size={14} className={selectedVirtualFolder === 'uncategorized' ? 'text-accent' : 'text-muted'} />
          <span className="text-2xs font-medium">未分类</span>
          <span className="text-xs text-muted ml-auto">{files.filter(f => !f.folder_id).length}</span>
        </div>
        <div className="mt-1 space-y-0.5">
          {roots.map(folder => renderFolderItem(folder))}
        </div>
      </div>

      {/* 标签筛选 */}
      {fileTags.length > 0 && (
        <div className="bg-white/40 border border-teal-900/10 rounded-xl p-3">
          <span className="text-2xs font-bold text-muted uppercase tracking-wider mb-2 block">标签</span>
          <div className="flex flex-wrap gap-1">
            {fileTags.map(tag => (
              <button
                key={tag}
                onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-full text-2xs border transition-all ${
                  selectedTag === tag ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white border-teal-900/10 text-muted hover:bg-teal-900/5'
                }`}
              >
                <Tag size={9} className="inline mr-0.5" />{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 类型筛选 */}
      {fileTypeOptions.length > 0 && (
        <div className="bg-white/40 border border-teal-900/10 rounded-xl p-3">
          <span className="text-2xs font-bold text-muted uppercase tracking-wider mb-2 block">类型</span>
          <div className="flex flex-wrap gap-1">
            {fileTypeOptions.map(([ext, count]) => (
              <button
                key={ext}
                onClick={() => onSelectType(selectedType === ext ? null : ext)}
                className={`px-2 py-0.5 rounded text-2xs border transition-all ${
                  selectedType === ext ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white border-teal-900/10 text-muted hover:bg-teal-900/5'
                }`}
              >
                {ext || '未知'} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 知识要点 */}
      <div className="bg-white/40 border border-teal-900/10 rounded-xl p-3">
        <button
          onClick={onToggleDigestView}
          className={`w-full flex items-center gap-2 transition-all ${
            showDigestView ? 'text-accent' : 'text-foreground hover:text-accent'
          }`}
        >
          <BrainCircuit size={14} className={showDigestView ? 'text-accent' : 'text-muted'} />
          <span className="text-2xs font-medium">知识要点</span>
          {digestStatus === 'running' && (
            <span className="ml-auto text-2xs text-amber-500 animate-pulse">学习中</span>
          )}
          {digestStatus === 'done' && (
            <span className="ml-auto text-2xs text-muted">{digestCount}/{digestTotal}</span>
          )}
          {digestStatus === 'idle' && (
            <span className="ml-auto text-2xs text-muted">未学习</span>
          )}
        </button>
      </div>

      {/* 新建文件夹对话框 */}
      {showFolderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-72">
            <p className="text-sm font-bold text-foreground mb-3">
              {parentFolderId ? '新建子文件夹' : '新建文件夹'}
            </p>
            <input
              type="text" value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="输入文件夹名称..."
              className="w-full px-3 py-2 bg-teal-900/5 border border-teal-900/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20"
              onKeyDown={e => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  onCreateFolder(newFolderName.trim(), parentFolderId || undefined);
                  setNewFolderName('');
                  setShowFolderDialog(false);
                  setParentFolderId(null);
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setShowFolderDialog(false); setParentFolderId(null); }} className="flex-1 px-3 py-1.5 border border-teal-900/10 rounded-lg text-xs font-medium text-foreground hover:bg-teal-900/5">
                取消
              </button>
              <button
                onClick={() => { onCreateFolder(newFolderName.trim(), parentFolderId || undefined); setNewFolderName(''); setShowFolderDialog(false); setParentFolderId(null); }}
                disabled={!newFolderName.trim()}
                className="flex-1 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KBNavigationPanel;
