import React, { useState } from 'react';
import { X, FolderOpen, Link2, Copy, ArrowRight } from 'lucide-react';
import type { KBFolder } from '../../types';

interface KBImportDialogProps {
  isOpen: boolean;
  filePaths: string[];
  folders: KBFolder[];
  defaultFolderId: string;
  onClose: () => void;
  onConfirm: (mode: 'reference' | 'copy', folderId: string) => void;
}

const KBImportDialog: React.FC<KBImportDialogProps> = ({
  isOpen, filePaths, folders, defaultFolderId, onClose, onConfirm
}) => {
  const [mode, setMode] = useState<'reference' | 'copy'>('reference');
  const [folderId, setFolderId] = useState(defaultFolderId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[440px] rounded-3xl bg-white border border-teal-900/10 shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">导入文件</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal-900/5 text-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="mb-5">
          <p className="text-xs font-medium text-muted mb-2">即将导入 {filePaths.length} 个文件：</p>
          <div className="max-h-24 overflow-y-auto rounded-xl bg-teal-50/50 border border-teal-900/5 p-2 space-y-1">
            {filePaths.map((p, i) => (
              <p key={i} className="text-2xs text-muted font-mono truncate">{p}</p>
            ))}
          </div>
        </div>

        {/* Mode selection */}
        <div className="mb-5">
          <p className="text-2xs font-bold uppercase tracking-wider text-muted mb-2">导入模式</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('reference')}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                mode === 'reference'
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-teal-900/10 bg-white/70 text-muted hover:border-accent/20'
              }`}
            >
              <Link2 size={18} />
              <span className="text-2xs font-bold">引用模式</span>
              <span className="text-xs text-muted/70 text-center leading-tight">不复制文件，引用原路径</span>
            </button>
            <button
              onClick={() => setMode('copy')}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                mode === 'copy'
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-teal-900/10 bg-white/70 text-muted hover:border-accent/20'
              }`}
            >
              <Copy size={18} />
              <span className="text-2xs font-bold">复制模式</span>
              <span className="text-xs text-muted/70 text-center leading-tight">复制到知识库存储目录</span>
            </button>
          </div>
        </div>

        {/* Folder selection */}
        <div className="mb-6">
          <p className="text-2xs font-bold uppercase tracking-wider text-muted mb-2">目标文件夹</p>
          <div className="space-y-1 max-h-32 overflow-y-auto rounded-xl border border-teal-900/5 p-1">
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setFolderId(folder.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                  folderId === folder.id
                    ? 'bg-accent/5 text-accent border border-accent/10'
                    : 'text-muted hover:bg-teal-50/50'
                }`}
              >
                <FolderOpen size={13} />
                <span>{folder.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted border border-teal-900/10 hover:bg-teal-50/50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(mode, folderId)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent/90 transition-colors"
          >
            <ArrowRight size={13} />
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
};

export default KBImportDialog;