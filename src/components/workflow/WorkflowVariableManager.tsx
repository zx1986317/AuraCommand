import React, { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';

interface Props {
  variables: Record<string, string>;
  onVariablesChange: (variables: Record<string, string>) => void;
}

const WorkflowVariableManager: React.FC<Props> = ({ variables, onVariablesChange }) => {
  const [newVarName, setNewVarName] = useState('');
  const [showAddVar, setShowAddVar] = useState(false);

  const handleRemoveVar = (key: string) => {
    const newVars = { ...variables };
    delete newVars[key];
    onVariablesChange(newVars);
  };

  const handleUpdateVar = (key: string, value: string) => {
    onVariablesChange({ ...variables, [key]: value });
  };

  const handleAddVar = () => {
    const trimmed = newVarName.trim();
    if (trimmed && !variables[trimmed]) {
      onVariablesChange({ ...variables, [trimmed]: '' });
      setNewVarName('');
      setShowAddVar(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-teal-900/5 p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground">工作流变量</h3>
        <span className="text-xs text-muted">
          {Object.keys(variables).length} 个变量
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(variables).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <input
              type="text"
              value={key}
              readOnly
              className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm text-muted"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => handleUpdateVar(key, e.target.value)}
              className="flex-1 bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <button
              onClick={() => handleRemoveVar(key)}
              className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {showAddVar ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddVar();
                if (e.key === 'Escape') { setShowAddVar(false); setNewVarName(''); }
              }}
              autoFocus
              className="flex-1 bg-white border border-accent/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="变量名，回车确认"
            />
            <button onClick={() => { setShowAddVar(false); setNewVarName(''); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-muted">
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowAddVar(true)}
              className="flex items-center gap-1.5 text-xs text-accent font-bold hover:underline"
            >
              <Plus size={12} /> 添加变量
            </button>
            <div className="p-2 bg-gray-50/50 rounded-lg border border-gray-100">
              <p className="text-2xs text-muted">
                变量可在节点配置中使用 <code className="bg-gray-200 px-1 rounded">{'{{variable}}'}</code> 引用
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowVariableManager;
