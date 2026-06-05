import React, { useState } from 'react';
import {
  UploadCloud, FolderOpen, Clock3, Filter, Tag, X, Plus,
  Sparkles, ExternalLink, Trash2, ArrowUpDown, Layers3,
  Link2, Unlink, RefreshCw, Settings2
} from 'lucide-react';
import type { FileMetadata, KBFolder } from '../../types';

interface KBFileListProps {
  files: FileMetadata[];
  visibleFiles: FileMetadata[];
  highlightedFileIds?: string[];
  fileTypeStats: [string, number][];
  kbSort: 'newest' | 'largest';
  isDragging: boolean;
  folders: KBFolder[];
  selectedFolderId: string;
  onSetSort: (sort: 'newest' | 'largest') => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDeleteFile: (id: string, path: string) => void;
  onOpenPDF: (filePath: string, fileName: string) => void;
  onGenerateSummary: (fileId: string, fileName: string, textContent: string) => void;
  onSetSelectedTagFilter: (tag: string | null) => void;
  onUpdateFileTags: (fileId: string, tags: string[]) => void;
  onRelinkFile: (fileId: string, newPath?: string) => void | Promise<void>;
  onShowImportDialog: (filePaths: string[]) => void;
}

const KBFileList: React.FC<KBFileListProps> = ({
  files, visibleFiles, highlightedFileIds = [], fileTypeStats, kbSort, isDragging, folders, selectedFolderId,
  onSetSort, onDragOver, onDragLeave, onDrop,
  onDeleteFile, onOpenPDF, onGenerateSummary,
  onSetSelectedTagFilter, onUpdateFileTags, onRelinkFile, onShowImportDialog,
}) => {
  const [editingTagFileId, setEditingTagFileId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const highlightedFileIdSet = new Set(highlightedFileIds);
  const orderedVisibleFiles = [...visibleFiles].sort((a, b) => {
    const aHighlighted = highlightedFileIdSet.has(a.id);
    const bHighlighted = highlightedFileIdSet.has(b.id);
    if (aHighlighted && !bHighlighted) return -1;
    if (!aHighlighted && bHighlighted) return 1;
    return 0;
  });

  const getStorageModeIcon = (file: FileMetadata) => {
    if (file.storage_mode === 'reference') {
      if (file.link_status === 'deleted' || file.link_status === 'moved') {
        return <Unlink size={12} className="text-red-400" />;
      }
      return <Link2 size={12} className="text-blue-400" />;
    }
    return null;
  };

  const getLinkStatusBadge = (file: FileMetadata) => {
    if (file.storage_mode === 'reference' && (file.link_status === 'deleted' || file.link_status === 'moved')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-bold bg-red-50 text-red-500 border border-red-100">
          <Unlink size={8} />
          {file.link_status === 'deleted' ? '已删除' : '已移动'}
        </span>
      );
    }
    return null;
  };

  const handleAddTag = (fileId: string) => {
    if (!tagInput.trim()) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    let currentTags: string[] = [];
    try {
      currentTags = typeof file.tags === 'string' ? JSON.parse(file.tags || '[]') : (file.tags || []);
    } catch {}
    if (!currentTags.includes(tagInput.trim())) {
      currentTags.push(tagInput.trim());
      onUpdateFileTags(fileId, currentTags);
    }
    setTagInput('');
  };

  const handleRemoveTag = (fileId: string, tag: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    let currentTags: string[] = [];
    try {
      currentTags = typeof file.tags === 'string' ? JSON.parse(file.tags || '[]') : (file.tags || []);
    } catch {}
    onUpdateFileTags(fileId, currentTags.filter(t => t !== tag));
  };

  return (
    <div className="xl:col-span-2 flex flex-col min-h-0 order-1 xl:order-2">
      {/* File type distribution + sort toggle */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-2xs text-muted font-bold">
          <Layers3 size={14} className="text-accent" />
          <span>文件类型分布</span>
          <div className="flex gap-2">
            {fileTypeStats.map(([type, count]) => (
              <span key={type} className="px-2 py-1 rounded-lg bg-white/80 border border-teal-900/10 text-2xs">
                {type} {count}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => onSetSort(kbSort === 'newest' ? 'largest' : 'newest')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/80 border border-teal-900/10 hover:border-accent/30 transition-colors cursor-pointer"
        >
          <ArrowUpDown size={13} className="text-accent" />
          {kbSort === 'newest' ? '按最近更新' : '按文件大小'}
        </button>
      </div>

      {/* Drag & drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e: React.DragEvent) => {
          // 收集拖拽的文件路径，转发给导入弹窗
          e.preventDefault();
          e.stopPropagation();
          const rawPaths = e.dataTransfer.getData('text/plain');
          if (rawPaths) {
            const paths = rawPaths.split('\n').filter(p => p && p.trim());
            if (paths.length > 0) {
              onShowImportDialog(paths);
              return;
            }
          }
          // Fallback to native drop handling
          onDrop(e);
        }}
        className={`mb-6 border-2 border-dashed rounded-3xl p-8 flex items-center justify-between gap-6 transition-all cursor-pointer bg-white/30 relative overflow-hidden ${isDragging ? 'border-accent bg-accent/10 scale-[0.99]' : 'border-teal-900/10 hover:border-accent/30 hover:bg-accent/5'}`}
      >
        <div className="relative z-10">
          <p className="text-lg font-bold mb-1">拖拽文件到这里开始构建知识库</p>
          <p className="text-xs text-muted font-medium">支持 PDF / DOCX / MD / PNG，导入后自动解析并向量化。</p>
        </div>
        <div className="relative z-10 w-14 h-14 rounded-2xl bg-white border border-teal-900/10 flex items-center justify-center text-accent shadow-sm">
          <UploadCloud size={26} />
        </div>
      </div>

      {/* File list */}
      <div className="bg-white/50 border border-teal-900/10 rounded-3xl shadow-glass p-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted">资产文件</h3>
          <div className="flex items-center gap-2 text-2xs font-bold text-accent">
            <Filter size={12} />
            <span>{visibleFiles.length} / {files.length} 项</span>
          </div>
        </div>
        {visibleFiles.length === 0 && (
          <div className="h-48 rounded-2xl border border-dashed border-teal-900/10 flex flex-col items-center justify-center text-muted">
            <FolderOpen size={20} className="mb-2" />
            <p className="text-xs font-bold">当前筛选下没有文件</p>
          </div>
        )}
        <div className="space-y-3">
          {orderedVisibleFiles.map((file) => {
            let fileTags: string[] = [];
            try {
              fileTags = typeof file.tags === 'string' ? JSON.parse(file.tags || '[]') : (file.tags || []);
            } catch {}
            const isEditingTags = editingTagFileId === file.id;
            const isHighlighted = highlightedFileIdSet.has(file.id);
            return (
              <div
                key={file.id}
                className={`p-4 rounded-2xl transition-all group/file ${
                  isHighlighted
                    ? 'bg-accent/5 border border-accent/30 hover:bg-accent/10'
                    : 'bg-white/80 border border-teal-900/5 hover:border-accent/30'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-foreground mb-1 cursor-pointer hover:text-accent transition-colors" onClick={() => {
                      const ext = (file.file_type || '').toLowerCase();
                      if (ext === '.pdf') onOpenPDF(file.file_path, file.file_name);
                      else { window.ipcRenderer.invoke('open-path', { path: file.file_path }).catch(() => {}); }
                    }}>{file.file_name}</p>
                    <div className="text-2xs text-muted font-medium flex items-center gap-2 flex-wrap">
                      <Clock3 size={10} />
                      <span>{(Number(file.file_size || 0) / 1024).toFixed(0)} KB</span>
                      <span className="text-teal-900/20">|</span>
                      <span>{String(file.file_type || '').replace('.', '').toUpperCase() || 'OTHER'}</span>
                      {isHighlighted && (
                        <>
                          <span className="text-teal-900/20">|</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                            <Sparkles size={9} />
                            示例资料
                          </span>
                        </>
                      )}
                      <span className="text-teal-900/20">|</span>
                      <span className="flex items-center gap-1">
                        {getStorageModeIcon(file)}
                        {file.storage_mode === 'reference' ? '引用' : '本地'}
                      </span>
                      {getLinkStatusBadge(file)}
                    </div>
                    {file.summary && (
                      <p className="text-2xs text-muted/70 mt-1.5 leading-relaxed line-clamp-2">
                        {file.summary}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {fileTags.map((tag: string) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-bold bg-accent/5 text-accent/70 border border-accent/10 cursor-pointer hover:bg-accent/10 transition-colors"
                          onClick={() => onSetSelectedTagFilter(tag)}
                        >
                          <Tag size={8} />{tag}
                          {isEditingTags && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveTag(file.id, tag); }}
                              className="ml-0.5 text-accent/40 hover:text-red-500"
                            >
                              <X size={8} />
                            </button>
                          )}
                        </span>
                      ))}
                      {!isEditingTags && fileTags.length === 0 && Number(file.is_indexed) === 1 && (
                        <button
                          onClick={() => setEditingTagFileId(file.id)}
                          className="px-1.5 py-0.5 rounded-md text-xs font-bold text-muted/40 border border-dashed border-teal-900/10 hover:border-accent/30 hover:text-accent/60 transition-colors"
                        >
                          + 标签
                        </button>
                      )}
                      {isEditingTags && (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddTag(file.id);
                              if (e.key === 'Escape') { setEditingTagFileId(null); setTagInput(''); }
                            }}
                            placeholder="添加标签"
                            className="w-16 px-1.5 py-0.5 rounded-md text-xs bg-white/80 border border-teal-900/10 outline-none focus:border-accent/30"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddTag(file.id)}
                            className="text-accent/50 hover:text-accent"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                    {!isEditingTags && fileTags.length > 0 && (
                      <button
                        onClick={() => setEditingTagFileId(file.id)}
                        className="p-2 rounded-lg hover:bg-accent/10 text-muted hover:text-accent transition-colors"
                        title="编辑标签"
                      >
                        <Tag size={14} />
                      </button>
                    )}
                    {Number(file.is_indexed) === 1 && !file.summary && (
                      <button
                        onClick={() => onGenerateSummary(file.id, file.file_name, '')}
                        className="p-2 rounded-lg hover:bg-accent/10 text-muted hover:text-accent transition-colors"
                        title="AI 生成摘要"
                      >
                        <Sparkles size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => { window.ipcRenderer.invoke('open-path', { path: file.file_path }).catch(() => {}); }}
                      className="p-2 rounded-lg hover:bg-accent/10 text-muted hover:text-accent transition-colors"
                      title="预览文件"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={() => { window.ipcRenderer.invoke('show-item-in-folder', { path: file.file_path }).catch(() => {}); }}
                      className="p-2 rounded-lg hover:bg-accent/10 text-muted hover:text-accent transition-colors"
                      title="打开所在目录"
                    >
                      <FolderOpen size={14} />
                    </button>
                    {file.storage_mode === 'reference' && (file.link_status === 'deleted' || file.link_status === 'moved') && (
                      <button
                        onClick={() => onRelinkFile(file.id)}
                        className="p-2 rounded-lg hover:bg-amber-500/10 text-muted hover:text-amber-500 transition-colors"
                        title="重新链接文件"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteFile(file.id, file.file_path)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                      title="删除文件"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span className={`text-2xs px-2 py-1 rounded-full font-black flex-shrink-0 ${
                    Number(file.is_indexed) === 1 ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {Number(file.is_indexed) === 1 ? '已索引' : '待处理'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KBFileList;
