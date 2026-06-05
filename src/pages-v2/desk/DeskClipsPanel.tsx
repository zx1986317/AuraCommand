import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clipboard, Trash2, FolderOpen, ZoomIn, ZoomOut, X, Loader2, Check, Copy, Edit3, ScanText } from 'lucide-react';
import { logger } from '../../utils/logger';
import ClipAnnotator from '../../components/ClipAnnotator';
import { useAppStore } from '../../store/appStore';

export interface DeskClipsPanelProps {
  previewClip: any | null;
  setPreviewClip: (clip: any | null) => void;
  clipSelectionMode: boolean;
  selectedClipIds: Set<string>;
  setShowGroupSelector: (v: boolean) => void;
  clipGroups: any[];
  loadClips: () => void;
}

const DeskClipsPanel: React.FC<DeskClipsPanelProps> = ({
  previewClip, setPreviewClip,
  clipSelectionMode, selectedClipIds,
  setShowGroupSelector,
  clipGroups,
  loadClips,
}) => {
  const [zoom, setZoom] = useState(1);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [annotatedImageData, setAnnotatedImageData] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrEditTitle, setOcrEditTitle] = useState('OCR 识别结果');
  const [ocrEditContent, setOcrEditContent] = useState('');
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [copying, setCopying] = useState(false);
  const selectedModel = useAppStore(s => s.selectedModel);
  const cloudModelIdMap = useAppStore(s => s.cloudModelIdMap);

  useEffect(() => {
    setZoom(1);
    if (previewClip) {
      setDescription(previewClip.user_description || '');
      setAnnotatedImageData(null);
      setShowOcrModal(false);
    }
  }, [previewClip?.id]);

  const handleSave = async () => {
    if (!previewClip) return;
    setSaving(true);
    try {
      await window.ipcRenderer.invoke('update-clip-description', { id: previewClip.id, description: description.trim() });
      loadClips();
    } catch (err) {
      logger.error('Failed to update description', err);
    } finally {
      setSaving(false);
    }
  };

  const handleOcr = async () => {
    if (!previewClip?.image_data) return;
    setOcrLoading(true);
    try {
      const result = await window.ipcRenderer.invoke('clipboard-ocr', {
        imageBase64: previewClip.image_data,
        cloudModelId: cloudModelIdMap[selectedModel],
      });
      if (result?.text) {
        setOcrEditContent(result.text);
        setOcrEditTitle('OCR 识别结果');
      } else if (result?.error) {
        setOcrEditContent(result.error);
        setOcrEditTitle('OCR 识别失败');
      }
      setShowOcrModal(true);
    } catch (err) {
      logger.error('OCR failed', err);
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

  const handleSaveAnnotatedImage = async (annotatedData: string) => {
    if (!previewClip) return;
    setShowAnnotator(false);
    try {
      const result = await window.ipcRenderer.invoke('save-clip', { type: 'image', content: annotatedData, userDescription: description.trim() || undefined });
      if (result && result.id) {
        await window.ipcRenderer.invoke('delete-clip', previewClip.id);
        loadClips();
        setPreviewClip(null);
      }
    } catch (err) {
      logger.error('Failed to save annotated image', err);
    }
  };

  const handleCopyImage = async () => {
    if (!previewClip?.thumbnail_path) return;
    setCopying(true);
    try {
      await window.ipcRenderer.invoke('copy-clip-to-clipboard', { thumbnailPath: previewClip.thumbnail_path });
    } catch (err) {
      logger.error('Failed to copy image', err);
    } finally {
      setCopying(false);
    }
  };

  if (showAnnotator && previewClip?.image_data) {
    return createPortal(
      <ClipAnnotator imageData={annotatedImageData || previewClip.image_data} onSave={handleSaveAnnotatedImage} onClose={() => setShowAnnotator(false)} />,
      document.body
    );
  }

  if (!previewClip) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-white/60 backdrop-blur-sm rounded-r-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Clipboard size={48} className="text-gray-200 mb-4" />
          <p className="text-sm text-gray-400 mb-2">选择一张截图预览</p>
          <p className="text-2xs text-gray-300">从左侧列表点击截图查看大图</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 bg-white/60 backdrop-blur-sm rounded-r-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Clipboard size={14} className="text-purple-500 flex-shrink-0" />
            <span className="text-xs font-bold text-gray-800 truncate">
              {previewClip.user_description || '截图'}
            </span>
            <span className="text-2xs text-gray-400 flex-shrink-0">
              {previewClip.created_at ? new Date(previewClip.created_at * 1000 || previewClip.created_at).toLocaleDateString('zh-CN') : ''}
            </span>
          </div>
          <button
            onClick={() => setPreviewClip(null)}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-50/30">
          {previewClip.image_data && (
            <img
              src={annotatedImageData || previewClip.image_data}
              alt=""
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="max-w-full max-h-full object-contain rounded-lg shadow-md transition-transform duration-200"
            />
          )}
        </div>

        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加描述..."
              className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-colors"
              maxLength={100}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white text-2xs font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              保存
            </button>
          </div>
          <p className="text-2xs text-gray-400 mt-0.5 text-right">{description.length}/100</p>
        </div>

        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between bg-white/80">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="缩小"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-2xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="放大"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 py-1 rounded-lg hover:bg-gray-100 text-2xs text-gray-500 hover:text-gray-700 transition-colors"
              title="重置缩放"
            >
              适应
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyImage}
              disabled={copying}
              className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              title="复制图片"
            >
              {copying ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
              复制
            </button>
            <button
              onClick={() => setShowAnnotator(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
              title="标注"
            >
              <Edit3 size={12} />
              标注
            </button>
            {previewClip.type === 'image' && (
              <button
                onClick={handleOcr}
                disabled={ocrLoading}
                className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                title="OCR 识别"
              >
                {ocrLoading ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />}
                OCR
              </button>
            )}
            {clipSelectionMode && selectedClipIds.size > 0 && clipGroups.length > 0 && (
              <button
                onClick={() => setShowGroupSelector(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <FolderOpen size={12} />
                加入组
              </button>
            )}
            <button
              onClick={async () => {
                if (!confirm('确定删除这张截图吗？')) return;
                await window.ipcRenderer.invoke('delete-clip', previewClip.id);
                setPreviewClip(null);
                loadClips();
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={12} />
              删除
            </button>
          </div>
        </div>
      </div>

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

export default DeskClipsPanel;
