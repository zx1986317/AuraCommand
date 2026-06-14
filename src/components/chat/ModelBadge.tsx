/**
 * P1 #7：AI 消息 model badge
 * - 每条 assistant 消息头部显示：模型别名 + 云端/本地/未知标记
 * - 视觉：☁️ 紫蓝/🖥️ 翠绿/❓ 灰；hover 显示完整模型名 + 完整路径
 * - 复用 useChatCostEstimate 同样的 modelKind 判定
 */
import React from 'react';
import { Cloud, Cpu, HelpCircle, Loader2 } from 'lucide-react';
import { getModelInfo } from '../../config/modelConfig';
import { getModelKind } from '../../utils/modelKind';

interface ModelBadgeProps {
  modelName?: string | null;
  cloudModelId?: string | null;
  /** 紧贴消息时的尺寸（更紧凑） */
  compact?: boolean;
  /** 流式生成中 —— 显示加载小图标（仅当 alias 仍未知时有视觉差异） */
  streaming?: boolean;
}

const KIND_STYLES = {
  cloud: {
    icon: Cloud,
    label: '云端',
    className: 'border-accent/15 bg-accent/5 text-accent',
  },
  local: {
    icon: Cpu,
    label: '本地',
    className: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700',
  },
  unknown: {
    icon: HelpCircle,
    label: '未知',
    className: 'border-slate-300/40 bg-slate-100/40 text-slate-500',
  },
} as const;

export const ModelBadge: React.FC<ModelBadgeProps> = ({
  modelName,
  cloudModelId,
  compact = false,
  streaming = false,
}) => {
  const hasModel = !!(modelName || cloudModelId);
  const kind = getModelKind(modelName, cloudModelId);
  const style = KIND_STYLES[kind];
  const Icon = style.icon;

  // alias 优先复用 modelConfig，未知时直接用原名；二者都缺时回退占位
  let alias: string;
  if (modelName) {
    alias = getModelInfo(modelName).alias;
  } else if (cloudModelId) {
    alias = '云端条目';
  } else {
    alias = streaming ? '准备中…' : '未指定模型';
  }

  const tooltipParts: string[] = [];
  if (modelName) tooltipParts.push(`模型：${modelName}`);
  if (cloudModelId) tooltipParts.push(`云端条目：${cloudModelId}`);
  if (!hasModel) {
    tooltipParts.push('尚未选择模型 —— 后续可能影响答复质量与计费');
  } else {
    tooltipParts.push(`类型：${style.label}`);
  }

  // 流式 + 尚未拿到模型信息 → 用 Loader2 图标；否则按 kind 显示
  const showLoader = streaming && !hasModel;
  const RenderIcon = showLoader ? Loader2 : Icon;

  return (
    <span
      className={`not-prose inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-2xs'
      } ${style.className}`}
      title={tooltipParts.join('\n')}
      data-model-kind={kind}
      data-model-name={modelName || ''}
      data-cloud-id={cloudModelId || ''}
    >
      <RenderIcon size={compact ? 9 : 10} className={showLoader ? 'animate-spin' : undefined} />
      <span className="truncate max-w-[160px]">{alias}</span>
    </span>
  );
};

export default ModelBadge;
