import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, StickyNote, ChevronRight } from 'lucide-react';
import { ipcService } from '../services/ipc';
import { logger } from '../utils/logger';

interface BacklinkPanelProps {
  memoId: string;
  onNavigateToMemo: (memo: any) => void;
}

const BacklinkPanel: React.FC<BacklinkPanelProps> = ({ memoId, onNavigateToMemo }) => {
  const [backlinks, setBacklinks] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadBacklinks = async () => {
      if (!memoId) return;
      setLoading(true);
      try {
        const results = await ipcService.memos.getBacklinks(memoId);
        setBacklinks(results || []);
      } catch (err) {
        logger.error('Failed to load backlinks:', err);
        setBacklinks([]);
      } finally {
        setLoading(false);
      }
    };
    loadBacklinks();
  }, [memoId]);

  if (!loading && backlinks.length === 0) return null;

  return (
    <div className="border-t border-teal-900/5 bg-white/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-3 hover:bg-accent/5 transition-all"
      >
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-accent" />
          <span className="text-2xs font-bold text-accent uppercase tracking-widest">
            反向链接
          </span>
          <span className="text-2xs font-bold text-muted">
            ({backlinks.length})
          </span>
        </div>
        <ChevronRight
          size={14}
          className={`text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {loading ? (
              <div className="px-6 py-4 text-center">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="px-6 pb-4 space-y-2">
                {backlinks.map((memo) => (
                  <button
                    key={memo.id}
                    onClick={() => onNavigateToMemo(memo)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/60 border border-teal-900/5 hover:border-accent/30 hover:bg-accent/5 transition-all text-left group/bl"
                  >
                    <StickyNote size={14} className="text-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground group-hover/bl:text-accent transition-colors truncate">
                        {memo.title || '无标题'}
                      </p>
                      <p className="text-2xs text-muted truncate mt-0.5">
                        {(memo.content || '').slice(0, 80)}...
                      </p>
                    </div>
                    <ChevronRight size={12} className="text-muted opacity-0 group-hover/bl:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BacklinkPanel;