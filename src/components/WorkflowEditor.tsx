import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, X, HelpCircle, Pause, SkipForward, Bug,
} from 'lucide-react';
import { logger } from '../utils/logger';
import { ipcService } from '../services/ipc';
import WorkflowNodeList from './workflow/WorkflowNodeList';
import WorkflowNodeConfig from './workflow/WorkflowNodeConfig';
import WorkflowDebugPanel from './workflow/WorkflowDebugPanel';
import WorkflowVariableManager from './workflow/WorkflowVariableManager';
import WorkflowScheduleTrigger from './workflow/WorkflowScheduleTrigger';
import WorkflowEventTrigger from './workflow/WorkflowEventTrigger';

interface WorkflowNode {
  id: string;
  type: 'llm' | 'tool' | 'condition' | 'start' | 'end';
  name: string;
  config: Record<string, any>;
}

interface WorkflowEdge {
  sourceId: string;
  targetId: string;
  label?: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  isPreset?: boolean;
  schedule_cron?: string;
  schedule_enabled?: number;
  last_scheduled_run?: string;
  trigger_types?: string[];
}

interface ToolInfo {
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string; required?: boolean }[];
}

interface Props {
  workflow: Workflow;
  onSave: (workflow: Workflow) => void;
  onCancel: () => void;
}

const NODE_TYPES: { value: WorkflowNode['type']; label: string; description: string }[] = [
  { value: 'start', label: '开始', description: '工作流起始节点' },
  { value: 'llm', label: 'AI 处理', description: '调用AI模型进行内容处理' },
  { value: 'tool', label: '工具调用', description: '执行系统工具（搜索、创建等）' },
  { value: 'condition', label: '条件判断', description: '根据条件决定流程走向' },
  { value: 'end', label: '结束', description: '工作流结束节点' },
];

const WorkflowEditor: React.FC<Props> = ({ workflow, onSave, onCancel }) => {
  const [wf, setWf] = useState<Workflow>({ ...workflow, nodes: [...workflow.nodes], edges: [...workflow.edges], schedule_cron: workflow.schedule_cron || '', schedule_enabled: workflow.schedule_enabled || 0, last_scheduled_run: workflow.last_scheduled_run || '' });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);

  const [debugMode, setDebugMode] = useState(false);
  const [debugCurrentNodeId, setDebugCurrentNodeId] = useState<string | null>(null);
  const [debugCompletedNodes, setDebugCompletedNodes] = useState<Set<string>>(new Set());
  const [debugLog, setDebugLog] = useState<{ nodeId: string; message: string; timestamp: string }[]>([]);

  const startDebug = useCallback(() => {
    setDebugMode(true);
    const startNode = wf.nodes.find(n => n.type === 'start');
    if (startNode) {
      setDebugCurrentNodeId(startNode.id);
      setDebugCompletedNodes(new Set());
      setDebugLog([{ nodeId: startNode.id, message: '工作流开始执行', timestamp: new Date().toLocaleTimeString() }]);
    }
  }, [wf.nodes]);

  const stopDebug = useCallback(() => {
    setDebugMode(false);
    setDebugCurrentNodeId(null);
    setDebugCompletedNodes(new Set());
    setDebugLog([]);
  }, []);

  const stepDebug = useCallback(() => {
    if (!debugCurrentNodeId) return;
    const currentNode = wf.nodes.find(n => n.id === debugCurrentNodeId);
    if (!currentNode) return;

    setDebugCompletedNodes(prev => new Set([...prev, debugCurrentNodeId]));
    setDebugLog(prev => [...prev, {
      nodeId: debugCurrentNodeId,
      message: `节点 "${currentNode.name}" 执行完成`,
      timestamp: new Date().toLocaleTimeString(),
    }]);

    const outEdge = wf.edges.find(e => e.sourceId === debugCurrentNodeId);
    if (outEdge) {
      const nextNode = wf.nodes.find(n => n.id === outEdge.targetId);
      if (nextNode) {
        setDebugCurrentNodeId(nextNode.id);
        setDebugLog(prev => [...prev, {
          nodeId: nextNode.id,
          message: `进入节点 "${nextNode.name}"`,
          timestamp: new Date().toLocaleTimeString(),
        }]);
      } else {
        setDebugCurrentNodeId(null);
        setDebugLog(prev => [...prev, { nodeId: '', message: '工作流执行结束', timestamp: new Date().toLocaleTimeString() }]);
      }
    } else {
      setDebugCurrentNodeId(null);
      setDebugLog(prev => [...prev, { nodeId: '', message: '工作流执行结束', timestamp: new Date().toLocaleTimeString() }]);
    }
  }, [debugCurrentNodeId, wf.nodes, wf.edges]);

  const getNodeDebugStatus = useCallback((nodeId: string) => {
    if (debugCurrentNodeId === nodeId) return 'current';
    if (debugCompletedNodes.has(nodeId)) return 'completed';
    return 'pending';
  }, [debugCurrentNodeId, debugCompletedNodes]);

  useEffect(() => {
    ipcService.workflow.getTools().then(tools => setAvailableTools(tools || [])).catch(err => logger.error('Failed to get workflow tools', err));
  }, []);

  const selectedNode = wf.nodes.find(n => n.id === selectedNodeId) || null;

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setWf(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, ...updates, config: updates.config !== undefined ? updates.config : n.config } : n),
    }));
  }, []);

  const addNode = useCallback((afterNodeId: string, type: WorkflowNode['type']) => {
    const newId = `n${Date.now()}`;
    const newNode: WorkflowNode = {
      id: newId,
      type,
      name: NODE_TYPES.find(t => t.value === type)?.label || type,
      config: type === 'llm' ? { system_prompt: '', prompt: '' } :
              type === 'tool' ? { tool_name: '', tool_args: {} } :
              type === 'condition' ? { condition: '' } : {},
    };

    setWf(prev => {
      const nodes = [...prev.nodes];
      const edges = [...prev.edges];
      const afterIdx = nodes.findIndex(n => n.id === afterNodeId);

      nodes.splice(afterIdx + 1, 0, newNode);

      const outEdge = edges.find(e => e.sourceId === afterNodeId);
      if (outEdge) {
        const edgeIdx = edges.findIndex(e => e.sourceId === afterNodeId);
        edges.splice(edgeIdx, 1);
        edges.push({ sourceId: afterNodeId, targetId: newId });
        edges.push({ sourceId: newId, targetId: outEdge.targetId });
      }

      return { ...prev, nodes, edges };
    });
    setSelectedNodeId(newId);
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    if (wf.nodes.length <= 2) return;
    const node = wf.nodes.find(n => n.id === nodeId);
    if (node?.type === 'start' || node?.type === 'end') return;

    setWf(prev => {
      const nodes = prev.nodes.filter(n => n.id !== nodeId);
      const edges = [...prev.edges].filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);

      const inEdge = prev.edges.find(e => e.targetId === nodeId);
      const outEdge = prev.edges.find(e => e.sourceId === nodeId);
      if (inEdge && outEdge) {
        edges.push({ sourceId: inEdge.sourceId, targetId: outEdge.targetId });
      }

      return { ...prev, nodes, edges };
    });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [wf.nodes.length, selectedNodeId]);

  const handleSave = () => {
    const updated = { ...wf, updatedAt: new Date().toISOString() };
    onSave(updated);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 hover:bg-black/5 rounded-xl text-muted hover:text-foreground transition-all">
            <X size={18} />
          </button>
          <div>
            <input
              type="text"
              value={wf.name}
              onChange={(e) => setWf(prev => ({ ...prev, name: e.target.value }))}
              className="text-lg font-bold text-foreground bg-transparent border-none outline-none focus:ring-0 w-60"
              placeholder="工作流名称"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.ipcRenderer.invoke('open-external', { url: 'https://github.com/your-repo/workflow-docs' })}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-muted hover:text-foreground transition-all"
          >
            <HelpCircle size={14} />
            帮助
          </button>
          {debugMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={stepDebug}
                disabled={!debugCurrentNodeId}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <SkipForward size={14} />
                下一步
              </button>
              <button
                onClick={stopDebug}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all"
              >
                <Pause size={14} />
                停止调试
              </button>
            </div>
          ) : (
            <button
              onClick={startDebug}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-all"
            >
              <Bug size={14} />
              调试模式
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-bold rounded-2xl hover:bg-accent/90 transition-all active:scale-[0.98] shadow-glass"
          >
            <Save size={16} />
            保存工作流
          </button>
        </div>
      </div>

      {/* 调试日志面板 */}
      {debugMode && (
        <WorkflowDebugPanel
          nodes={wf.nodes}
          debugCurrentNodeId={debugCurrentNodeId}
          debugLog={debugLog}
        />
      )}

      {/* 描述 */}
      <div className="mb-6">
        <input
          type="text"
          value={wf.description}
          onChange={(e) => setWf(prev => ({ ...prev, description: e.target.value }))}
          className="w-full bg-white border border-teal-900/5 rounded-xl px-4 py-2.5 text-sm text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
          placeholder="工作流描述（可选）"
        />
      </div>

      <div className="flex gap-6">
        {/* 左侧：节点流程 + 变量 + 触发器 */}
        <div className="flex-1">
          <WorkflowNodeList
            nodes={wf.nodes}
            edges={wf.edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onRemoveNode={removeNode}
            onAddNode={addNode}
            debugMode={debugMode}
            debugStatusMap={debugMode ? Object.fromEntries(wf.nodes.map(n => [n.id, getNodeDebugStatus(n.id)])) : undefined}
          />

          <WorkflowVariableManager
            variables={wf.variables}
            onVariablesChange={(vars) => setWf(prev => ({ ...prev, variables: vars }))}
          />

          <WorkflowScheduleTrigger
            scheduleEnabled={wf.schedule_enabled || 0}
            scheduleCron={wf.schedule_cron || ''}
            lastScheduledRun={wf.last_scheduled_run}
            onToggle={() => setWf(prev => ({ ...prev, schedule_enabled: prev.schedule_enabled ? 0 : 1 }))}
            onCronChange={(cron) => setWf(prev => ({ ...prev, schedule_cron: cron }))}
          />

          <WorkflowEventTrigger
            triggerTypes={wf.trigger_types || []}
            onChange={(types) => setWf(prev => ({ ...prev, trigger_types: types }))}
          />
        </div>

        {/* 右侧：节点配置面板 */}
        <WorkflowNodeConfig
          node={selectedNode}
          onUpdateNode={updateNode}
          onDeselect={() => setSelectedNodeId(null)}
          availableTools={availableTools}
          workflow={{ nodes: wf.nodes }}
        />
      </div>
    </div>
  );
};

export default WorkflowEditor;
