import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Plus } from 'lucide-react';
import WorkflowsPanel from '../components/WorkflowsPanel';

interface WorkflowsPageProps {
  workflows: any[];
  logs: Record<string, any[]>;
  executing: Record<string, boolean>;
  onExecute: (id: string) => void;
  onToggleEnabled?: ((id: string, enabled: boolean) => void) | undefined;
  onCreate: (workflow: any) => void;
  onUpdate: (workflow: any) => void;
  onDelete: (id: string) => void;
}

const WorkflowsPage: React.FC<WorkflowsPageProps> = ({
  workflows,
  logs,
  executing,
  onExecute,
  onToggleEnabled,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">工作流</h1>
          <p className="text-sm text-muted mt-1">
            自动化重复任务，让 AI 帮你批量处理
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <WorkflowsPanel
          workflows={workflows}
          logs={logs}
          executing={executing}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onExecute={onExecute}
          onToggleEnabled={onToggleEnabled}
        />
      </div>
    </motion.div>
  );
};

export default WorkflowsPage;
