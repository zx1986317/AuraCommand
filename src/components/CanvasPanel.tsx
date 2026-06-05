import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, GripVertical, ZoomIn, ZoomOut, Maximize2, Trash2, StickyNote, CalendarDays, Lightbulb, Move, ArrowRight } from 'lucide-react';

interface CanvasCard {
  id: string;
  type: 'note' | 'schedule' | 'idea';
  title: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface CanvasPanelProps {
  memos?: any[];
  schedules?: any[];
  onSaveMemo?: (memo: any) => void;
  onSaveSchedule?: (schedule: any) => void;
  onEditMemo?: (memo: any) => void;
}

const CARD_COLORS = [
  'bg-amber-50 border-amber-200',
  'bg-blue-50 border-blue-200',
  'bg-green-50 border-green-200',
  'bg-pink-50 border-pink-200',
  'bg-purple-50 border-purple-200',
  'bg-orange-50 border-orange-200',
];

const getCardIcon = (type: CanvasCard['type']) => {
  switch (type) {
    case 'note': return StickyNote;
    case 'schedule': return CalendarDays;
    case 'idea': return Lightbulb;
  }
};

const getCardAccent = (type: CanvasCard['type']) => {
  switch (type) {
    case 'note': return 'text-amber-600';
    case 'schedule': return 'text-blue-600';
    case 'idea': return 'text-purple-600';
  }
};

const CanvasPanel: React.FC<CanvasPanelProps> = ({ memos = [], schedules = [], onSaveMemo, onSaveSchedule, onEditMemo }) => {
  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initial: CanvasCard[] = [];
    memos.slice(0, 3).forEach((memo, i) => {
      initial.push({
        id: `memo-${memo.id}`,
        type: 'note',
        title: memo.title,
        content: memo.content?.substring(0, 200) || '',
        x: 50 + (i % 3) * 300,
        y: 80 + Math.floor(i / 3) * 250,
        width: 260,
        height: 180,
        color: CARD_COLORS[i % CARD_COLORS.length]!
      });
    });
    schedules.slice(0, 2).forEach((schedule, i) => {
      initial.push({
        id: `schedule-${schedule.id}`,
        type: 'schedule',
        title: schedule.title,
        content: schedule.content || '',
        x: 50 + (memos.slice(0, 3).length + i) % 3 * 300,
        y: 80 + Math.floor((memos.slice(0, 3).length + i) / 3) * 250,
        width: 240,
        height: 140,
        color: CARD_COLORS[(memos.slice(0, 3).length + i) % CARD_COLORS.length]!
      });
    });
    setCards(initial);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
      e.preventDefault();
    } else if (e.button === 0 && !draggingCard) {
      setSelectedCard(null);
      setShowAddMenu(false);
    }
  }, [canvasOffset, draggingCard]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setCanvasOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggingCard) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      const x = (e.clientX - canvasRect.left - canvasOffset.x - dragOffset.x) / scale;
      const y = (e.clientY - canvasRect.top - canvasOffset.y - dragOffset.y) / scale;
      setCards(prev => prev.map(c =>
        c.id === draggingCard ? { ...c, x: Math.max(0, x), y: Math.max(0, y) } : c
      ));
    }
  }, [isPanning, panStart, draggingCard, dragOffset, scale, canvasOffset]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingCard(null);
  }, []);

  const handleCardMouseDown = useCallback((e: React.MouseEvent, cardId: string) => {
    e.stopPropagation();
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const cardScreenX = card.x * scale + canvasOffset.x + canvasRect.left;
    const cardScreenY = card.y * scale + canvasOffset.y + canvasRect.top;

    setDraggingCard(cardId);
    setDragOffset({
      x: e.clientX - cardScreenX,
      y: e.clientY - cardScreenY
    });
    setSelectedCard(cardId);
  }, [cards, canvasOffset, scale]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.min(3, Math.max(0.3, prev * delta)));
    } else {
      setCanvasOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  }, []);

  const addCard = (type: CanvasCard['type']) => {
    const id = `${type}-${Date.now()}`;
    const center = {
      x: (-canvasOffset.x + (canvasRef.current?.clientWidth || 800) / 2) / scale - 120,
      y: (-canvasOffset.y + (canvasRef.current?.clientHeight || 600) / 2) / scale - 80,
    };
    setCards(prev => [...prev, {
      id,
      type,
      title: type === 'note' ? '新便签' : type === 'schedule' ? '新日程' : '新想法',
      content: '',
      x: Math.max(20, center.x + (Math.random() - 0.5) * 100),
      y: Math.max(20, center.y + (Math.random() - 0.5) * 100),
      width: 260,
      height: 180,
      color: CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)]!
    }]);
    setShowAddMenu(false);
  };

  const updateCard = (id: string, updates: Partial<CanvasCard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    if (selectedCard === id) setSelectedCard(null);
  };

  const resetView = () => {
    setCanvasOffset({ x: 0, y: 0 });
    setScale(1);
  };

  return (
    <motion.div
      key="canvas"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="h-full w-full flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-4 left-6 z-20 flex items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Move size={20} />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">AI 画布</h2>
        </div>
        <div className="h-6 w-[1px] bg-teal-900/10" />
        <span className="text-xs text-muted">{cards.length} 张卡片</span>
      </div>

      <div className="absolute top-4 right-6 z-20 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent/90 transition-all shadow-premium active:scale-95"
          >
            <Plus size={16} />
            添加卡片
          </button>
          <AnimatePresence>
            {showAddMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-teal-900/10 shadow-xl p-2 min-w-[160px]"
              >
                {[
                  { type: 'note' as const, label: '便签卡片', icon: StickyNote },
                  { type: 'schedule' as const, label: '日程卡片', icon: CalendarDays },
                  { type: 'idea' as const, label: '想法卡片', icon: Lightbulb },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      onClick={() => addCard(item.type)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium hover:bg-accent/5 transition-all text-left"
                    >
                      <Icon size={14} className="text-accent" />
                      {item.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute bottom-4 right-6 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-xl rounded-2xl border border-teal-900/10 shadow-glass p-1.5">
        <button onClick={() => setScale(prev => Math.min(3, prev * 1.2))} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-accent/5 transition-all">
          <ZoomIn size={14} />
        </button>
        <span className="text-2xs font-mono text-muted px-2 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(prev => Math.max(0.3, prev * 0.8))} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-accent/5 transition-all">
          <ZoomOut size={14} />
        </button>
        <div className="w-[1px] h-4 bg-teal-900/10 mx-1" />
        <button onClick={resetView} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-accent/5 transition-all">
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="absolute bottom-4 left-6 z-20 text-2xs text-muted/50 font-mono">
        Alt+拖拽 平移 · 滚轮 平移 · Ctrl+滚轮 缩放
      </div>

      <div
        ref={canvasRef}
        className="flex-1 relative cursor-crosshair"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)`,
          backgroundSize: `${30 * scale}px ${30 * scale}px`,
          backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
          className="absolute inset-0"
        >
          {cards.map(card => {
            const Icon = getCardIcon(card.type);
            const accent = getCardAccent(card.type);
            const isSelected = selectedCard === card.id;

            return (
              <motion.div
                key={card.id}
                layout={false}
                className={`absolute ${card.color} rounded-2xl border-2 shadow-lg select-none transition-shadow ${
                  isSelected ? 'shadow-xl ring-2 ring-accent/30' : 'hover:shadow-xl'
                } ${draggingCard === card.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  left: card.x,
                  top: card.y,
                  width: card.width,
                  height: card.height,
                }}
                onMouseDown={(e) => handleCardMouseDown(e, card.id)}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-current/10">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Icon size={12} className={accent} />
                    <input
                      value={card.title}
                      onChange={(e) => updateCard(card.id, { title: e.target.value })}
                      className={`text-xs font-bold bg-transparent border-none outline-none flex-1 min-w-0 ${accent}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {card.type === 'note' && (card.id.startsWith('memo-') || card.content.trim()) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const memoId = card.id.replace('memo-', '');
                          const originalMemo = memos.find(m => m.id === memoId);
                          if (originalMemo) {
                            onSaveMemo?.({ ...originalMemo, title: card.title, content: card.content });
                          } else {
                            onSaveMemo?.({ id: memoId, title: card.title, content: card.content, project: '默认项目', category: '个人' });
                          }
                        }}
                        className="w-5 h-5 rounded-lg flex items-center justify-center text-current/20 hover:text-accent hover:bg-accent/10 transition-all"
                        title="同步到便签"
                      >
                        <ArrowRight size={10} />
                      </button>
                    )}
                    {card.type === 'note' && card.id.startsWith('memo-') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const memoId = card.id.replace('memo-', '');
                          const originalMemo = memos.find(m => m.id === memoId);
                          if (originalMemo) {
                            onEditMemo?.(originalMemo);
                          }
                        }}
                        className="w-5 h-5 rounded-lg flex items-center justify-center text-current/20 hover:text-blue-500 hover:bg-blue-500/10 transition-all"
                        title="在编辑器中打开"
                      >
                        <StickyNote size={10} />
                      </button>
                    )}
                    {card.type === 'schedule' && card.id.startsWith('schedule-') && card.content.trim() && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const scheduleId = card.id.replace('schedule-', '');
                          const originalSchedule = schedules.find(s => s.id === scheduleId);
                          if (originalSchedule) {
                            onSaveSchedule?.({ ...originalSchedule, title: card.title, description: card.content });
                          }
                        }}
                        className="w-5 h-5 rounded-lg flex items-center justify-center text-current/20 hover:text-accent hover:bg-accent/10 transition-all"
                        title="同步到日程"
                      >
                        <ArrowRight size={10} />
                      </button>
                    )}
                    <GripVertical size={10} className="text-current/20" />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }}
                      className="w-5 h-5 rounded-lg flex items-center justify-center text-current/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
                <textarea
                  value={card.content}
                  onChange={(e) => updateCard(card.id, { content: e.target.value })}
                  placeholder="输入内容..."
                  className="w-full h-[calc(100%-36px)] p-3 text-2xs leading-relaxed bg-transparent border-none outline-none resize-none text-current/70"
                  onClick={(e) => e.stopPropagation()}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default CanvasPanel;
