import React from 'react';
import { Clock } from 'lucide-react';

interface Props {
  scheduleEnabled: number;
  scheduleCron: string;
  lastScheduledRun: string | undefined;
  onToggle: () => void;
  onCronChange: (cron: string) => void;
}

const CRON_PRESETS = [
  { label: '每天8点', expr: '0 8 * * *' },
  { label: '每天12点', expr: '0 12 * * *' },
  { label: '每周一8点', expr: '0 8 * * 1' },
  { label: '每小时', expr: '0 * * * *' },
];

const WorkflowScheduleTrigger: React.FC<Props> = ({
  scheduleEnabled,
  scheduleCron,
  lastScheduledRun,
  onToggle,
  onCronChange,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-teal-900/5 p-6 mt-4">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        <Clock size={14} className="text-blue-500" />
        定时触发
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-muted w-20">启用定时</label>
          <button
            onClick={onToggle}
            className={`relative w-10 h-5 rounded-full transition-colors ${scheduleEnabled ? 'bg-accent' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${scheduleEnabled ? 'bg-white right-0.5' : 'bg-white left-0.5'}`} />
          </button>
        </div>
        {scheduleEnabled ? (
          <div>
            <label className="text-xs font-bold text-muted mb-1.5 block">Cron 表达式</label>
            <input
              type="text"
              value={scheduleCron}
              onChange={(e) => onCronChange(e.target.value)}
              className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="0 8 * * *  (每天早上8点)"
            />
            <div className="mt-2 space-y-1">
              <p className="text-2xs text-muted">常用表达式：</p>
              <div className="flex flex-wrap gap-1">
                {CRON_PRESETS.map(preset => (
                  <button
                    key={preset.expr}
                    onClick={() => onCronChange(preset.expr)}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-2xs rounded-lg hover:bg-accent/10 hover:text-accent transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {lastScheduledRun && (
          <p className="text-2xs text-muted">上次运行: {new Date(lastScheduledRun).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
};

export default WorkflowScheduleTrigger;
