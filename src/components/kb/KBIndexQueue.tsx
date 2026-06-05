import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity, FileText, Cpu, CheckCircle2, X
} from 'lucide-react';

interface KBIndexQueueProps {
  indexingEntries: [string, any][];
}

const KBIndexQueue: React.FC<KBIndexQueueProps> = ({ indexingEntries }) => {
  return (
    <div className="bg-white/50 border border-teal-900/10 rounded-3xl shadow-glass p-4 h-full order-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted">索引队列</h3>
        <span className="text-2xs font-bold text-accent">{indexingEntries.length} 进程</span>
      </div>
      <div className="space-y-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
        {indexingEntries.length === 0 && (
          <div className="h-56 rounded-2xl border border-dashed border-teal-900/10 flex flex-col items-center justify-center text-muted">
            <Activity size={20} className="mb-2" />
            <p className="text-xs font-bold">暂无正在进行的索引进程</p>
          </div>
        )}
        {indexingEntries.map(([id, file]: [string, any]) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white/90 border border-teal-900/10 rounded-3xl p-6 shadow-sm relative overflow-hidden group"
          >
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-2 rounded-xl ${file.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-accent/10 text-accent'}`}>
                  {file.status === 'parsing' ? <FileText size={16} /> :
                   file.status === 'vectorizing' ? <Cpu size={16} className="animate-pulse" /> :
                   file.status === 'completed' ? <CheckCircle2 size={16} /> : <X size={16} />}
                </div>
                <span className="text-sm font-bold truncate text-foreground">{file.fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                {file.status === 'vectorizing' && (
                  <span className="text-2xs font-mono font-bold text-accent bg-accent/5 px-2 py-0.5 rounded-full">{file.progress}%</span>
                )}
                <span className={`text-2xs font-black uppercase px-2 py-1 rounded-lg ${
                  file.status === 'completed' ? 'bg-green-500 text-white' :
                  file.status === 'error' ? 'bg-red-500 text-white' :
                  'bg-accent text-white shadow-lg shadow-accent/20'
                }`}>
                  {file.status === 'parsing' ? '正在解析' :
                   file.status === 'vectorizing' ? '正在量化' :
                   file.status === 'completed' ? '处理完成' : '处理失败'}
                </span>
              </div>
            </div>
            <div className="space-y-2 relative z-10">
              <div className="flex justify-between items-center text-2xs font-bold text-muted px-1">
                <span>处理进度</span>
                <span>{file.progress}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${file.progress}%` }}
                  className={`h-full transition-all duration-500 ${
                    file.status === 'completed' ? 'bg-green-500' :
                    file.status === 'error' ? 'bg-red-500' :
                    'bg-accent shadow-[0_0_10px_rgba(13,148,136,0.5)]'
                  }`}
                />
              </div>
            </div>
            {file.message && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 relative z-10">
                <X size={14} className="text-red-500 mt-0.5" />
                <p className="text-2xs text-red-600 font-bold leading-relaxed">{file.message}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default KBIndexQueue;