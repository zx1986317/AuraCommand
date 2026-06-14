import React from 'react';
import { X, ImageIcon, Send, Square, Database, Paperclip, FileText, Loader2 } from 'lucide-react';

interface ChatAttachment {
  name: string;
  text: string;
  size: number;
}

interface ChatInputAreaProps {
  chatInput: string;
  chatImages: string[];
  isChatLoading: boolean;
  fileRefOpen: boolean;
  fileRefQuery: string;
  fileRefResults: any[];
  fileRefSelectedIdx: number;
  attachedFiles: any[];
  chatAttachments: ChatAttachment[];
  attachmentLoading: boolean;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  attachmentInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (val: string) => void;
  onSendMessage: () => void;
  onStopChat: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachmentSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (idx: number) => void;
  onRemoveAttachment: (idx: number) => void;
  onAttachFile: (fileId: string) => void;
  onSearchFileRef: (query: string) => void;
  onFileRefOpenChange: (open: boolean) => void;
  onFileRefQueryChange: (query: string) => void;
  onFileRefSelectedIdxChange: (idx: number) => void;
  onAttachedFilesChange: (files: any[]) => void;
  fileRefMenuRef: React.RefObject<HTMLDivElement>;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  chatInput, chatImages, isChatLoading,
  fileRefOpen, fileRefQuery, fileRefResults, fileRefSelectedIdx, attachedFiles,
  chatAttachments, attachmentLoading,
  chatInputRef, fileInputRef, attachmentInputRef,
  onInputChange, onSendMessage, onStopChat, onFileSelect, onAttachmentSelect, onRemoveImage, onRemoveAttachment,
  onAttachFile, onSearchFileRef, onFileRefOpenChange, onFileRefQueryChange,
  onFileRefSelectedIdxChange, onAttachedFilesChange, fileRefMenuRef
}) => {
  return (
    <div className="flex-shrink-0 px-6 py-4 bg-white/30 border-t border-teal-900/5">
      <div className="relative">
        {/* Attached files from knowledge base */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachedFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 text-accent text-2xs rounded-lg border border-accent/20">
                <Database size={10} />
                <span className="truncate max-w-[120px]">{f.file_name}</span>
                <button onClick={() => onAttachedFilesChange(attachedFiles.filter((x: any) => x.id !== f.id))} className="text-accent/50 hover:text-accent">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chat attachments (uploaded files) */}
        {(chatAttachments.length > 0 || attachmentLoading) && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {chatAttachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 text-2xs rounded-lg border border-blue-200">
                <FileText size={10} />
                <span className="truncate max-w-[140px]">{att.name}</span>
                <span className="text-blue-400 text-2xs">({(att.size / 1024).toFixed(1)}KB)</span>
                <button onClick={() => onRemoveAttachment(idx)} className="text-blue-400 hover:text-red-500">
                  <X size={10} />
                </button>
              </div>
            ))}
            {attachmentLoading && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-500 text-2xs rounded-lg">
                <Loader2 size={10} className="animate-spin" />
                <span>解析中...</span>
              </div>
            )}
          </div>
        )}
        {chatImages.length > 0 && (
          <div className="absolute bottom-full left-0 mb-3 flex flex-wrap gap-2 p-3 bg-white/90 border border-teal-900/5 rounded-xl shadow-lg z-30">
            {chatImages.map((img, idx) => (
              <div key={idx} className="relative group/img w-16 h-16">
                <img src={img} alt="preview" className="w-full h-full object-cover rounded-lg border border-teal-900/10" />
                <button onClick={() => onRemoveImage(idx)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <input type="file" ref={fileInputRef} onChange={onFileSelect} accept="image/*" multiple className="hidden" />
        <input type="file" ref={attachmentInputRef} onChange={onAttachmentSelect} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json,.xml,.html,.pptx,.ppt" multiple className="hidden" />

        <textarea
          ref={chatInputRef}
          value={chatInput}
          onChange={(e) => {
            const val = e.target.value;
            onInputChange(val);
            const cursorPos = e.target.selectionStart || val.length;
            const textBefore = val.substring(0, cursorPos);
            const atIndex = textBefore.lastIndexOf('@');
            if (atIndex !== -1 && (atIndex === 0 || textBefore[atIndex - 1] === ' ' || textBefore[atIndex - 1] === '\n')) {
              const query = textBefore.substring(atIndex + 1);
              if (!query.includes(' ') && !query.includes('\n')) {
                onFileRefOpenChange(true);
                onFileRefQueryChange(query);
                onSearchFileRef(query);
                return;
              }
            }
            onFileRefOpenChange(false);
          }}
          onKeyDown={(e) => {
            if (fileRefOpen) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                onFileRefSelectedIdxChange(Math.min(fileRefSelectedIdx + 1, fileRefResults.length - 1));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                onFileRefSelectedIdxChange(Math.max(fileRefSelectedIdx - 1, 0));
                return;
              }
              if (e.key === 'Enter' && fileRefResults[fileRefSelectedIdx]) {
                e.preventDefault();
                onAttachFile(fileRefResults[fileRefSelectedIdx].id);
                const cursorPos = chatInputRef.current?.selectionStart || chatInput.length;
                const atIndex = chatInput.substring(0, cursorPos).lastIndexOf('@');
                if (atIndex !== -1) {
                  onInputChange(chatInput.substring(0, atIndex) + chatInput.substring(cursorPos));
                }
                return;
              }
              if (e.key === 'Escape') {
                onFileRefOpenChange(false);
                return;
              }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(); }
          }}
          placeholder="输入问题... (@引用知识库文件，Shift+Enter 换行)"
          rows={1}
          autoFocus
          className="w-full bg-white border border-teal-900/10 rounded-xl pl-12 pr-24 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all shadow-inner resize-none max-h-28"
        />

        {fileRefOpen && (
          <div
            ref={fileRefMenuRef}
            className="absolute bottom-full left-4 mb-2 z-50 bg-white rounded-xl border border-teal-900/10 shadow-xl w-72 max-h-48 overflow-y-auto"
          >
            <div className="px-3 py-1.5 text-2xs text-muted/50 font-medium uppercase tracking-wide border-b border-teal-900/5">
              引用知识库文件
            </div>
            {fileRefResults.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted/40 text-center">
                {fileRefQuery ? '未找到匹配文件' : '输入文件名搜索...'}
              </div>
            ) : (
              fileRefResults.map((file, idx) => (
                <button
                  key={file.id}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs transition-colors ${
                    idx === fileRefSelectedIdx ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-teal-900/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAttachFile(file.id);
                    const cursorPos = chatInputRef.current?.selectionStart || chatInput.length;
                    const atIndex = chatInput.substring(0, cursorPos).lastIndexOf('@');
                    if (atIndex !== -1) {
                      onInputChange(chatInput.substring(0, atIndex) + chatInput.substring(cursorPos));
                    }
                  }}
                >
                  <Database size={12} className="shrink-0 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{file.file_name}</div>
                    {file.summary && <div className="text-2xs text-muted/40 truncate">{file.summary}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <div className="absolute left-2 top-2 bottom-2 flex items-center gap-0.5 pointer-events-none">
          <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 flex items-center justify-center text-muted hover:text-accent hover:bg-accent/5 rounded-lg transition-all pointer-events-auto" title="上传图片">
            <ImageIcon size={16} />
          </button>
          <button onClick={() => attachmentInputRef.current?.click()} className="w-8 h-8 flex items-center justify-center text-muted hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all pointer-events-auto" title="上传附件（PDF/Word/Excel/PPT）">
            <Paperclip size={16} />
          </button>
        </div>

        <div className="absolute right-2 top-2 bottom-2 flex gap-1.5 pointer-events-none">
          {isChatLoading ? (
            <button onClick={onStopChat} className="px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all flex items-center justify-center pointer-events-auto" title="停止生成">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => onSendMessage()}
              disabled={!chatInput.trim() && chatImages.length === 0}
              className="px-4 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center pointer-events-auto"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInputArea;
