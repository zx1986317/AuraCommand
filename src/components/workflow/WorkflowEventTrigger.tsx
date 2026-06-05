import React from 'react';
import { Zap } from 'lucide-react';

interface TriggerInfo {
  key: string;
  label: string;
  desc: string;
}

interface Props {
  triggerTypes: string[];
  onChange: (triggerTypes: string[]) => void;
}

const EVENT_TRIGGERS: TriggerInfo[] = [
  { key: 'on_file_imported', label: '文件导入时', desc: '当新文件导入知识库时触发' },
  { key: 'on_tag_added', label: '标签变更时', desc: '当便签/文档标签发生变化时触发' },
  { key: 'on_memo_created', label: '新建便签时', desc: '当创建新便签时触发' },
  { key: 'on_task_completed', label: '任务完成时', desc: '当待办任务标记完成时触发' },
];

const WorkflowEventTrigger: React.FC<Props> = ({ triggerTypes, onChange }) => {
  const toggleTrigger = (key: string) => {
    onChange(
      triggerTypes.includes(key)
        ? triggerTypes.filter((t) => t !== key)
        : [...triggerTypes, key]
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-teal-900/5 p-6 mt-4">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        <Zap size={14} className="text-amber-500" />
        事件触发
      </h3>
      <div className="space-y-2">
        {EVENT_TRIGGERS.map((trigger) => (
          <div key={trigger.key} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-all">
            <div>
              <p className="text-xs font-medium text-foreground">{trigger.label}</p>
              <p className="text-2xs text-muted">{trigger.desc}</p>
            </div>
            <button
              onClick={() => toggleTrigger(trigger.key)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                triggerTypes.includes(trigger.key) ? 'bg-accent' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                  triggerTypes.includes(trigger.key) ? 'bg-white right-0.5' : 'bg-white left-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowEventTrigger;
