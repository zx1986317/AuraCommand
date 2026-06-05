import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, CalendarDays, Sparkles, Play, Clock, GitBranch, AlertTriangle, Zap, Globe, BookmarkPlus, Plus, Trash2, ChevronUp, ChevronDown, Eye } from 'lucide-react';

interface WorkflowModalProps {
  isOpen: boolean;
  workflow: any;
  onWorkflowChange: (workflow: any) => void;
  onClose: () => void;
  onSave: () => void;
  onNotification: (notification: { message: string; type: 'info' | 'error' | 'warning' } | null) => void;
  availableModels?: string[];
}

const ACTION_TYPES = [
  { value: 'summarize_memos', label: '便签总结', icon: FileText, desc: '总结近期便签' },
  { value: 'daily_report', label: '日报生成', icon: CalendarDays, desc: '生成今日日报' },
  { value: 'auto_tag_memos', label: '自动标签', icon: Sparkles, desc: '为便签打标签' },
  { value: 'search_web', label: '联网搜索', icon: Globe, desc: '抓取互联网资讯' },
  { value: 'multi_step', label: '多步编排', icon: GitBranch, desc: '串联多个操作' },
  { value: 'extract_todos', label: '提取待办', icon: Zap, desc: '从便签提取待办' },
  { value: 'search_and_summarize', label: '检索总结', icon: FileText, desc: '搜索并总结知识' },
  { value: 'save_to_memo', label: '存为便签', icon: BookmarkPlus, desc: '结果保存为便签' },
] as const;

const STEP_ACTION_TYPES = ACTION_TYPES.filter(a => a.value !== 'multi_step');

const WorkflowModal: React.FC<WorkflowModalProps> = ({ isOpen, workflow, onWorkflowChange, onClose, onSave, onNotification, availableModels = [] }) => {
  const [previewStepIndex, setPreviewStepIndex] = useState<number | null>(null);

  if (!isOpen || !workflow) return null;

  const models = availableModels;

  return (
    <AnimatePresence>
      {isOpen && workflow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col p-8 rounded-3xl border border-teal-900/10 bg-white/95 backdrop-blur-2xl shadow-[0_40px_80px_rgba(0,0,0,0.2)]"
          >
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <p className="text-2xs font-black uppercase tracking-[0.25em] text-accent mb-1">
                  {workflow.id ? '编辑工作流' : '新建工作流'}
                </p>
                <h3 className="text-2xl font-display font-bold tracking-tight">
                  {workflow.id ? '编辑工作流' : '新建工作流'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto min-h-0 flex-1 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>
              <div>
                <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">工作流名称</label>
                <input
                  type="text"
                  value={workflow.name}
                  onChange={(e) => onWorkflowChange({ ...workflow, name: e.target.value })}
                  placeholder="例如：每日便签总结"
                  className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">描述（可选）</label>
                <input
                  type="text"
                  value={workflow.description || ''}
                  onChange={(e) => onWorkflowChange({ ...workflow, description: e.target.value })}
                  placeholder="描述这个工作流的用途"
                  className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">操作类型</label>
                <div className="grid grid-cols-3 gap-3">
                  {ACTION_TYPES.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onWorkflowChange({ ...workflow, action_type: opt.value })}
                      className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        workflow.action_type === opt.value
                          ? 'border-accent bg-accent/5'
                          : 'border-teal-900/5 bg-white/60 hover:border-teal-900/20'
                      }`}
                    >
                      <opt.icon size={18} className={workflow.action_type === opt.value ? 'text-accent mb-2' : 'text-muted mb-2'} />
                      <p className="text-xs font-bold mb-0.5">{opt.label}</p>
                      <p className="text-2xs text-muted">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {workflow.action_type === 'summarize_memos' && (
                <div>
                  <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">总结天数</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={workflow.action_config?.days || 1}
                    onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, days: parseInt(e.target.value) || 1 } })}
                    className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  />
                </div>
              )}

              {workflow.action_type === 'search_web' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">搜索关键词（逗号分隔多个）</label>
                    <input
                      type="text"
                      value={workflow.action_config?.queries?.join(',') || workflow.action_config?.query || ''}
                      onChange={(e) => {
                        const queries = e.target.value.split(',').map(q => q.trim()).filter(Boolean);
                        onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, queries, query: queries[0] || '' } });
                      }}
                      placeholder="例如: AI最新进展,科技新闻,大模型动态"
                      className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                    />
                    <p className="text-2xs text-muted mt-1">多个关键词会分别搜索，结果合并后生成报告</p>
                  </div>
                  <div>
                    <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">SearXNG 地址</label>
                    <input
                      type="text"
                      value={workflow.action_config?.searxng_url || 'http://localhost:8080'}
                      onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, searxng_url: e.target.value } })}
                      placeholder="http://localhost:8080"
                      className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">时间范围</label>
                      <select
                        value={workflow.action_config?.time_range || 'day'}
                        onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, time_range: e.target.value } })}
                        className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                      >
                        <option value="day">今天</option>
                        <option value="week">本周</option>
                        <option value="month">本月</option>
                        <option value="year">今年</option>
                        <option value="">不限</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">每关键词结果数</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={workflow.action_config?.max_results || 5}
                        onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, max_results: parseInt(e.target.value) || 5 } })}
                        className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workflow.action_config?.summarize !== false}
                        onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, summarize: e.target.checked } })}
                        className="w-4 h-4 rounded border-teal-900/20 accent-accent"
                      />
                      <span className="text-xs font-bold">AI 总结为报告</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workflow.action_config?.save_to_memo || false}
                        onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, save_to_memo: e.target.checked } })}
                        className="w-4 h-4 rounded border-teal-900/20 accent-accent"
                      />
                      <span className="text-xs font-bold">自动保存为便签</span>
                    </label>
                  </div>
                  {workflow.action_config?.summarize !== false && (
                    <div>
                      <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">总结模型</label>
                      <select
                        value={workflow.action_config?.model || models[0] || ''}
                        onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, model: e.target.value } })}
                        disabled={models.length === 0}
                        className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                      >
                        {models.length === 0 && (
                          <option value="">未检测到可用模型</option>
                        )}
                        {models.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {workflow.action_type === 'save_to_memo' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">便签标题</label>
                    <input
                      type="text"
                      value={workflow.action_config?.memo_title || ''}
                      onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, memo_title: e.target.value } })}
                      placeholder="例如: 每日资讯报告"
                      className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">分类</label>
                    <input
                      type="text"
                      value={workflow.action_config?.memo_category || '工作流'}
                      onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, memo_category: e.target.value } })}
                      placeholder="工作流"
                      className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">标签（逗号分隔）</label>
                    <input
                      type="text"
                      value={workflow.action_config?.memo_tags?.join(',') || '工作流'}
                      onChange={(e) => {
                        const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                        onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, memo_tags: tags } });
                      }}
                      placeholder="资讯,自动抓取"
                      className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                    />
                  </div>
                </div>
              )}

              {workflow.action_type === 'multi_step' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-2xs font-black uppercase tracking-[0.2em] text-muted">编排步骤</label>
                    <button
                      onClick={() => {
                        const steps = workflow.action_config?.steps || [];
                        onWorkflowChange({
                          ...workflow,
                          action_config: {
                            ...workflow.action_config,
                            steps: [...steps, { action_type: 'summarize_memos', name: `步骤 ${steps.length + 1}`, config: {} }]
                          }
                        });
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-2xs font-bold hover:bg-accent/20 transition-colors cursor-pointer"
                    >
                      <Plus size={12} /> 添加步骤
                    </button>
                  </div>
                  {(workflow.action_config?.steps || []).length === 0 && (
                    <div className="text-center py-8 text-muted">
                      <GitBranch size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">尚未添加步骤，点击上方按钮添加</p>
                      <p className="text-2xs mt-1 opacity-60">步骤将按顺序依次执行，前一步的输出可作为后一步的输入</p>
                    </div>
                  )}
                  {(workflow.action_config?.steps || []).map((step: any, idx: number) => {
                    const stepType = STEP_ACTION_TYPES.find(a => a.value === step.action_type);
                    return (
                      <div key={idx} className="relative border border-teal-900/10 rounded-xl p-4 bg-white/60">
                        <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-accent text-white text-2xs font-bold flex items-center justify-center shadow-sm">
                          {idx + 1}
                        </div>
                        <div className="ml-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={step.name || ''}
                              onChange={(e) => {
                                const steps = [...(workflow.action_config?.steps || [])];
                                steps[idx] = { ...steps[idx], name: e.target.value };
                                onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, steps } });
                              }}
                              placeholder={`步骤 ${idx + 1}`}
                              className="text-xs font-bold bg-transparent border-b border-transparent hover:border-teal-900/10 focus:border-accent/50 focus:outline-none px-1 py-0.5 transition-all"
                            />
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setPreviewStepIndex(previewStepIndex === idx ? null : idx)}
                                className="p-1 rounded hover:bg-teal-900/5 text-muted hover:text-foreground transition-colors cursor-pointer"
                                title="预览配置"
                              >
                                <Eye size={12} />
                              </button>
                              {idx > 0 && (
                                <button
                                  onClick={() => {
                                    const steps = [...(workflow.action_config?.steps || [])];
                                    [steps[idx - 1], steps[idx]] = [steps[idx], steps[idx - 1]];
                                    onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, steps } });
                                  }}
                                  className="p-1 rounded hover:bg-teal-900/5 text-muted hover:text-foreground transition-colors cursor-pointer"
                                  title="上移"
                                >
                                  <ChevronUp size={12} />
                                </button>
                              )}
                              {idx < (workflow.action_config?.steps || []).length - 1 && (
                                <button
                                  onClick={() => {
                                    const steps = [...(workflow.action_config?.steps || [])];
                                    [steps[idx], steps[idx + 1]] = [steps[idx + 1], steps[idx]];
                                    onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, steps } });
                                  }}
                                  className="p-1 rounded hover:bg-teal-900/5 text-muted hover:text-foreground transition-colors cursor-pointer"
                                  title="下移"
                                >
                                  <ChevronDown size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const steps = (workflow.action_config?.steps || []).filter((_: any, i: number) => i !== idx);
                                  onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, steps } });
                                }}
                                className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors cursor-pointer"
                                title="删除步骤"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {STEP_ACTION_TYPES.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  const steps = [...(workflow.action_config?.steps || [])];
                                  steps[idx] = { ...steps[idx], action_type: opt.value };
                                  onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, steps } });
                                }}
                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                  step.action_type === opt.value
                                    ? 'border-accent bg-accent/5'
                                    : 'border-teal-900/5 bg-white/40 hover:border-teal-900/15'
                                }`}
                              >
                                <p className="text-2xs font-bold">{opt.label}</p>
                              </button>
                            ))}
                          </div>
                          {previewStepIndex === idx && (
                            <div className="mt-2 p-3 rounded-lg bg-zinc-50 border border-teal-900/5">
                              <p className="text-2xs font-black uppercase tracking-[0.15em] text-muted mb-2">步骤配置</p>
                              <pre className="text-2xs text-foreground/70 font-mono whitespace-pre-wrap">{JSON.stringify(step.config || {}, null, 2)}</pre>
                            </div>
                          )}
                          {step.action_type === 'search_web' && (
                            <div className="space-y-2 mt-2">
                              <input
                                type="text"
                                value={step.config?.queries?.join(',') || step.config?.query || ''}
                                onChange={(e) => {
                                  const queries = e.target.value.split(',').map(q => q.trim()).filter(Boolean);
                                  const steps = [...(workflow.action_config?.steps || [])];
                                  steps[idx] = { ...steps[idx], config: { ...steps[idx].config, queries, query: queries[0] || '' } };
                                  onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, steps } });
                                }}
                                placeholder="搜索关键词（逗号分隔）"
                                className="w-full px-3 py-2 rounded-lg border border-teal-900/10 bg-white/80 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30"
                              />
                            </div>
                          )}
                          {step.action_type === 'summarize_memos' && (
                            <div className="mt-2">
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={step.config?.days || 1}
                                onChange={(e) => {
                                  const steps = [...(workflow.action_config?.steps || [])];
                                  steps[idx] = { ...steps[idx], config: { ...steps[idx].config, days: parseInt(e.target.value) || 1 } };
                                  onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, steps } });
                                }}
                                placeholder="总结天数"
                                className="w-full px-3 py-2 rounded-lg border border-teal-900/10 bg-white/80 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30"
                              />
                            </div>
                          )}
                        </div>
                        {idx < (workflow.action_config?.steps || []).length - 1 && (
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-teal-900/5 flex items-center justify-center">
                            <ChevronDown size={10} className="text-muted" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(workflow.action_config?.steps || []).length > 1 && (
                    <div>
                      <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">步骤间传递</label>
                      <select
                        value={workflow.action_config?.step_chaining || 'output_as_input'}
                        onChange={(e) => onWorkflowChange({ ...workflow, action_config: { ...workflow.action_config, step_chaining: e.target.value } })}
                        className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                      >
                        <option value="output_as_input">前步输出作为后步输入</option>
                        <option value="output_as_context">前步输出作为后步上下文</option>
                        <option value="independent">各步独立执行</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">触发方式</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'manual', label: '手动触发', icon: Play, desc: '点击按钮执行' },
                    { value: 'cron', label: '定时触发', icon: Clock, desc: '按时间周期执行' },
                    { value: 'on_memo_created', label: '便签创建时', icon: FileText, desc: '新建便签自动触发' },
                    { value: 'on_schedule_due', label: '日程到期时', icon: CalendarDays, desc: '日程临近自动触发' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onWorkflowChange({ ...workflow, trigger_type: opt.value })}
                      className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        workflow.trigger_type === opt.value
                          ? 'border-accent bg-accent/5'
                          : 'border-teal-900/5 bg-white/60 hover:border-teal-900/20'
                      }`}
                    >
                      <opt.icon size={18} className={`mb-1 ${workflow.trigger_type === opt.value ? 'text-accent' : 'text-muted'}`} />
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-2xs text-muted">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {workflow.trigger_type === 'cron' && (
                <div>
                  <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">Cron 表达式</label>
                  <input
                    type="text"
                    value={workflow.trigger_config?.cron || ''}
                    onChange={(e) => onWorkflowChange({ ...workflow, trigger_config: { ...workflow.trigger_config, cron: e.target.value } })}
                    placeholder="0 9 * * * (每天早上9点)"
                    className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  />
                  <p className="text-2xs text-muted mt-1">格式: 分 时 日 月 星期</p>
                </div>
              )}

              <div>
                <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">错误处理</label>
                <div className="flex gap-3">
                  {[
                    { value: 'stop', label: '立即停止', icon: AlertTriangle },
                    { value: 'retry', label: '自动重试', icon: Sparkles },
                    { value: 'skip', label: '跳过继续', icon: GitBranch },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onWorkflowChange({ ...workflow, error_handling: opt.value })}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        (workflow.error_handling || 'stop') === opt.value
                          ? 'border-accent bg-accent/5'
                          : 'border-teal-900/5 bg-white/60 hover:border-teal-900/20'
                      }`}
                    >
                      <opt.icon size={14} className={`mx-auto mb-1 ${(workflow.error_handling || 'stop') === opt.value ? 'text-accent' : 'text-muted'}`} />
                      <p className="text-2xs font-bold">{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8 shrink-0 pt-4 border-t border-teal-900/5">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-teal-900/10 text-sm font-bold hover:bg-teal-900/5 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!workflow.name.trim()) {
                    onNotification({ message: '请输入工作流名称', type: 'error' });
                    setTimeout(() => onNotification(null), 2000);
                    return;
                  }
                  await window.ipcRenderer.invoke('save-agent-workflow', workflow);
                  onSave();
                }}
                className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors cursor-pointer"
              >
                {workflow.id ? '保存更改' : '创建'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WorkflowModal;
