import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Wifi,
  WifiOff,
  Loader2,
  Download,
  Settings,
  Zap,
  ChevronDown,
  Globe,
  Database,
  Sparkles,
  Trash2,
  Plus,
  Pencil,
  X,
  ShieldCheck,
  Key,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import { getDefaultBaseUrl, getDefaultModel, buildProviderTemplate, PROVIDER_LABELS } from './SettingsTypes';
import type { ModelStatus, OllamaReadiness, DiagnosisItem, VaultStats } from './SettingsTypes';
import { applyCapabilityMutex, isCapabilityDisabled } from '../../shared/capabilityMutex';
import { computeHealthReport, runWithConcurrency, toFailedProbeResult } from '../../shared/batchHealth';
import type { HealthReport, BatchTestItemResult } from '../../shared/batchHealth';
import type { OverallUsageStats } from '../../shared/usageTracker';
import { formatRelativeTime } from '../../shared/usageTracker';
import { useTranslation } from '../../i18n/I18nContext';

interface ModelCapabilities {
  chat: boolean;
  vision: boolean;
  imageGen: boolean;
  embedding: boolean;
  videoGen: boolean;
}

const CAPABILITY_KEYS: Array<{ key: keyof ModelCapabilities; i18nKey: string; descI18nKey: string }> = [
  { key: 'chat', i18nKey: 'ai.tab.capability.chat', descI18nKey: '' },
  { key: 'vision', i18nKey: 'ai.tab.capability.vision', descI18nKey: '' },
  { key: 'imageGen', i18nKey: 'ai.tab.capability.imageGen', descI18nKey: '' },
  { key: 'embedding', i18nKey: 'ai.tab.capability.embedding', descI18nKey: '' },
  { key: 'videoGen', i18nKey: 'ai.tab.capability.videoGen', descI18nKey: '' },
];

function CapabilitiesSelector({ value, onChange }: { value: ModelCapabilities; onChange: (caps: ModelCapabilities) => void }) {
  const { t } = useTranslation();
  // P0 #4 修复：imageGen/embedding/videoGen 与 chat 互斥（共用纯函数 + 单测）
  const handleToggle = (key: keyof ModelCapabilities) => {
    const willEnable = !value[key]
    onChange(applyCapabilityMutex(value as any, key as any, willEnable) as ModelCapabilities)
  };
  const disabledKeyOf = (key: keyof ModelCapabilities): keyof ModelCapabilities | null => {
    if (key === 'chat') return 'imageGen'
    if (key === 'imageGen' || key === 'embedding' || key === 'videoGen') return 'chat'
    return null
  };
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-muted">
        {t('ai.tab.capabilities.title')}
        <span className="ml-2 text-2xs font-normal text-muted/80">{t('ai.tab.capabilities.hint')}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {CAPABILITY_KEYS.map(opt => {
          const disabled = isCapabilityDisabled(value as any, opt.key as any);
          const mutexKey = disabledKeyOf(opt.key);
          const mutexLabel = mutexKey
            ? CAPABILITY_KEYS.find(o => o.key === mutexKey)?.i18nKey
              ? t(CAPABILITY_KEYS.find(o => o.key === mutexKey)!.i18nKey)
              : ''
            : '';
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => !disabled && handleToggle(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                disabled
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : value[opt.key]
                    ? 'bg-accent text-white'
                    : 'bg-white border border-teal-900/10 text-muted hover:border-accent/30'
              }`}
              title={disabled ? t('ai.tab.capabilities.mutexTitle', { name: mutexLabel }) : ''}
            >
              {t(opt.i18nKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// P1 #6：测试结果内嵌卡片
type TestResultPayload = {
  success: boolean;
  latencyMs?: number;
  modelVersion?: string;
  httpStatus?: number;
  endpoint?: string;
  error?: string;
  errorKind?: 'network' | 'auth' | 'bad-request' | 'timeout' | 'unknown';
  at: number;
};

const ERROR_KIND_I18N: Record<NonNullable<TestResultPayload['errorKind']>, string> = {
  network: 'ai.tab.test.errorKind.network',
  auth: 'ai.tab.test.errorKind.auth',
  'bad-request': 'ai.tab.test.errorKind.bad-request',
  timeout: 'ai.tab.test.errorKind.timeout',
  unknown: 'ai.tab.test.errorKind.unknown',
};

function TestResultCard({ result, onDismiss }: { result: TestResultPayload; onDismiss?: () => void }) {
  const { t } = useTranslation();
  const isOk = result.success;
  const latency = result.latencyMs;
  const latencyBadge =
    latency === undefined
      ? null
      : latency < 800
        ? { label: `${latency}ms · 快速`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' }
        : latency < 2500
          ? { label: `${latency}ms · 正常`, cls: 'bg-blue-50 text-blue-700 border-blue-200/60' }
          : { label: `${latency}ms · 偏慢`, cls: 'bg-amber-50 text-amber-700 border-amber-200/60' };

  return (
    <div
      className={`mt-2 ml-10 p-3 rounded-xl border text-2xs leading-relaxed ${
        isOk ? 'bg-emerald-50/60 border-emerald-200/50' : 'bg-red-50/60 border-red-200/50'
      }`}
      role="status"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {isOk ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-2xs font-bold">
              <CheckCircle2 size={10} /> {t('ai.tab.test.success')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-2xs font-bold">
              <AlertCircle size={10} /> {t('ai.tab.test.failed')}
            </span>
          )}
          {latencyBadge && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-2xs font-mono ${latencyBadge.cls}`}>
              {latencyBadge.label}
            </span>
          )}
          {result.httpStatus !== undefined && (
            <span className="text-muted/80">HTTP {result.httpStatus}</span>
          )}
          {result.modelVersion && (
            <span className="text-muted/80">
              {t('ai.tab.test.modelLabel')} <span className="font-mono text-foreground/80">{result.modelVersion}</span>
            </span>
          )}
          {!isOk && result.errorKind && (
            <span className="text-muted/80">
              {t('ai.tab.test.errorKindLabel')} <span className="font-bold text-red-700">{t(ERROR_KIND_I18N[result.errorKind])}</span>
            </span>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-muted/60 hover:text-foreground transition-colors"
            title={t('ai.tab.test.collapse')}
          >
            <X size={11} />
          </button>
        )}
      </div>
      {!isOk && result.error && (
        <p className="mt-1.5 text-red-700/90 break-all font-mono">{result.error}</p>
      )}
      {result.endpoint && (
        <p className="mt-1 text-muted/60 font-mono break-all">→ {result.endpoint}</p>
      )}
    </div>
  );
}

const ERROR_KIND_HEALTH_LABEL: Record<string, string> = {
  network: 'ai.health.errorKind.network',
  auth: 'ai.health.errorKind.auth',
  'bad-request': 'ai.health.errorKind.bad-request',
  timeout: 'ai.health.errorKind.timeout',
  unknown: 'ai.health.errorKind.unknown',
};

const ERROR_KIND_CLS: Record<string, string> = {
  network: 'bg-orange-50 text-orange-700 border-orange-200/60',
  auth: 'bg-red-50 text-red-700 border-red-200/60',
  'bad-request': 'bg-amber-50 text-amber-700 border-amber-200/60',
  timeout: 'bg-yellow-50 text-yellow-700 border-yellow-200/60',
  unknown: 'bg-gray-50 text-gray-700 border-gray-200/60',
};

/** P2 #2：批量测试后的健康度报告卡 */
function HealthReportCard({ report }: { report: HealthReport }) {
  const { t } = useTranslation();
  const statusConfig = {
    healthy: { label: t('ai.health.healthy'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', icon: CheckCircle2 },
    degraded: { label: t('ai.health.degraded'), cls: 'bg-amber-50 text-amber-700 border-amber-200/60', icon: AlertCircle },
    down: { label: t('ai.health.down'), cls: 'bg-red-50 text-red-700 border-red-200/60', icon: AlertCircle },
  }[report.status];
  const StatusIcon = statusConfig.icon;
  const latencyCls =
    report.avgLatencyMs === null ? 'text-muted' :
    report.avgLatencyMs < 800 ? 'text-emerald-600' :
    report.avgLatencyMs < 2500 ? 'text-blue-600' : 'text-amber-600';

  return (
    <div className="p-3 bg-white/80 rounded-xl border border-teal-900/10 space-y-2.5" data-testid="health-report">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon size={14} className={statusConfig.cls.split(' ')[1]} />
          <p className="text-xs font-bold text-foreground">{t('ai.healthReport')}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-lg text-2xs font-bold border ${statusConfig.cls}`}>
          {statusConfig.label} · {t('ai.health.score', { score: report.score })}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="px-2 py-1.5 rounded-lg bg-teal-900/5">
          <p className="text-2xs text-muted">{t('ai.health.total')}</p>
          <p className="text-sm font-bold text-foreground">{report.total}</p>
        </div>
        <div className="px-2 py-1.5 rounded-lg bg-emerald-50/60">
          <p className="text-2xs text-muted">{t('ai.health.passed')}</p>
          <p className="text-sm font-bold text-emerald-600">{report.passed}</p>
        </div>
        <div className="px-2 py-1.5 rounded-lg bg-red-50/60">
          <p className="text-2xs text-muted">{t('ai.health.failed')}</p>
          <p className="text-sm font-bold text-red-600">{report.failed}</p>
        </div>
      </div>

      {report.avgLatencyMs !== null && (
        <p className="text-2xs text-muted flex items-center gap-1">
          <Loader2 size={10} className="opacity-50" />
          {t('ai.health.avgLatency')}
          <span className={`font-mono font-bold ${latencyCls}`}>{report.avgLatencyMs}ms</span>
        </p>
      )}

      {Object.keys(report.errorBreakdown).length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-teal-900/5">
          <span className="text-2xs text-muted">{t('ai.health.errorBreakdown')}</span>
          {Object.entries(report.errorBreakdown).map(([kind, count]) => (
            <span
              key={kind}
              className={`px-1.5 py-0.5 rounded text-2xs font-medium border ${ERROR_KIND_CLS[kind] || ERROR_KIND_CLS.unknown}`}
            >
              {(ERROR_KIND_HEALTH_LABEL[kind] && t(ERROR_KIND_HEALTH_LABEL[kind])) || kind} ×{count}
            </span>
          ))}
        </div>
      )}

      <p className="text-2xs text-muted/60 text-right">
        {new Date(report.testedAt).toLocaleTimeString('zh-CN')}
      </p>
    </div>
  );
}

/** P2 #3：多模型用量面板 */
function UsageStatsSection() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<OverallUsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const s = await window.ipcRenderer.invoke('get-usage-stats');
      setStats(s);
    } catch (err) {
      console.error('[UsageStatsSection] load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleReset = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
      return;
    }
    await window.ipcRenderer.invoke('reset-usage-stats');
    setShowResetConfirm(false);
    await load();
  };

  const isEmpty = !stats || stats.totalCalls === 0;
  const costCNY = stats ? stats.totalCostUSD * 7.2 : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">{t('ai.usageStats')}</h4>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1 rounded text-muted hover:text-accent transition-colors disabled:opacity-50"
          title={t('ai.usage.refresh')}
        >
          <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-teal-900/5 p-6 rounded-2xl border border-teal-900/5 space-y-4" data-testid="usage-stats">
        {isEmpty ? (
          <div className="text-center py-6 text-muted">
            <BarChart3 size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">{t('ai.usage.empty')}</p>
            <p className="text-2xs mt-1">{t('ai.usage.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="px-2 py-2 rounded-lg bg-white/60">
                <p className="text-2xs text-muted">{t('ai.usage.totalCalls')}</p>
                <p className="text-base font-bold text-foreground">{stats!.totalCalls}</p>
              </div>
              <div className="px-2 py-2 rounded-lg bg-blue-50/60">
                <p className="text-2xs text-muted">{t('ai.usage.totalTokens')}</p>
                <p className="text-base font-bold text-blue-600">
                  {((stats!.totalInputTokens + stats!.totalOutputTokens) / 1000).toFixed(1)}k
                </p>
              </div>
              <div className="px-2 py-2 rounded-lg bg-amber-50/60">
                <p className="text-2xs text-muted">{t('ai.usage.estimatedCost')}</p>
                <p className="text-base font-bold text-amber-600">
                  ¥{costCNY < 0.01 ? t('ai.usage.tiny') : costCNY.toFixed(2)}
                </p>
              </div>
            </div>

            {stats!.unpricedCalls > 0 && (
              <p className="text-2xs text-muted/80 flex items-center gap-1">
                <AlertCircle size={10} />
                {t('ai.usage.unpricedNote', { count: stats!.unpricedCalls })}
              </p>
            )}

            {stats!.byModel.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-teal-900/5">
                <p className="text-2xs font-bold text-muted uppercase tracking-wider">{t('ai.usage.byModel')}</p>
                {stats!.byModel.slice(0, 5).map(m => (
                  <div key={m.modelId} className="flex items-center justify-between text-2xs">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="font-bold text-foreground truncate">{m.modelName}</span>
                      <span className="text-muted/60">{m.provider}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted">{t('ai.usage.callsCount', { count: m.callCount })}</span>
                      {m.totalCostUSD > 0 && (
                        <span className="font-mono text-amber-600 font-bold">
                          ¥{(m.totalCostUSD * 7.2).toFixed(2)}
                        </span>
                      )}
                      <span className="text-muted/60 w-16 text-right">
                        {formatRelativeTime(m.lastUsedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={handleReset}
                className={`text-2xs transition-colors ${
                  showResetConfirm
                    ? 'text-red-600 font-bold'
                    : 'text-muted/60 hover:text-red-500'
                }`}
              >
                {showResetConfirm ? t('ai.usage.resetConfirm') : t('ai.usage.reset')}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

interface AiTabProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: string[];
  ollamaStatus?: OllamaReadiness | null | undefined;
  vaultStats?: VaultStats | undefined;
  activeIndexingCount?: number | undefined;
  showReasoningProcess: boolean;
  onShowReasoningProcessChange: (enabled: boolean) => void;
  onCloudModelsChanged?: (() => void) | undefined;
  chatContextLength?: number;
  onChatContextLengthChange?: (length: number) => void;
}

const AiTab: React.FC<AiTabProps> = ({
  currentModel,
  onModelChange,
  availableModels,
  ollamaStatus,
  vaultStats,
  activeIndexingCount = 0,
  showReasoningProcess,
  onShowReasoningProcessChange,
  onCloudModelsChanged,
  chatContextLength = 10,
  onChatContextLengthChange,
}) => {
  const { t } = useTranslation();
  const [ollamaApiUrl, setOllamaApiUrl] = useState('http://127.0.0.1:11434');
  const [ollamaTestStatus, setOllamaTestStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [gpuMode, setGpuMode] = useState<'auto' | 'gpu' | 'cpu'>('auto');
  const [modelParams, setModelParams] = useState<{ temperature?: number; top_p?: number; num_predict?: number }>({});
  const [diagnosisItems, setDiagnosisItems] = useState<DiagnosisItem[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([]);

  const [cloudModels, setCloudModels] = useState<Array<{
    id: string; name: string; provider: string; apiKeyMasked: string; baseUrl: string; modelName: string;
    capabilities: { chat: boolean; vision: boolean; imageGen: boolean; embedding: boolean; videoGen: boolean };
    testStatus: 'idle' | 'testing' | 'connected' | 'failed'
  }>>([]);
  const [showAddCloud, setShowAddCloud] = useState(false);
  const [secretSecure, setSecretSecure] = useState<boolean | null>(null);
  const defaultCapabilities = { chat: true, vision: false, imageGen: false, embedding: false, videoGen: false };
  const [addCloudForm, setAddCloudForm] = useState({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } });
  const [addCloudTestStatus, setAddCloudTestStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } });

  // P1 #6：保存最近一次测试结果（延迟 / 模型版本 / 错误类型），用于在卡片下方展开诊断
  const [testResults, setTestResults] = useState<Record<string, {
    success: boolean;
    latencyMs?: number;
    modelVersion?: string;
    httpStatus?: number;
    endpoint?: string;
    error?: string;
    errorKind?: 'network' | 'auth' | 'bad-request' | 'timeout' | 'unknown';
    at: number;
  }>>({});
  const [addTestResult, setAddTestResult] = useState<null | {
    success: boolean;
    latencyMs?: number;
    modelVersion?: string;
    httpStatus?: number;
    endpoint?: string;
    error?: string;
    errorKind?: 'network' | 'auth' | 'bad-request' | 'timeout' | 'unknown';
    at: number;
  }>(null);

  // P2 #2：批量测试 + 健康度报告
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);

  const runBatchHealthTest = async () => {
    if (cloudModels.length === 0 || batchRunning) return;
    setBatchRunning(true);
    setBatchProgress({ done: 0, total: cloudModels.length });
    setHealthReport(null);
    setCloudModels(prev => prev.map(m => ({ ...m, testStatus: 'testing' as const })));

    const items: BatchTestItemResult[] = await runWithConcurrency(
      cloudModels,
      3,
      async (cm): Promise<BatchTestItemResult> => {
        try {
          const result = await window.ipcRenderer.invoke('test-cloud-model', {
            provider: cm.provider,
            modelId: cm.id,
            baseUrl: cm.baseUrl || getDefaultBaseUrl(cm.provider),
            model: cm.modelName || getDefaultModel(cm.provider),
          });
          setTestResults(prev => ({ ...prev, [cm.id]: { ...result, at: Date.now() } }));
          setCloudModels(prev => prev.map((m, i) => prev.indexOf(cm) === i ? { ...m, testStatus: result.success ? 'connected' as const : 'failed' as const } : m));
          return { id: cm.id, name: cm.name, provider: cm.provider, result };
        } catch (err) {
          const failed = toFailedProbeResult(err);
          setTestResults(prev => ({ ...prev, [cm.id]: { ...failed, at: Date.now() } }));
          return { id: cm.id, name: cm.name, provider: cm.provider, result: failed };
        } finally {
          setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }));
        }
      }
    );

    setHealthReport(computeHealthReport(items));
    setBatchRunning(false);
  };

  useEffect(() => {
    window.ipcRenderer.invoke('get-cloud-models').then((models: any[]) => {
      if (models && models.length > 0) {
        setCloudModels(models.map((m: any) => ({ ...m, testStatus: 'connected' as const })));
      }
    }).catch(() => {});
  }, []);

  // P0 #1：探测安全存储状态 + 触发一次幂等迁移
  useEffect(() => {
    window.ipcRenderer.invoke('secret-store-status')
      .then((s: any) => setSecretSecure(!!s?.secure))
      .catch(() => setSecretSecure(false));
    window.ipcRenderer.invoke('migrate-cloud-api-keys').catch(() => {});
  }, []);

  // 加载 GPU 模式
  useEffect(() => {
    window.ipcRenderer.invoke('ollama-gpu-mode').then((mode: any) => {
      if (mode && ['auto', 'gpu', 'cpu'].includes(mode)) {
        setGpuMode(mode);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    window.ipcRenderer.invoke('ollama-url').then((url: any) => {
      if (url) {
        setOllamaApiUrl(url);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    window.ipcRenderer.invoke('ollama-model-params').then((params: any) => {
      if (params) {
        setModelParams(params);
      }
    }).catch(() => {});
  }, []);

  const handleGpuModeChange = async (mode: 'auto' | 'gpu' | 'cpu') => {
    setGpuMode(mode);
    try {
      await window.ipcRenderer.invoke('ollama-set-gpu-mode', { mode });
    } catch {}
  };

  const handleOllamaUrlChange = async (url: string) => {
    setOllamaApiUrl(url);
    setOllamaTestStatus('idle');
    try {
      await window.ipcRenderer.invoke('ollama-set-url', { url });
    } catch (err) {
      console.error('[AiTab] ollama-set-url error:', err);
    }
  };

  const handleModelParamChange = async (key: string, value: number | undefined) => {
    const newParams = { ...modelParams, [key]: value };
    setModelParams(newParams);
    try {
      await window.ipcRenderer.invoke('ollama-set-model-params', { params: newParams });
    } catch (err) {
      console.error('[AiTab] ollama-set-model-params error:', err);
    }
  };

  const handleAddCloudModel = async () => {
    try {
      const result = await window.ipcRenderer.invoke('save-cloud-model', {
        name: addCloudForm.name || addCloudForm.modelName,
        provider: addCloudForm.provider,
        apiKey: addCloudForm.apiKey,
        baseUrl: addCloudForm.baseUrl,
        modelName: addCloudForm.modelName,
        capabilities: addCloudForm.capabilities,
      });
      console.log('[AiTab] save-cloud-model result:', result);
      if (result && result.success && result.models) {
        setCloudModels(result.models.map((m: any) => ({ ...m, testStatus: 'connected' as const })));
        setShowAddCloud(false);
        setAddCloudForm({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } });
        setAddCloudTestStatus('idle');
        onCloudModelsChanged?.();
      } else {
        alert(t('ai.tab.add.saveFailed', { message: result?.error || '返回数据异常' }));
      }
    } catch (err: any) {
      console.error('[AiTab] save-cloud-model error:', err);
      alert(t('ai.tab.add.saveFailed', { message: err?.message || t('error.unknown') }));
    }
  };

  const handleDeleteCloudModel = async (id: string) => {
    try {
      const result = await window.ipcRenderer.invoke('delete-cloud-model', id);
      if (result?.success) {
        setCloudModels(result.models.map((m: any) => ({ ...m, testStatus: 'connected' as const })));
        onCloudModelsChanged?.();
      }
    } catch (err) {
      console.error('[AiTab] delete-cloud-model error:', err);
    }
  };

  const handleStartEdit = (model: any) => {
    setEditingModelId(model.id);
    setEditForm({
      name: model.name || '',
      provider: model.provider || '',
      apiKey: '', // 永远不显示明文
      baseUrl: model.baseUrl || '',
      modelName: model.modelName || '',
      capabilities: model.capabilities || { ...defaultCapabilities },
    });
  };

  const handleCancelEdit = () => {
    setEditingModelId(null);
    setEditForm({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } });
  };

  const handleSaveEdit = async () => {
    if (!editingModelId) return;
    try {
      const result = await window.ipcRenderer.invoke('save-cloud-model', {
        id: editingModelId,
        name: editForm.name || editForm.modelName,
        provider: editForm.provider,
        apiKey: editForm.apiKey,
        baseUrl: editForm.baseUrl,
        modelName: editForm.modelName,
        capabilities: editForm.capabilities,
      });
      if (result && result.success && result.models) {
        setCloudModels(result.models.map((m: any) => ({ ...m, testStatus: 'connected' as const })));
        setEditingModelId(null);
        setEditForm({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } });
        onCloudModelsChanged?.();
      } else {
        alert(t('ai.tab.add.saveFailed', { message: result?.error || '返回数据异常' }));
      }
    } catch (err: any) {
      console.error('[AiTab] save edit error:', err);
      alert(t('ai.tab.add.saveFailed', { message: err?.message || t('error.unknown') }));
    }
  };

  const testCloudConnection = async (index: number) => {
    const cm = cloudModels[index];
    if (!cm) return;
    setCloudModels(prev => prev.map((m, i) => i === index ? { ...m, testStatus: 'testing' as const } : m));
    try {
      // P0 #1：不传 apiKey，后端用 modelId 从 Keychain 取真值
      const result = await window.ipcRenderer.invoke('test-cloud-model', {
        provider: cm.provider,
        modelId: cm.id,
        baseUrl: cm.baseUrl || getDefaultBaseUrl(cm.provider),
        model: cm.modelName || getDefaultModel(cm.provider),
      });
      setCloudModels(prev => prev.map((m, i) => i === index ? { ...m, testStatus: result.success ? 'connected' as const : 'failed' as const } : m));
      setTestResults(prev => ({ ...prev, [cm.id]: { ...result, at: Date.now() } }));
    } catch (err: any) {
      setCloudModels(prev => prev.map((m, i) => i === index ? { ...m, testStatus: 'failed' as const } : m));
      setTestResults(prev => ({ ...prev, [cm.id]: { success: false, error: err?.message || '请求失败', errorKind: 'unknown', at: Date.now() } }));
    }
  };

  const testAddCloudConnection = async () => {
    setAddCloudTestStatus('testing');
    setAddTestResult(null);
    try {
      const result = await window.ipcRenderer.invoke('test-cloud-model', {
        provider: addCloudForm.provider,
        apiKey: addCloudForm.apiKey,
        baseUrl: addCloudForm.baseUrl || getDefaultBaseUrl(addCloudForm.provider),
        model: addCloudForm.modelName || getDefaultModel(addCloudForm.provider),
      });
      setAddCloudTestStatus(result.success ? 'connected' : 'failed');
      setAddTestResult({ ...result, at: Date.now() });
    } catch (err: any) {
      setAddCloudTestStatus('failed');
      setAddTestResult({ success: false, error: err?.message || '请求失败', errorKind: 'unknown', at: Date.now() });
    }
  };

  const testOllamaConnection = async () => {
    setOllamaTestStatus('testing');
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${ollamaApiUrl}/api/tags`, { signal: controller.signal });
      if (resp.ok) {
        setOllamaTestStatus('connected');
      } else {
        setOllamaTestStatus('failed');
      }
    } catch {
      setOllamaTestStatus('failed');
    }
  };

  const handleRunDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisItems([]);
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${ollamaApiUrl}/api/tags`, { signal: controller.signal });
      const data = await resp.json();
      const models: string[] = (data.models || []).map((m: any) => m.name);
      const items: DiagnosisItem[] = [];
      const hasChat = models.some(m => !m.includes('embed'));
      const hasEmbedding = models.some(m => m.includes('embed'));
      items.push({
        title: t('ai.diagnosis.ollamaService'),
        status: 'ready',
        detail: t('ai.diagnosis.ollamaOk', { count: models.length }),
        action: t('ai.diagnosis.action.ready'),
      });
      if (hasChat) {
        items.push({ title: t('ai.diagnosis.chatModel'), status: 'ready', detail: t('ai.diagnosis.chatOk'), action: t('ai.diagnosis.action.ready') });
      } else {
        items.push({ title: t('ai.diagnosis.chatModel'), status: 'error', detail: t('ai.diagnosis.chatMissing'), action: t('ai.diagnosis.action.installChat') });
      }
      if (hasEmbedding) {
        items.push({ title: t('ai.diagnosis.embedModel'), status: 'ready', detail: t('ai.diagnosis.embedOk'), action: t('ai.diagnosis.action.ready') });
      } else {
        items.push({ title: t('ai.diagnosis.embedModel'), status: 'warning', detail: t('ai.diagnosis.embedMissing'), action: t('ai.diagnosis.action.installEmbed') });
      }
      setDiagnosisItems(items);
    } catch {
      setDiagnosisItems([{
        title: t('ai.diagnosis.ollamaService'),
        status: 'error',
        detail: t('ai.diagnosis.ollamaFailed'),
        action: t('ai.diagnosis.action.start'),
      }]);
    } finally {
      setIsDiagnosing(false);
    }
  };

  useEffect(() => {
    if (cloudModels.length > 0) return;
    setLoadingModels(true);
    window.ipcRenderer.invoke('ollama-models')
      .then((data: any) => {
        const models: string[] = (data || []).map((m: any) => m.name || m);
        const chatRec = models.find((m: string) => !m.includes('embed')) || t('ai.diagnosis.chatMissing');
        const embedRec = models.find((m: string) => m.includes('embed')) || t('ai.diagnosis.embedMissing');
        setModelStatuses([
          { category: t('ai.diagnosis.chatModel'), recommend: chatRec, installed: models.some(m => !m.includes('embed')), pullCommand: models.some(m => !m.includes('embed')) ? t('ai.tab.installedOf', { name: chatRec }) : 'ollama pull <chat-model-name>' },
          { category: t('ai.diagnosis.embedModel'), recommend: embedRec, installed: models.some(m => m.includes('embed')), pullCommand: models.some(m => m.includes('embed')) ? t('ai.tab.installedOf', { name: embedRec }) : 'ollama pull <embedding-model-name>' },
        ]);
      })
      .catch(() => setModelStatuses([]))
      .finally(() => setLoadingModels(false));
  }, [cloudModels.length, t]);

  const [loadingModels, setLoadingModels] = useState(false);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-accent" />
            <h4 className="text-xs font-bold text-muted uppercase tracking-widest">{t('ai.tab.currentCapabilities')}</h4>
          </div>
          <button
            onClick={handleRunDiagnosis}
            disabled={isDiagnosing}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-teal-900/10 rounded-xl text-2xs font-bold text-muted hover:bg-teal-900/5 transition-all disabled:opacity-50"
          >
            {isDiagnosing ? <Loader2 size={12} className="animate-spin text-accent" /> : <Sparkles size={12} className="text-accent" />}
            {isDiagnosing ? t('ai.tab.diagnosing') : t('ai.tab.diagnose')}
          </button>
        </div>
        {(() => {
          const hasChat = ollamaStatus?.chatModelReady || cloudModels.length > 0;
          const hasEmbedding = ollamaStatus?.embeddingModelReady || cloudModels.some((m: any) => m.capabilities?.embedding || (m.modelName || '').toLowerCase().includes('embed'));
          const chatSource = cloudModels.length > 0
            ? t('ai.tab.cap.source.cloud', { count: cloudModels.length })
            : ollamaStatus?.chatModelReady ? t('ai.tab.cap.source.local') : t('ai.tab.cap.source.unconfigured');
          const expansionSource = cloudModels.length > 0
            ? t('ai.tab.cap.source.cloud', { count: cloudModels.length })
            : ollamaStatus?.chatModelReady ? t('ai.tab.cap.source.local') : t('ai.tab.cap.source.unconfigured');
          const embeddingSource = (() => {
            const hasCloudEmbed = cloudModels.some((m: any) => m.capabilities?.embedding || (m.modelName || '').toLowerCase().includes('embed'));
            if (ollamaStatus?.embeddingModelReady && hasCloudEmbed) return t('ai.tab.cap.source.mixed');
            if (hasCloudEmbed) return t('ai.tab.cap.source.cloudOnly');
            if (ollamaStatus?.embeddingModelReady) return t('ai.tab.cap.source.local');
            return t('ai.tab.cap.source.needEmbedding');
          })();
          const items = [
            { label: t('ai.tab.cap.chatGen'), ok: hasChat, source: chatSource },
            { label: t('ai.tab.cap.queryExpansion'), ok: hasChat, source: expansionSource },
            { label: t('ai.tab.cap.fts'), ok: true, source: t('ai.tab.cap.source.localAlways') },
            { label: t('ai.tab.cap.vectorSearch'), ok: hasEmbedding, source: embeddingSource },
          ];
          return (
            <div className="grid grid-cols-2 gap-3">
              {items.map(item => (
                <div key={item.label} className="bg-white/70 border border-teal-900/10 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    {item.ok ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-amber-500" />}
                    <span className="text-xs font-bold text-foreground">{item.label}</span>
                  </div>
                  <p className="mt-2 text-2xs text-muted">{item.ok ? `→ ${item.source}` : item.source}</p>
                </div>
              ))}
            </div>
          );
        })()}
        {diagnosisItems.length > 0 && (
          <div className="space-y-2 pt-1">
            {diagnosisItems.map((item) => (
              <div key={item.title} className="flex items-start justify-between gap-4 p-3 bg-white/70 rounded-xl border border-teal-900/5">
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.status === 'ready' ? 'bg-emerald-100 text-emerald-600' :
                    item.status === 'warning' ? 'bg-amber-100 text-amber-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {item.status === 'ready' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{item.title}</p>
                    <p className="text-2xs text-muted mt-0.5 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
                <span className="text-2xs font-bold text-accent whitespace-nowrap">{item.action}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">{t('ai.tab.config')}</h4>
        </div>
        <div className="space-y-4">
          <details open={ollamaStatus?.connected} className="group bg-teal-900/5 rounded-2xl border border-teal-900/5 overflow-hidden">
            <summary className="flex items-center justify-between px-6 py-4 cursor-pointer select-none list-none">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${ollamaStatus?.connected ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Cpu size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{t('ai.tab.ollama')}</p>
                  <p className="text-2xs text-muted">{ollamaStatus?.connected ? t('ai.tab.ollamaConnected') : t('ai.tab.ollamaDisconnected')}</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground block">{t('ai.tab.apiUrl')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ollamaApiUrl}
                    onChange={(e) => handleOllamaUrlChange(e.target.value)}
                    className="flex-1 bg-white border border-teal-900/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 transition-all font-mono"
                  />
                  <button
                    onClick={testOllamaConnection}
                    disabled={ollamaTestStatus === 'testing'}
                    className="shrink-0 px-4 py-2.5 rounded-xl border border-teal-900/10 text-xs font-bold hover:bg-teal-900/5 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {ollamaTestStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : ollamaTestStatus === 'connected' ? <Wifi size={14} className="text-green-500" /> : ollamaTestStatus === 'failed' ? <WifiOff size={14} className="text-red-500" /> : <Wifi size={14} className="text-muted" />}
                    {ollamaTestStatus === 'testing' ? t('common.testing') : ollamaTestStatus === 'connected' ? t('common.connected') : ollamaTestStatus === 'failed' ? t('common.disconnected') : t('common.test')}
                  </button>
                </div>
                <p className="text-2xs text-muted">{t('ai.tab.apiUrlHint')}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground block">{t('ai.tab.compute')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'auto', label: t('ai.tab.gpu.auto'), desc: t('ai.tab.gpu.autoDesc') },
                    { value: 'gpu', label: t('ai.tab.gpu.gpu'), desc: t('ai.tab.gpu.gpuDesc') },
                    { value: 'cpu', label: t('ai.tab.gpu.cpu'), desc: t('ai.tab.gpu.cpuDesc') },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => handleGpuModeChange(value as 'auto' | 'gpu' | 'cpu')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        gpuMode === value
                          ? 'border-accent bg-accent/5 text-foreground'
                          : 'border-teal-900/10 bg-white text-muted hover:border-teal-900/20'
                      }`}
                    >
                      <p className={`text-xs font-bold ${gpuMode === value ? 'text-accent' : ''}`}>{label}</p>
                      <p className="text-2xs mt-0.5 opacity-70">{desc}</p>
                    </button>
                  ))}
                </div>
                <p className="text-2xs text-muted">{t('ai.tab.computeHint')}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-foreground">{t('ai.tab.params')}</label>
                  <details className="relative">
                    <summary className="text-2xs text-muted cursor-pointer hover:text-accent list-none flex items-center gap-1">
                      <Sparkles size={12} />
                      {Object.keys(modelParams).length > 0 ? t('ai.tab.params.configured') : t('ai.tab.params.default')}
                    </summary>
                    <div className="absolute right-0 top-6 w-64 bg-white rounded-xl border border-teal-900/10 shadow-lg p-4 space-y-4 z-10">
                      <p className="text-2xs text-muted">{t('ai.tab.paramsHint')}</p>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-2xs mb-1">
                            <span className="text-muted">{t('ai.tab.params.temperature')}</span>
                            <span className="font-mono">{modelParams.temperature ?? t('ai.tab.params.default')}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={modelParams.temperature ?? ''}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              handleModelParamChange('temperature', isNaN(v) ? undefined : v);
                            }}
                            className="w-full accent-accent"
                          />
                          <p className="text-2xs text-muted mt-0.5">{t('ai.tab.params.temperatureHint')}</p>
                        </div>
                        <div>
                          <div className="flex justify-between text-2xs mb-1">
                            <span className="text-muted">{t('ai.tab.params.topP')}</span>
                            <span className="font-mono">{modelParams.top_p ?? t('ai.tab.params.default')}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={modelParams.top_p ?? ''}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              handleModelParamChange('top_p', isNaN(v) ? undefined : v);
                            }}
                            className="w-full accent-accent"
                          />
                          <p className="text-2xs text-muted mt-0.5">{t('ai.tab.params.topPHint')}</p>
                        </div>
                        <div>
                          <div className="flex justify-between text-2xs mb-1">
                            <span className="text-muted">{t('ai.tab.params.maxTokens')}</span>
                            <span className="font-mono">{modelParams.num_predict ?? 16384}</span>
                          </div>
                          <input
                            type="range"
                            min="256"
                            max="32768"
                            step="256"
                            value={modelParams.num_predict ?? 16384}
                            onChange={(e) => {
                              handleModelParamChange('num_predict', parseInt(e.target.value));
                            }}
                            className="w-full accent-accent"
                          />
                          <p className="text-2xs text-muted mt-0.5">{t('ai.tab.params.maxTokensHint')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleModelParamChange('temperature', undefined)}
                        className="w-full text-2xs text-muted hover:text-accent transition-colors"
                      >
                        {t('ai.tab.params.reset')}
                      </button>
                    </div>
                  </details>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground block">{t('ai.tab.defaultModel')}</label>
                <select
                  value={currentModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="w-full bg-white border border-teal-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground outline-none focus:border-accent/50 transition-all"
                >
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              {ollamaStatus?.connected && modelStatuses.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-teal-900/10">
                  <p className="text-2xs font-bold text-muted uppercase tracking-widest">{t('ai.tab.installedModels')}</p>
                  {modelStatuses.map((status, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl border border-teal-900/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${status.installed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {status.installed ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground">{status.category}</p>
                          <p className="text-2xs text-muted">{t('ai.tab.recommend')}: <span className="font-mono">{status.recommend}</span></p>
                        </div>
                      </div>
                      {!status.installed && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(status.pullCommand);
                            alert(`命令已复制: ${status.pullCommand}\n请在终端执行以安装模型。`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-600 rounded-lg text-2xs font-bold hover:bg-amber-50 transition-all"
                        >
                          <Download size={12} />
                          <span>{t('ai.tab.installed')}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          <details open={cloudModels.length > 0 || !ollamaStatus?.connected} className="group bg-teal-900/5 rounded-2xl border border-teal-900/5 overflow-hidden">
            <summary className="flex items-center justify-between px-6 py-4 cursor-pointer select-none list-none">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cloudModels.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Cloud size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{t('ai.tab.cloudApi')}</p>
                  <p className="text-2xs text-muted">{cloudModels.length > 0 ? t('ai.tab.cloudCount', { count: cloudModels.length }) : t('ai.tab.cloudOptional')}</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-6 space-y-4">
              {cloudModels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-2xs font-bold text-muted uppercase tracking-widest">{t('ai.tab.cloud.configured')}</p>
                  {cloudModels.map((cm, idx) => (
                    <div key={cm.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-teal-900/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cm.testStatus === 'connected' ? 'bg-emerald-100 text-emerald-600' : cm.testStatus === 'failed' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {cm.testStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : cm.testStatus === 'connected' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{cm.name || cm.modelName}</p>
                          <p className="text-2xs text-muted">{cm.provider} · {cm.modelName}</p>
                          {/* P0 #1：明文不再下发到前端，只展示脱敏的 key + Keychain 标记 */}
                          <p className="text-2xs font-mono text-muted/80 flex items-center gap-1 mt-0.5">
                            <Key size={10} className="opacity-60" />
                            <span>{cm.apiKeyMasked || t('ai.tab.cloud.notConfigured')}</span>
                            {secretSecure !== false && (
                              <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600/80" title={t('ai.tab.cloud.keychainTitle')}>
                                <ShieldCheck size={10} /> {t('ai.tab.cloud.keychain')}
                              </span>
                            )}
                            {secretSecure === false && (
                              <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600" title={t('ai.tab.cloud.unencryptedTitle')}>
                                {t('ai.tab.cloud.unencrypted')}
                              </span>
                            )}
                          </p>
                          {cm.capabilities && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {CAPABILITY_KEYS.filter(opt => cm.capabilities[opt.key]).map(opt => (
                                <span key={opt.key} className="px-1.5 py-0.5 rounded text-2xs bg-accent/10 text-accent">
                                  {t(opt.i18nKey)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => testCloudConnection(idx)}
                          disabled={cm.testStatus === 'testing'}
                          className="p-1.5 rounded-lg hover:bg-teal-900/5 text-muted transition-colors disabled:opacity-50"
                          title={t('ai.tab.cloud.testConn')}
                        >
                          {cm.testStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : cm.testStatus === 'connected' ? <Wifi size={12} className="text-green-500" /> : <WifiOff size={12} className="text-red-500" />}
                        </button>
                        <button
                          onClick={() => handleStartEdit(cm)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-muted hover:text-blue-500 transition-colors"
                          title={t('ai.tab.cloud.edit')}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => { if (window.confirm(t('ai.tab.cloud.deleteConfirm', { name: cm.name || cm.modelName }))) handleDeleteCloudModel(cm.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                          title={t('ai.tab.cloud.delete')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editingModelId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                >
                  <div
                    className="absolute inset-0 bg-teal-900/20 backdrop-blur-sm"
                    onClick={handleCancelEdit}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl border border-teal-900/10 rounded-[2rem] shadow-premium p-6 overflow-hidden max-h-[80vh] overflow-y-auto"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-foreground">{t('ai.tab.edit.title')}</p>
                      <button onClick={handleCancelEdit} className="p-1.5 rounded-lg hover:bg-teal-900/5 text-muted">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder={t('ai.tab.add.namePlaceholder')} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
                      <select value={editForm.provider} onChange={e => {
                        const provider = e.target.value;
                        // P2 #1：协议模板 - 选 Provider 时自动带入 baseUrl / modelName 默认值
                        const tpl = buildProviderTemplate(provider, editForm.baseUrl, editForm.modelName);
                        setEditForm(f => ({ ...f, provider, baseUrl: tpl.baseUrl, modelName: tpl.modelName }));
                      }} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-accent/50">
                        <option value="">{t('ai.tab.add.chooseProvider')}</option>
                        {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      {editForm.provider && (
                        <>
                          <input type="password" value={editForm.apiKey} onChange={e => setEditForm(f => ({ ...f, apiKey: e.target.value }))} placeholder={t('ai.tab.add.apiKeyPlaceholder')} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50" />
                          <div className="relative">
                            <input type="text" value={editForm.baseUrl} onChange={e => setEditForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder={t('ai.tab.add.baseUrlPlaceholder', { default: getDefaultBaseUrl(editForm.provider) })} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 pr-20 text-sm font-mono outline-none focus:border-accent/50" />
                            {editForm.baseUrl && editForm.baseUrl !== getDefaultBaseUrl(editForm.provider) && (
                              <button
                                type="button"
                                onClick={() => setEditForm(f => ({ ...f, baseUrl: getDefaultBaseUrl(f.provider) }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-accent hover:text-accent/80 font-medium px-1.5 py-0.5 rounded hover:bg-accent/5"
                                title={t('ai.tab.add.restoreDefault')}
                              >
                                {t('ai.tab.add.restoreDefault')}
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <input type="text" value={editForm.modelName} onChange={e => setEditForm(f => ({ ...f, modelName: e.target.value }))} placeholder={t('ai.tab.add.modelPlaceholder', { default: getDefaultModel(editForm.provider) })} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 pr-20 text-sm font-mono outline-none focus:border-accent/50" />
                            {editForm.modelName && editForm.modelName !== getDefaultModel(editForm.provider) && (
                              <button
                                type="button"
                                onClick={() => setEditForm(f => ({ ...f, modelName: getDefaultModel(f.provider) }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-accent hover:text-accent/80 font-medium px-1.5 py-0.5 rounded hover:bg-accent/5"
                                title={t('ai.tab.add.restoreDefault')}
                              >
                                {t('ai.tab.add.restoreDefault')}
                              </button>
                            )}
                          </div>
                          <CapabilitiesSelector
                            value={editForm.capabilities}
                            onChange={caps => setEditForm(f => ({ ...f, capabilities: caps }))}
                          />
                        </>
                      )}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleCancelEdit}
                          className="flex-1 px-3 py-2.5 rounded-xl border border-teal-900/10 text-xs font-bold hover:bg-teal-900/5 transition-all"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editForm.provider || !editForm.apiKey || !editForm.modelName}
                          className="flex-1 px-3 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all disabled:opacity-50"
                        >
                          {t('ai.tab.edit.save')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {showAddCloud ? (
                <div className="p-4 bg-white rounded-2xl border border-teal-900/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">{t('ai.tab.add.title')}</p>
                    <button onClick={() => { setShowAddCloud(false); setAddCloudForm({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } }); setAddCloudTestStatus('idle') }} className="text-2xs text-muted hover:text-foreground">{t('common.cancel')}</button>
                  </div>
                  <p className="text-2xs text-muted/80 flex items-center gap-1">
                    <ShieldCheck size={10} className="text-emerald-600/80" />
                    {t('ai.tab.add.keychainHint')}
                  </p>
                  <div className="space-y-2">
                    <input type="text" value={addCloudForm.name} onChange={e => setAddCloudForm(f => ({ ...f, name: e.target.value }))} placeholder={t('ai.tab.add.namePlaceholder')} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
                  </div>
                  <div className="space-y-2">
                    <select value={addCloudForm.provider} onChange={e => {
                      const provider = e.target.value;
                      // P2 #1：协议模板 - 选 Provider 时自动带入 baseUrl / modelName 默认值
                      const tpl = buildProviderTemplate(provider, addCloudForm.baseUrl, addCloudForm.modelName);
                      setAddCloudForm(f => ({ ...f, provider, baseUrl: tpl.baseUrl, modelName: tpl.modelName }));
                    }} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-accent/50">
                      <option value="">{t('ai.tab.add.chooseProvider')}</option>
                      {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {addCloudForm.provider && (
                    <>
                      <input type="password" value={addCloudForm.apiKey} onChange={e => setAddCloudForm(f => ({ ...f, apiKey: e.target.value }))} placeholder={t('ai.tab.add.apiKeyPlaceholder')} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50" />
                      <div className="relative">
                        <input type="text" value={addCloudForm.baseUrl} onChange={e => setAddCloudForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder={t('ai.tab.add.baseUrlPlaceholder', { default: getDefaultBaseUrl(addCloudForm.provider) })} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 pr-20 text-sm font-mono outline-none focus:border-accent/50" />
                        {addCloudForm.baseUrl && addCloudForm.baseUrl !== getDefaultBaseUrl(addCloudForm.provider) && (
                          <button
                            type="button"
                            onClick={() => setAddCloudForm(f => ({ ...f, baseUrl: getDefaultBaseUrl(f.provider) }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-accent hover:text-accent/80 font-medium px-1.5 py-0.5 rounded hover:bg-accent/5"
                            title={t('ai.tab.add.restoreDefault')}
                          >
                            {t('ai.tab.add.restoreDefault')}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input type="text" value={addCloudForm.modelName} onChange={e => setAddCloudForm(f => ({ ...f, modelName: e.target.value }))} placeholder={t('ai.tab.add.modelPlaceholder', { default: getDefaultModel(addCloudForm.provider) })} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 pr-20 text-sm font-mono outline-none focus:border-accent/50" />
                        {addCloudForm.modelName && addCloudForm.modelName !== getDefaultModel(addCloudForm.provider) && (
                          <button
                            type="button"
                            onClick={() => setAddCloudForm(f => ({ ...f, modelName: getDefaultModel(f.provider) }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-accent hover:text-accent/80 font-medium px-1.5 py-0.5 rounded hover:bg-accent/5"
                            title={t('ai.tab.add.restoreDefault')}
                          >
                            {t('ai.tab.add.restoreDefault')}
                          </button>
                        )}
                      </div>
                      <CapabilitiesSelector
                        value={addCloudForm.capabilities}
                        onChange={caps => setAddCloudForm(f => ({ ...f, capabilities: caps }))}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={testAddCloudConnection}
                          disabled={addCloudTestStatus === 'testing' || !addCloudForm.apiKey || !addCloudForm.modelName}
                          className="flex-1 px-3 py-2 rounded-xl border border-teal-900/10 text-xs font-bold hover:bg-teal-900/5 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {addCloudTestStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : addCloudTestStatus === 'connected' ? <Wifi size={12} className="text-green-500" /> : <Wifi size={12} />}
                          {addCloudTestStatus === 'testing' ? t('common.testing') : addCloudTestStatus === 'connected' ? t('common.connected') : t('common.test')}
                        </button>
                        <button
                          onClick={handleAddCloudModel}
                          disabled={!addCloudForm.provider || !addCloudForm.apiKey || !addCloudForm.modelName}
                          className="flex-1 px-3 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all disabled:opacity-50"
                        >
                          {t('common.save')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* P2 #2：批量测试 + 健康度报告 */}
                  {cloudModels.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={runBatchHealthTest}
                        disabled={batchRunning}
                        className="flex-1 px-3 py-2 rounded-xl border border-accent/20 bg-accent/5 text-xs font-bold text-accent hover:bg-accent/10 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        title={t('ai.batchTestTitle')}
                      >
                        {batchRunning ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            {t('ai.testing', { done: batchProgress.done, total: batchProgress.total })}
                          </>
                        ) : (
                          <>
                            <Zap size={12} />
                            {t('ai.batchTest')}
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {healthReport && <HealthReportCard report={healthReport} />}

                  <button
                    onClick={() => setShowAddCloud(true)}
                    className="w-full px-4 py-3 rounded-xl border border-dashed border-teal-900/10 text-xs font-bold text-muted hover:text-accent hover:border-accent/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    {t('ai.tab.cloud.addMore')}
                  </button>
                </div>
              )}
            </div>
          </details>
        </div>
      </section>

      <UsageStatsSection />

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">{t('ai.tab.advanced')}</h4>
        </div>

        <div className="bg-teal-900/5 p-6 rounded-2xl border border-teal-900/5 space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-bold text-foreground">{t('ai.advanced.reasoning.title')}</p>
              <p className="text-xs text-muted mt-1">{t('ai.advanced.reasoning.desc')}</p>
            </div>
            <button
              onClick={() => onShowReasoningProcessChange(!showReasoningProcess)}
              className={`w-12 h-6 rounded-full relative transition-all duration-300 ${showReasoningProcess ? 'bg-accent' : 'bg-teal-900/10'}`}
            >
              <motion.div
                animate={{ x: showReasoningProcess ? 24 : 4 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>
        </div>

        <div className="bg-teal-900/5 p-6 rounded-2xl border border-teal-900/5 space-y-4">
          <div>
            <p className="text-sm font-bold text-foreground">{t('ai.advanced.contextLength.title')}</p>
            <p className="text-xs text-muted mt-1">{t('ai.advanced.contextLength.desc')}</p>
          </div>
          <div className="flex items-center gap-2">
            {[10, 20, 50].map(len => (
              <button
                key={len}
                onClick={() => onChatContextLengthChange?.(len)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  chatContextLength === len
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white border border-teal-900/10 text-muted hover:bg-teal-900/5'
                }`}
              >
                {t('ai.advanced.contextLength.item', { n: len })}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AiTab;
