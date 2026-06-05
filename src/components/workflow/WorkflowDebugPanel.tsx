import React from 'react';
import { Bug, Play, CheckCircle } from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: string;
  name: string;
}

interface DebugLogEntry {
  nodeId: string;
  message: string;
  timestamp: string;
}

interface Props {
  nodes: WorkflowNode[];
  debugCurrentNodeId: string | null;
  debugLog: DebugLogEntry[];
}

const WorkflowDebugPanel: React.FC<Props> = ({ nodes, debugCurrentNodeId, debugLog }) => {
  return (
    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Bug size={14} className="text-amber-600" />
        <span className="text-xs font-bold text-amber-800">调试日志</span>
        {debugCurrentNodeId && (
          <span className="text-2xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Play size={10} />
            当前: {nodes.find(n => n.id === debugCurrentNodeId)?.name || '未知'}
          </span>
        )}
        <span className="text-2xs text-amber-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle size={10} />
          已完成: {debugLog.filter(l => l.message.includes('完成')).length}
        </span>
      </div>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {debugLog.map((log, idx) => (
          <div key={idx} className="flex items-center gap-2 text-2xs">
            <span className="text-amber-500">{log.timestamp}</span>
            <span className="text-amber-700">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowDebugPanel;
