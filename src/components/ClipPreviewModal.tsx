import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, Copy, Trash2, Edit3, ScanText } from 'lucide-react';
import { logger } from '../utils/logger';
import ClipAnnotator from './ClipAnnotator';
import { useAppStore } from '../store/appStore';

interface ClipPreviewModalProps {
  isOpen: boolean;
  clip: any | null;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
}

const ClipPreviewModal: React.FC<ClipPreviewModalProps> = ({ isOpen, clip, onClose, onDeleted, onUpdated }) => {
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [annotatedImageData, setAnnotatedImageData] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [ocrEditTitle, setOcrEditTitle] = useState('OCR 识别结果');
  const [ocrEditContent, setOcrEditContent] = useState('');
  const [showOcrModal, setShowOcrModal] = useState(false);
  const selectedModel = useAppStore(s => s.selectedModel);
  const cloudModelIdMap = useAppStore(s => s.cloudModelIdMap);

  useEffect(() => {
    if (clip) {
      setDescription(clip.user_description || '');
      setAnnotatedImageData(null);
      setOcrResult(null);
      setShowOcrModal(false);
    }
  }, [clip]);

  const handleOcr = async () => {
    if (!clip?.image_data) return;
    setOcrLoading(true);
    try {
      const result = await window.ipcRenderer.invoke('clipboard-ocr', {
        imageBase64: clip.image_data,
        cloudModelId: cloudModelIdMap[selectedModel],
      });
      if (result?.text) {
        setOcrResult(result.text);
        setOcrEditContent(result.text);
        setOcrEditTitle('OCR 识别结果');
        setShowOcrModal(true);
      } else if (result?.error) {
        setOcrResult(result.error);
        setOcrEditContent(result.error);
        setOcrEditTitle('OCR 识别失败');
        setShowOcrModal(true);
      }
    } catch (err) {
      logger.error('OCR failed', err);
      setOcrResult('OCR 识别失败');
      setOcrEditContent('OCR 识别失败，请确认已安装 Tesseract OCR');
      setOcrEditTitle('OCR 识别失败');
      setShowOcrModal(true);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSaveOcrToNote = async () => {
    try {
      await window.ipcRenderer.invoke('save-ocr-to-note', { title: ocrEditTitle, content: ocrEditContent });
      setShowOcrModal(false);
    } catch (err) {
      logger.error('Save OCR to note failed', err);
    }
  };

  const handleSaveOcrToKb = async () => {
    try {
      await window.ipcRenderer.invoke('save-ocr-to-kb', { title: ocrEditTitle, content: ocrEditContent });
      setShowOcrModal(false);
    } catch (err) {
      logger.error('Save OCR to KB failed', err);
    }
  };

  const handleSave = async () => {
    if (!clip) return;
    setSaving(true);
    try {
      await window.ipcRenderer.invoke('update-clip-description', { id: clip.id, description: description.trim() });
      onUpdated();
      onClose();
    } catch (err: any) {
      logger.error('Failed to update description', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnnotatedImage = async (annotatedData: string) => {
    if (!clip) return;
    setShowAnnotator(false);

    try {
      // 保存标注后的图片
      const result = await window.ipcRenderer.invoke('save-clip', { type: 'image', content: annotatedData, userDescription: description.trim() || undefined });
      if (result && result.id) {
        // 删除原图
        await window.ipcRenderer.invoke('delete-clip', clip.id);
        onUpdated();
        onClose();
      }
    } catch (err: any) {
      logger.error('Failed to save annotated image', err);
    }
  };

  const handleCopyImage = async () => {
    if (!clip?.thumbnail_path) return;
    try {
      await window.ipcRenderer.invoke('copy-clip-to-clipboard', { thumbnailPath: clip.thumbnail_path });
    } catch (err) {
      logger.error('Failed to copy image', err);
    }
  };

  const handleDelete = async () => {
    if (!clip) return;
    if (!confirm('确定要删除这张截图吗？')) return;
    setDeleting(true);
    try {
      await window.ipcRenderer.invoke('delete-clip', clip.id);
      onDeleted();
      onClose();
    } catch (err: any) {
      logger.error('Failed to delete clip', err);
    } finally {
      setDeleting(false);
    }
  };

  // 显示标注器
  if (showAnnotator && clip?.image_data) {
    return createPortal(
      <ClipAnnotator imageData={annotatedImageData || clip.image_data} onSave={handleSaveAnnotatedImage} onClose={() => setShowAnnotator(false)} />,
      document.body
    );
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && clip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
            >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-gray-800">截图详情</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {clip.type === 'image' && (clip.image_data || annotatedImageData) && (
                <div className="p-5 border-b border-gray-100 bg-gray-50">
                  <img src={annotatedImageData || clip.image_data} alt="" className="w-full max-h-64 object-contain rounded-lg" />
                </div>
              )}

              <div className="p-5">
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">截图描述</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="添加描述..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-colors"
                    maxLength={100}
                  />
                  <p className="text-2xs text-gray-400 mt-1 text-right">{description.length}/100</p>
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                  <p>创建时间：{new Date(clip.created_at * 1000).toLocaleString('zh-CN')}</p>
                  {clip.tags && clip.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {clip.tags.map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-500 text-2xs rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex justify-between shrink-0">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                删除
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyImage}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Copy size={12} />
                  复制
                </button>
                <button
                  onClick={() => setShowAnnotator(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <Edit3 size={12} />
                  标注
                </button>
                {clip.type === 'image' && (
                  <button
                    onClick={handleOcr}
                    disabled={ocrLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {ocrLoading ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />}
                    OCR 识别
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 text-white text-xs font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {showOcrModal && createPortal(
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={() => setShowOcrModal(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-[480px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-gray-800">OCR 识别结果</h3>
            <button onClick={() => setShowOcrModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">标题</label>
              <input
                type="text"
                value={ocrEditTitle}
                onChange={(e) => setOcrEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">识别内容</label>
              <textarea
                value={ocrEditContent}
                onChange={(e) => setOcrEditContent(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 resize-none font-mono"
              />
            </div>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
            <button
              onClick={() => setShowOcrModal(false)}
              className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleSaveOcrToNote}
              className="px-4 py-2 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
              保存为便签
            </button>
            <button
              onClick={handleSaveOcrToKb}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
            >
              导入知识库
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export default ClipPreviewModal;
