import { useState, useEffect } from 'react';
import { useAppStore, type AppState } from '../store/appStore';
import { logger } from '../utils/logger';

interface WorkflowsLogicDeps {
  setNotification: (n: { message: string; type: 'info' | 'error' | 'warning' } | null) => void;
}

export function useWorkflowsLogic(deps: WorkflowsLogicDeps) {
  const { setNotification } = deps;
  const selectedModel = useAppStore((s: AppState) => s.selectedModel);

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null);
  const [workflowLogs, setWorkflowLogs] = useState<Record<string, any[]>>({});
  const [executingWorkflows, setExecutingWorkflows] = useState<Record<string, boolean>>({});
  const [pdfViewerState, setPdfViewerState] = useState<{ fileId: string; fileName: string } | null>(null);

  useEffect(() => {
    const handler = (_event: any, data: { workflowId: string; result?: string; logId?: string }) => {
      setNotification({ message: `定时工作流「${data.workflowId}」执行完成`, type: 'info' });
      loadWorkflows();
    };
    window.ipcRenderer.on('workflow-cron-completed', handler);
    return () => {
      window.ipcRenderer.removeListener('workflow-cron-completed', handler);
    };
  }, []);

  const loadWorkflows = async () => {
    try {
      const res = await window.ipcRenderer.invoke('get-agent-workflows');
      if (res.success) {
        setWorkflows(res.workflows);
        const logsMap: Record<string, any[]> = {};
        for (const wf of res.workflows) {
          try {
            const logsRes = await window.ipcRenderer.invoke('get-agent-workflow-logs', wf.id);
            if (logsRes?.success) logsMap[wf.id] = logsRes.logs;
          } catch (err) {
            logger.error(`Failed to load logs for workflow ${wf.id}:`, err);
          }
        }
        setWorkflowLogs(logsMap);
      }
    } catch (err) {
      logger.error('Failed to load workflows:', err);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const handleExecuteWorkflow = async (workflowId: string) => {
    setExecutingWorkflows(prev => ({ ...prev, [workflowId]: true }));
    try {
      const res = await window.ipcRenderer.invoke('execute-agent-workflow', { workflowId, manualTrigger: true, model: selectedModel });
      if (res.success) {
        loadWorkflows();
        const logs = await window.ipcRenderer.invoke('get-agent-workflow-logs', { workflowId });
        if (logs.success) setWorkflowLogs(prev => ({ ...prev, [workflowId]: logs.logs }));
      }
    } catch (err) {
      logger.error('Failed to execute workflow:', err);
    } finally {
      setExecutingWorkflows(prev => ({ ...prev, [workflowId]: false }));
    }
  };

  const handleToggleWorkflowEnabled = async (id: string, enabled: boolean) => {
    try {
      const res = await window.ipcRenderer.invoke('toggle-workflow-enabled', { id, enabled });
      if (res.success) {
        loadWorkflows();
        setNotification({ message: enabled ? '工作流已启用' : '工作流已停用', type: 'info' });
        setTimeout(() => setNotification(null), 2000);
      } else {
        setNotification({ message: res.error || '操作失败', type: 'error' });
      }
    } catch (err) {
      logger.error('Failed to toggle workflow enabled:', err);
    }
  };

  return {
    workflows, setWorkflows,
    showWorkflowModal, setShowWorkflowModal,
    editingWorkflow, setEditingWorkflow,
    workflowLogs, setWorkflowLogs,
    executingWorkflows, setExecutingWorkflows,
    pdfViewerState, setPdfViewerState,
    loadWorkflows, handleExecuteWorkflow,
    handleToggleWorkflowEnabled,
  };
}
