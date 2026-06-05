import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, AlertCircle } from 'lucide-react';

interface AddClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const AddClipModal: React.FC<AddClipModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      setImageData(null);
      setDescription('');
      window.ipcRenderer.invoke('read-clipboard-image-preview').then((result: any) => {
        setLoading(false);
        if (result && result.image) {
          setImageData(result.image);
        } else if (result && result.error) {
          setError(result.error);
        }
      }).catch((err: any) => {
        setLoading(false);
        setError(err.message || '读取剪贴板失败');
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (imageData && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [imageData]);

  const handleSave = async () => {
    if (!imageData) return;
    setSaving(true);
    try {
      const result = await window.ipcRenderer.invoke('save-clip', { type: 'image', content: imageData, userDescription: description.trim() || undefined });
      if (result && result.id) {
        onSaved();
        onClose();
      } else if (result && result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">添加截图</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={24} className="animate-spin text-purple-400" />
                  <p className="text-xs text-gray-400">读取剪贴板...</p>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <AlertCircle size={32} className="text-gray-300" />
                  <p className="text-sm text-gray-500">{error}</p>
                  <p className="text-2xs text-gray-400 mt-1">请先用截图工具截图（Win+Shift+S）</p>
                </div>
              )}

              {imageData && !loading && (
                <>
                  <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 mb-4">
                    <img src={imageData} alt="预览" className="w-full max-h-64 object-contain" />
                  </div>
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">截图描述</label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                      placeholder="简单说明一下这个截图的用途..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-colors"
                      maxLength={100}
                    />
                    <p className="text-2xs text-gray-400 mt-1 text-right">{description.length}/100</p>
                  </div>
                </>
              )}
            </div>

            {imageData && !loading && (
              <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 text-white text-xs font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      保存截图
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddClipModal;
