import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowRight, CheckCircle, X, Sparkles, Zap, Search, FileText, Calendar } from 'lucide-react';
import { ipcService } from '../services/ipc';
import { logger } from '../utils/logger';

interface SimpleWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  templateData: {
    name: string;
    description: string;
    nodes: any[];
    edges: any[];
    variables: Record<string, string>;
  };
}

const SIMPLE_TEMPLATES: SimpleWorkflowTemplate[] = [
  {
    id: 'daily-news',
    name: '每日资讯收集',
    description: '自动搜索今日新闻并保存为便签',
    icon: <Zap size={20} />,
    category: '资讯',
    templateData: {
      name: '每日科技资讯',
      description: '自动搜索今日科技新闻，AI总结后保存为便签',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '搜索科技资讯', config: { tool_name: 'search_web', tool_args: { query: '今日科技新闻 最新科技资讯', time_range: 'day', limit: 8 } } },
        { id: 'n3', type: 'llm', name: 'AI总结', config: { system_prompt: '你是一个科技资讯编辑，请将搜索到的新闻整理为结构化的每日科技简报。使用Markdown格式，包含：日期、重要新闻标题和摘要、分类（AI/芯片/互联网/创业等）。', prompt: '请将以下搜索结果整理为今日科技简报：\n\n{{nodeOutput.n2.items}}' } },
        { id: 'n4', type: 'tool', name: '保存为便签', config: { tool_name: 'create_memo', tool_args: { title: '每日科技简报 {{date}}', content: '{{nodeOutput.n3.response}}', tags: '科技,资讯,日报' } } },
        { id: 'n5', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n2', targetId: 'n3' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
    },
  },
  {
    id: 'knowledge-summary',
    name: '知识库周报',
    description: '搜索知识库内容，生成周报',
    icon: <FileText size={20} />,
    category: '总结',
    templateData: {
      name: '知识库周报',
      description: '搜索本周知识库内容，生成周报并保存',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '搜索知识库', config: { tool_name: 'search_knowledge', tool_args: { query: '本周工作记录 项目进展', limit: 10 } } },
        { id: 'n3', type: 'llm', name: '生成周报', config: { system_prompt: '你是一个项目经理，请根据知识库搜索结果生成本周工作周报。使用Markdown格式，包含：本周完成事项、遇到的问题、下周计划。', prompt: '请根据以下知识库内容生成本周工作周报：\n\n{{nodeOutput.n2.items}}' } },
        { id: 'n4', type: 'tool', name: '保存周报', config: { tool_name: 'create_memo', tool_args: { title: '工作周报 {{date}}', content: '{{nodeOutput.n3.response}}', tags: '周报,工作' } } },
        { id: 'n5', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n2', targetId: 'n3' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
    },
  },
  {
    id: 'schedule-manager',
    name: '日程管理',
    description: '查看待办日程，AI分析优先级',
    icon: <Calendar size={20} />,
    category: '管理',
    templateData: {
      name: '智能日程管理',
      description: '查看待办日程，AI分析优先级，生成提醒便签',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '获取待办日程', config: { tool_name: 'list_schedules', tool_args: { status: 'pending' } } },
        { id: 'n3', type: 'llm', name: 'AI分析优先级', config: { system_prompt: '你是一个时间管理专家，请分析用户的待办日程，按紧急程度排序，给出每个日程的优先级和建议处理时间。', prompt: '请分析以下待办日程并给出优先级建议：\n\n{{nodeOutput.n2.items}}' } },
        { id: 'n4', type: 'tool', name: '保存分析结果', config: { tool_name: 'create_memo', tool_args: { title: '日程优先级分析 {{date}}', content: '{{nodeOutput.n3.response}}', tags: '日程,分析' } } },
        { id: 'n5', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n2', targetId: 'n3' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
    },
  },
  {
    id: 'weekly-review',
    name: '本周回顾',
    description: '回顾本周便签和日程，生成周总结',
    icon: <FileText size={20} />,
    category: '总结',
    templateData: {
      name: '本周工作回顾',
      description: '回顾本周便签和日程，生成周总结',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '搜索本周便签', config: { tool_name: 'search_memos', tool_args: { query: '本周', limit: 20 } } },
        { id: 'n3', type: 'tool', name: '获取本周日程', config: { tool_name: 'list_schedules', tool_args: {} } },
        { id: 'n4', type: 'llm', name: '生成回顾总结', config: { system_prompt: '你是一个个人助理，帮助用户总结本周工作和生活。使用Markdown格式输出：本周大事记、完成任务、未完成事项、下周重点。', prompt: '根据以下本周的便签和日程，生成一份个人周回顾总结：\n\n便签：\n{{nodeOutput.n2.items}}\n\n日程：\n{{nodeOutput.n3.items}}' } },
        { id: 'n5', type: 'tool', name: '保存总结', config: { tool_name: 'create_memo', tool_args: { title: '周回顾 {{date}}', content: '{{nodeOutput.n4.response}}', tags: '周报,回顾' } } },
        { id: 'n6', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n1', targetId: 'n3' },
        { sourceId: 'n2', targetId: 'n4' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
        { sourceId: 'n5', targetId: 'n6' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
    },
  },
  {
    id: 'meeting-notes',
    name: '会议记录助手',
    description: '从便签中提取会议要点并生成纪要',
    icon: <Search size={20} />,
    category: '总结',
    templateData: {
      name: '会议记录助手',
      description: '搜索会议相关便签，AI提取要点并生成会议纪要',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '搜索会议便签', config: { tool_name: 'search_memos', tool_args: { query: '会议', limit: 10 } } },
        { id: 'n3', type: 'llm', name: '生成会议纪要', config: { system_prompt: '你是一个会议记录员。从便签中提取会议相关内容，生成结构化的会议纪要，包含：会议主题、参会人、讨论要点、决定事项、待办任务。', prompt: '从以下便签中提取会议相关信息，生成会议纪要：\n\n{{nodeOutput.n2.items}}' } },
        { id: 'n4', type: 'tool', name: '保存纪要', config: { tool_name: 'create_memo', tool_args: { title: '会议纪要 {{date}}', content: '{{nodeOutput.n3.response}}', tags: '会议,纪要' } } },
        { id: 'n5', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n2', targetId: 'n3' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
    },
  },
  {
    id: 'morning-briefing',
    name: '晨间简报',
    description: '每天查看日程、便签和最新资讯',
    icon: <Sparkles size={20} />,
    category: '资讯',
    templateData: {
      name: '每日晨间简报',
      description: '查看今日日程、昨日便签和最新资讯，生成晨间报告',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '获取今日日程', config: { tool_name: 'list_schedules', tool_args: {} } },
        { id: 'n3', type: 'tool', name: '搜索昨日便签', config: { tool_name: 'search_memos', tool_args: { query: '昨天', limit: 5 } } },
        { id: 'n4', type: 'tool', name: '搜索最新资讯', config: { tool_name: 'search_web', tool_args: { query: '今日要闻', limit: 5 } } },
        { id: 'n5', type: 'llm', name: '生成晨间简报', config: { system_prompt: '你是一个个人助理，生成每日晨间简报。使用Markdown格式输出：🌤️ 今日概览、📅 今日日程、📝 昨日回顾、📰 今日要闻、💡 今日建议。', prompt: '根据以下信息生成今日晨间简报：\n\n今日日程：\n{{nodeOutput.n2.items}}\n\n昨日便签：\n{{nodeOutput.n3.items}}\n\n今日要闻：\n{{nodeOutput.n4.items}}' } },
        { id: 'n6', type: 'tool', name: '保存简报', config: { tool_name: 'create_memo', tool_args: { title: '晨间简报 {{date}}', content: '{{nodeOutput.n5.response}}', tags: '晨间,简报' } } },
        { id: 'n7', type: 'send_notification', name: '通知用户', config: { tool_name: 'send_notification', tool_args: { message: '您的晨间简报已生成，请查看' } } },
        { id: 'n8', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n1', targetId: 'n3' },
        { sourceId: 'n1', targetId: 'n4' },
        { sourceId: 'n2', targetId: 'n5' },
        { sourceId: 'n3', targetId: 'n5' },
        { sourceId: 'n4', targetId: 'n5' },
        { sourceId: 'n5', targetId: 'n6' },
        { sourceId: 'n6', targetId: 'n7' },
        { sourceId: 'n7', targetId: 'n8' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
    },
  },
  {
    id: 'idea-organizer',
    name: '灵感整理',
    description: '搜索近期便签，AI提炼核心观点',
    icon: <Sparkles size={20} />,
    category: '管理',
    templateData: {
      name: '灵感整理',
      description: '搜索近期便签，AI提炼核心观点并分类',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '搜索近期便签', config: { tool_name: 'search_memos', tool_args: { query: '', limit: 30 } } },
        { id: 'n3', type: 'llm', name: 'AI提炼整理', config: { system_prompt: '你是一个知识管理专家。从用户的便签中提炼核心观点，按主题分类整理。输出Markdown格式：主题分类、每个分类下的核心观点、相关便签引用、行动建议。', prompt: '请整理以下便签内容，提炼核心观点并分类：\n\n{{nodeOutput.n2.items}}' } },
        { id: 'n4', type: 'tool', name: '保存整理结果', config: { tool_name: 'create_memo', tool_args: { title: '灵感整理 {{date}}', content: '{{nodeOutput.n3.response}}', tags: '整理,灵感' } } },
        { id: 'n5', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n2', targetId: 'n3' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
    },
  },
  {
    id: 'web-research',
    name: '联网调研',
    description: '搜索多个关键词，汇总调研报告',
    icon: <Search size={20} />,
    category: '资讯',
    templateData: {
      name: '多关键词联网调研',
      description: '搜索多个关键词，汇总生成调研报告',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '搜索关键词1', config: { tool_name: 'search_web', tool_args: { query: '{{keyword1}}', limit: 5 } } },
        { id: 'n3', type: 'tool', name: '搜索关键词2', config: { tool_name: 'search_web', tool_args: { query: '{{keyword2}}', limit: 5 } } },
        { id: 'n4', type: 'llm', name: '汇总报告', config: { system_prompt: '你是一个调研分析师。根据联网搜索结果，生成结构化的调研报告，包含：调研背景、关键发现、数据对比、结论建议。', prompt: '根据以下搜索关键词的结果生成调研报告：\n\n关键词1（{{keyword1}}）：\n{{nodeOutput.n2.items}}\n\n关键词2（{{keyword2}}）：\n{{nodeOutput.n3.items}}' } },
        { id: 'n5', type: 'tool', name: '保存报告', config: { tool_name: 'create_memo', tool_args: { title: '调研报告 {{keyword1}}/{{keyword2}} {{date}}', content: '{{nodeOutput.n4.response}}', tags: '调研,报告' } } },
        { id: 'n6', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n1', targetId: 'n3' },
        { sourceId: 'n2', targetId: 'n4' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
        { sourceId: 'n5', targetId: 'n6' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN'), keyword1: '人工智能', keyword2: '大模型' },
    },
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onWorkflowCreated: (workflow: any) => void;
}

const SimpleWorkflowCreator: React.FC<Props> = ({ isOpen, onClose, onWorkflowCreated }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<SimpleWorkflowTemplate | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!selectedTemplate) return;
    
    setCreating(true);
    try {
      const newWorkflow = {
        ...selectedTemplate.templateData,
        id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: workflowName || selectedTemplate.templateData.name,
        description: workflowDescription || selectedTemplate.templateData.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPreset: false,
      };

      await ipcService.workflow.save(newWorkflow);
      onWorkflowCreated(newWorkflow);
      handleClose();
    } catch (err) {
      logger.error('Failed to create workflow:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setWorkflowName('');
    setWorkflowDescription('');
    onClose();
  };

  const categories = Array.from(new Set(SIMPLE_TEMPLATES.map(t => t.category)));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Sparkles size={20} className="text-amber-500" />
                  创建工作流
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 rounded-xl text-muted transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-muted mt-1">选择模板，快速创建自动化工作流</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!selectedTemplate ? (
                <div>
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-foreground mb-3">选择模板类型</h3>
                    <div className="flex gap-2 flex-wrap">
                      {categories.map(category => (
                        <button
                          key={category}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full hover:bg-gray-200 transition-all"
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SIMPLE_TEMPLATES.map(template => (
                      <motion.div
                        key={template.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedTemplate(template);
                          setWorkflowName(template.templateData.name);
                          setWorkflowDescription(template.templateData.description);
                        }}
                        className="p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-accent hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                            {template.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-foreground text-sm">{template.name}</h4>
                            <p className="text-xs text-muted mt-1">{template.description}</p>
                            <span className="inline-block mt-2 text-2xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {template.category}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="flex items-center gap-1 text-sm text-accent font-bold hover:underline"
                    >
                      <ArrowRight size={14} className="rotate-180" />
                      返回模板选择
                    </button>
                  </div>

                  <div className="flex items-start gap-4 mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      {selectedTemplate.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">{selectedTemplate.name}</h3>
                      <p className="text-sm text-muted mt-1">{selectedTemplate.description}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">工作流名称</label>
                      <input
                        type="text"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                        placeholder="输入工作流名称"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">工作流描述</label>
                      <textarea
                        value={workflowDescription}
                        onChange={(e) => setWorkflowDescription(e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                        placeholder="输入工作流描述（可选）"
                      />
                    </div>

                    <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                      <h4 className="text-xs font-bold text-foreground mb-2">工作流步骤预览</h4>
                      <div className="space-y-2">
                        {selectedTemplate.templateData.nodes.map((node, idx) => (
                          <div key={node.id} className="flex items-center gap-2">
                            <span className="text-xs text-muted w-4">{idx + 1}.</span>
                            <span className="text-xs text-foreground">
                              {node.name}
                              {node.type === 'tool' && ` (${node.config?.tool_name || '工具'})`}
                              {node.type === 'llm' && ' (AI处理)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-bold text-muted hover:text-foreground transition-all"
              >
                取消
              </button>
              {selectedTemplate && (
                <button
                  onClick={handleCreate}
                  disabled={creating || !workflowName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      创建工作流
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SimpleWorkflowCreator;