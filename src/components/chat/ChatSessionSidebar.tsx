import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Plus, Edit2, Trash2, Search, Pin } from 'lucide-react';

interface ChatSessionSidebarProps {
  isOpen: boolean;
  chatSessions: any[];
  activeSessionId: string | null;
  sessionFilter: string;
  onSessionFilterChange: (val: string) => void;
  pinnedSessions?: string[];
  onTogglePin?: (sessionId: string) => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
  onRenameSession: (e: React.MouseEvent, sessionId: string, title: string) => void;
}

const ChatSessionSidebar: React.FC<ChatSessionSidebarProps> = ({
  isOpen, chatSessions, activeSessionId, sessionFilter, onSessionFilterChange,
  pinnedSessions, onTogglePin, onNewChat, onSelectSession, onDeleteSession, onRenameSession
}) => {
  const filteredSessions = chatSessions.filter((s: any) =>
    !sessionFilter || (s.title || '新对话').toLowerCase().includes(sessionFilter.toLowerCase())
  );

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 256, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 bg-white/30 border-r border-teal-900/5 flex flex-col overflow-hidden"
        >
          <div className="p-4 border-b border-teal-900/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted uppercase tracking-widest">对话</h3>
            <button onClick={onNewChat} className="p-1.5 hover:bg-accent/10 rounded-lg text-accent transition-all" title="新建对话">
              <Plus size={14} />
            </button>
          </div>
          <div className="px-3 py-2 border-b border-teal-900/5">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="搜索..."
                className="w-full bg-white/60 border border-teal-900/5 rounded-lg pl-7 pr-2 py-1 text-2xs focus:outline-none focus:ring-1 focus:ring-accent/20"
                value={sessionFilter}
                onChange={(e) => onSessionFilterChange(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-2xs text-muted">暂无对话</p>
              </div>
            ) : (
              filteredSessions.map((session: any) => (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group relative p-2.5 rounded-xl cursor-pointer transition-all ${
                    activeSessionId === session.id
                      ? 'bg-accent/10 border border-accent/20'
                      : 'hover:bg-white/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={12} className={activeSessionId === session.id ? 'text-accent' : 'text-muted'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${activeSessionId === session.id ? 'text-accent' : 'text-foreground'}`}>
                        {session.title || '新对话'}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {session.updated_at ? new Date(session.updated_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onTogglePin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onTogglePin(session.id); }}
                          className={`p-1 rounded transition-all ${pinnedSessions?.includes(session.id) ? 'text-accent hover:bg-accent/10' : 'text-muted hover:text-accent hover:bg-accent/5'}`}
                          title={pinnedSessions?.includes(session.id) ? '取消置顶' : '置顶'}
                        >
                          <Pin size={10} fill={pinnedSessions?.includes(session.id) ? 'currentColor' : 'none'} />
                        </button>
                      )}
                      <button
                        onClick={(e) => onRenameSession(e, session.id, session.title || '新对话')}
                        className="p-1 hover:bg-accent/10 rounded text-muted hover:text-accent transition-all"
                        title="重命名"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        onClick={(e) => onDeleteSession(e, session.id)}
                        className="p-1 hover:bg-red-50 rounded text-muted hover:text-red-500 transition-all"
                        title="删除"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatSessionSidebar;
