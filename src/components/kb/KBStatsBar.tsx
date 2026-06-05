import React from 'react';
import { FileText, CheckCircle2, Activity, HardDrive } from 'lucide-react';

interface KBStatsBarProps {
  fileCount: number;
  indexedFileCount: number;
  activeIndexingCount: number;
  totalStorageMB: string;
}

const KBStatsBar: React.FC<KBStatsBarProps> = ({
  fileCount, indexedFileCount, activeIndexingCount, totalStorageMB,
}) => {
  const stats = [
    { label: '文件总数', value: fileCount, icon: <FileText size={14} className="text-accent" /> },
    { label: '已索引', value: indexedFileCount, icon: <CheckCircle2 size={14} className="text-green-600" /> },
    { label: '处理中', value: activeIndexingCount, icon: <Activity size={14} className="text-amber-500" /> },
    { label: '占用空间', value: `${totalStorageMB} MB`, icon: <HardDrive size={14} className="text-accent" /> },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="p-5 bg-white/60 border border-teal-900/10 rounded-2xl shadow-glass">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xs uppercase tracking-[0.2em] font-black text-muted">{stat.label}</span>
            {stat.icon}
          </div>
          <p className="text-3xl font-display font-bold">{stat.value}</p>
        </div>
      ))}
    </div>
  );
};

export default KBStatsBar;