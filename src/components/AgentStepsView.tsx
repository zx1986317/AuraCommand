import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface AgentStep {
  type: 'tool_call' | 'tool_result' | 'thinking';
  toolCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  toolResult?: {
    name: string;
    success: boolean;
    result: any;
    error?: string;
  };
  content?: string;
  timestamp: number;
}

interface AgentStepsViewProps {
  steps: AgentStep[];
}

const TOOL_LABELS: Record<string, string> = {
  create_memo: '创建便签',
  search_memos: '搜索便签',
  search_knowledge: '深度检索知识库',
  read_knowledge: '检索知识库',
  create_schedule: '创建日程',
  list_schedules: '查看日程',
  update_memo: '更新便签',
  search_web: '联网搜索',
  send_notification: '发送通知',
};

const TOOL_ICONS: Record<string, string> = {
  create_memo: '📝',
  search_memos: '🔍',
  search_knowledge: '🧠',
  read_knowledge: '📚',
  create_schedule: '📅',
  list_schedules: '📋',
  update_memo: '✏️',
  search_web: '🌐',
  send_notification: '🔔',
};

const AgentStepsView: React.FC<AgentStepsViewProps> = ({ steps }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="my-3 space-y-2">
      <AnimatePresence>
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-2"
          >
            {step.type === 'tool_call' && step.toolCall && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-xs">
                <span className="text-sm">{TOOL_ICONS[step.toolCall.name] || '🔧'}</span>
                <span className="font-bold">{TOOL_LABELS[step.toolCall.name] || step.toolCall.name}</span>
                <span className="text-violet-400">调用中...</span>
                <Loader2 size={12} className="animate-spin text-violet-400" />
              </div>
            )}

            {step.type === 'tool_result' && step.toolResult && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                step.toolResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {step.toolResult.success ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span className="font-bold">{TOOL_LABELS[step.toolResult.name] || step.toolResult.name}</span>
                    <span className="opacity-60">完成</span>
                    {step.toolResult.result?.message && (
                      <span className="opacity-80">· {step.toolResult.result.message}</span>
                    )}
                    {step.toolResult.result?.count !== undefined && (
                      <span className="opacity-80">· {step.toolResult.result.count} 条结果</span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircle size={14} />
                    <span className="font-bold">{TOOL_LABELS[step.toolResult.name] || step.toolResult.name}</span>
                    <span className="opacity-80">失败: {step.toolResult.error}</span>
                  </>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AgentStepsView;