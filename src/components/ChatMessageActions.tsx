import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Edit2, Quote, RotateCcw, MoreHorizontal } from 'lucide-react';

interface ChatMessageActionsProps {
  role: 'user' | 'assistant';
  onCopy: () => void;
  onEdit?: () => void;
  onQuote?: () => void;
  onRegenerate?: () => void;
  isCopied?: boolean;
}

const ChatMessageActions: React.FC<ChatMessageActionsProps> = ({
  role,
  onCopy,
  onEdit,
  onQuote,
  onRegenerate,
  isCopied,
}) => {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex items-center gap-0.5">
      {/* Copy - always visible */}
      <button
        onClick={onCopy}
        className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/5 transition-all"
        title="复制"
      >
        {isCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      </button>

      {/* Quote reply - always visible */}
      {onQuote && (
        <button
          onClick={onQuote}
          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/5 transition-all"
          title="引用回复"
        >
          <Quote size={13} />
        </button>
      )}

      {/* User message: Edit */}
      {role === 'user' && onEdit && (
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/5 transition-all"
          title="编辑并重发"
        >
          <Edit2 size={13} />
        </button>
      )}

      {/* Assistant message: Regenerate */}
      {role === 'assistant' && onRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/5 transition-all"
          title="重新生成"
        >
          <RotateCcw size={13} />
        </button>
      )}
    </div>
  );
};

export default ChatMessageActions;