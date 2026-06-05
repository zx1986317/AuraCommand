import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, FolderOpen, Tag, X, ChevronRight, Home } from 'lucide-react';
import KBNavigationPanel from '../components/kb/KBNavigationPanel';
import KBFilePreviewModal from '../components/kb/KBFilePreviewModal';
import KBSearchBar from '../components/kb/KBSearchBar';
import KBStatusBar from '../components/kb/KBStatusBar';
import KBQueueBanner from '../components/kb/KBQueueBanner';
import KBSimpleFileList from '../components/kb/KBSimpleFileList';
import KBPagination from '../components/kb/KBPagination';
import KBFileDetail from '../components/kb/KBFileDetail';
import KBFileContextMenu from '../components/kb/KBFileContextMenu';
import { logger } from '../utils/logger';
import { useAppStore } from '../store/appStore';
import { useConfirmDelete } from '../hooks/useConfirmDelete';
import Modal from '../components/Modal';

interface KBFolder {
  id: string;
  name: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
}

interface KnowledgePageProps {
  files: any[];
  indexedFileCount: number;
  activeIndexingCount: number;
  onImportFiles: () => void;
  onSearch: (query: string) => void;
  onFileClick: (file: any) => void;

  onDeleteFile: (file: any) => void;
  kbFolders?: KBFolder[];
  onCreateFolder?: (name: string, parentId?: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onMoveFileToFolder?: (fileId: string, folderId: string | null) => void;
  onInsertToDocument?: ((content: string, title?: string) => void) | undefined;
  onRefreshFiles?: () => void;
  fileTags?: string[];
  setNotification?: (n: { message: string; type: 'info' | 'success' | 'error' | 'warning' } | null) => void;
}

const PLATFORM_TAGS = ['微信公众号', 'B站', '小红书', '微博', '知乎', 'V2EX', '雪球', '抖音'] as const;

const parseTags = (file: any): string[] => {
  try {
    if (typeof file?.tags === 'string') return JSON.parse(file.tags || '[]');
    return Array.isArray(file?.tags) ? file.tags : [];
  } catch {
    return [];
  }
};

const KnowledgePage: React.FC<KnowledgePageProps> = ({
  files,
  indexedFileCount,
  activeIndexingCount,
  onImportFiles,
  onSearch,
  onFileClick,


  onDeleteFile,
  kbFolders = [],
  onCreateFolder,
  onDeleteFolder,
  onMoveFileToFolder,
  onInsertToDocument,
  onRefreshFiles,
  fileTags = [],
  setNotification,
}) => {
  const { confirmState, requestConfirm, handleConfirm, handleCancel } = useConfirmDelete();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('list');
  const [selectedFile, setSelectedFile] = React.useState<any>(null);
  const [selectedVirtualFolder, setSelectedVirtualFolder] = React.useState<string | null | 'uncategorized'>(null);
  const [copilotCollapsed, setCopilotCollapsed] = React.useState(false);
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [selectedPlatformTag, setSelectedPlatformTag] = React.useState<string | null>(null);
  const [selectedType, setSelectedType] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [fileContextMenu, setFileContextMenu] = React.useState<{ fileId: string; x: number; y: number } | null>(null);
  const [indexingProgress, setIndexingProgress] = React.useState<Record<string, { status: string; progress: number; fileName?: string; totalChunks?: number; current?: number; total?: number }>>({});
  const [queueStatus, setQueueStatus] = React.useState<{ processing: boolean; queueLength: number; total: number } | null>(null);
  const [previewFileId, setPreviewFileId] = React.useState<string | null>(null);
  const [clipboardOcrLoading, setClipboardOcrLoading] = React.useState(false);
  const [clipboardOcrModal, setClipboardOcrModal] = React.useState<{ title: string; content: string } | null>(null);
  const selectedModel = useAppStore(s => s.selectedModel);
  const cloudModelIdMap = useAppStore(s => s.cloudModelIdMap);

  const handleImportFromClipboard = React.useCallback(async () => {
    if (!window.ipcRenderer) return;
    setClipboardOcrLoading(true);
    try {
      const imageResult = await window.ipcRenderer.invoke('read-clipboard-image-preview');
      if (imageResult?.image) {
        const ocrResult = await window.ipcRenderer.invoke('clipboard-ocr', {
          imageBase64: imageResult.image,
          cloudModelId: cloudModelIdMap[selectedModel],
        });
        if (ocrResult?.text) {
          setClipboardOcrModal({ title: '剪贴板 OCR 结果', content: ocrResult.text });
        } else if (ocrResult?.error) {
          setClipboardOcrModal({ title: 'OCR 识别失败', content: ocrResult.error });
        }
      }
    } catch (err) {
      logger.error('Clipboard OCR import failed', err);
    } finally {
      setClipboardOcrLoading(false);
    }
  }, [cloudModelIdMap, selectedModel]);

  const handleSaveClipboardOcrToKb = React.useCallback(async () => {
    if (!clipboardOcrModal || !window.ipcRenderer) return;
    try {
      await window.ipcRenderer.invoke('save-ocr-to-kb', { title: clipboardOcrModal.title, content: clipboardOcrModal.content });
      setClipboardOcrModal(null);
      if (onRefreshFiles) onRefreshFiles();
      if (setNotification) setNotification({ message: '已从剪贴板导入到知识库', type: 'success' });
    } catch (err) {
      logger.error('Save clipboard OCR to KB failed', err);
    }
  }, [clipboardOcrModal, onRefreshFiles, setNotification]);

  const handleSaveClipboardOcrToNote = React.useCallback(async () => {
    if (!clipboardOcrModal || !window.ipcRenderer) return;
    try {
      await window.ipcRenderer.invoke('save-ocr-to-note', { title: clipboardOcrModal.title, content: clipboardOcrModal.content });
      setClipboardOcrModal(null);
      if (setNotification) setNotification({ message: '已从剪贴板保存为便签', type: 'success' });
    } catch (err) {
      logger.error('Save clipboard OCR to note failed', err);
    }
  }, [clipboardOcrModal, setNotification]);
  const [isSelectMode, setIsSelectMode] = React.useState(false);
  const [selectedFileIds, setSelectedFileIds] = React.useState<Set<string>>(new Set());
  const [showFolderSelector, setShowFolderSelector] = React.useState(false);
  const [showTagInput, setShowTagInput] = React.useState(false);
  const [batchTagInput, setBatchTagInput] = React.useState('');

  React.useEffect(() => {
    if (!window.ipcRenderer) return;
    const onProgress = (_: any, data: any) => {
      setIndexingProgress(prev => ({ ...prev, [data.fileId]: data }));
      if (data.status === 'error') {
        if (onRefreshFiles) onRefreshFiles();
      }
    };
    const onQueueStatus = (_: any, data: any) => {
      setQueueStatus(data);
      if (!data.processing && data.queueLength === 0) {
        setIndexingProgress({});
        if (onRefreshFiles) onRefreshFiles();
        setTimeout(() => setQueueStatus(null), 3000);
      }
    };
    window.ipcRenderer.on('indexing-progress', onProgress);
    window.ipcRenderer.on('indexing-queue-status', onQueueStatus);
    return () => {
      window.ipcRenderer.removeListener?.('indexing-progress', onProgress);
      window.ipcRenderer.removeListener?.('indexing-queue-status', onQueueStatus);
    };
  }, [onRefreshFiles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const getFolderPath = React.useMemo(() => {
    if (!selectedVirtualFolder || selectedVirtualFolder === 'uncategorized') return [];
    const path: KBFolder[] = [];
    let currentId: string | null | undefined = selectedVirtualFolder;
    while (currentId) {
      const folder = kbFolders.find(f => f.id === currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.parent_id;
    }
    return path;
  }, [selectedVirtualFolder, kbFolders]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedFileIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedFileIds.size === 0) return;
    requestConfirm({
      message: `确定删除选中的 ${selectedFileIds.size} 个文件吗？此操作不可撤销。`,
      onConfirm: async () => {
        let deletedCount = 0;
        try {
          for (const fileId of selectedFileIds) {
            await window.ipcRenderer.invoke('delete-file', { fileId: String(fileId) });
            deletedCount++;
          }
          setNotification?.({ message: `已删除 ${deletedCount} 个文件`, type: 'success' });
        } catch (err) {
          setNotification?.({ message: `删除中断，已删除 ${deletedCount}/${selectedFileIds.size} 个文件`, type: 'error' });
        }
        setTimeout(() => setNotification?.(null), 3000);
        exitSelectMode();
        onRefreshFiles?.();
      },
    });
  };

  const handleBatchMoveToFolder = async (folderId: string) => {
    if (selectedFileIds.size === 0) return;
    let movedCount = 0;
    try {
      for (const fileId of selectedFileIds) {
        await onMoveFileToFolder?.(String(fileId), folderId);
        movedCount++;
      }
      setNotification?.({ message: `已移动 ${movedCount} 个文件`, type: 'success' });
    } catch (err) {
      setNotification?.({ message: `移动中断，已移动 ${movedCount}/${selectedFileIds.size} 个文件`, type: 'error' });
    }
    setTimeout(() => setNotification?.(null), 3000);
    setShowFolderSelector(false);
    exitSelectMode();
    onRefreshFiles?.();
  };

  const handleBatchAddTag = async () => {
    if (selectedFileIds.size === 0 || !batchTagInput.trim()) return;
    const newTags = batchTagInput.split(',').map(t => t.trim()).filter(Boolean);
    let taggedCount = 0;
    try {
      for (const fileId of selectedFileIds) {
        const file = files.find(f => f.id === String(fileId));
        if (file) {
          let existingTags: string[] = [];
          try {
            existingTags = typeof file.tags === 'string' ? JSON.parse(file.tags || '[]') : (file.tags || []);
          } catch { existingTags = []; }
          const mergedTags = [...new Set([...existingTags, ...newTags])];
          await window.ipcRenderer.invoke('update-file-tags', { fileId: String(fileId), tags: mergedTags });
          taggedCount++;
        }
      }
      setNotification?.({ message: `已为 ${taggedCount} 个文件添加标签`, type: 'success' });
    } catch (err) {
      setNotification?.({ message: `标签操作中断，已完成 ${taggedCount}/${selectedFileIds.size}`, type: 'error' });
    }
    setTimeout(() => setNotification?.(null), 3000);
    setShowTagInput(false);
    setBatchTagInput('');
    exitSelectMode();
    onRefreshFiles?.();
  };

  const filteredFiles = React.useMemo(() => {
    const all = files.filter(file => {
      if (selectedVirtualFolder === 'uncategorized') {
        if (file.folder_id) return false;
      } else if (selectedVirtualFolder !== null) {
        if (file.folder_id !== selectedVirtualFolder) return false;
      }
      const matchTag = !selectedTag || (() => {
        try { const tags = file.tags ? JSON.parse(file.tags) : []; return tags.includes(selectedTag); }
        catch { return false; }
      })();
      const matchPlatformTag = !selectedPlatformTag || parseTags(file).includes(selectedPlatformTag);
      const matchType = !selectedType || (file.file_type || '').toLowerCase() === selectedType.toLowerCase();
      return matchTag && matchPlatformTag && matchType;
    });
    return all.slice((page - 1) * pageSize, page * pageSize);
  }, [files, selectedVirtualFolder, selectedTag, selectedPlatformTag, selectedType, page, pageSize]);

  const filteredTotal = React.useMemo(() => {
    return files.filter(file => {
      if (selectedVirtualFolder === 'uncategorized') {
        if (file.folder_id) return false;
      } else if (selectedVirtualFolder !== null) {
        if (file.folder_id !== selectedVirtualFolder) return false;
      }
      const matchTag = !selectedTag || (() => {
        try { const tags = file.tags ? JSON.parse(file.tags) : []; return tags.includes(selectedTag); }
        catch { return false; }
      })();
      const matchPlatformTag = !selectedPlatformTag || parseTags(file).includes(selectedPlatformTag);
      const matchType = !selectedType || (file.file_type || '').toLowerCase() === selectedType.toLowerCase();
      return matchTag && matchPlatformTag && matchType;
    }).length;
  }, [files, selectedVirtualFolder, selectedTag, selectedPlatformTag, selectedType]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));

  React.useEffect(() => { setPage(1); }, [selectedVirtualFolder, selectedTag, selectedPlatformTag, selectedType]);

  const platformTagOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach(file => {
      const tags = parseTags(file);
      PLATFORM_TAGS.forEach(tag => {
        if (tags.includes(tag)) counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return PLATFORM_TAGS.filter(tag => counts.has(tag)).map(tag => ({ tag, count: counts.get(tag) || 0 }));
  }, [files]);

  const fileTypeOptions = React.useMemo(() => {
    const types = new Map<string, number>();
    files.forEach(f => {
      const ext = (f.file_type || '').toLowerCase();
      types.set(ext, (types.get(ext) || 0) + 1);
    });
    return Array.from(types.entries()).sort((a, b) => b[1] - a[1]);
  }, [files]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
      return d.toLocaleDateString('zh-CN');
    } catch { return ''; }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'parsing': return '解析中...';
      case 'vectorizing': return '向量化中...';
      case 'generating_summary': return '生成摘要中...';
      case 'completed': return '已完成';
      case 'error': return '处理失败';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'parsing': return 'text-blue-500';
      case 'vectorizing': return 'text-violet-500';
      case 'generating_summary': return 'text-amber-500';
      case 'completed': return 'text-emerald-600';
      case 'error': return 'text-red-500';
      default: return 'text-muted';
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'parsing': return 'bg-blue-400';
      case 'vectorizing': return 'bg-violet-400';
      case 'generating_summary': return 'bg-amber-400';
      case 'completed': return 'bg-emerald-400';
      default: return 'bg-accent';
    }
  };

  const getFileIcon = (fileType: string, size: number = 20) => {
    const ext = (fileType || '').toLowerCase();
    if (['.pdf'].includes(ext)) return <span className="text-red-500">PDF</span>;
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return <span className="text-blue-500">IMG</span>;
    if (['.doc', '.docx'].includes(ext)) return <span className="text-blue-600">DOC</span>;
    if (['.xls', '.xlsx', '.csv'].includes(ext)) return <span className="text-green-600">XLS</span>;
    if (['.md', '.txt'].includes(ext)) return <span className="text-slate-600">TXT</span>;
    return <span className="text-slate-500">FILE</span>;
  };

  const selectedFileTags = React.useMemo(() => {
    if (!selectedFile?.tags) return [];
    try { return typeof selectedFile.tags === 'string' ? JSON.parse(selectedFile.tags) : selectedFile.tags; }
    catch { return []; }
  }, [selectedFile]);

  const clearAllFilters = React.useCallback(() => {
    setSelectedVirtualFolder(null);
    setSelectedTag(null);
    setSelectedPlatformTag(null);
    setSelectedType(null);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full flex gap-3"
    >
      {/* 左侧：文件夹树 + 标签 + 类型筛选 */}
      <KBNavigationPanel
        kbFolders={kbFolders}
        files={files}
        selectedVirtualFolder={selectedVirtualFolder}
        selectedTag={selectedTag}
        selectedType={selectedType}
        fileTags={fileTags}
        fileTypeOptions={fileTypeOptions}
        getFileIcon={getFileIcon}
        onSelectVirtualFolder={setSelectedVirtualFolder}
        onSelectTag={setSelectedTag}
        onSelectType={setSelectedType}
        onCreateFolder={onCreateFolder || (() => {})}
        onDeleteFolder={onDeleteFolder || (() => {})}
      />

      {/* 中间：文件列表 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 搜索 + 操作栏 */}
        <KBSearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchSubmit={handleSearch}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onImportFiles={onImportFiles}
          onImportFromClipboard={handleImportFromClipboard}
          copilotCollapsed={copilotCollapsed}
          onCopilotToggle={() => setCopilotCollapsed(!copilotCollapsed)}
          isSelectMode={isSelectMode}
          onToggleSelectMode={() => { if (isSelectMode) exitSelectMode(); else setIsSelectMode(true); }}
          selectedCount={selectedFileIds.size}
        />

        {/* 面包屑导航 */}
        {(selectedVirtualFolder || selectedTag || selectedPlatformTag || selectedType) && (
          <div className="flex items-center gap-1 px-4 py-1.5 text-2xs text-muted">
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 hover:text-accent transition-colors"
            >
              <Home size={12} />
              <span>全部文件</span>
            </button>
            {getFolderPath.map((folder, idx) => (
              <React.Fragment key={folder.id}>
                <ChevronRight size={10} className="text-muted/50" />
                <button
                  onClick={() => setSelectedVirtualFolder(folder.id)}
                  className={`hover:text-accent transition-colors ${idx === getFolderPath.length - 1 ? 'text-accent font-medium' : ''}`}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}
            {selectedVirtualFolder === 'uncategorized' && (
              <>
                <ChevronRight size={10} className="text-muted/50" />
                <span className="text-accent font-medium">未分类</span>
              </>
            )}
            {selectedTag && (
              <>
                <ChevronRight size={10} className="text-muted/50" />
                <span className="text-accent font-medium">标签: {selectedTag}</span>
              </>
            )}
            {selectedPlatformTag && (
              <>
                <ChevronRight size={10} className="text-muted/50" />
                <span className="text-accent font-medium">来源: {selectedPlatformTag}</span>
              </>
            )}
            {selectedType && (
              <>
                <ChevronRight size={10} className="text-muted/50" />
                <span className="text-accent font-medium">类型: {selectedType}</span>
              </>
            )}
          </div>
        )}

        {/* 状态栏 */}
        <KBStatusBar
          filteredTotal={filteredTotal}
          indexedFileCount={indexedFileCount}
          activeIndexingCount={activeIndexingCount}
          selectedTag={selectedTag}
          selectedPlatformTag={selectedPlatformTag}
          selectedType={selectedType}
          onClearTag={() => setSelectedTag(null)}
          onClearPlatformTag={() => setSelectedPlatformTag(null)}
          onClearType={() => setSelectedType(null)}
          onClearAll={clearAllFilters}
        />

        {platformTagOptions.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-2 flex-wrap border-b border-teal-900/5">
            <span className="text-2xs font-medium text-muted">平台来源</span>
            <button
              onClick={() => setSelectedPlatformTag(null)}
              className={`px-2 py-1 rounded-full text-2xs border transition-all ${
                !selectedPlatformTag
                  ? 'bg-accent/10 border-accent/20 text-accent'
                  : 'bg-white/60 border-teal-900/10 text-muted hover:bg-teal-900/5'
              }`}
            >
              全部
            </button>
            {platformTagOptions.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => setSelectedPlatformTag(prev => prev === tag ? null : tag)}
                className={`px-2 py-1 rounded-full text-2xs border transition-all ${
                  selectedPlatformTag === tag
                    ? 'bg-accent/10 border-accent/20 text-accent'
                    : 'bg-white/60 border-teal-900/10 text-muted hover:bg-teal-900/5'
                }`}
              >
                {tag} {count}
              </button>
            ))}
          </div>
        )}

        {/* 队列状态提示 */}
        <KBQueueBanner
          queueStatus={queueStatus}
          indexingProgress={indexingProgress}
        />

        {/* 文件列表 */}
        <KBSimpleFileList
          filteredFiles={filteredFiles}
          totalFiles={files.length}
          viewMode={viewMode}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          onFileDoubleClick={onFileClick}
          onFileContextMenu={(fileId, e) => { e.preventDefault(); setFileContextMenu({ fileId, x: e.clientX, y: e.clientY }); }}
          getFileIcon={getFileIcon}
          formatDate={formatDate}
          formatFileSize={formatFileSize}
          indexingProgress={indexingProgress}
          onImportFiles={onImportFiles}
          isSelectMode={isSelectMode}
          selectedFileIds={selectedFileIds}
          onToggleFileSelection={toggleFileSelection}
        />

        {/* 分页 */}
        <KBPagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          filteredTotal={filteredTotal}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />

        {isSelectMode && selectedFileIds.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-accent/5 border border-accent/20 rounded-xl">
            <span className="text-xs font-bold text-accent">批量操作：</span>
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={12} /> 批量删除
            </button>
            <button
              onClick={() => setShowFolderSelector(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <FolderOpen size={12} /> 批量移动
            </button>
            <button
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <Tag size={12} /> 批量添加标签
            </button>
            <button
              onClick={exitSelectMode}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={12} /> 取消
            </button>
          </div>
        )}
      </div>

      {/* 右侧：文件详情 + Copilot */}
      <AnimatePresence>
        {!copilotCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 flex flex-col gap-3 overflow-hidden"
          >
            <KBFileDetail
              selectedFile={selectedFile}
              selectedFileTags={selectedFileTags}
              indexingProgress={indexingProgress}
              copilotCollapsed={copilotCollapsed}
              kbFolders={kbFolders}
              onPreview={setPreviewFileId}


              onDelete={onDeleteFile}
              onMoveToFolder={onMoveFileToFolder}
              onRefreshFiles={onRefreshFiles}
              onGenerateSummary={async (fileId) => {
                if (!window.ipcRenderer) return { success: false, error: 'IPC 不可用' };
                const result = await window.ipcRenderer.invoke('generate-file-summary', { fileId });
                return result;
              }}
              setNotification={setNotification}
              getFileIcon={getFileIcon}
              formatDate={formatDate}
              formatFileSize={formatFileSize}
              getStatusLabel={getStatusLabel}
              getStatusColor={getStatusColor}
              getProgressBarColor={getProgressBarColor}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 文件右键上下文菜单 */}
      <KBFileContextMenu
        contextMenu={fileContextMenu}
        kbFolders={kbFolders}
        onPreview={setPreviewFileId}
        onMoveToFolder={(fileId, folderId) => onMoveFileToFolder?.(fileId, folderId)}
        onRemoveFromFolder={(fileId) => onMoveFileToFolder?.(fileId, null)}
        onClose={() => setFileContextMenu(null)}
      />

      {/* 文件预览模态框 */}
      <KBFilePreviewModal
        isOpen={!!previewFileId}
        fileId={previewFileId}
        onClose={() => setPreviewFileId(null)}
        onOpenExternal={(filePath, fileName) => {
          if (window.ipcRenderer) {
            window.ipcRenderer.invoke('open-path', { path: filePath });
          }
        }}
      />

      {showFolderSelector && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowFolderSelector(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-4">选择目标文件夹</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {kbFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => handleBatchMoveToFolder(folder.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-left"
                >
                  <span className="text-gray-700">{folder.name}</span>
                </button>
              ))}
              {kbFolders.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">暂无文件夹</p>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowFolderSelector(false)} className="px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg">取消</button>
            </div>
          </div>
        </div>
      )}

      {showTagInput && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowTagInput(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-4">批量添加标签</h3>
            <input
              type="text"
              value={batchTagInput}
              onChange={e => setBatchTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleBatchAddTag(); }}
              placeholder="输入标签，逗号分隔..."
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/30 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTagInput(false)} className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg">取消</button>
              <button onClick={handleBatchAddTag} className="px-4 py-2 text-xs bg-accent text-white rounded-lg hover:bg-accent/90">确认</button>
            </div>
          </div>
        </div>
      )}

      {clipboardOcrModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setClipboardOcrModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-[480px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-gray-800">剪贴板 OCR 识别结果</h3>
              <button onClick={() => setClipboardOcrModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">标题</label>
                <input
                  type="text"
                  value={clipboardOcrModal.title}
                  onChange={(e) => setClipboardOcrModal({ ...clipboardOcrModal, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">识别内容</label>
                <textarea
                  value={clipboardOcrModal.content}
                  onChange={(e) => setClipboardOcrModal({ ...clipboardOcrModal, content: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 resize-none font-mono"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
              <button onClick={() => setClipboardOcrModal(null)} className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg">取消</button>
              <button onClick={handleSaveClipboardOcrToNote} className="px-4 py-2 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">保存为便签</button>
              <button onClick={handleSaveClipboardOcrToKb} className="px-4 py-2 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors">导入知识库</button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type="confirm"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </motion.div>
  );
};

export default KnowledgePage;
