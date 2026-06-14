import { useState, useMemo, useCallback, useEffect } from 'react';
import type { FileMetadata, KBSearchResult, IndexingStatus, KBSearchMode, KBFilterMode, KBSortMode, KBViewMode, KBFolder } from '../types';
import { useAppStore } from '../store/appStore';
import { logger } from '../utils/logger';

interface KBLogicDeps {
  setNotification: (n: { message: string; type: 'info' | 'error' | 'warning' } | null) => void;
  setModalConfig: (config: { isOpen: boolean; title: string; message: string; onConfirm: () => void; } | null) => void;
  setIsAIProcessing: (v: boolean) => void;
}

export function useKBLogic(deps: KBLogicDeps) {
  const { setNotification, setModalConfig, setIsAIProcessing } = deps;

  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [filesPage, setFilesPage] = useState(1);
  const [filesPageSize] = useState(20);
  const [filesTotal, setFilesTotal] = useState(0);
  const [filesTotalPages, setFilesTotalPages] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [kbViewMode, setKbViewMode] = useState<KBViewMode>('list');
  const [kbGraphData, setKbGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [kbFilter, setKbFilter] = useState<KBFilterMode>('all');
  const [kbSort, setKbSort] = useState<KBSortMode>('newest');
  const [indexingFiles, setIndexingFiles] = useState<Record<string, IndexingStatus>>({});
  // P1 #8：文件列表加载状态（用于 KB 列表在 IPC 期间显示骨架）
  const [isFilesLoading, setIsFilesLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [kbSearchMode, setKbSearchMode] = useState<KBSearchMode>('hybrid');
  const [kbSearchResults, setKbSearchResults] = useState<KBSearchResult[]>([]);
  const [isKbSearching, setIsKbSearching] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [allFileTags, setAllFileTags] = useState<string[]>([]);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string | null>(null);

  // 虚拟文件夹状态
  const [kbFolders, setKbFolders] = useState<KBFolder[]>([]);
  const [selectedVirtualFolder, setSelectedVirtualFolder] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImportPaths, setPendingImportPaths] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'reference' | 'copy'>('reference');
  const [importTargetFolder, setImportTargetFolder] = useState('default');

  const folderTree = useMemo(() => {
    const folders = new Set<string>();
    files.forEach((f) => {
      const fp = f.folder_path || f.file_path || '';
      const separator: string = /[/\\]/.test(fp) ? (fp.includes('\\') ? '\\' : '/') : '/';
      const lastSepIndex = fp.lastIndexOf(separator);
      const dir = lastSepIndex >= 0 ? fp.substring(0, lastSepIndex) : '';
      if (dir) folders.add(dir);
    });
    return Array.from(folders).sort();
  }, [files]);

  const indexingEntries = Object.entries(indexingFiles);
  const activeIndexingCount = indexingEntries.filter(([, file]) => file.status === 'parsing' || file.status === 'vectorizing').length;
  const indexedFileCount = files.filter((file) => Number(file.is_indexed) === 1).length;
  const totalStorageMB = (files.reduce((sum, file) => sum + Number(file.file_size || 0), 0) / (1024 * 1024)).toFixed(1);
  const fileTypeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    files.forEach((file) => {
      const ext = String(file.file_type || '').replace('.', '').toUpperCase() || 'OTHER';
      stats[ext] = (stats[ext] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [files]);

  const visibleFiles = useMemo(() => {
    const filtered = files.filter((file) => {
      if (kbFilter === 'indexed' && Number(file.is_indexed) !== 1) return false;
      if (kbFilter === 'pending' && Number(file.is_indexed) === 1) return false;
      if (selectedTagFilter) {
        try {
          const tags = typeof file.tags === 'string' ? JSON.parse(file.tags || '[]') : (file.tags || []);
          if (!tags.includes(selectedTagFilter)) return false;
        } catch {
          return false;
        }
      }
      if (selectedFolderFilter) {
        const fp = file.folder_path || file.file_path || '';
        if (!fp.startsWith(selectedFolderFilter)) return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (kbSort === 'largest') return Number(b.file_size || 0) - Number(a.file_size || 0);
      const aTime = a.last_modified ? new Date(a.last_modified).getTime() : 0;
      const bTime = b.last_modified ? new Date(b.last_modified).getTime() : 0;
      return bTime - aTime;
    });
    return sorted;
  }, [files, kbFilter, kbSort, selectedTagFilter, selectedFolderFilter]);

  const loadFiles = async (page?: number) => {
    if (!window.ipcRenderer) return;
    setIsFilesLoading(true);
    try {
      const p = page ?? filesPage;
      const projectName = useAppStore.getState().currentProjectName || undefined;
      const data = await window.ipcRenderer.invoke('get-vault-files', { page: p, pageSize: 10000, projectName });
      if (data && typeof data === 'object' && Array.isArray(data.files)) {
        setFiles(data.files);
        setFilesTotal(data.total);
        setFilesTotalPages(data.totalPages);
        setFilesPage(data.page);
      } else if (Array.isArray(data)) {
        setFiles(data);
      }
    } catch (err) {
      logger.error('Failed to load files:', err);
    } finally {
      setIsFilesLoading(false);
      setHasLoadedOnce(true);
    }
  };

  const loadFileTags = useCallback(async () => {
    if (!window.ipcRenderer) return;
    try {
      const res = await window.ipcRenderer.invoke('get-file-tags');
      if (res?.success) setAllFileTags(res.tags);
    } catch (err) {
      logger.error('Failed to load file tags:', err);
    }
  }, []);

  const handleKbSearch = useCallback(async (query: string, mode?: KBSearchMode) => {
    if (!window.ipcRenderer || !query.trim()) {
      setKbSearchResults([]);
      return;
    }
    setIsKbSearching(true);
    try {
      const projectName = useAppStore.getState().currentProjectName || undefined;
      const res = await window.ipcRenderer.invoke('search-kb-fulltext', {
        query: query.trim(),
        mode: mode || kbSearchMode,
        limit: 15,
        projectName,
      });
      if (Array.isArray(res)) {
        setKbSearchResults(res);
      } else if (res?.success) {
        setKbSearchResults(res.results || []);
      } else {
        setKbSearchResults([]);
      }
    } catch {
      setKbSearchResults([]);
    } finally {
      setIsKbSearching(false);
    }
  }, [kbSearchMode]);

  const handleGenerateSummary = async (fileId: string, fileName: string, textContent: string) => {
    if (!window.ipcRenderer) return;
    setNotification({ message: `正在为「${fileName}」生成摘要...`, type: 'info' });
    try {
      const res = await window.ipcRenderer.invoke('generate-file-summary', { fileId, fileName, textContent });
      if (res.success) {
        setNotification({ message: `摘要生成完成`, type: 'info' });
        await loadFiles();
        await loadFileTags();
      } else {
        setNotification({ message: `摘要生成失败: ${res.error}`, type: 'error' });
      }
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ message: `摘要生成失败: ${err.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleUpdateFileTags = async (fileId: string, tags: string[]) => {
    if (!window.ipcRenderer) return;
    try {
      const res = await window.ipcRenderer.invoke('update-file-tags', { fileId, tags });
      if (res?.success) {
        await loadFiles();
        await loadFileTags();
      }
    } catch (err) {
      logger.error('Failed to update file tags:', err);
    }
  };

  const handleDeleteFile = async (id: string, filePath: string) => {
    setModalConfig({
      isOpen: true,
      title: '删除文件',
      message: '确定要从知识库中删除此文件吗？这将同时删除其向量索引。',
      onConfirm: async () => {
        try {
          const result = await window.ipcRenderer.invoke('delete-file', { id, filePath });
          if (result?.success) {
            await loadFiles();
          } else {
            setNotification({ message: `删除失败: ${result?.error || '未知错误'}`, type: 'error' });
            setTimeout(() => setNotification(null), 3000);
          }
        } catch (err: any) {
          setNotification({ message: `删除失败: ${err.message}`, type: 'error' });
          setTimeout(() => setNotification(null), 3000);
        } finally {
          setModalConfig(null);
        }
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const paths = droppedFiles.map(f => (f as File & { path?: string }).path || '').filter(p => p);
      if (paths.length > 0) {
        // 打开导入设置弹窗
        setPendingImportPaths(paths);
        setShowImportDialog(true);
      } else {
        setNotification({ message: '无法获取文件路径，请重试', type: 'error' });
        setTimeout(() => setNotification(null), 3000);
      }
    }
  };

  const confirmImport = async () => {
    if (pendingImportPaths.length === 0) return;
    setShowImportDialog(false);
    setIsAIProcessing(true);
    setNotification({ message: `正在导入 ${pendingImportPaths.length} 个文件...`, type: 'info' });
    try {
      const results = await window.ipcRenderer.invoke('import-files', {
        filePaths: pendingImportPaths,
        mode: importMode,
        folderId: importTargetFolder
      });
      // import-files 返回结果数组 [{ filePath, success, id? }]
      const succeeded = Array.isArray(results) ? results.filter((r: any) => r.success) : [];
      const failed = Array.isArray(results) ? results.filter((r: any) => !r.success) : [];
      if (succeeded.length > 0) {
        setNotification({
          message: `成功导入 ${succeeded.length} 个文件${failed.length > 0 ? `，${failed.length} 个失败` : ''}，正在进行向量化...`,
          type: failed.length > 0 ? 'warning' : 'info'
        });
        await loadFiles();
      } else {
        setNotification({ message: `导入失败：所有文件均未成功`, type: 'error' });
      }
    } catch (err: any) {
      logger.error('Failed to import files:', err);
      setNotification({ message: `导入失败: ${err.message}`, type: 'error' });
    } finally {
      setIsAIProcessing(false);
      setPendingImportPaths([]);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // 虚拟文件夹管理
  const loadKbFolders = async () => {
    if (!window.ipcRenderer) return;
    try {
      const res = await window.ipcRenderer.invoke('get-kb-folders');
      if (res.success) setKbFolders(res.folders);
    } catch (err) {
      logger.error('Failed to load kb folders:', err);
    }
  };

  const createKbFolder = async (name: string, parentId?: string) => {
    if (!window.ipcRenderer) return;
    try {
      const res = await window.ipcRenderer.invoke('create-kb-folder', { name, parentId });
      if (res.success) {
        await loadKbFolders();
        return res.folder;
      }
    } catch (err) {
      logger.error('Failed to create folder:', err);
    }
    return null;
  };

  const renameKbFolder = async (id: string, name: string) => {
    if (!window.ipcRenderer) return;
    try {
      const res = await window.ipcRenderer.invoke('rename-kb-folder', { id, name });
      if (res.success) await loadKbFolders();
    } catch (err) {
      logger.error('Failed to rename folder:', err);
    }
  };

  const deleteKbFolder = async (id: string) => {
    if (!window.ipcRenderer) return;
    try {
      const res = await window.ipcRenderer.invoke('delete-kb-folder', { id });
      if (res.success) {
        await loadKbFolders();
        if (selectedVirtualFolder === id) setSelectedVirtualFolder(null);
      }
    } catch (err) {
      logger.error('Failed to delete folder:', err);
    }
  };

  const moveFileToFolder = async (fileId: string, folderId: string | null) => {
    if (!window.ipcRenderer) return;
    try {
      const res = await window.ipcRenderer.invoke('move-file-to-folder', { fileId, folderId });
      if (res.success) await loadFiles();
    } catch (err) {
      logger.error('Failed to move file:', err);
    }
  };

  const relinkFile = async (fileId: string, newPath?: string) => {
    if (!window.ipcRenderer) return;
    try {
      let targetPath = newPath;
      if (!targetPath) {
        // 打开文件选择对话框让用户选择新路径
        const result = await window.ipcRenderer.invoke('select-file-dialog');
        if (!result || !result.filePath) return;
        targetPath = result.filePath;
      }
      const res = await window.ipcRenderer.invoke('relink-file', { fileId, newPath: targetPath });
      if (res.success) {
        setNotification({ message: '文件重新链接成功', type: 'info' });
        await loadFiles();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setNotification({ message: `重新链接失败: ${err.message}`, type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    loadKbFolders();
  }, []);

  const loadKbGraphData = async () => {
    try {
      const res = await window.ipcRenderer.invoke('get-kb-graph-data');
      if (res.success) setKbGraphData(res.data);
    } catch (err) {
      logger.error('Failed to load graph data:', err);
    }
  };

  useEffect(() => {
    loadFileTags();
  }, [files, loadFileTags]);

  return {
    files, setFiles,
    filesPage, setFilesPage, filesPageSize, filesTotal, filesTotalPages,
    isDragging, setIsDragging,
    kbViewMode, setKbViewMode,
    kbGraphData, setKbGraphData,
    kbFilter, setKbFilter,
    kbSort, setKbSort,
    indexingFiles, setIndexingFiles,
    isFilesLoading,
    hasLoadedOnce,
    indexingEntries, activeIndexingCount, indexedFileCount, totalStorageMB, fileTypeStats, visibleFiles,
    loadFiles,
    handleDeleteFile,
    handleDragOver, handleDragLeave, handleDrop,
    loadKbGraphData,
    kbSearchQuery, setKbSearchQuery,
    kbSearchMode, setKbSearchMode,
    kbSearchResults, setKbSearchResults,
    isKbSearching,
    handleKbSearch,
    handleGenerateSummary,
    allFileTags, loadFileTags,
    selectedTagFilter, setSelectedTagFilter,
    handleUpdateFileTags,
    folderTree,
    selectedFolderFilter, setSelectedFolderFilter,
    // 虚拟文件夹
    kbFolders, loadKbFolders,
    selectedVirtualFolder, setSelectedVirtualFolder,
    createKbFolder, renameKbFolder, deleteKbFolder,
    moveFileToFolder,
    relinkFile,
    // 导入弹窗
    showImportDialog, setShowImportDialog,
    pendingImportPaths, setPendingImportPaths,
    importMode, setImportMode,
    importTargetFolder, setImportTargetFolder,
    confirmImport,
  };
}
