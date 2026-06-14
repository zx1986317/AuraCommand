import React from 'react';
import {
  Database, HardDrive, Clock, Cpu, Sparkles, Eye,
  Folder
} from 'lucide-react';

interface KBFolder {
  id: string;
  name: string;
  parent_id?: string;
}

interface KBFileDetailProps {
  selectedFile: any | null;
  selectedFileTags: string[];
  indexingProgress: Record<string, { status: string; progress: number }>;
  copilotCollapsed: boolean;
  kbFolders: KBFolder[];
  onPreview: (fileId: string) => void;

  onDelete: (file: any) => void;
  onMoveToFolder: ((fileId: string, folderId: string | null) => void) | undefined;
  onRefreshFiles: (() => void) | undefined;
  onGenerateSummary: ((fileId: string) => Promise<{ success: boolean; error?: string }>) | undefined;
  setNotification: ((n: { message: string; type: 'info' | 'success' | 'error' | 'warning' } | null) => void) | undefined;
  getFileIcon: (fileType: string, size?: number) => React.ReactNode;
  formatDate: (dateStr?: string) => string;
  formatFileSize: (bytes?: number) => string;
  getStatusLabel: (status: string) => string;
  getStatusColor: (status: string) => string;
  getProgressBarColor: (status: string) => string;
  digestFacts: string[];
}

const PLATFORM_TAGS = ['微信公众号', 'B站', '小红书', '微博', '知乎', 'V2EX', '雪球', '抖音'] as const;

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

const KBFileDetail: React.FC<KBFileDetailProps> = ({
  selectedFile,
  selectedFileTags,
  indexingProgress,
  copilotCollapsed,
  kbFolders,
  onPreview,


  onDelete,
  onMoveToFolder,
  onRefreshFiles,
  onGenerateSummary,
  setNotification,
  getFileIcon,
  formatDate,
  formatFileSize,
  getStatusLabel,
  getStatusColor,
  getProgressBarColor,
  digestFacts,
}) => {
  if (copilotCollapsed || !selectedFile) {
    if (copilotCollapsed) return null;
    return (
      <div className="bg-white/40 border border-teal-900/10 rounded-xl p-6 flex-shrink-0 text-center">
        <Database size={24} className="mx-auto text-muted mb-2" />
        <p className="text-xs text-muted">选择文件查看详情</p>
      </div>
    );
  }

  const platformTags = selectedFileTags.filter(tag => PLATFORM_TAGS.includes(tag as typeof PLATFORM_TAGS[number]));
  const normalTags = selectedFileTags.filter(tag => !PLATFORM_TAGS.includes(tag as typeof PLATFORM_TAGS[number]));

  return (
    <div className="bg-white/40 border border-teal-900/10 rounded-xl p-4 flex-shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          {getFileIcon(selectedFile.file_type || '.txt', 22)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{selectedFile.title || selectedFile.file_name}</p>
          <p className="text-2xs text-muted truncate">{selectedFile.file_path}</p>
        </div>
      </div>

      {/* 元数据 */}
      <div className="space-y-1.5 mb-3">
        {selectedFile.file_size && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <HardDrive size={11} /> {formatFileSize(selectedFile.file_size)}
          </div>
        )}
        {selectedFile.added_at && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Clock size={11} /> {formatDate(selectedFile.added_at)}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          {indexingProgress[selectedFile.id] ? (
            <>
              <Cpu size={11} className={getStatusColor(indexingProgress[selectedFile.id]!.status)} />
              <span className={getStatusColor(indexingProgress[selectedFile.id]!.status)}>
                {getStatusLabel(indexingProgress[selectedFile.id]!.status)}
                {indexingProgress[selectedFile.id]!.status === 'vectorizing' && ` ${indexingProgress[selectedFile.id]!.progress}%`}
              </span>
            </>
          ) : (
            <>
              <Cpu size={11} className={selectedFile.is_indexed ? 'text-emerald-600' : 'text-amber-600'} />
              <span className={selectedFile.is_indexed ? 'text-emerald-600' : 'text-amber-600'}>
                {selectedFile.is_indexed ? '已索引' : '未索引'}
              </span>
            </>
          )}
        </div>
        {indexingProgress[selectedFile.id] && indexingProgress[selectedFile.id]!.status !== 'error' && (
          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(indexingProgress[selectedFile.id]!.status)}`}
              style={{ width: `${indexingProgress[selectedFile.id]!.progress || 0}%` }}
            />
          </div>
        )}
      </div>

      {/* 来源平台 */}
      {platformTags.length > 0 && (
        <div className="mb-3">
          <p className="text-2xs text-muted mb-1">来源平台</p>
          <div className="flex flex-wrap gap-1">
            {platformTags.map((tag: string, i: number) => (
              <span key={i} className={`px-2 py-0.5 rounded-full text-2xs border ${getPlatformTagClassName(tag)}`}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 标签 */}
      {normalTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {normalTags.map((tag: string, i: number) => (
            <span key={i} className="px-2 py-0.5 bg-teal-900/5 text-muted rounded-full text-2xs">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-0.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>{tag}
            </span>
          ))}
        </div>
      )}

      {/* 摘要 */}
      {selectedFile.summary ? (
        <p className="text-xs text-muted mb-3 line-clamp-3 leading-relaxed">{selectedFile.summary}</p>
      ) : (
        <button
          onClick={async () => {
            if (!window.ipcRenderer || !onGenerateSummary) return;
            setNotification?.({ message: '正在生成摘要...', type: 'info' });
            const result = await onGenerateSummary(selectedFile.id);
            if (result.success) {
              setNotification?.({ message: '摘要生成成功', type: 'success' });
              if (onRefreshFiles) onRefreshFiles();
            } else {
              setNotification?.({ message: result.error || '生成失败', type: 'error' });
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 border border-dashed border-teal-900/20 bg-teal-900/5 rounded-lg text-xs text-muted hover:bg-teal-900/10 hover:text-foreground transition-all mb-3"
        >
          <Sparkles size={12} /> 生成摘要
        </button>
      )}

      {/* 关键要点 */}
      {digestFacts.length > 0 && (
        <div className="mb-3">
          <p className="text-2xs text-muted font-medium mb-1.5 flex items-center gap-1">
            <Sparkles size={10} /> 关键要点
          </p>
          <ul className="space-y-1">
            {digestFacts.map((fact, i) => (
              <li key={i} className="text-2xs text-muted leading-relaxed pl-3 relative">
                <span className="absolute left-0 top-1.5 w-1 h-1 rounded-full bg-accent/40" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <button onClick={() => onPreview(selectedFile.id)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 border border-teal-900/10 bg-white rounded-lg text-xs font-medium text-foreground hover:bg-teal-900/5 transition-all">
          <Eye size={12} /> 预览内容
        </button>

        <button onClick={() => onDelete(selectedFile)} className="p-1.5 border border-red-200 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 transition-all">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
      {/* 移动到文件夹 */}
      {onMoveToFolder && (
        <div className="mt-2">
          <label className="text-2xs text-muted block mb-1">移动到文件夹</label>
          <div className="flex flex-wrap gap-1">
            {kbFolders.map(folder => (
              <button
                key={folder.id}
                onClick={() => onMoveToFolder(selectedFile.id, folder.id)}
                className={`px-2 py-0.5 rounded text-2xs border transition-all ${
                  selectedFile.folder_id === folder.id
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-white border-teal-900/10 text-muted hover:bg-teal-900/5'
                }`}
              >
                <Folder size={9} className="inline mr-0.5" />{folder.name}
              </button>
            ))}
            {selectedFile.folder_id && (
              <button
                onClick={() => onMoveToFolder(selectedFile.id, null)}
                className="px-2 py-0.5 rounded text-2xs border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all"
              >
                取消归类
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KBFileDetail;
