import React from 'react';
import { Minus, Square, X, Layers3 } from 'lucide-react';

interface WindowControlsProps {
  isMaximized: boolean;
}

const WindowControls: React.FC<WindowControlsProps> = ({ isMaximized }) => {
  const stopWindowDrag = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.ipcRenderer.invoke('window-min');
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.ipcRenderer.invoke('window-max');
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.ipcRenderer.invoke('window-close');
  };

  return (
    <div
      className="flex select-none items-center gap-2 no-drag pointer-events-auto"
      onMouseDown={stopWindowDrag}
      onDoubleClick={stopWindowDrag}
    >
      <button
        type="button"
        onClick={handleMinimize}
        onMouseDown={stopWindowDrag}
        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/60 border border-teal-900/5 hover:bg-zinc-100 active:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer shadow-glass group no-drag"
        title="最小化"
      >
        <Minus size={18} className="group-hover:scale-110 transition-transform" />
      </button>
      <button
        type="button"
        onClick={handleMaximize}
        onMouseDown={stopWindowDrag}
        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/60 border border-teal-900/5 hover:bg-zinc-100 active:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer shadow-glass group no-drag"
        title={isMaximized ? '向下还原' : '最大化'}
      >
        {isMaximized ? <Layers3 size={18} className="group-hover:scale-110 transition-transform" /> : <Square size={16} className="group-hover:scale-110 transition-transform" />}
      </button>
      <button
        type="button"
        onClick={handleClose}
        onMouseDown={stopWindowDrag}
        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-50/60 border border-red-200/30 text-zinc-600 hover:bg-red-500 hover:text-white hover:border-red-500 active:bg-red-600 transition-colors cursor-pointer shadow-glass group no-drag"
        title="关闭"
      >
        <X size={18} className="group-hover:rotate-90 transition-transform" />
      </button>
    </div>
  );
};

export default WindowControls;
