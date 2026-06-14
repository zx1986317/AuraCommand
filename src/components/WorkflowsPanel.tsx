import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from './common/EmptyState';
import {
  Play, 
  Pause, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Clock, 
  Zap,
  Calendar,
  FileText,
  Tags,
  ArrowRight,
  ChevronDown,
  Search,
  CheckSquare,
  Eye,
  MessageCircle,
  Globe,
  BookmarkPlus,
  ToggleLeft,
  ToggleRight,
  BarChart3,
  Sparkles,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Workflow, WorkflowStep, WorkflowLog } from '../types';

function safeParseJSON(raw: any): any {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return JSON.parse(parsed)
    return parsed
  } catch { return {} }
}

interface WorkflowsPanelProps {
  workflows: Workflow[];
  logs: Record<string, WorkflowLog[]>;
  executing: Record<string, boolean>;
  onCreate: (workflow: Workflow) => void;
  onUpdate: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
  onExecute: (id: string) => void;
  onToggleEnabled?: ((id: string, enabled: boolean) => void) | undefined;
}

const actionTypes = [
  { id: 'summarize_memos', name: '总结便签', icon: FileText, desc: '汇总并总结所有便签内容' },
  { id: 'daily_report', name: '每日报告', icon: Calendar, desc: '生成每日工作报告' },
  { id: 'auto_tag_memos', name: '自动标签', icon: Tags, desc: '为便签自动添加标签' },
  { id: 'custom_prompt', name: '自定义提示', icon: MessageCircle, desc: '使用自定义提示词调用AI' },
  { id: 'search_knowledge', name: '搜索知识', icon: Search, desc: '在知识库中搜索内容' },
  { id: 'search_and_summarize', name: '搜索并总结', icon: Search, desc: '在知识库中搜索关键词，AI生成综合摘要' },
  { id: 'search_web', name: '联网搜索', icon: Globe, desc: '抓取互联网资讯' },
  { id: 'extract_todos', name: '提取待办', icon: CheckSquare, desc: '从内容中提取待办事项' },
  { id: 'save_to_memo', name: '存为便签', icon: BookmarkPlus, desc: '将结果保存为便签' },
  { id: 'condition', name: '条件判断', icon: AlertCircle, desc: 'AI判断条件是否满足' },
  { id: 'multi_step', name: '多步工作流', icon: Zap, desc: '串行编排多个步骤' },
];

const triggerTypes = [
  { id: 'manual', name: '手动触发', desc: '点击按钮手动执行' },
  { id: 'cron', name: '定时触发', desc: '按计划自动执行（Cron）' },
  { id: 'on_schedule_due', name: '日程到期触发', desc: '当日程开始时自动执行' },
];

const cronPresets = [
  { label: '每分钟', expr: '* * * * *' },
  { label: '每5分钟', expr: '*/5 * * * *' },
  { label: '每15分钟', expr: '*/15 * * * *' },
  { label: '每小时', expr: '0 * * * *' },
  { label: '每天8:00', expr: '0 8 * * *' },
  { label: '每天18:00', expr: '0 18 * * *' },
  { label: '每周一9:00', expr: '0 9 * * 1' },
  { label: '每月1日10:00', expr: '0 10 1 * *' },
];

const workflowTemplates = [
  {
    name: '每日知识库摘要',
    description: '每天定时总结新增文件，生成知识库增量摘要',
    trigger_type: 'cron',
    trigger_config: JSON.stringify({ cron_expression: '0 8 * * *' }),
    action_type: 'multi_step',
    action_config: JSON.stringify({
      steps: [
        { id: uuidv4(), name: '搜索知识库', action_type: 'search_knowledge', config: { query: '最近新增文件', days: 1 } },
        { id: uuidv4(), name: '生成摘要', action_type: 'custom_prompt', config: { prompt: '请基于前序步骤搜索到的知识库内容，生成一份今日新增文件的摘要报告。包括：文件名称、核心内容概述、关键发现。使用 {{today}} 标注日期。' } },
        { id: uuidv4(), name: '保存摘要', action_type: 'save_to_memo', config: { memo_title: '每日知识库摘要 {{today}}', memo_category: '知识库', memo_tags: ['摘要', '每日', '知识库'] } }
      ]
    })
  },
  {
    name: '每周待办回顾',
    description: '每周五汇总未完成待办，帮助回顾和规划',
    trigger_type: 'cron',
    trigger_config: JSON.stringify({ cron_expression: '0 17 * * 5' }),
    action_type: 'multi_step',
    action_config: JSON.stringify({
      steps: [
        { id: uuidv4(), name: '提取待办', action_type: 'extract_todos', config: {} },
        { id: uuidv4(), name: '生成回顾', action_type: 'custom_prompt', config: { prompt: '请基于前序步骤提取的待办事项，生成一份周五回顾报告。包括：本周未完成事项清单、优先级排序建议、下周行动建议。使用 {{today}} 和 {{weekday}} 标注日期。' } },
        { id: uuidv4(), name: '保存回顾', action_type: 'save_to_memo', config: { memo_title: '每周待办回顾 {{today}}', memo_category: '待办', memo_tags: ['回顾', '每周', '待办'] } }
      ]
    })
  },
  {
    name: '文件导入自动索引',
    description: '监听新文件导入后自动建立索引和生成摘要',
    trigger_type: 'manual',
    trigger_config: '{}',
    action_type: 'multi_step',
    action_config: JSON.stringify({
      steps: [
        { id: uuidv4(), name: '搜索知识', action_type: 'search_knowledge', config: { query: '最近导入文件' } },
        { id: uuidv4(), name: '生成摘要', action_type: 'custom_prompt', config: { prompt: '请为前序步骤搜索到的文件生成结构化摘要，包括：文件主题、关键要点、建议标签。' } },
        { id: uuidv4(), name: '保存摘要', action_type: 'save_to_memo', config: { memo_title: '文件索引 {{today}}', memo_category: '索引', memo_tags: ['索引', '自动'] } }
      ]
    })
  },
  {
    name: '定期备份',
    description: '每周备份知识库数据，确保数据安全',
    trigger_type: 'cron',
    trigger_config: JSON.stringify({ cron_expression: '0 2 * * 0' }),
    action_type: 'custom_prompt',
    action_config: JSON.stringify({ prompt: '请生成一份知识库备份状态报告，包括：当前文件总数、已索引文件数、存储空间使用情况、最近一周新增文件数。使用 {{today}} 标注日期。' })
  },
  {
    name: 'AI 周回顾',
    description: '每周生成知识库活动报告，总结本周学习和工作',
    trigger_type: 'cron',
    trigger_config: JSON.stringify({ cron_expression: '0 20 * * 5' }),
    action_type: 'multi_step',
    action_config: JSON.stringify({
      steps: [
        { id: uuidv4(), name: '汇总便签', action_type: 'summarize_memos', config: { days: 7 } },
        { id: uuidv4(), name: '搜索知识', action_type: 'search_knowledge', config: { query: '本周重要内容', days: 7 } },
        { id: uuidv4(), name: '生成周回顾', action_type: 'custom_prompt', config: { prompt: '请基于前序步骤的便签总结和知识库搜索结果，生成一份全面的周回顾报告。包括：本周学习要点、关键工作进展、知识库新增内容概览、下周关注建议。使用 {{today}} 和 {{weekday}} 标注日期。' } },
        { id: uuidv4(), name: '保存周回顾', action_type: 'save_to_memo', config: { memo_title: 'AI 周回顾 {{today}}', memo_category: '周回顾', memo_tags: ['周回顾', 'AI', '知识库'] } }
      ]
    })
  },
  {
    name: '每日资讯简报',
    description: '自动抓取互联网资讯，生成结构化简报并保存为便签',
    trigger_type: 'cron',
    trigger_config: JSON.stringify({ cron_expression: '0 8 * * *' }),
    action_type: 'multi_step',
    action_config: JSON.stringify({
      steps: [
        { id: uuidv4(), name: '抓取资讯', action_type: 'search_web', config: { queries: ['AI科技新闻', '行业动态'], time_range: 'day', max_results: 5 } },
        { id: uuidv4(), name: '生成简报', action_type: 'custom_prompt', config: { prompt: '你是一位专业资讯分析师。请基于前序步骤的搜索结果，生成一份结构化的每日资讯简报。要求：\n1. 按主题分类归纳信息\n2. 提炼每条资讯的核心要点\n3. 标注关键来源\n4. 如有发展趋势或潜在影响，请特别指出' } },
        { id: uuidv4(), name: '保存便签', action_type: 'save_to_memo', config: { memo_title: '每日资讯 {{today}}', memo_category: '资讯', memo_tags: ['资讯', '自动抓取'] } }
      ]
    })
  },
  {
    name: '自动打标签',
    description: '为没有标签的便签自动生成AI标签',
    trigger_type: 'manual',
    trigger_config: '{}',
    action_type: 'auto_tag_memos',
    action_config: '{}'
  },
  {
    name: '周报生成',
    description: '每周一自动汇总本周便签和日程，生成周报',
    trigger_type: 'cron',
    trigger_config: JSON.stringify({ cron_expression: '0 9 * * 1' }),
    action_type: 'multi_step',
    action_config: JSON.stringify({
      steps: [
        { id: uuidv4(), name: '汇总便签', action_type: 'summarize_memos', config: { days: 7 } },
        { id: uuidv4(), name: '生成周报', action_type: 'custom_prompt', config: { prompt: '基于前序步骤的便签总结，生成一份结构化的周报。包括：本周主要工作、关键进展、下周计划。使用 {{today}} 和 {{weekday}} 变量标注日期。' } },
        { id: uuidv4(), name: '保存周报', action_type: 'save_to_memo', config: { memo_title: '周报 {{today}}', memo_category: '周报', memo_tags: ['周报', '自动生成'] } }
      ]
    })
  },
  {
    name: '待办提取',
    description: '从最近7天便签中提取所有待办事项',
    trigger_type: 'manual',
    trigger_config: '{}',
    action_type: 'extract_todos',
    action_config: '{}'
  },
  {
    name: '每日工作日报',
    description: '每天18:00自动生成当天工作日报',
    trigger_type: 'cron',
    trigger_config: JSON.stringify({ cron_expression: '0 18 * * *' }),
    action_type: 'daily_report',
    action_config: '{}'
  },
  {
    name: '搜索并总结',
    description: '在知识库中搜索关键词，AI生成综合摘要',
    trigger_type: 'manual',
    trigger_config: '{}',
    action_type: 'search_and_summarize',
    action_config: '{}'
  },
  {
    name: '会议前准备',
    description: '会议开始前自动总结相关便签，帮你做好准备',
    trigger_type: 'on_schedule_due',
    trigger_config: JSON.stringify({ category: '会议', title_match: '' }),
    action_type: 'multi_step',
    action_config: JSON.stringify({
      steps: [
        { id: uuidv4(), name: '汇总便签', action_type: 'summarize_memos', config: { days: 3 } },
        { id: uuidv4(), name: '生成准备提示', action_type: 'custom_prompt', config: { prompt: '基于前序步骤的便签总结，为即将到来的会议生成一份准备要点清单。包括：\n1. 可能讨论的话题\n2. 需要提前了解的背景\n3. 建议准备的材料\n使用 {{today}} 和 {{weekday}} 标注日期。' } },
      ]
    })
  },
];

const templateVariables = [
  { key: '{{today}}', desc: '今日日期（如 2026/4/27）' },
  { key: '{{now}}', desc: '当前时间（如 2026/4/27 14:30:00）' },
  { key: '{{weekday}}', desc: '星期几（如 一、二、三...）' },
  { key: '{{timestamp}}', desc: 'ISO时间戳' },
];

function computeStats(wLogs: WorkflowLog[]) {
  const total = wLogs.length
  const completed = wLogs.filter(l => l.status === 'completed').length
  const failed = wLogs.filter(l => l.status === 'failed').length
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const lastRun = total > 0 ? wLogs[0]?.executed_at : null
  return { total, completed, failed, successRate, lastRun }
}

const WorkflowsPanel: React.FC<WorkflowsPanelProps> = ({
  workflows,
  logs,
  executing,
  onCreate,
  onUpdate,
  onDelete,
  onExecute,
  onToggleEnabled
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [showStats, setShowStats] = useState<string | null>(null);

  const handleSave = (workflow: Partial<Workflow>) => {
    if (editingWorkflow?.id) {
      onUpdate({ ...editingWorkflow, ...workflow } as Workflow);
    } else {
      onCreate({
        id: uuidv4(),
        name: workflow.name || '新工作流',
        description: workflow.description || '',
        trigger_type: workflow.trigger_type || 'manual',
        trigger_config: workflow.trigger_config || '',
        action_type: workflow.action_type || 'summarize_memos',
        action_config: workflow.action_config || '',
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...workflow
      } as Workflow);
    }
    setShowModal(false);
    setEditingWorkflow(null);
  };

  const handleCreateFromTemplate = (template: any) => {
    onCreate({
      id: uuidv4(),
      ...template,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Workflow);
    setShowTemplateModal(false);
  };

  return (
    <motion.div 
      key="workflows"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="max-w-5xl mx-auto w-full h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
            <Zap size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">自动化任务</h2>
            <p className="text-xs text-muted font-medium">创建和管理自动化工作流</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-900/5 text-foreground rounded-xl text-xs font-bold hover:bg-teal-900/10 transition-all"
          >
            <Sparkles size={16} />
            从模板创建
          </button>
          <button 
            onClick={() => { setEditingWorkflow(null); setShowModal(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent/90 transition-all shadow-premium active:scale-95"
          >
            <Plus size={16} />
            新建工作流
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
        {workflows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Zap size={32} />}
              title="暂无工作流"
              description="把高频操作串起来：一句话触发、自动汇总、定时推送"
              action={
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="px-5 py-2 bg-teal-900/5 text-foreground rounded-xl text-xs font-bold hover:bg-teal-900/10 transition-all"
                  >
                    从模板创建
                  </button>
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-5 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent/90 transition-all"
                  >
                    + 自定义创建
                  </button>
                </div>
              }
            />
          </div>
        ) : (
          workflows.map((workflow) => {
            const action = actionTypes.find(a => a.id === workflow.action_type);
            const trigger = triggerTypes.find(t => t.id === workflow.trigger_type);
            const isExecuting = executing[workflow.id];
            const workflowLogs = logs[workflow.id] || [];
            const stats = computeStats(workflowLogs);
            let cronExpr = ''
            if (workflow.trigger_type === 'cron' && workflow.trigger_config) {
              try {
                const tc = safeParseJSON(workflow.trigger_config)
                cronExpr = tc?.cron_expression || tc?.cron || ''
              } catch {}
            }

            return (
              <div key={workflow.id} className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-6 shadow-glass">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${workflow.enabled ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-gray-400'}`}>
                      {action?.icon && <action.icon size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-foreground">{workflow.name}</h3>
                        {!workflow.enabled && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-2xs font-bold text-gray-400">已停用</span>
                        )}
                      </div>
                      <p className="text-xs text-muted mb-2">{workflow.description || '无描述'}</p>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full bg-teal-900/5 text-2xs font-bold text-muted flex items-center gap-1">
                          {trigger?.id === 'cron' ? <Clock size={8} /> : trigger?.id === 'on_schedule_due' ? <Calendar size={8} /> : null}
                          {trigger?.name || '未知触发'}
                          {cronExpr ? ` (${cronExpr})` : ''}
                        </span>
                        {workflow.action_type === 'multi_step' ? (
                          (() => {
                            let stepList: WorkflowStep[] = [];
                            try {
                              const config = safeParseJSON(workflow.action_config);
                              stepList = config.steps || [];
                            } catch {}
                            return (
                              <div className="flex items-center gap-1 flex-wrap">
                                {stepList.map((step, si) => {
                                  const stepAction = actionTypes.find(a => a.id === step.action_type);
                                  const StepIcon = stepAction?.icon || Zap;
                                  return (
                                    <React.Fragment key={si}>
                                      <span className="px-2 py-0.5 rounded-full bg-accent/5 text-2xs font-bold text-accent flex items-center gap-1">
                                        <StepIcon size={8} />
                                        {step.name}
                                      </span>
                                      {si < stepList.length - 1 && <ArrowRight size={8} className="text-muted" />}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-accent/5 text-2xs font-bold text-accent">
                            {action?.name || '未知动作'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onToggleEnabled && (
                      <button
                        onClick={() => onToggleEnabled(workflow.id, !workflow.enabled)}
                        className="p-2 rounded-xl transition-all hover:bg-teal-900/5"
                        title={workflow.enabled ? '停用' : '启用'}
                      >
                        {workflow.enabled ? 
                          <ToggleRight size={18} className="text-accent" /> : 
                          <ToggleLeft size={18} className="text-gray-400" />
                        }
                      </button>
                    )}
                    <button 
                      onClick={() => onExecute(workflow.id)}
                      disabled={isExecuting}
                      className={`p-2 rounded-xl transition-all ${isExecuting ? 'bg-accent/10 text-accent' : 'hover:bg-accent/10 text-muted hover:text-accent'} disabled:opacity-30`}
                      title="执行"
                    >
                      {isExecuting ? <Pause size={18} className="animate-pulse" /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={() => setShowStats(showStats === workflow.id ? null : workflow.id)}
                      className="p-2 hover:bg-teal-900/5 rounded-xl text-muted hover:text-foreground transition-all"
                      title="统计"
                    >
                      <BarChart3 size={16} />
                    </button>
                    <button 
                      onClick={() => { setEditingWorkflow(workflow); setShowModal(true); }}
                      className="p-2 hover:bg-teal-900/5 rounded-xl text-muted hover:text-foreground transition-all"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(workflow.id)}
                      className="p-2 hover:bg-red-50 rounded-xl text-muted hover:text-red-500 transition-all"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {showStats === workflow.id && stats.total > 0 && (
                  <div className="mt-3 p-3 bg-teal-900/[0.03] rounded-xl flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={12} className="text-accent" />
                      <span className="text-2xs font-bold text-muted">统计</span>
                    </div>
                    <div className="text-2xs text-muted">总执行: <span className="font-bold text-foreground">{stats.total}</span></div>
                    <div className="text-2xs text-muted">成功: <span className="font-bold text-green-600">{stats.completed}</span></div>
                    <div className="text-2xs text-muted">失败: <span className="font-bold text-red-600">{stats.failed}</span></div>
                    <div className="text-2xs text-muted">成功率: <span className="font-bold text-accent">{stats.successRate}%</span></div>
                    {stats.lastRun && (
                      <div className="text-2xs text-muted">上次: <span className="font-bold text-foreground">{new Date(stats.lastRun).toLocaleString()}</span></div>
                    )}
                  </div>
                )}

                {workflowLogs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-teal-900/5">
                    <button 
                      onClick={() => setExpandedLogs(expandedLogs === workflow.id ? null : workflow.id)}
                      className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
                    >
                      <Clock size={12} />
                      <span>执行记录 ({workflowLogs.length})</span>
                    </button>
                    <AnimatePresence>
                      {expandedLogs === workflow.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 space-y-2 overflow-hidden"
                        >
                          {workflowLogs.slice(0, 5).map((log) => (
                            <div key={log.id} className="p-3 bg-teal-900/5 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === 'completed' ? 'bg-green-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                                <span className="text-2xs text-muted">{new Date(log.executed_at).toLocaleString()}</span>
                                <span className={`text-2xs font-bold ${log.status === 'completed' ? 'text-green-600' : log.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                                  {log.status === 'completed' ? '成功' : log.status === 'failed' ? '失败' : '运行中'}
                                </span>
                                {log.result && (
                                  <button
                                    onClick={() => setExpandedResult(expandedResult === log.id ? null : log.id)}
                                    className="ml-auto flex items-center gap-1 text-2xs text-accent hover:text-accent/80 transition-colors cursor-pointer"
                                  >
                                    <Eye size={10} />
                                    <span>{expandedResult === log.id ? '收起' : '查看结果'}</span>
                                  </button>
                                )}
                              </div>
                              {log.result && expandedResult === log.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="mt-2 overflow-hidden"
                                >
                                  <div className="p-3 bg-white border border-teal-900/10 rounded-xl text-2xs text-foreground leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap"
                                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}
                                  >
                                    {log.result}
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <WorkflowModal 
            workflow={editingWorkflow}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditingWorkflow(null); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTemplateModal && (
          <TemplateModal
            onSelect={handleCreateFromTemplate}
            onClose={() => setShowTemplateModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface WorkflowModalProps {
  workflow: Workflow | null;
  onSave: (workflow: Partial<Workflow>) => void;
  onClose: () => void;
}

const WorkflowModal: React.FC<WorkflowModalProps> = ({ workflow, onSave, onClose }) => {
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [triggerType, setTriggerType] = useState<'manual' | 'cron' | 'on_schedule_due'>(workflow?.trigger_type === 'cron' ? 'cron' : workflow?.trigger_type === 'on_schedule_due' ? 'on_schedule_due' : 'manual');
  const [cronExpression, setCronExpression] = useState(() => {
    if (workflow?.trigger_type === 'cron' && workflow.trigger_config) {
      try {
        const tc = safeParseJSON(workflow.trigger_config)
        return tc?.cron_expression || tc?.cron || ''
      } catch { return '' }
    }
    return ''
  });
  const [scheduleMatchCategory, setScheduleMatchCategory] = useState(() => {
    if (workflow?.trigger_type === 'on_schedule_due' && workflow.trigger_config) {
      try {
        const tc = safeParseJSON(workflow.trigger_config)
        return tc?.category || ''
      } catch { return '' }
    }
    return ''
  });
  const [scheduleMatchTitle, setScheduleMatchTitle] = useState(() => {
    if (workflow?.trigger_type === 'on_schedule_due' && workflow.trigger_config) {
      try {
        const tc = safeParseJSON(workflow.trigger_config)
        return tc?.title_match || ''
      } catch { return '' }
    }
    return ''
  });
  const [actionType, setActionType] = useState<string>(workflow?.action_type || 'summarize_memos');
  const [isMultiStep, setIsMultiStep] = useState(workflow?.action_type === 'multi_step');
  const [steps, setSteps] = useState<WorkflowStep[]>(() => {
    if (workflow?.action_type === 'multi_step' && workflow.action_config) {
      try {
        const config = safeParseJSON(workflow.action_config);
        return config.steps || [];
      } catch { return []; }
    }
    return [];
  });
  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    if (workflow?.action_config) {
      try {
        const config = safeParseJSON(workflow.action_config);
        return config.prompt || '';
      } catch { return ''; }
    }
    return '';
  });
  const [showVarHint, setShowVarHint] = useState(false)
  const [showCronHelp, setShowCronHelp] = useState(false);

  const insertVariable = (varKey: string) => {
    setCustomPrompt(prev => prev + varKey)
  }

  const insertStepVariable = (stepId: string, varKey: string) => {
    setSteps(prev => prev.map(s => {
      if (s.id === stepId && s.action_type === 'custom_prompt') {
        return { ...s, config: { ...s.config, prompt: (s.config.prompt || '') + varKey } }
      }
      return s
    }))
  }

  const addStep = () => {
    setSteps(prev => [...prev, {
      id: uuidv4(),
      name: `步骤 ${prev.length + 1}`,
      action_type: 'custom_prompt',
      config: {}
    }]);
  };

  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const moveStep = (id: string, direction: 'up' | 'down') => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx]!, arr[idx]!];
      return arr;
    });
  };

  const handleSave = () => {
    const triggerConfig = triggerType === 'cron' 
      ? JSON.stringify({ cron_expression: cronExpression }) 
      : triggerType === 'on_schedule_due'
        ? JSON.stringify({ category: scheduleMatchCategory, title_match: scheduleMatchTitle })
        : '{}'
    
    if (isMultiStep) {
      onSave({
        name, description, trigger_type: triggerType,
        trigger_config: triggerConfig,
        action_type: 'multi_step',
        action_config: JSON.stringify({ steps })
      });
    } else {
      const config = actionType === 'custom_prompt' ? { prompt: customPrompt } : {};
      onSave({
        name, description, trigger_type: triggerType,
        trigger_config: triggerConfig,
        action_type: actionType as Workflow['action_type'],
        action_config: JSON.stringify(config)
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl p-8 max-h-[85vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-foreground">{workflow ? '编辑工作流' : '新建工作流'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-teal-900/5 rounded-xl text-muted transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">名称</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入工作流名称"
              className="w-full px-4 py-3 bg-teal-900/5 border border-teal-900/10 rounded-xl text-sm outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">描述</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入工作流描述"
              className="w-full px-4 py-3 bg-teal-900/5 border border-teal-900/10 rounded-xl text-sm outline-none focus:border-accent/50 transition-all resize-none min-h-[60px]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">触发方式</label>
            <div className="grid grid-cols-2 gap-2">
              {triggerTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTriggerType(t.id as 'manual' | 'cron' | 'on_schedule_due')}
                  className={`p-3 rounded-xl text-left transition-all ${triggerType === t.id ? 'bg-accent/10 border border-accent/30' : 'bg-teal-900/5 border border-transparent hover:bg-teal-900/10'}`}
                >
                  <p className="text-xs font-bold text-foreground">{t.name}</p>
                  <p className="text-2xs text-muted mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {triggerType === 'cron' && (
            <div className="p-4 bg-teal-900/[0.03] rounded-2xl border border-teal-900/5 space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Cron 表达式</label>
                <div className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setShowCronHelp(true)}
                    onMouseLeave={() => setShowCronHelp(false)}
                    onClick={() => setShowCronHelp(!showCronHelp)}
                    className="text-muted/40 hover:text-accent transition-colors cursor-help"
                  >
                    <HelpCircle size={13} />
                  </button>
                  <AnimatePresence>
                    {showCronHelp && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-6 z-50 w-72 px-3 py-2.5 bg-white rounded-xl border border-teal-900/10 shadow-lg text-2xs leading-5 text-muted"
                      >
                        <p className="font-bold text-2xs text-foreground mb-1.5">Cron 表达式格式</p>
                        <p className="mb-1.5"><span className="font-mono font-bold text-2xs text-accent">分 时 日 月 周</span>（共5个字段）</p>
                        <div className="space-y-0.5 font-mono text-2xs text-muted">
                          <p><span className="text-foreground">*</span> = 任意值 &nbsp;<span className="text-foreground">*/5</span> = 每5个</p>
                          <p><span className="text-foreground">0</span> = 零 &nbsp;<span className="text-foreground">1-5</span> = 范围</p>
                        </div>
                        <div className="mt-2 pt-2 border-t border-teal-900/5 space-y-0.5 text-2xs text-muted">
                          <p><span className="font-mono font-bold text-accent">30 10 * * *</span> = 每天10:30</p>
                          <p><span className="font-mono text-muted/60">0 8 * * *</span> = 每天8:00</p>
                          <p><span className="font-mono text-muted/60">0 9 * * 1</span> = 每周一9:00</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="如 0 8 * * * (每天8:00)"
                className="w-full px-4 py-3 bg-white border border-teal-900/10 rounded-xl text-sm font-mono outline-none focus:border-accent/50 transition-all"
              />
              <div className="flex items-center gap-2 flex-wrap">
                {cronPresets.map((preset) => (
                  <button
                    key={preset.expr}
                    onClick={() => setCronExpression(preset.expr)}
                    className={`px-3 py-1.5 rounded-lg text-2xs font-bold transition-all ${cronExpression === preset.expr ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-white border border-teal-900/5 text-muted hover:bg-teal-900/5'}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-2xs text-muted">
                格式：分钟 小时 日 月 星期 (如 0 8 * * * = 每天8:00)
              </p>
            </div>
          )}

          {triggerType === 'on_schedule_due' && (
            <div className="p-4 bg-teal-900/[0.03] rounded-2xl border border-teal-900/5 space-y-3">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">日程匹配条件</label>
              <p className="text-2xs text-muted">当日程开始时触发。可设置筛选条件，仅匹配特定日程。</p>
              <input
                type="text"
                value={scheduleMatchCategory}
                onChange={(e) => setScheduleMatchCategory(e.target.value)}
                placeholder="日程分类（如：会议、工作，留空匹配所有）"
                className="w-full px-4 py-3 bg-white border border-teal-900/10 rounded-xl text-sm outline-none focus:border-accent/50 transition-all"
              />
              <input
                type="text"
                value={scheduleMatchTitle}
                onChange={(e) => setScheduleMatchTitle(e.target.value)}
                placeholder="标题关键词（如：周会，留空匹配所有）"
                className="w-full px-4 py-3 bg-white border border-teal-900/10 rounded-xl text-sm outline-none focus:border-accent/50 transition-all"
              />
            </div>
          )}

          <div className="border-t border-teal-900/5 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">工作流模式</label>
              <button
                onClick={() => setIsMultiStep(!isMultiStep)}
                className={`relative w-10 h-5 rounded-full transition-colors ${isMultiStep ? 'bg-accent' : 'bg-teal-900/10'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isMultiStep ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <p className="text-2xs text-muted mb-3">
              {isMultiStep ? '多步模式：可编排多个 Agent 步骤串行执行' : '单步模式：选择一个动作执行'}
            </p>
          </div>

          {isMultiStep ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">步骤编排</label>
                <button
                  onClick={addStep}
                  className="flex items-center gap-1 px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-2xs font-bold hover:bg-accent/20 transition-all"
                >
                  <Plus size={10} /> 添加步骤
                </button>
              </div>

              {steps.length === 0 ? (
                <div className="text-center py-8 bg-teal-900/[0.02] rounded-2xl border border-dashed border-teal-900/10">
                  <p className="text-xs text-muted">点击"添加步骤"开始编排工作流</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {steps.map((step, idx) => {
                    const stepAction = actionTypes.find(a => a.id === step.action_type);
                    return (
                      <motion.div
                        key={step.id}
                        layout
                        className="bg-teal-900/[0.02] rounded-2xl border border-teal-900/5 p-4"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-2xs font-bold">
                            {idx + 1}
                          </div>
                          <input
                            value={step.name}
                            onChange={(e) => updateStep(step.id, { name: e.target.value })}
                            className="flex-1 text-xs font-bold bg-transparent outline-none"
                            placeholder="步骤名称"
                          />
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveStep(step.id, 'up')} disabled={idx === 0} className="p-1 rounded hover:bg-teal-900/5 text-muted disabled:opacity-30">
                              <ChevronDown size={12} className="rotate-180" />
                            </button>
                            <button onClick={() => moveStep(step.id, 'down')} disabled={idx === steps.length - 1} className="p-1 rounded hover:bg-teal-900/5 text-muted disabled:opacity-30">
                              <ChevronDown size={12} />
                            </button>
                            <button onClick={() => removeStep(step.id)} className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {actionTypes.map((a) => {
                            const Icon = a.icon;
                            return (
                              <button
                                key={a.id}
                                onClick={() => updateStep(step.id, { action_type: a.id as WorkflowStep['action_type'] })}
                                className={`p-2 rounded-xl text-left transition-all flex items-center gap-1.5 ${step.action_type === a.id ? 'bg-accent/10 border border-accent/20' : 'bg-white border border-transparent hover:bg-teal-900/5'}`}
                              >
                                <Icon size={12} className={step.action_type === a.id ? 'text-accent' : 'text-muted'} />
                                <span className="text-2xs font-bold">{a.name}</span>
                              </button>
                            );
                          })}
                        </div>
                        {step.action_type === 'custom_prompt' && (
                          <div className="mt-2">
                            <textarea
                              value={step.config.prompt || ''}
                              onChange={(e) => updateStep(step.id, { config: { ...step.config, prompt: e.target.value } })}
                              placeholder="输入自定义提示词... 可使用 {{today}} {{now}} 等变量"
                              className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30 resize-none min-h-[60px]"
                            />
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {templateVariables.map(v => (
                                <button
                                  key={v.key}
                                  onClick={() => insertStepVariable(step.id, v.key)}
                                  className="px-2 py-0.5 bg-accent/5 text-accent rounded text-xs font-bold hover:bg-accent/10 transition-all"
                                  title={v.desc}
                                >
                                  {v.key}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {step.action_type === 'condition' && (
                          <div className="mt-2 space-y-2">
                            <input
                              type="text"
                              value={step.config?.condition || ''}
                              onChange={(e) => updateStep(step.id, { config: { ...step.config, condition: e.target.value } })}
                              placeholder="条件描述（如：今天有会议安排）"
                              className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30"
                            />
                            <label className="flex items-center gap-2 text-2xs text-muted cursor-pointer">
                              <input
                                type="checkbox"
                                checked={step.config?.skip_if_false || false}
                                onChange={(e) => updateStep(step.id, { config: { ...step.config, skip_if_false: e.target.checked } })}
                                className="w-3 h-3 accent-accent"
                              />
                              条件不满足时跳过后续步骤
                            </label>
                          </div>
                        )}
                        {step.action_type === 'search_web' && (
                          <div className="mt-2 space-y-2">
                            <input
                              type="text"
                              value={step.config?.queries?.join(',') || step.config?.query || ''}
                              onChange={(e) => {
                                const queries = e.target.value.split(',').map(q => q.trim()).filter(Boolean);
                                updateStep(step.id, { config: { ...step.config, queries, query: queries[0] || '' } });
                              }}
                              placeholder="搜索关键词（逗号分隔）"
                              className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30"
                            />
                            <input
                              type="text"
                              value={step.config?.searxng_url || ''}
                              onChange={(e) => updateStep(step.id, { config: { ...step.config, searxng_url: e.target.value } })}
                              placeholder="SearXNG 地址（留空使用全局配置）"
                              className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30 font-mono"
                            />
                            <select
                              value={step.config?.time_range || 'day'}
                              onChange={(e) => updateStep(step.id, { config: { ...step.config, time_range: e.target.value } })}
                              className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30"
                            >
                              <option value="day">今天</option>
                              <option value="week">本周</option>
                              <option value="month">本月</option>
                              <option value="">不限</option>
                            </select>
                          </div>
                        )}
                        {step.action_type === 'save_to_memo' && (
                          <div className="mt-2 space-y-2">
                            <input
                              type="text"
                              value={step.config?.memo_title || ''}
                              onChange={(e) => updateStep(step.id, { config: { ...step.config, memo_title: e.target.value } })}
                              placeholder="便签标题（可用 {{today}} 变量）"
                              className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30"
                            />
                            <input
                              type="text"
                              value={step.config?.memo_category || '工作流'}
                              onChange={(e) => updateStep(step.id, { config: { ...step.config, memo_category: e.target.value } })}
                              placeholder="分类"
                              className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30"
                            />
                          </div>
                        )}
                        {step.action_type === 'summarize_memos' && (
                          <div className="mt-2">
                            <label className="text-2xs text-muted">汇总最近几天</label>
                            <input
                              type="number"
                              value={step.config?.days || 1}
                              min={1}
                              max={30}
                              onChange={(e) => updateStep(step.id, { config: { ...step.config, days: parseInt(e.target.value) || 1 } })}
                              className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30"
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {steps.length > 1 && (
                <div className="flex items-center gap-2 py-2 overflow-x-auto">
                  {steps.map((step, idx) => {
                    const stepAction = actionTypes.find(a => a.id === step.action_type);
                    const Icon = stepAction?.icon || Zap;
                    return (
                      <React.Fragment key={step.id}>
                        <div className="flex items-center gap-1 px-2 py-1 bg-accent/5 rounded-lg shrink-0">
                          <Icon size={10} className="text-accent" />
                          <span className="text-xs font-bold text-accent">{step.name}</span>
                        </div>
                        {idx < steps.length - 1 && <ArrowRight size={10} className="text-muted shrink-0" />}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">执行动作</label>
              <div className="space-y-2">
                {actionTypes.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setActionType(a.id)}
                      className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${actionType === a.id ? 'bg-accent/10 border border-accent/30' : 'bg-teal-900/5 border border-transparent hover:bg-teal-900/10'}`}
                    >
                      <Icon size={18} className={actionType === a.id ? 'text-accent' : 'text-muted'} />
                      <div>
                        <p className="text-xs font-bold text-foreground">{a.name}</p>
                        <p className="text-2xs text-muted mt-0.5">{a.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {actionType === 'custom_prompt' && (
                <div className="mt-3">
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="输入自定义提示词... 可使用 {{today}} {{now}} 等变量"
                    className="w-full px-4 py-3 bg-teal-900/5 border border-teal-900/10 rounded-xl text-sm outline-none focus:border-accent/50 resize-none min-h-[80px]"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xs text-muted">插入变量：</span>
                    {templateVariables.map(v => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="px-2 py-0.5 bg-accent/5 text-accent rounded text-2xs font-bold hover:bg-accent/10 transition-all"
                        title={v.desc}
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-teal-900/5 text-muted rounded-xl text-sm font-bold hover:bg-teal-900/10 transition-all">
            取消
          </button>
          <button onClick={handleSave} className="flex-1 px-4 py-3 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all">
            保存
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface TemplateModalProps {
  onSelect: (template: any) => void;
  onClose: () => void;
}

const TemplateModal: React.FC<TemplateModalProps> = ({ onSelect, onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-8 max-h-[80vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-accent" />
            <h3 className="text-lg font-bold text-foreground">工作流模板库</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-teal-900/5 rounded-xl text-muted transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          {workflowTemplates.map((template, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(template)}
              className="w-full p-4 rounded-2xl text-left transition-all bg-teal-900/[0.03] border border-teal-900/5 hover:bg-accent/5 hover:border-accent/20 group"
            >
              <div className="flex items-center gap-3 mb-2">
                <Zap size={16} className="text-accent" />
                <h4 className="text-sm font-bold text-foreground">{template.name}</h4>
                {template.trigger_type === 'cron' && (
                  <span className="px-2 py-0.5 rounded-full bg-accent/10 text-2xs font-bold text-accent">
                    定时
                  </span>
                )}
              </div>
              <p className="text-2xs text-muted">{template.description}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WorkflowsPanel;