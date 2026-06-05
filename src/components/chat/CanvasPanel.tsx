import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, ExternalLink, RotateCw, Minimize2, Maximize2 } from 'lucide-react';

interface CanvasPanelProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  title?: string;
}

const CanvasPanel: React.FC<CanvasPanelProps> = ({
  isOpen,
  onClose,
  htmlContent,
  title = '画布预览',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (isOpen && iframeRef.current) {
      setRefreshKey(prev => prev + 1);
    }
  }, [htmlContent, isOpen]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, [htmlContent]);

  if (!isOpen) return null;

  return (
    <div
      className={`flex flex-col border-l border-teal-900/10 bg-white transition-all duration-300 ease-in-out ${
        isFullscreen ? 'fixed inset-0 z-50' : 'w-[45%] min-w-[320px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-teal-900/10 bg-white/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-bold text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="p-1.5 hover:bg-teal-900/5 rounded-lg text-muted hover:text-accent transition-all"
            title="刷新预览"
          >
            <RotateCw size={13} />
          </button>
          <button
            onClick={handleOpenExternal}
            className="p-1.5 hover:bg-teal-900/5 rounded-lg text-muted hover:text-accent transition-all"
            title="在新窗口打开"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            className="p-1.5 hover:bg-teal-900/5 rounded-lg text-muted hover:text-accent transition-all"
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-hidden bg-gray-50 relative">
        {htmlContent ? (
          <iframe
            ref={iframeRef}
            key={refreshKey}
            title="canvas-preview"
            srcDoc={htmlContent}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted/40">
            <div className="w-16 h-16 rounded-2xl bg-teal-900/5 flex items-center justify-center mb-3">
              <ExternalLink size={24} />
            </div>
            <p className="text-xs font-medium">等待内容输出...</p>
            <p className="text-2xs mt-1">AI 生成的 HTML 将在此处实时预览</p>
          </div>
        )}

        {/* Close button - bottom right */}
        <button
          onClick={onClose}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/90 hover:bg-red-500 text-white shadow-lg hover:shadow-xl transition-all text-xs font-medium backdrop-blur-sm"
          title="关闭画布"
        >
          <X size={14} />
          关闭画布
        </button>
      </div>
    </div>
  );
};

export default CanvasPanel;
