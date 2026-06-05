import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, ChevronRight, Sparkles, Loader2,
  Users, CalendarRange, CalendarCheck, Goal, FileText, Bug,
  RefreshCw, Target, AlertTriangle, MessageCircle, GitBranch,
  BookOpen, GraduationCap, Video, Lightbulb, Heart,
  ListChecks, MapPin, FilePlus, Clock, Star,
  Pencil, Code2, Boxes, Wrench, Server, CheckSquare,
  BarChart2, Swords, TrendingUp, Flag, Rocket, Map,
  MousePointerClick, ChefHat, ShoppingCart,
} from 'lucide-react';
import {
  MEMO_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplatesByType,
  resolveTemplate,
  buildTemplateRecommendationPrompt,
  type MemoTemplate,
} from '../data/memoTemplates';

// Lucide 图标映射
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'users': Users,
  'calendar-range': CalendarRange,
  'calendar-check': CalendarCheck,
  'goal': Goal,
  'file-text': FileText,
  'bug': Bug,
  'refresh-cw': RefreshCw,
  'target': Target,
  'alert-triangle': AlertTriangle,
  'message-circle': MessageCircle,
  'git-branch': GitBranch,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  'video': Video,
  'lightbulb': Lightbulb,
  'book-heart': Heart,
  'list-checks': ListChecks,
  'map-pin': MapPin,
  'file-plus': FilePlus,
  'clock': Clock,
  'pencil': Pencil,
  'code': Code2,
  'boxes': Boxes,
  'wrench': Wrench,
  'server': Server,
  'check-square': CheckSquare,
  'bar-chart-2': BarChart2,
  'swords': Swords,
  'trending-up': TrendingUp,
  'flag': Flag,
  'rocket': Rocket,
  'map': Map,
  'mouse-pointer-click': MousePointerClick,
  'chef-hat': ChefHat,
  'shopping-cart': ShoppingCart,
};

function getIconComponent(iconName: string): React.ComponentType<any> {
  return ICON_MAP[iconName] || FileText;
}

interface Props {
  isOpen: boolean;
  /** 'note' | 'document' — 筛选对应类型的模板 */
  contextType: 'note' | 'document';
  /** 选择模板后的回调，传入已解析好占位符的模板 */
  onSelect: (template: MemoTemplate) => void;
  onClose: () => void;
  /** 可选：AI 推荐上下文（用户的最近便签/文档标题列表） */
  recentTitles?: string[];
  /** 可选：用于 AI 推荐的 Ollama 生成函数 */
  aiGenerate: ((prompt: string) => Promise<string>) | undefined;
}

const TemplateSelector: React.FC<Props> = ({
  isOpen,
  contextType,
  onSelect,
  onClose,
  recentTitles = [],
  aiGenerate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 按类型过滤
  const typeFilteredTemplates = useMemo(
    () => getTemplatesByType(contextType),
    [contextType]
  );

  // 类别列表（仅显示当前类型有模板的类别）
  const availableCategories = useMemo(
    () => Array.from(new Set(typeFilteredTemplates.map(t => t.category))),
    [typeFilteredTemplates]
  );

  // 最终筛选结果
  const filteredTemplates = useMemo(() => {
    return typeFilteredTemplates.filter(t => {
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [typeFilteredTemplates, selectedCategory, searchQuery]);

  // AI 推荐的模板对象列表（按推荐顺序排列）
  const aiRecommendedTemplates = useMemo(() => {
    return aiRecommendedIds
      .map(id => MEMO_TEMPLATES.find(t => t.id === id))
      .filter((t): t is MemoTemplate => t !== undefined)
      .filter(t => t.type === contextType);
  }, [aiRecommendedIds, contextType]);

  // AI 推荐之外的常规模板（去重）
  const nonRecommendedTemplates = useMemo(() => {
    const recommendedSet = new Set(aiRecommendedIds);
    return filteredTemplates.filter(t => !recommendedSet.has(t.id));
  }, [filteredTemplates, aiRecommendedIds]);

  // 触发 AI 推荐
  const triggerAiRecommendation = useCallback(async () => {
    if (!aiGenerate || recentTitles.length === 0) return;
    setIsAiLoading(true);
    try {
      const now = new Date();
      const timeLabel = `${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
      const prompt = buildTemplateRecommendationPrompt(
        contextType === 'note' ? recentTitles : [],
        contextType === 'document' ? recentTitles : [],
        timeLabel
      );
      const result = await aiGenerate(prompt);
      try {
        // 尝试从 AI 回复中提取 JSON 数组
        const jsonMatch = result.match(/\[.*?\]/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            setAiRecommendedIds(parsed);
          }
        }
      } catch {
        // 解析失败，不设置推荐
      }
    } catch {
      // AI 调用失败，静默处理
    } finally {
      setIsAiLoading(false);
    }
  }, [aiGenerate, recentTitles, contextType]);

  // 打开时自动触发 AI 推荐
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory(null);
      setAiRecommendedIds([]);
      if (aiGenerate && recentTitles.length > 0) {
        triggerAiRecommendation();
      }
    }
  }, [isOpen, aiGenerate, recentTitles.length, triggerAiRecommendation]);

  const handleSelect = (template: MemoTemplate) => {
    onSelect({
      ...template,
      title: resolveTemplate(template.title),
      content: resolveTemplate(template.content),
    });
  };

  // 渲染单个模板卡片
  const isDocument = contextType === 'document';

  const renderTemplateCard = (
    template: MemoTemplate,
    isRecommended: boolean = false
  ) => {
    const IconComp = getIconComponent(template.icon);
    return (
      <motion.button
        key={template.id}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => handleSelect(template)}
        className={`group relative p-4 rounded-xl text-left border transition-all w-full ${
          isRecommended
            ? 'border-amber-200 bg-amber-50/60 hover:border-amber-400 hover:shadow-md hover:shadow-amber-200/30'
            : isDocument
              ? 'border-slate-200 bg-white hover:border-blue-400/50 hover:shadow-md hover:shadow-blue-100/40'
              : 'border-gray-200 bg-white hover:border-accent/40 hover:shadow-md'
        }`}
      >
        {isRecommended && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
            <Sparkles size={10} />
            <span>推荐</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isRecommended
                ? 'bg-amber-100 text-amber-600'
                : isDocument
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-accent/10 text-accent'
            }`}
          >
            <IconComp size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3
                className={`font-bold text-sm truncate ${
                  isRecommended ? 'text-amber-900' : 'text-foreground'
                }`}
              >
                {template.name}
              </h3>
              <ChevronRight
                size={14}
                className="shrink-0 text-gray-300 group-hover:text-accent transition-colors"
              />
            </div>
            <p className="text-xs text-muted mt-1 text-left">
              {template.description}
            </p>
            {template.tags && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {template.tags.split(',').slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className={`text-2xs px-1.5 py-0.5 rounded ${
                      isRecommended
                        ? 'bg-amber-100/70 text-amber-700'
                        : isDocument
                          ? 'bg-blue-50 text-blue-500'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {template.content && isDocument && (() => {
          const plainText = template.content.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
          const lines = plainText.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 4);
          return lines.length > 0 ? (
            <div className="mt-3 p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
              <p className="text-2xs text-slate-400 font-mono leading-relaxed line-clamp-3 text-left">
                {lines.join(' · ')}
              </p>
            </div>
          ) : null;
        })()}
      </motion.button>
    );
  };

  const categoriesWithTemplates = useMemo(() => {
    const groups: Record<string, MemoTemplate[]> = {};
    for (const t of filteredTemplates) {
      (groups[t.category] ??= []).push(t);
    }
    return groups;
  }, [filteredTemplates]);

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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`bg-white rounded-2xl shadow-2xl ${
              isDocument ? 'max-w-3xl' : 'max-w-2xl'
            } w-full max-h-[85vh] overflow-hidden flex flex-col`}
          >
            {/* 头部 */}
            <div className={`p-6 pb-4 border-b ${isDocument ? 'border-blue-100 bg-gradient-to-b from-blue-50/50 to-white' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-xl font-bold ${isDocument ? 'text-slate-800' : 'text-foreground'}`}>
                    {isDocument ? '📄 选择文档模板' : '📝 选择便签模板'}
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    {isDocument
                      ? '专业模板，结构化撰写，占位符自动替换'
                      : '快速选择一个模板开始记录'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-xl text-muted transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 搜索 */}
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`搜索${isDocument ? '文档' : '便签'}模板...`}
                  className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${
                    isDocument
                      ? 'bg-white border-blue-200 focus:ring-blue-200 focus:border-blue-300'
                      : 'bg-gray-50 border-gray-200 focus:ring-accent/20 focus:border-accent/30'
                  }`}
                  autoFocus
                />
              </div>

              {/* 类别筛选 */}
              <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    !selectedCategory
                      ? isDocument
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-accent text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  全部
                </button>
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() =>
                      setSelectedCategory(selectedCategory === cat ? null : cat)
                    }
                    className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      selectedCategory === cat
                        ? isDocument
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-accent text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 模板列表 */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {isAiLoading && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                  <Loader2 size={14} className="animate-spin text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">
                    AI 正在根据你的使用情况推荐模板...
                  </span>
                </div>
              )}

              {aiRecommendedTemplates.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-2xs font-bold uppercase tracking-wider">
                      <Sparkles size={12} />
                      <span>AI 智能推荐</span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-amber-200 to-transparent" />
                  </div>
                  <div className={`grid gap-3 ${isDocument ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {aiRecommendedTemplates.map(t => renderTemplateCard(t, true))}
                  </div>
                </div>
              )}

              {isDocument && !searchQuery && !selectedCategory ? (
                Object.entries(categoriesWithTemplates).map(([cat, templates]) => (
                  <div key={cat} className="mb-6 last:mb-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat}</span>
                      <div className="h-px flex-1 bg-slate-100" />
                      <span className="text-2xs text-slate-400">{templates.length} 个</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {templates.map(t => renderTemplateCard(t, false))}
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {aiRecommendedTemplates.length > 0 && nonRecommendedTemplates.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={14} className="text-muted" />
                      <span className="text-xs font-medium text-muted">其他模板</span>
                      <div className="h-px flex-1 bg-gray-100" />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {nonRecommendedTemplates.map(t => renderTemplateCard(t, false))}
                  </div>
                </>
              )}

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-muted">没有匹配的模板</p>
                  <p className="text-xs text-muted/60 mt-1">
                    试试其他关键词或清除筛选条件
                  </p>
                </div>
              )}
            </div>

            {/* 底部提示 */}
            <div className={`px-6 py-3 border-t bg-gray-50/50 flex items-center justify-between ${isDocument ? 'border-blue-100' : 'border-gray-100'}`}>
              <p className="text-2xs text-muted">
                支持 <code className={`px-1 rounded ${isDocument ? 'text-blue-600 bg-blue-50' : 'text-accent bg-accent/5'}`}>{'{{日期}}'}</code>、{' '}
                <code className={`px-1 rounded ${isDocument ? 'text-blue-600 bg-blue-50' : 'text-accent bg-accent/5'}`}>{'{{时间}}'}</code> 等占位符自动替换
              </p>
              <span className="text-2xs text-muted">
                {typeFilteredTemplates.length} 个模板
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TemplateSelector;
