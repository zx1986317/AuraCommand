import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, RotateCcw, Eye, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';

interface Version {
  id: string;
  note_id: string;
  title: string;
  tags: string;
  created_at: string;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  noteId: string | null;
  onClose: () => void;
  onRestore: (versionId: string) => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  noteId,
  onClose,
  onRestore,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen && noteId) {
      loadVersions();
    }
  }, [isOpen, noteId]);

  const loadVersions = async () => {
    if (!noteId) return;
    setLoading(true);
    try {
      const result = await window.ipcRenderer.invoke('get-note-versions', { noteId });
      setVersions(result || []);
    } catch {
      setVersions([]);
    }
    setLoading(false);
  };

  const handlePreview = async (version: Version) => {
    setSelectedVersion(version);
    setPreviewLoading(true);
    try {
      const content = await window.ipcRenderer.invoke('get-note-version-content', { versionId: version.id });
      setPreviewContent(content?.content || '');
    } catch {
      setPreviewContent('');
    }
    setPreviewLoading(false);
  };

  const handleRestore = async (versionId: string) => {
    onRestore(versionId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-[800px] max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-accent" />
              <h2 className="text-sm font-bold text-gray-800">版本历史</h2>
              <span className="text-2xs text-gray-400">({versions.length} 个版本)</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            <div className="w-[280px] border-r border-gray-100 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="text-accent animate-spin" />
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                  <Clock size={24} className="mb-2" />
                  <p className="text-xs">暂无版本历史</p>
                </div>
              ) : (
                <div className="py-2">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => handlePreview(version)}
                      className={`w-full text-left px-4 py-3 transition-all ${
                        selectedVersion?.id === version.id
                          ? 'bg-accent/10 border-r-2 border-accent'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-2xs font-medium text-gray-700 truncate">
                          {version.title || '无标题'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-gray-400">
                          {new Date(version.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              {selectedVersion ? (
                <>
                  <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                    <div>
                      <h3 className="text-sm font-medium text-gray-800">{selectedVersion.title || '无标题'}</h3>
                      <p className="text-2xs text-gray-400 mt-0.5">
                        {new Date(selectedVersion.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore(selectedVersion.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-2xs font-medium rounded-lg hover:bg-accent/90 transition-all"
                    >
                      <RotateCcw size={12} />
                      恢复此版本
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    {previewLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={20} className="text-accent animate-spin" />
                      </div>
                    ) : (
                      <div
                        className="prose prose-sm max-w-none text-gray-600"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewContent) }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-300">
                  <div className="text-center">
                    <Eye size={24} className="mx-auto mb-2" />
                    <p className="text-xs">选择一个版本查看内容</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VersionHistoryModal;
