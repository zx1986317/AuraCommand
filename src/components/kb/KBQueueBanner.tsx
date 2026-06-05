import React from 'react';

interface KBQueueBannerProps {
  queueStatus: { processing: boolean; queueLength: number; total: number } | null;
  indexingProgress: Record<string, { status: string; progress: number; fileName?: string }>;
}

const KBQueueBanner: React.FC<KBQueueBannerProps> = ({ queueStatus, indexingProgress }) => {
  if (!queueStatus || queueStatus.total === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-1.5 px-3 py-2 bg-accent/5 border border-accent/10 rounded-xl text-xs">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-accent/80 font-medium">
          正在处理 {queueStatus.total} 个文件
          {queueStatus.queueLength > 0 && `（${queueStatus.queueLength} 个排队中）`}
        </span>
        {Object.keys(indexingProgress).length > 0 && (
          <span className="text-accent ml-auto">
            {(() => {
              const active = Object.values(indexingProgress).find(p => p.status !== 'completed' && p.status !== 'error');
              return active ? active.fileName || '' : '';
            })()}
          </span>
        )}
      </div>
      <div className="h-1.5 bg-accent/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${queueStatus.total > 0 ? Math.round(((queueStatus.total - queueStatus.queueLength - (queueStatus.processing ? 1 : 0)) / queueStatus.total) * 100) : 0}%`
          }}
        />
      </div>
    </div>
  );
};

export default KBQueueBanner;
