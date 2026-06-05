import React from 'react';
import { Users, PlusCircle, Settings, Edit2, Trash2 } from 'lucide-react';
import type { AiRole } from '../../constants';

interface ChatRoleBarProps {
  allRoles: AiRole[];
  customRoles: AiRole[];
  selectedRole: string;
  isRoleOpen: boolean;
  isRoleEditorOpen: boolean;
  onSelectRole: (roleId: string) => void;
  onToggleRoleManager: (open: boolean) => void;
  onOpenRoleEditor: () => void;
  onEditRole: (role: AiRole) => void;
  onDeleteRole: (roleId: string) => void;
}

const ChatRoleBar: React.FC<ChatRoleBarProps> = ({
  allRoles, customRoles, selectedRole, isRoleOpen, isRoleEditorOpen,
  onSelectRole, onToggleRoleManager, onOpenRoleEditor, onEditRole, onDeleteRole
}) => {
  return (
    <div className="flex-shrink-0 px-6 py-2 bg-white/20 border-t border-teal-900/5 flex items-center gap-2 overflow-x-auto">
      <Users size={12} className="text-muted flex-shrink-0" />
      {allRoles.map((role) => {
        const IconComponent = role.icon;
        const isActive = selectedRole === role.id;
        return (
          <button
            key={role.id}
            onClick={() => onSelectRole(role.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              isActive
                ? 'bg-accent text-white shadow-sm'
                : 'bg-white/60 text-muted hover:text-accent hover:bg-accent/5 border border-teal-900/5'
            }`}
            title={role.prompt ? `${role.name}: ${role.prompt.slice(0, 80)}...` : role.name}
          >
            <IconComponent size={11} />
            <span>{role.name}</span>
          </button>
        );
      })}
      <button
        onClick={onOpenRoleEditor}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold text-muted hover:text-accent hover:bg-accent/5 border border-dashed border-teal-900/15 whitespace-nowrap transition-all flex-shrink-0"
        title="创建自定义角色"
      >
        <PlusCircle size={11} />
        <span>自定义</span>
      </button>
      {customRoles.length > 0 && (
        <button
          onClick={() => onToggleRoleManager(!isRoleOpen)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs text-muted hover:text-accent hover:bg-accent/5 transition-all flex-shrink-0"
          title="管理角色"
        >
          <Settings size={10} />
        </button>
      )}
      {isRoleOpen && customRoles.length > 0 && (
        <div className="absolute bottom-full left-6 mb-2 bg-white border border-teal-900/5 rounded-xl shadow-xl z-50 p-1.5 min-w-[160px]">
          <div className="px-2.5 mb-1.5 text-2xs font-bold text-muted uppercase tracking-wider">自定义角色</div>
          {customRoles.map((role) => {
            const IconComponent = role.icon;
            return (
              <div key={role.id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent/5 rounded-lg group">
                <IconComponent size={12} className="text-accent" />
                <span className="text-xs flex-1">{role.name}</span>
                <button
                  onClick={() => { onEditRole(role); onToggleRoleManager(false); }}
                  className="p-0.5 text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                  title="编辑"
                >
                  <Edit2 size={10} />
                </button>
                <button
                  onClick={() => { onDeleteRole(role.id); }}
                  className="p-0.5 text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChatRoleBar;
