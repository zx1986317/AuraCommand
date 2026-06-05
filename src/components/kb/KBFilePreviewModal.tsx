import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../../utils/logger';
import { X, Copy, FileText, Image, File, Loader2 } from 'lucide-react';
import PDFViewer from '../PDFViewer';

interface KBFilePreviewModalProps {
  isOpen: boolean;
  fileId: string | null;
  onClose: () => void;
  onOpenExternal?: (filePath: string, fileName: string) => void;
}

interface PreviewData {
  success: boolean;
  isMedia?: boolean;
  isPdf?: boolean;
  filePath?: string;
  fileName?: string;
  fileType?: string;
  content?: string;
  summary?: string;
  error?: string;
}

const KBFilePreviewModal: React.FC<KBFilePreviewModalProps> = ({
  isOpen,
  fileId,
  onClose,
  onOpenExternal
}) => {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!isOpen || !fileId) {
      setPreviewData(null);
      setPdfData(null);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      try {
        const result = await window.ipcRenderer.invoke('get-file-preview', { fileId });
        if (result?.success && result?.fileType === '.pdf') {
          result.isPdf = true;
          result.isMedia = false;
        }
        setPreviewData(result);

        if (result?.success && result?.fileType === '.pdf' && fileId) {
          const pdfResult = await window.ipcRenderer.invoke('read-pdf-file', { fileId });
          if (pdfResult?.success && pdfResult?.data) {
            const binary = atob(pdfResult.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            setPdfData(bytes);
          } else {
            setPdfData(null);
          }
        }
      } catch (err) {
        logger.error('Failed to load file preview', err);
        setPreviewData({ success: false, error: '加载预览失败' });
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [isOpen, fileId]);

  const handleCopyContent = () => {
    if (previewData?.content) {
      navigator.clipboard.writeText(previewData.content);
    }
  };

  const handleOpenExternal = () => {
    if (previewData?.filePath && onOpenExternal) {
      onOpenExternal(previewData.filePath, previewData.fileName || '文件');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (!fileType) return <File size={20} className="text-gray-400" />;
    const ext = fileType.toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) {
      return <Image size={20} className="text-blue-400" />;
    }
    if (ext === '.pdf') {
      return <File size={20} className="text-red-400" />;
    }
    return <FileText size={20} className="text-accent" />;
  };

  const isPdf = previewData?.isPdf;

  if (isOpen && isPdf && pdfData) {
    return (
      <PDFViewer
        pdfData={pdfData}
        fileName={previewData?.fileName || 'PDF'}
        onClose={onClose}
      />
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  {previewData ? getFileIcon(previewData.fileType || '') : <File size={20} className="text-gray-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{previewData?.fileName || '加载中...'}</h3>
                  <p className="text-2xs text-gray-400">
                    {previewData?.fileType?.toUpperCase().replace('.', '') || ''}
                    {previewData?.isMedia && ' (点击底部按钮使用系统预览)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewData && !previewData.isMedia && previewData.content && (
                  <button
                    onClick={handleCopyContent}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="复制内容"
                  >
                    <Copy size={16} />
                  </button>
                )}
                {previewData?.isMedia && (
                  <button
                    onClick={handleOpenExternal}
                    className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 transition-colors"
                  >
                    使用系统预览
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading && (
                <div className="flex items-center justify-center h-48">
                  <Loader2 size={24} className="text-accent animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">正在加载预览...</span>
                </div>
              )}

              {!loading && isPdf && !pdfData && (
                <div className="flex items-center justify-center h-48">
                  <Loader2 size={24} className="text-accent animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">正在加载PDF...</span>
                </div>
              )}

              {!loading && previewData?.error && (
                <div className="flex items-center justify-center h-48">
                  <p className="text-sm text-red-500">{previewData.error}</p>
                </div>
              )}

              {!loading && previewData?.success && previewData.isMedia && (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                    {getFileIcon(previewData.fileType || '')}
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-2">{previewData.fileName}</p>
                  <p className="text-xs text-gray-400">此文件类型需要使用系统程序预览</p>
                  {onOpenExternal && (
                    <button
                      onClick={handleOpenExternal}
                      className="mt-4 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
                    >
                      打开文件
                    </button>
                  )}
                </div>
              )}

              {!loading && previewData?.success && !previewData.isMedia && !isPdf && previewData.content && (
                <div className="space-y-4">
                  {previewData.summary && (
                    <div className="bg-accent/5 rounded-xl p-4 border border-accent/10">
                      <div className="text-2xs font-semibold text-accent uppercase tracking-wider mb-2">摘要</div>
                      <p className="text-sm text-gray-600 leading-relaxed">{previewData.summary}</p>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">内容</div>
                      <span className="text-2xs text-gray-400">
                        {previewData.content.length} 字符
                      </span>
                    </div>
                    <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono bg-white p-3 rounded-lg border border-gray-100 max-h-[50vh] overflow-y-auto">
                      {previewData.content}
                    </pre>
                  </div>
                </div>
              )}

              {!loading && previewData?.success && !previewData.isMedia && !isPdf && !previewData.content && (
                <div className="flex items-center justify-center h-48">
                  <p className="text-sm text-gray-500">文件内容为空或未索引</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KBFilePreviewModal;
