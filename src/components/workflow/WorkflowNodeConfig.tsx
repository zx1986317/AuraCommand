import React from 'react';
import { Settings, X, Info } from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: 'llm' | 'tool' | 'condition' | 'start' | 'end';
  name: string;
  config: Record<string, any>;
}

interface ToolInfo {
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string; required?: boolean }[];
}

interface Props {
  node: WorkflowNode | null;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeselect: () => void;
  availableTools: ToolInfo[];
  workflow: { nodes: WorkflowNode[] };
}

const NODE_TYPE_INFO: Record<string, { label: string; icon: string; color: string; description: string }> = {
  start: { label: '开始', icon: '▶', color: 'bg-emerald-500', description: '工作流起始节点' },
  llm: { label: 'AI 处理', icon: '🤖', color: 'bg-purple-500', description: '调用AI模型进行内容处理' },
  tool: { label: '工具调用', icon: '🔧', color: 'bg-blue-500', description: '执行系统工具（搜索、创建等）' },
  condition: { label: '条件判断', icon: '◆', color: 'bg-amber-500', description: '根据条件决定流程走向' },
  end: { label: '结束', icon: '■', color: 'bg-red-500', description: '工作流结束节点' },
};

const WorkflowNodeConfig: React.FC<Props> = ({ node, onUpdateNode, onDeselect, availableTools, workflow }) => {
  if (!node) {
    return (
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-2xl border border-teal-900/5 p-6 sticky top-0">
          <div className="text-center py-8">
            <Settings size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-muted">点击左侧节点进行配置</p>
            <div className="mt-4 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
              <p className="text-2xs text-muted mb-2">
                这是一个示例工作流，包含完整的流程：
              </p>
              <div className="text-left space-y-1">
                <p className="text-2xs text-muted">1. 搜索资讯 → 2. AI总结 → 3. 保存便签</p>
                <p className="text-2xs text-muted">您可以修改现有节点，或添加新节点扩展功能</p>
              </div>
            </div>
            <button
              onClick={() => {
                const firstToolNode = workflow.nodes.find((n) => n.type === 'tool');
                if (firstToolNode) onDeselect();
              }}
              className="mt-3 px-3 py-1.5 bg-accent/10 text-accent text-xs font-bold rounded-lg hover:bg-accent/20 transition-all"
            >
              查看示例节点
            </button>
          </div>
        </div>
      </div>
    );
  }

  const typeInfo = NODE_TYPE_INFO[node.type]!;

  return (
    <div className="w-80 flex-shrink-0">
      <div className="bg-white rounded-2xl border border-teal-900/5 p-6 sticky top-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-lg ${typeInfo.color} text-white flex items-center justify-center text-2xs font-bold`}>
              {typeInfo.icon}
            </span>
            <h3 className="text-sm font-bold text-foreground">节点配置</h3>
          </div>
          <button
            onClick={onDeselect}
            className="p-1 hover:bg-gray-100 rounded-lg text-muted"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
            <span className={`w-6 h-6 rounded-lg ${typeInfo.color} text-white flex items-center justify-center text-xs font-bold`}>
              {typeInfo.icon}
            </span>
            <div>
              <h4 className="text-sm font-bold text-foreground">{typeInfo.label}</h4>
              <p className="text-2xs text-muted">{typeInfo.description}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">节点名称</label>
            <input
              type="text"
              value={node.name}
              onChange={(e) => onUpdateNode(node.id, { name: e.target.value })}
              className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder={`输入${typeInfo.label}名称`}
            />
          </div>

          {node.type === 'llm' && (
            <>
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">系统提示词</label>
                <textarea
                  value={node.config.system_prompt || ''}
                  onChange={(e) => onUpdateNode(node.id, { config: { ...node.config, system_prompt: e.target.value } })}
                  rows={3}
                  className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                  placeholder="你是一个智能助手..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">用户提示词</label>
                <textarea
                  value={node.config.prompt || ''}
                  onChange={(e) => onUpdateNode(node.id, { config: { ...node.config, prompt: e.target.value } })}
                  rows={4}
                  className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                  placeholder="使用 {{nodeOutput.n1.items}} 引用前序节点输出，使用 {{variable}} 引用变量"
                />
              </div>
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={12} className="text-blue-500" />
                  <p className="text-2xs text-blue-600 font-bold">模板语法帮助</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xs text-blue-500/80">
                    <code className="bg-blue-100 px-1 rounded">{'{{nodeOutput.n2.items}}'}</code> - 引用节点 n2 的输出
                  </p>
                  <p className="text-2xs text-blue-500/80">
                    <code className="bg-blue-100 px-1 rounded">{'{{variable}}'}</code> - 引用工作流变量
                  </p>
                  <p className="text-2xs text-blue-500/80">
                    <code className="bg-blue-100 px-1 rounded">{'{{date}}'}</code> - 引用日期变量
                  </p>
                </div>
              </div>
            </>
          )}

          {node.type === 'tool' && (
            <>
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">选择工具</label>
                <select
                  value={node.config.tool_name || ''}
                  onChange={(e) => onUpdateNode(node.id, { config: { ...node.config, tool_name: e.target.value, tool_args: {} } })}
                  className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">选择工具...</option>
                  {availableTools.map((t) => (
                    <option key={t.name} value={t.name}>{t.name} - {t.description}</option>
                  ))}
                </select>
              </div>
              {node.config.tool_name && (() => {
                const tool = availableTools.find((t) => t.name === node.config.tool_name);
                if (!tool) return null;
                return (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-foreground">参数配置</p>
                    {tool.parameters.map((param) => (
                      <div key={param.name}>
                        <label className="text-2xs font-bold text-muted mb-1 block">
                          {param.name} {param.required && <span className="text-red-400">*</span>}
                          <span className="text-muted/50 ml-1">- {param.description}</span>
                        </label>
                        {param.type === 'number' ? (
                          <input
                            type="number"
                            value={node.config.tool_args?.[param.name] || ''}
                            onChange={(e) => onUpdateNode(node.id, { config: { ...node.config, tool_args: { ...node.config.tool_args, [param.name]: parseInt(e.target.value) || 0 } } })}
                            className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                          />
                        ) : (
                          <input
                            type="text"
                            value={node.config.tool_args?.[param.name] || ''}
                            onChange={(e) => onUpdateNode(node.id, { config: { ...node.config, tool_args: { ...node.config.tool_args, [param.name]: e.target.value } } })}
                            className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                            placeholder={`支持 {{variable}} 模板`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {node.type === 'condition' && (
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">条件表达式</label>
              <input
                type="text"
                value={node.config.condition || ''}
                onChange={(e) => onUpdateNode(node.id, { config: { ...node.config, condition: e.target.value } })}
                className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder='如：{{count}} > 0'
              />
              <p className="text-2xs text-muted mt-1">支持 ==, !=, &gt;, &lt; 比较</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowNodeConfig;
