import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Play, CheckCircle, Info } from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: 'llm' | 'tool' | 'condition' | 'start' | 'end';
  name: string;
}

interface WorkflowEdge {
  sourceId: string;
  targetId: string;
}

interface Props {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onRemoveNode: (id: string) => void;
  onAddNode: (afterId: string, type: WorkflowNode['type']) => void;
  debugMode?: boolean;
  debugStatusMap?: Record<string, string> | undefined;
}

const NODE_TYPES = [
  { value: 'llm' as const, label: 'AI 处理', icon: '🤖', color: 'bg-purple-500', description: '调用AI模型进行内容处理' },
  { value: 'tool' as const, label: '工具调用', icon: '🔧', color: 'bg-blue-500', description: '执行系统工具（搜索、创建等）' },
  { value: 'condition' as const, label: '条件判断', icon: '◆', color: 'bg-amber-500', description: '根据条件决定流程走向' },
];

const NODE_DISPLAY: Record<string, { icon: string; label: string }> = {
  start: { icon: '▶', label: '开始' },
  llm: { icon: '🤖', label: 'AI 处理' },
  tool: { icon: '🔧', label: '工具调用' },
  condition: { icon: '◆', label: '条件判断' },
  end: { icon: '■', label: '结束' },
};

const NODE_COLORS: Record<string, string> = {
  start: 'bg-emerald-500',
  llm: 'bg-purple-500',
  tool: 'bg-blue-500',
  condition: 'bg-amber-500',
  end: 'bg-red-500',
};

const WorkflowNodeList: React.FC<Props> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onRemoveNode,
  onAddNode,
  debugMode,
  debugStatusMap,
}) => {
  const [showAddNode, setShowAddNode] = useState<string | null>(null);

  return (
    <div className="flex-1">
      <div className="bg-white rounded-2xl border border-teal-900/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">工作流节点</h3>
          <span className="text-xs text-muted">
            {nodes.length} 个节点
          </span>
        </div>

        {nodes.length <= 5 && (
          <div className="mb-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-blue-500 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-600">新手提示</p>
                <p className="text-2xs text-blue-500/80 mt-1">
                  这是一个完整的工作流示例。点击节点查看配置，或点击节点间的 + 按钮添加新节点。
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {nodes.map((node, idx) => {
            const isSelected = selectedNodeId === node.id;
            const debugStatus = debugMode ? (debugStatusMap?.[node.id] ?? 'pending') : null;
            const display = NODE_DISPLAY[node.type]!;
            const color = NODE_COLORS[node.type]!;

            return (
              <React.Fragment key={node.id}>
                <motion.div
                  layout
                  onClick={() => onSelectNode(node.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    debugStatus === 'current' ? 'border-amber-400 bg-amber-50 shadow-sm' :
                    debugStatus === 'completed' ? 'border-emerald-400 bg-emerald-50' :
                    isSelected ? 'border-accent bg-accent/5 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg ${color} text-white flex items-center justify-center text-xs font-bold`}>
                    {debugStatus === 'current' ? <Play size={14} /> :
                     debugStatus === 'completed' ? <CheckCircle size={14} /> :
                     display.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{node.name}</p>
                    <p className="text-2xs text-muted">
                      {debugStatus === 'current' ? '正在执行...' :
                       debugStatus === 'completed' ? '已完成' :
                       display.label}
                    </p>
                  </div>
                  {node.type !== 'start' && node.type !== 'end' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveNode(node.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </motion.div>

                {/* 添加节点按钮（在节点之间） */}
                {idx < nodes.length - 1 && (
                  <div className="flex items-center justify-center relative">
                    <div className="w-px h-4 bg-gray-200"></div>
                    <button
                      onClick={() => setShowAddNode(showAddNode === node.id ? null : node.id)}
                      className="absolute z-10 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-muted hover:text-accent hover:border-accent/30 transition-all shadow-sm group"
                      title="在此位置添加新节点"
                    >
                      <Plus size={12} />
                      <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-2xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        添加节点
                      </span>
                    </button>
                  </div>
                )}

                {/* 添加节点下拉菜单 */}
                <AnimatePresence>
                  {showAddNode === node.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 py-2 px-4">
                        <div className="text-2xs text-muted mr-2">添加节点：</div>
                        {NODE_TYPES.map((type) => (
                          <button
                            key={type.value}
                            onClick={() => {
                              onAddNode(node.id, type.value);
                              setShowAddNode(null);
                            }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white ${type.color} hover:opacity-90 transition-all`}
                            title={type.description}
                          >
                            <span>{type.icon}</span> {type.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkflowNodeList;
