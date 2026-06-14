import React, { useEffect, useRef, useState } from 'react';
import { Plus, Smile } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * P3 任务 3：表情反应（Emoji Reactions）
 *
 * 数据形态：
 *  - 按 messageId 存储一组反应，结构 { [messageId]: { [emoji]: { count: number; mine: boolean } } }
 *  - 持久化到 localStorage 键 `chat_reactions_v1`，刷新不丢失
 *  - mine 由当前用户视角决定（这里统一标记点击者为同一用户）
 *
 * 设计取舍：
 *  - 仅用 React 状态同步（不引入 Zustand 子切片），避免污染 store schema
 *  - 提供内置 6 个常用 emoji 选择器，可扩展
 *  - 减少动效：使用 prefers-reduced-motion 自适应（CSS 接管）
 */

export const REACTION_EMOJIS: { emoji: string; labelKey: string }[] = [
  { emoji: '👍', labelKey: 'chat.reaction.common.like' },
  { emoji: '❤️', labelKey: 'chat.reaction.common.love' },
  { emoji: '😂', labelKey: 'chat.reaction.common.laugh' },
  { emoji: '🤔', labelKey: 'chat.reaction.common.think' },
  { emoji: '😕', labelKey: 'chat.reaction.common.confused' },
  { emoji: '🙏', labelKey: 'chat.reaction.common.thanks' },
];

export interface ReactionEntry {
  count: number;
  mine: boolean;
}

export type ReactionMap = Record<string, Record<string, ReactionEntry>>;
export type AllReactions = Record<string, Record<string, ReactionEntry>>;

const STORAGE_KEY = 'chat_reactions_v1';

function loadAll(): AllReactions {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as AllReactions;
    return {};
  } catch {
    return {};
  }
}

function saveAll(data: AllReactions) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function useMessageReactions(messageId: string): {
  reactions: Record<string, ReactionEntry>;
  toggle: (emoji: string) => void;
} {
  const [all, setAll] = useState<AllReactions>(() => loadAll());
  const reactions = all[messageId] || {};

  const toggle = (emoji: string) => {
    setAll(prev => {
      const current = prev[messageId] || {};
      const existing = current[emoji];
      const next: Record<string, ReactionEntry> = { ...current };
      if (existing) {
        if (existing.mine) {
          // 取消自己的反应
          if (existing.count <= 1) {
            delete next[emoji];
          } else {
            next[emoji] = { count: existing.count - 1, mine: false };
          }
        } else {
          // 加入并标记为自己的
          next[emoji] = { count: existing.count + 1, mine: true };
        }
      } else {
        next[emoji] = { count: 1, mine: true };
      }
      const merged: AllReactions = { ...prev, [messageId]: next };
      if (Object.keys(next).length === 0) {
        delete merged[messageId];
      }
      saveAll(merged);
      return merged;
    });
  };

  return { reactions, toggle };
}

interface MessageReactionsProps {
  messageId: string;
  /** 自定义外观：默认显示在消息下方居左 */
  align?: 'left' | 'right';
}

const MessageReactions: React.FC<MessageReactionsProps> = ({ messageId, align = 'left' }) => {
  const { t } = useTranslation();
  const { reactions, toggle } = useMessageReactions(messageId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const entries = Object.entries(reactions);

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 mt-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
      aria-label={t('chat.reaction.ariaLabel')}
    >
      {entries.map(([emoji, entry]) => (
        <button
          key={emoji}
          className={`chat-reaction ${entry.mine ? 'is-mine' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggle(emoji);
          }}
          title={REACTION_EMOJIS.find(r => r.emoji === emoji)?.labelKey
            ? t(REACTION_EMOJIS.find(r => r.emoji === emoji)!.labelKey)
            : emoji}
        >
          <span>{emoji}</span>
          <span className="text-2xs font-mono text-muted">{entry.count}</span>
        </button>
      ))}

      <div className="relative" ref={pickerRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(o => !o);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition-all border border-dashed border-teal-900/15"
          title={t('chat.reaction.add')}
        >
          <Smile size={12} />
        </button>
        {pickerOpen && (
          <div
            className={`absolute z-30 ${align === 'right' ? 'right-0' : 'left-0'} bottom-full mb-1.5 flex items-center gap-1 p-1.5 rounded-2xl bg-white shadow-glass border border-teal-900/5`}
          >
            {REACTION_EMOJIS.map(r => (
              <button
                key={r.emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(r.emoji);
                  setPickerOpen(false);
                }}
                className="w-8 h-8 rounded-xl hover:bg-accent/10 text-base flex items-center justify-center transition-all"
                title={t(r.labelKey)}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageReactions;
