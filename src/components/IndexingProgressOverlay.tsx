import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu } from 'lucide-react';

interface IndexingProgressOverlayProps {
  entries: [string, {
    fileName: string;
    status: 'parsing' | 'vectorizing' | 'completed' | 'error';
    progress: number;
    message?: string;
  }][];
}

const IndexingProgressOverlay: React.FC<IndexingProgressOverlayProps> = ({ entries }) => {
  if (entries.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col gap-3 max-w-sm w-full">
      <AnimatePresence>
        {entries.map(([id, file]) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <Cpu size={14} className={file.status === 'vectorizing' ? 'animate-spin text-accent' : 'text-zinc-400'} />
                <span className="text-xs font-bold truncate text-zinc-700 dark:text-zinc-200">
                  {file.fileName}
                </span>
              </div>
              <span className={`text-2xs font-black uppercase px-1.5 py-0.5 rounded ${
                file.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                file.status === 'error' ? 'bg-red-500/10 text-red-500' :
                'bg-accent/10 text-accent'
              }`}>
                {file.status === 'parsing' ? '解析中' : 
                 file.status === 'vectorizing' ? `量化中 ${file.progress}%` : 
                 file.status === 'completed' ? '已完成' : '错误'}
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${file.progress}%` }}
                className={`h-full ${
                  file.status === 'completed' ? 'bg-green-500' :
                  file.status === 'error' ? 'bg-red-500' :
                  'bg-accent'
                }`}
              />
            </div>
            {file.message && (
              <p className="mt-2 text-2xs text-red-500 font-medium">
                {file.message}
              </p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default IndexingProgressOverlay;
