import React, { useEffect, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';

interface MessageSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  currentMatch: number;       // 1-based；0 表示无匹配
  totalMatches: number;       // 0 表示无匹配
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/**
 * P3 任务 2：消息搜索高亮 - 工具栏
 *
 * 设计：
 *  - 受控 query / currentMatch / totalMatches
 *  - 键盘：Enter 下一个，Shift+Enter 上一个，Esc 关闭
 *  - 不破坏现有 ChatPanel 既有快捷键
 */
const MessageSearchBar: React.FC<MessageSearchBarProps> = ({
  query, onQueryChange, currentMatch, totalMatches, onPrev, onNext, onClose
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/70 border border-teal-900/5 shadow-glass">
      <Search size={14} className="text-muted shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={t('chat.search.placeholder')}
        className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted/60"
      />
      {query.trim() && (
        <span className="text-2xs font-mono text-muted shrink-0">
          {totalMatches > 0
            ? t('chat.search.matchOf', { current: currentMatch, total: totalMatches })
            : t('chat.search.noMatch')}
        </span>
      )}
      <button
        onClick={onPrev}
        disabled={totalMatches === 0}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        title={t('chat.search.prev')}
        aria-label={t('chat.search.prev')}
      >
        <ChevronUp size={14} />
      </button>
      <button
        onClick={onNext}
        disabled={totalMatches === 0}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        title={t('chat.search.next')}
        aria-label={t('chat.search.next')}
      >
        <ChevronDown size={14} />
      </button>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-all"
        title={t('chat.search.clear')}
        aria-label={t('chat.search.clear')}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default MessageSearchBar;
