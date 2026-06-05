import React from 'react';
import { motion } from 'framer-motion';
import { Database, CheckSquare } from 'lucide-react';
import { highlightText } from '../../utils/helpers';

interface KBSimpleFileListProps {
  filteredFiles: any[];
  totalFiles: number;
  viewMode: 'grid' | 'list';
  selectedFile: any | null;
  onSelectFile: (file: any) => void;
  onFileDoubleClick: (file: any) => void;
  onFileContextMenu: (fileId: string, e: React.MouseEvent) => void;
  getFileIcon: (fileType: string, size?: number) => React.ReactNode;
  formatDate: (dateStr?: string) => string;
  formatFileSize: (bytes?: number) => string;
  indexingProgress: Record<string, { status: string; progress: number }>;
  onImportFiles: () => void;
  searchQuery?: string;
  isSelectMode?: boolean;
  selectedFileIds?: Set<string>;
  onToggleFileSelection?: (fileId: string) => void;
}

const getSnippet = (text: string, query: string, maxLen = 100): string => {
  if (!text || !query.trim()) return '';
  const lower = text.toLowerCase();
  const keywords = query.split(/\s+/).filter(Boolean);
  let bestPos = 0;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx !== -1) { bestPos = idx; break; }
  }
  const start = Math.max(0, bestPos - 20);
  const end = Math.min(text.length, start + maxLen);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
};

const PLATFORM_TAGS = ['微信公众号', 'B站', '小红书', '微博', '知乎', 'V2EX', '雪球', '抖音'] as const;

const parseFileTags = (file: any): string[] => {
  try {
    if (typeof file?.tags === 'string') {
      return JSON.parse(file.tags || '[]');
    }
    return Array.isArray(file?.tags) ? file.tags : [];
  } catch {
    return [];
  }
};

const getPlatformTags = (file: any): string[] => {
  const tags = parseFileTags(file);
  const ordered = PLATFORM_TAGS.filter(tag => tags.includes(tag));
  return ordered.slice(0, 3);
};

const getPlatformTagClassName = (tag: string): string => {
  switch (tag) {
    case '微信公众号':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/15';
    case 'B站':
      return 'bg-sky-500/10 text-sky-700 border-sky-500/15';
    case '小红书':
      return 'bg-rose-500/10 text-rose-700 border-rose-500/15';
    case '微博':
      return 'bg-orange-500/10 text-orange-700 border-orange-500/15';
    case '知乎':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/15';
    case 'V2EX':
      return 'bg-slate-500/10 text-slate-700 border-slate-500/15';
    case '雪球':
      return 'bg-red-500/10 text-red-700 border-red-500/15';
    case '抖音':
      return 'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/15';
    default:
      return 'bg-slate-500/10 text-slate-700 border-slate-500/15';
  }
};

const KBSimpleFileList: React.FC<KBSimpleFileListProps> = ({
  filteredFiles,
  totalFiles,
  viewMode,
  selectedFile,
  onSelectFile,
  onFileDoubleClick,
  onFileContextMenu,
  getFileIcon,
  formatDate,
  formatFileSize,
  indexingProgress,
  onImportFiles,
  searchQuery = '',
  isSelectMode = false,
  selectedFileIds = new Set(),
  onToggleFileSelection,
}) => {
  if (filteredFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Database size={28} className="text-accent" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1.5">
            {totalFiles === 0 ? '书架是空的' : '没有匹配的文件'}
          </h3>
          <p className="text-sm text-muted mb-4">
            {totalFiles === 0 ? '导入资料让 AI 帮你检索和理解' : '试试调整筛选条件'}
          </p>
          {totalFiles === 0 && (
            <button onClick={onImportFiles} className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> 导入第一批资料
            </button>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="flex-1 overflow-y-auto space-y-1">
        {filteredFiles.map((file) => {
          const platformTags = getPlatformTags(file);
          return (
            <motion.div
              key={file.id}
              whileHover={{ x: 2 }}
              onClick={() => {
                if (isSelectMode) {
                  onToggleFileSelection?.(file.id);
                } else {
                  onSelectFile(file);
                }
              }}
              onDoubleClick={() => !isSelectMode && onFileDoubleClick(file)}
              onContextMenu={(e) => onFileContextMenu(file.id, e)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                isSelectMode && selectedFileIds.has(file.id)
                  ? 'bg-accent/10 border border-accent/30'
                  : selectedFile?.id === file.id
                    ? 'bg-accent/5 border border-accent/20'
                    : 'hover:bg-white/60 border border-transparent'
              }`}
            >
              {isSelectMode && (
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${
                  selectedFileIds.has(file.id)
                    ? 'bg-accent border-accent text-white'
                    : 'border-gray-300 bg-white'
                }`}>
                  {selectedFileIds.has(file.id) && <span className="text-2xs">✓</span>}
                </div>
              )}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelectMode && selectedFileIds.has(file.id) ? 'bg-accent/10' :
                selectedFile?.id === file.id ? 'bg-accent/10' : 'bg-slate-100'
              }`}>
                {getFileIcon(file.file_type || '.txt', 18)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{highlightText(file.title || file.file_name, searchQuery)}</p>
                {platformTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {platformTags.map((tag) => (
                      <span key={tag} className={`px-1.5 py-0.5 text-2xs rounded-full border ${getPlatformTagClassName(tag)}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {searchQuery && file.content && (
                  <p className="text-2xs text-muted mt-0.5 line-clamp-1">
                    {highlightText(getSnippet(file.content, searchQuery), searchQuery)}
                  </p>
                )}
                <div className="flex items-center gap-2 text-2xs text-muted mt-0.5">
                  {file.added_at && <span>{formatDate(file.added_at)}</span>}
                  {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                  {indexingProgress[file.id] ? (
                    <span className="text-accent animate-pulse">处理中</span>
                  ) : file.is_indexed ? (
                    <span className="text-emerald-600">已索引</span>
                  ) : (
                    <span className="text-amber-600">未索引</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto grid grid-cols-3 xl:grid-cols-4 gap-3 content-start">
      {filteredFiles.map((file) => {
        const platformTags = getPlatformTags(file);
        return (
          <motion.div
            key={file.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => {
              if (isSelectMode) {
                onToggleFileSelection?.(file.id);
              } else {
                onSelectFile(file);
              }
            }}
            onDoubleClick={() => !isSelectMode && onFileDoubleClick(file)}
            onContextMenu={(e) => onFileContextMenu(file.id, e)}
            className={`bg-white/60 border rounded-xl p-3.5 cursor-pointer transition-all relative ${
              isSelectMode && selectedFileIds.has(file.id)
                ? 'border-accent ring-2 ring-accent/20 bg-accent/5'
                : selectedFile?.id === file.id
                  ? 'border-accent ring-2 ring-accent/20 bg-accent/5'
                  : 'border-teal-900/10 hover:border-accent/30'
            }`}
          >
            {isSelectMode && (
              <div className={`absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center border ${
                selectedFileIds.has(file.id)
                  ? 'bg-accent border-accent text-white'
                  : 'border-gray-300 bg-white'
              }`}>
                {selectedFileIds.has(file.id) && <span className="text-2xs">✓</span>}
              </div>
            )}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
              isSelectMode && selectedFileIds.has(file.id) ? 'bg-accent/10' :
              selectedFile?.id === file.id ? 'bg-accent/10' : 'bg-slate-100'
            }`}>
              {getFileIcon(file.file_type || '.txt', 20)}
            </div>
            <p className="font-medium text-sm text-foreground truncate">{highlightText(file.title || file.file_name, searchQuery)}</p>
            {platformTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {platformTags.map((tag) => (
                  <span key={tag} className={`px-1.5 py-0.5 text-2xs rounded-full border ${getPlatformTagClassName(tag)}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-2xs text-muted mt-1">{formatDate(file.added_at)}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

export default KBSimpleFileList;
