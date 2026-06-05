import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, GitBranch, Search, FolderPlus, Sparkles, ArrowRight, UploadCloud } from 'lucide-react';
import type { KBSearchMode, KBSearchResult, FileMetadata, KBFolder } from '../types';

import KBSearchPanel from './kb/KBSearchPanel';
import KBTagFilter from './kb/KBTagFilter';
import KBStatsBar from './kb/KBStatsBar';
import KBWebClipper from './kb/KBWebClipper';
import KBFolderTree from './kb/KBFolderTree';
import KBFileList from './kb/KBFileList';
import KBIndexQueue from './kb/KBIndexQueue';
import KbGraphVisualization from './kb/KBGraphVisualization';
import KBImportDialog from './kb/KBImportDialog';

interface KnowledgeBasePanelProps {
  files: FileMetadata[];
  visibleFiles: FileMetadata[];
  highlightedFileIds?: string[];
  indexedFileCount: number;
  activeIndexingCount: number;
  totalStorageMB: string;
  fileTypeStats: [string, number][];
  kbFilter: 'all' | 'indexed' | 'pending';
  kbSort: 'newest' | 'largest';
  kbViewMode: 'list' | 'graph';
  kbGraphData: { nodes: any[]; links: any[] };
  isDragging: boolean;
  indexingEntries: [string, any][];
  onSetFilter: (filter: 'all' | 'indexed' | 'pending') => void;
  onSetSort: (sort: 'newest' | 'largest') => void;
  onSetViewMode: (mode: 'list' | 'graph') => void;
  onLoadGraphData: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDeleteFile: (id: string, path: string) => void;
  onOpenPDF: (filePath: string, fileName: string) => void;
  onClipWebPage: (url: string) => void;
  onNodeClick?: (node: any) => void;
  kbSearchQuery: string;
  kbSearchMode: KBSearchMode;
  kbSearchResults: KBSearchResult[];
  isKbSearching: boolean;
  onKbSearch: (query: string, mode?: KBSearchMode) => void;
  onSetKbSearchQuery: (q: string) => void;
  onSetKbSearchMode: (m: KBSearchMode) => void;
  onSetKbSearchResults: (r: KBSearchResult[]) => void;
  onGenerateSummary: (fileId: string, fileName: string, textContent: string) => void;
  allFileTags: string[];
  selectedTagFilter: string | null;
  onSetSelectedTagFilter: (tag: string | null) => void;
  onUpdateFileTags: (fileId: string, tags: string[]) => void;
  folders: KBFolder[];
  selectedVirtualFolder: string | null;
  onSelectVirtualFolder: (folderId: string | null) => void;
  onCreateKbFolder: (name: string) => Promise<any>;
  onRenameKbFolder: (id: string, name: string) => void;
  onDeleteKbFolder: (id: string) => void;
  onMoveFileToFolder: (fileId: string, folderId: string) => void;
  showImportDialog: boolean;
  pendingImportPaths: string[];
  onShowImportDialog: (paths: string[]) => void;
  onCloseImportDialog: () => void;
  onConfirmImport: (mode: 'reference' | 'copy', folderId: string) => void;
  onRelinkFile: (fileId: string, newPath?: string) => void | Promise<void>;
  onImportSampleWorkspace: () => void;
  onOpenOnboarding: () => void;
  onNavigateToChat: () => void;
  aiChatReady: boolean;
  aiRagReady: boolean;
}

const KnowledgeBasePanel: React.FC<KnowledgeBasePanelProps> = ({
  files, visibleFiles, highlightedFileIds = [], indexedFileCount, activeIndexingCount, totalStorageMB,
  fileTypeStats, kbFilter, kbSort, kbViewMode, kbGraphData, isDragging,
  indexingEntries, onSetFilter, onSetSort, onSetViewMode, onLoadGraphData,
  onDragOver, onDragLeave, onDrop, onDeleteFile, onOpenPDF, onClipWebPage, onNodeClick,
  kbSearchQuery, kbSearchMode, kbSearchResults, isKbSearching,
  onKbSearch, onSetKbSearchQuery, onSetKbSearchMode, onSetKbSearchResults,
  onGenerateSummary, allFileTags, selectedTagFilter, onSetSelectedTagFilter,
  onUpdateFileTags,
  folders, selectedVirtualFolder, onSelectVirtualFolder, onCreateKbFolder, onRenameKbFolder, onDeleteKbFolder,
  onMoveFileToFolder, showImportDialog, pendingImportPaths, onShowImportDialog, onCloseImportDialog,
  onConfirmImport, onRelinkFile, onImportSampleWorkspace, onOpenOnboarding, onNavigateToChat, aiChatReady, aiRagReady
}) => {
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  return (
    <motion.div
      key="kb"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="max-w-6xl mx-auto h-full flex flex-col w-full"
    >
      {/* Header section */}
      <div className="mb-6 p-8 rounded-3xl border border-teal-900/10 bg-gradient-to-br from-white/90 to-white/40 shadow-glass">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-2xs font-black uppercase tracking-[0.25em] text-accent mb-3">Knowledge Hub</p>
            <h2 className="text-4xl font-display font-bold tracking-tight mb-2">知识库索引中心</h2>
            <p className="text-muted text-sm font-medium">文件资产、索引状态、日程安排在同一视图内完成闭环。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${
                showSearchPanel ? 'bg-accent text-white border-accent' : 'bg-accent/10 text-accent border-accent/20'
              }`}
            >
              <Search size={22} />
            </button>
            <button
              onClick={async () => {
                const name = window.prompt('输入新文件夹名称：');
                if (name?.trim()) await onCreateKbFolder(name.trim());
              }}
              className="w-12 h-12 rounded-2xl border flex items-center justify-center transition-all bg-accent/10 text-accent border-accent/20 hover:bg-accent/20"
              title="新建虚拟文件夹"
            >
              <FolderPlus size={22} />
            </button>
            {!showSearchPanel && (
              <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center border border-accent/20">
                <Database size={22} />
              </div>
            )}
          </div>
        </div>

        {/* Search input area (collapsible) */}
        <KBSearchPanel
          kbSearchQuery={kbSearchQuery}
          kbSearchMode={kbSearchMode}
          kbSearchResults={kbSearchResults}
          isKbSearching={isKbSearching}
          onKbSearch={onKbSearch}
          onSetKbSearchQuery={onSetKbSearchQuery}
          onSetKbSearchMode={onSetKbSearchMode}
          onSetKbSearchResults={onSetKbSearchResults}
          showSearchPanel={showSearchPanel}
          onToggleSearchPanel={setShowSearchPanel}
        />

        {/* Filter tabs + view mode toggle */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: '全部资产', count: files.length },
            { key: 'pending', label: '待索引', count: files.length - indexedFileCount },
            { key: 'indexed', label: '已索引', count: indexedFileCount }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => onSetFilter(item.key as 'all' | 'indexed' | 'pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                kbFilter === item.key ? 'bg-accent text-white' : 'bg-white/70 text-muted border border-teal-900/10 hover:text-foreground'
              }`}
            >
              {item.label} {item.count}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => {
              onSetViewMode(kbViewMode === 'list' ? 'graph' : 'list');
              if (kbViewMode === 'list') onLoadGraphData();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              kbViewMode === 'graph' ? 'bg-accent text-white' : 'bg-white/70 text-muted border border-teal-900/10 hover:text-foreground'
            }`}
          >
            <GitBranch size={12} />
            {kbViewMode === 'graph' ? '列表视图' : '图谱视图'}
          </button>
        </div>
      </div>

      {files.length === 0 && (
        <div className="mb-6 grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
          <div className="relative overflow-hidden rounded-3xl border border-accent/15 bg-gradient-to-br from-accent/10 via-white/90 to-white/60 p-8 shadow-glass">
            <div className="absolute right-6 top-6 w-24 h-24 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-accent/10 text-2xs font-bold uppercase tracking-[0.2em] text-accent">
                  <Sparkles size={12} />
                  冷启动助手
                </div>
                <h3 className="mt-4 text-2xl font-display font-bold text-foreground">先导入一个示例工作区，立刻体验知识库与 AI 联动</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed">我们会为你准备 5 条示例便签和 3 份示例资料，让搜索、知识问答和便签关联马上变得可见。</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={onImportSampleWorkspace}
                    className="flex items-center gap-2 px-5 py-3 bg-accent text-white rounded-2xl text-xs font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
                  >
                    <Sparkles size={14} />
                    导入示例工作区
                  </button>
                  <button
                    onClick={onOpenOnboarding}
                    className="flex items-center gap-2 px-5 py-3 bg-white border border-teal-900/10 rounded-2xl text-xs font-bold text-foreground hover:bg-teal-900/5 transition-all"
                  >
                    <Sparkles size={14} />
                    重新查看引导
                  </button>
                  <button
                    onClick={onNavigateToChat}
                    className="flex items-center gap-2 px-5 py-3 bg-white border border-teal-900/10 rounded-2xl text-xs font-bold text-foreground hover:bg-teal-900/5 transition-all"
                  >
                    <ArrowRight size={14} />
                    先看看 AI 助手
                  </button>
                </div>
              </div>
              <div className="hidden md:flex flex-col items-center justify-center min-w-[180px] rounded-[2rem] border border-dashed border-accent/20 bg-white/70 px-5 py-6 text-center">
                <motion.div
                  animate={{ y: [0, -8, 0], opacity: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                  className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center"
                >
                  <UploadCloud size={26} />
                </motion.div>
                <p className="mt-4 text-xs font-bold text-foreground">也可以直接拖拽文件到下方区域</p>
                <p className="mt-2 text-2xs text-muted leading-relaxed">支持 PDF / DOCX / MD / TXT，导入后会自动进入索引队列。</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-teal-900/10 bg-white/70 p-6 shadow-glass">
            <p className="text-2xs font-black uppercase tracking-[0.22em] text-muted">AI 状态</p>
            <div className="mt-4 space-y-3">
              <div className={`rounded-2xl border px-4 py-3 ${aiChatReady ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                <p className="text-xs font-bold">AI 对话 {aiChatReady ? '已就绪' : '暂未就绪'}</p>
                <p className="mt-1 text-2xs leading-relaxed">{aiChatReady ? '可以直接基于便签发起提问。' : '请先启动 Ollama 并安装对话模型。'}</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${aiRagReady ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                <p className="text-xs font-bold">知识检索 {aiRagReady ? '已就绪' : '等待资料与向量模型'}</p>
                <p className="mt-1 text-2xs leading-relaxed">{aiRagReady ? '聊天中已可启用 RAG 增强。' : '先导入资料并完成索引，AI 才能根据知识库回答。'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search results area (rendered by KBSearchPanel) */}

      {/* Tag filter */}
      <KBTagFilter
        allFileTags={allFileTags}
        selectedTagFilter={selectedTagFilter}
        onSetSelectedTagFilter={onSetSelectedTagFilter}
      />

      {/* Stats bar */}
      <KBStatsBar
        fileCount={files.length}
        indexedFileCount={indexedFileCount}
        activeIndexingCount={activeIndexingCount}
        totalStorageMB={totalStorageMB}
      />

      {highlightedFileIds.length > 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-[1.75rem] border border-accent/15 bg-accent/5 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-foreground">已为你标出本次导入的示例资料</p>
            <p className="mt-1 text-2xs leading-relaxed text-muted">这些文件会优先显示在列表前面，方便你立即试用搜索、摘要和 AI 问答。</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-2xs font-bold text-accent">{highlightedFileIds.length} 份资料</span>
        </div>
      )}

      {/* Web clipper */}
      <KBWebClipper onClipWebPage={onClipWebPage} />

      {/* Graph view */}
      {kbViewMode === 'graph' && (
        <div className="flex-1 min-h-0 pb-2">
          <div className="h-full rounded-3xl border border-teal-900/10 bg-gradient-to-br from-white/90 to-white/40 shadow-glass p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <GitBranch size={14} />
                </div>
                <span className="text-xs font-bold text-muted">知识图谱 · {kbGraphData.nodes.length} 节点 / {kbGraphData.links.length} 连接</span>
              </div>
            </div>
            <div className="relative w-full overflow-hidden rounded-2xl bg-white/60 border border-teal-900/5" style={{ height: '500px' }}>
              <KbGraphVisualization
                nodes={kbGraphData.nodes}
                links={kbGraphData.links}
                {...(onNodeClick ? { onNodeClick } : {})}
              />
              {kbGraphData.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3">
                      <GitBranch size={20} />
                    </div>
                    <p className="text-sm font-bold mb-1">图谱数据为空</p>
                    <p className="text-xs text-muted">请先导入文件到知识库</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span>文件 ({kbGraphData.nodes.filter((n: any) => n.type === 'file').length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>便签 ({kbGraphData.nodes.filter((n: any) => n.type === 'memo').length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-zinc-300 border-dashed" />
                <span>关联 ({kbGraphData.links.length})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {kbViewMode === 'list' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 flex-1 min-h-0 pb-2">
          <KBFolderTree
            folders={folders}
            selectedFolderId={selectedVirtualFolder || 'default'}
            onSelectFolder={(id) => onSelectVirtualFolder(id === 'default' ? null : id)}
            onCreateFolder={onCreateKbFolder}
            onRenameFolder={onRenameKbFolder}
            onDeleteFolder={onDeleteKbFolder}
          />
          <KBFileList
            files={files}
            visibleFiles={visibleFiles}
            fileTypeStats={fileTypeStats}
            kbSort={kbSort}
            isDragging={isDragging}
            folders={folders}
            selectedFolderId={selectedVirtualFolder || 'default'}
            onSetSort={onSetSort}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDeleteFile={onDeleteFile}
            onOpenPDF={onOpenPDF}
            onGenerateSummary={onGenerateSummary}
            onSetSelectedTagFilter={onSetSelectedTagFilter}
            onUpdateFileTags={onUpdateFileTags}
            onRelinkFile={onRelinkFile}
            onShowImportDialog={onShowImportDialog}
            highlightedFileIds={highlightedFileIds}
          />
          <KBIndexQueue indexingEntries={indexingEntries} />
        </div>
      )}

      {/* Import dialog */}
      <KBImportDialog
        isOpen={showImportDialog}
        filePaths={pendingImportPaths}
        folders={folders}
        defaultFolderId={selectedVirtualFolder || 'default'}
        onClose={onCloseImportDialog}
        onConfirm={onConfirmImport}
      />
    </motion.div>
  );
};

export default KnowledgeBasePanel;
