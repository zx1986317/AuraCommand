/**
 * P1：聊天费用预估徽章
 * - 展示当前对话的预估 token 数 + USD/CNY 费用
 * - 点击展开明细浮层（输入/输出拆分、价格模型、备注）
 * - 仅对云端模型启用；本地模型不渲染
 */
import React, { useState, useRef, useEffect } from 'react';
import { Coins, ChevronDown, Info } from 'lucide-react';
import type { CostBreakdownFE } from '../../hooks/useChatCostEstimate';

interface CostEstimateBadgeProps {
  breakdown: CostBreakdownFE | null;
  loading: boolean;
  enabled: boolean;
}

export const CostEstimateBadge: React.FC<CostEstimateBadgeProps> = ({ breakdown, loading, enabled }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!enabled) return null;

  // 三种状态：loading / 未知价格 / 已知价格
  const showLoading = loading && !breakdown;
  const unknown = breakdown && !breakdown.priceKnown;

  const badgeText = showLoading
    ? '估算中...'
    : !breakdown
      ? '—'
      : unknown
        ? '价格未知'
        : breakdown.totalUSDFmt;

  const titleText = !breakdown
    ? '暂无估算'
    : unknown
      ? '该模型价格未知'
      : `预估 $${breakdown.totalUSD.toFixed(4)} · ¥${breakdown.cny.toFixed(4)}`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-2xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
          unknown
            ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'border-accent/15 bg-accent/5 text-accent hover:bg-accent/10'
        }`}
        title={titleText}
      >
        <Coins size={10} />
        <span>{badgeText}</span>
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-teal-900/10 rounded-xl shadow-xl z-50 p-3 text-xs">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={12} className="text-accent" />
            <span className="font-bold text-primary">本次对话费用预估</span>
            <span className="ml-auto text-2xs text-muted">仅供参考</span>
          </div>

          {!breakdown ? (
            <div className="py-3 text-2xs text-muted text-center">正在估算...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-accent/5 rounded-lg p-2">
                  <div className="text-2xs text-muted mb-0.5">输入</div>
                  <div className="text-xs font-bold text-primary">{breakdown.inputTokens.toLocaleString()} tok</div>
                  <div className="text-2xs text-muted">{breakdown.inputUSDFmt}</div>
                </div>
                <div className="bg-accent/5 rounded-lg p-2">
                  <div className="text-2xs text-muted mb-0.5">输出（预估）</div>
                  <div className="text-xs font-bold text-primary">{breakdown.outputTokens.toLocaleString()} tok</div>
                  <div className="text-2xs text-muted">{breakdown.outputUSDFmt}</div>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 border-t border-slate-100">
                <span className="text-2xs text-muted">合计</span>
                <div className="text-right">
                  <div className="text-xs font-bold text-accent">
                    {breakdown.priceKnown ? breakdown.totalUSDFmt : '—'}
                  </div>
                  <div className="text-2xs text-muted">
                    {breakdown.priceKnown ? `¥${breakdown.cny.toFixed(4)}` : '价格未知'}
                  </div>
                </div>
              </div>

              {breakdown.priceLabel && (
                <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-100 text-2xs text-muted">
                  <Info size={10} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-primary/80">{breakdown.priceLabel}</div>
                    {breakdown.priceNote && <div className="mt-0.5">{breakdown.priceNote}</div>}
                  </div>
                </div>
              )}

              {unknown && (
                <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-2xs text-amber-700">
                  未在价格表中找到该模型，费用按 0 计算，实际账单以服务提供商为准。
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CostEstimateBadge;
