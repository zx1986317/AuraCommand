import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Copy, Trash2, Eye, Plus, ChevronRight } from 'lucide-react';
import { AiRole, aiRoles, customRoleTemplates } from '../constants';

interface RoleEditorModalProps {
  isOpen: boolean;
  editingRole: AiRole | null;
  allCustomRoles: AiRole[];
  onSave: (role: AiRole) => void;
  onDelete?: (roleId: string) => void;
  onClone?: (role: AiRole) => void;
  onClose: () => void;
  onNotification: (n: { message: string; type: 'info' | 'error' | 'warning' } | null) => void;
}

const RoleEditorModal: React.FC<RoleEditorModalProps> = ({
  isOpen,
  editingRole,
  allCustomRoles,
  onSave,
  onDelete,
  onClone,
  onClose,
  onNotification
}) => {
  const [view, setView] = useState<'editor' | 'templates' | 'preview'>('editor');
  const [role, setRole] = useState<AiRole | null>(null);

  React.useEffect(() => {
    if (isOpen && editingRole) {
      setRole({ ...editingRole });
      setView('editor');
    } else if (isOpen && !editingRole) {
      setView('templates');
      setRole(null);
    }
  }, [isOpen, editingRole]);

  const handleSelectTemplate = (template: AiRole) => {
    setRole({
      ...template,
      id: `custom-${Date.now()}`,
      name: template.name,
      builtin: false,
      isTemplate: false,
      clonedFrom: template.id,
    });
    setView('editor');
  };

  const handleCloneBuiltin = (builtinRole: AiRole) => {
    setRole({
      ...builtinRole,
      id: `custom-${Date.now()}`,
      name: `${builtinRole.name} (副本)`,
      builtin: false,
      isTemplate: false,
      clonedFrom: builtinRole.id,
    });
    setView('editor');
  };

  const handleSave = () => {
    if (!role) return;
    if (!role.name.trim()) {
      onNotification({ message: '请输入角色名称', type: 'error' });
      setTimeout(() => onNotification(null), 2000);
      return;
    }
    if (!role.prompt.trim()) {
      onNotification({ message: '请输入角色设定', type: 'error' });
      setTimeout(() => onNotification(null), 2000);
      return;
    }
    onSave(role);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col p-8 rounded-3xl border border-teal-900/10 bg-white/95 backdrop-blur-2xl shadow-[0_40px_80px_rgba(0,0,0,0.2)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <p className="text-2xs font-black uppercase tracking-[0.25em] text-accent mb-1">
                  {view === 'templates' ? '选择模板' : view === 'preview' ? '角色预览' : role?.id ? '编辑角色' : '新建角色'}
                </p>
                <h3 className="text-2xl font-display font-bold tracking-tight">
                  {view === 'templates' ? '从模板创建角色' : view === 'preview' ? '角色预览' : role?.id ? '编辑角色' : '新建角色'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {view === 'editor' && role && (
                  <button
                    onClick={() => setView('preview')}
                    className="w-8 h-8 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 transition-colors flex items-center justify-center"
                    title="预览角色"
                  >
                    <Eye size={16} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Templates View */}
            {view === 'templates' && (
              <div className="flex-1 overflow-y-auto min-h-0 space-y-6">
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">基于内置角色微调</p>
                  <div className="grid grid-cols-2 gap-3">
                    {aiRoles.filter(r => r.builtin).map((builtinRole) => {
                      const IconComponent = builtinRole.icon;
                      return (
                        <button
                          key={builtinRole.id}
                          onClick={() => handleCloneBuiltin(builtinRole)}
                          className="p-4 rounded-xl border-2 border-teal-900/5 bg-white/60 hover:border-accent/30 hover:bg-accent/5 text-left transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <IconComponent size={16} className="text-accent" />
                            <span className="text-xs font-bold">{builtinRole.name}</span>
                          </div>
                          <p className="text-2xs text-muted line-clamp-2">{builtinRole.domain} · {builtinRole.tone}</p>
                          <div className="flex items-center gap-1 mt-2 text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                            <Copy size={10} />
                            <span className="text-xs font-bold">克隆并微调</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">专业模板库</p>
                  <div className="grid grid-cols-2 gap-3">
                    {customRoleTemplates.map((template) => {
                      const IconComponent = template.icon;
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleSelectTemplate(template)}
                          className="p-4 rounded-xl border-2 border-teal-900/5 bg-white/60 hover:border-accent/30 hover:bg-accent/5 text-left transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <IconComponent size={16} className="text-accent" />
                            <span className="text-xs font-bold">{template.name}</span>
                          </div>
                          <p className="text-2xs text-muted line-clamp-2">{template.domain} · {template.tone}</p>
                          <p className="text-xs text-muted/60 mt-1 line-clamp-2">{template.outputFormat}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setRole({
                        id: `custom-${Date.now()}`,
                        name: '',
                        icon: Sparkles,
                        prompt: '',
                        builtin: false,
                        isTemplate: false,
                        domain: '',
                        tone: '',
                        focusAreas: '',
                        outputFormat: '',
                      });
                      setView('editor');
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-teal-900/20 text-muted hover:text-accent hover:border-accent/30 transition-all"
                  >
                    <Plus size={14} />
                    <span className="text-xs font-bold">从空白创建</span>
                  </button>
                </div>
              </div>
            )}

            {/* Editor View */}
            {view === 'editor' && role && (
              <div className="flex-1 overflow-y-auto min-h-0 space-y-5 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>
                <div>
                  <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">角色名称</label>
                  <input
                    type="text"
                    value={role.name}
                    onChange={(e) => setRole({ ...role, name: e.target.value })}
                    placeholder="例如：架构师、面试官、健身教练..."
                    className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">专业领域</label>
                    <input
                      type="text"
                      value={role.domain || ''}
                      onChange={(e) => setRole({ ...role, domain: e.target.value })}
                      placeholder="例如：技术架构"
                      className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">语气风格</label>
                    <input
                      type="text"
                      value={role.tone || ''}
                      onChange={(e) => setRole({ ...role, tone: e.target.value })}
                      placeholder="例如：严谨、建设性"
                      className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">关注维度 <span className="text-muted/50 normal-case tracking-normal">（逗号分隔）</span></label>
                  <input
                    type="text"
                    value={role.focusAreas || ''}
                    onChange={(e) => setRole({ ...role, focusAreas: e.target.value })}
                    placeholder="例如：系统设计,扩展性,容错性"
                    className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">输出格式</label>
                  <input
                    type="text"
                    value={role.outputFormat || ''}
                    onChange={(e) => setRole({ ...role, outputFormat: e.target.value })}
                    placeholder="例如：架构图 + 演进路线"
                    className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">角色设定 (System Prompt)</label>
                  <textarea
                    value={role.prompt}
                    onChange={(e) => setRole({ ...role, prompt: e.target.value })}
                    placeholder="详细描述这个角色的专业能力、回答规范和关注点...&#10;&#10;提示：好的角色设定应包含：&#10;1. 角色定位和专业能力&#10;2. 回答规范和格式要求&#10;3. 关注维度和优先级"
                    className="w-full min-h-[160px] px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all resize-none leading-relaxed"
                  />
                  <p className="text-2xs text-muted mt-1">{role.prompt.length} 字符</p>
                </div>

                <div>
                  <label className="block text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">示例问题 <span className="text-muted/50 normal-case tracking-normal">（用于角色预览）</span></label>
                  <input
                    type="text"
                    value={role.exampleQuestion || ''}
                    onChange={(e) => setRole({ ...role, exampleQuestion: e.target.value })}
                    placeholder="一个能体现该角色特色的典型问题"
                    className="w-full px-4 py-3 rounded-xl border border-teal-900/10 bg-white/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Preview View */}
            {view === 'preview' && role && (
              <div className="flex-1 overflow-y-auto min-h-0 space-y-5">
                <div className="p-6 rounded-2xl bg-accent/5 border border-accent/10">
                  <div className="flex items-center gap-3 mb-4">
                    {role.icon && <role.icon size={24} className="text-accent" />}
                    <div>
                      <h4 className="text-lg font-bold">{role.name || '未命名角色'}</h4>
                      <p className="text-xs text-muted">{role.domain || '通用'} · {role.tone || '默认风格'}</p>
                    </div>
                  </div>
                  {role.focusAreas && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {role.focusAreas.split(',').map((area, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-2xs font-bold">{area.trim()}</span>
                      ))}
                    </div>
                  )}
                  {role.outputFormat && (
                    <p className="text-xs text-muted mb-3">输出格式：{role.outputFormat}</p>
                  )}
                </div>
                <div className="p-5 rounded-2xl bg-teal-900/5 border border-teal-900/5">
                  <p className="text-2xs font-black uppercase tracking-[0.2em] text-muted mb-2">System Prompt</p>
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{role.prompt || '(空)'}</p>
                </div>
                {role.exampleQuestion && (
                  <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                    <p className="text-2xs font-black uppercase tracking-[0.2em] text-blue-600 mb-2">示例问题</p>
                    <p className="text-xs text-foreground/80">{role.exampleQuestion}</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 mt-6 shrink-0 pt-4 border-t border-teal-900/5">
              <div>
                {view === 'editor' && role && !role.builtin && onDelete && role.id.startsWith('custom-') && (
                  <button
                    onClick={() => {
                      onDelete(role.id);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 text-xs font-bold transition-colors"
                  >
                    <Trash2 size={14} />
                    删除角色
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {view === 'preview' && (
                  <button onClick={() => setView('editor')} className="px-5 py-2.5 rounded-xl border border-teal-900/10 text-sm font-bold hover:bg-teal-900/5 transition-colors cursor-pointer">
                    返回编辑
                  </button>
                )}
                {view === 'editor' && (
                  <>
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-teal-900/10 text-sm font-bold hover:bg-teal-900/5 transition-colors cursor-pointer">
                      取消
                    </button>
                    <button onClick={handleSave} className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors cursor-pointer">
                      保存角色
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RoleEditorModal;