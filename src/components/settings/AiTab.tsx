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
} from 'lucide-react';
import { getDefaultBaseUrl, getDefaultModel } from './SettingsTypes';
import type { ModelStatus, OllamaReadiness, DiagnosisItem, VaultStats } from './SettingsTypes';

interface ModelCapabilities {
  chat: boolean;
  vision: boolean;
  imageGen: boolean;
  embedding: boolean;
  videoGen: boolean;
}

const CAPABILITY_OPTIONS: Array<{ key: keyof ModelCapabilities; label: string; desc: string }> = [
  { key: 'chat', label: '对话', desc: '文本对话能力' },
  { key: 'vision', label: '图片识别', desc: '理解图片内容' },
  { key: 'imageGen', label: '图片生成', desc: '文生图能力' },
  { key: 'embedding', label: '嵌入', desc: '文本向量化' },
  { key: 'videoGen', label: '视频生成', desc: '文/图生视频' },
];

function CapabilitiesSelector({ value, onChange }: { value: ModelCapabilities; onChange: (caps: ModelCapabilities) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-muted">模型能力（可多选）</label>
      <div className="flex flex-wrap gap-2">
        {CAPABILITY_OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange({ ...value, [opt.key]: !value[opt.key] })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              value[opt.key]
                ? 'bg-accent text-white'
                : 'bg-white border border-teal-900/10 text-muted hover:border-accent/30'
            }`}
            title={opt.desc}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
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
  const [ollamaApiUrl, setOllamaApiUrl] = useState('http://127.0.0.1:11434');
  const [ollamaTestStatus, setOllamaTestStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [gpuMode, setGpuMode] = useState<'auto' | 'gpu' | 'cpu'>('auto');
  const [modelParams, setModelParams] = useState<{ temperature?: number; top_p?: number; num_predict?: number }>({});
  const [diagnosisItems, setDiagnosisItems] = useState<DiagnosisItem[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([]);

  const [cloudModels, setCloudModels] = useState<Array<{
    id: string; name: string; provider: string; apiKey: string; baseUrl: string; modelName: string;
    capabilities: { chat: boolean; vision: boolean; imageGen: boolean; embedding: boolean; videoGen: boolean };
    testStatus: 'idle' | 'testing' | 'connected' | 'failed'
  }>>([]);
  const [showAddCloud, setShowAddCloud] = useState(false);
  const defaultCapabilities = { chat: true, vision: false, imageGen: false, embedding: false, videoGen: false };
  const [addCloudForm, setAddCloudForm] = useState({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } });
  const [addCloudTestStatus, setAddCloudTestStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } });

  useEffect(() => {
    window.ipcRenderer.invoke('get-cloud-models').then((models: any[]) => {
      if (models && models.length > 0) {
        setCloudModels(models.map((m: any) => ({ ...m, testStatus: 'connected' as const })));
      }
    }).catch(() => {});
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
        alert('保存失败: ' + (result?.error || '返回数据异常'));
      }
    } catch (err: any) {
      console.error('[AiTab] save-cloud-model error:', err);
      alert('保存失败: ' + (err?.message || '未知错误'));
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
      apiKey: model.apiKey || '',
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
        alert('保存失败: ' + (result?.error || '返回数据异常'));
      }
    } catch (err: any) {
      console.error('[AiTab] save edit error:', err);
      alert('保存失败: ' + (err?.message || '未知错误'));
    }
  };

  const testCloudConnection = async (index: number) => {
    const cm = cloudModels[index];
    if (!cm) return;
    setCloudModels(prev => prev.map((m, i) => i === index ? { ...m, testStatus: 'testing' as const } : m));
    try {
      const result = await window.ipcRenderer.invoke('test-cloud-model', {
        provider: cm.provider,
        apiKey: cm.apiKey,
        baseUrl: cm.baseUrl || getDefaultBaseUrl(cm.provider),
        model: cm.modelName || getDefaultModel(cm.provider),
      });
      setCloudModels(prev => prev.map((m, i) => i === index ? { ...m, testStatus: result.success ? 'connected' as const : 'failed' as const } : m));
      if (result.success) {
        alert('连接测试成功！');
      } else {
        alert('连接测试失败: ' + (result.error || '未知错误'));
      }
    } catch (err: any) {
      setCloudModels(prev => prev.map((m, i) => i === index ? { ...m, testStatus: 'failed' as const } : m));
    }
  };

  const testAddCloudConnection = async () => {
    setAddCloudTestStatus('testing');
    try {
      const result = await window.ipcRenderer.invoke('test-cloud-model', {
        provider: addCloudForm.provider,
        apiKey: addCloudForm.apiKey,
        baseUrl: addCloudForm.baseUrl || getDefaultBaseUrl(addCloudForm.provider),
        model: addCloudForm.modelName || getDefaultModel(addCloudForm.provider),
      });
      setAddCloudTestStatus(result.success ? 'connected' : 'failed');
      if (result.success) {
        alert('连接测试成功！');
      } else {
        alert('连接测试失败: ' + (result.error || '未知错误'));
      }
    } catch (err: any) {
      setAddCloudTestStatus('failed');
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
        title: 'Ollama 服务',
        status: 'ready',
        detail: `服务运行正常，已安装 ${models.length} 个模型`,
        action: '已就绪',
      });
      if (hasChat) {
        items.push({ title: '对话模型', status: 'ready', detail: '检测到对话模型可用', action: '已就绪' });
      } else {
        items.push({ title: '对话模型', status: 'error', detail: '未检测到对话模型，请先安装至少一个本地对话模型', action: '安装模型' });
      }
      if (hasEmbedding) {
        items.push({ title: '向量模型', status: 'ready', detail: '检测到嵌入模型可用', action: '已就绪' });
      } else {
        items.push({ title: '向量模型', status: 'warning', detail: '未检测到嵌入模型，RAG 功能不可用', action: '安装嵌入模型' });
      }
      setDiagnosisItems(items);
    } catch {
      setDiagnosisItems([{
        title: 'Ollama 服务',
        status: 'error',
        detail: '无法连接 Ollama 服务，请确认已启动',
        action: '启动服务',
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
        const chatRec = models.find((m: string) => !m.includes('embed')) || '请先安装任意对话模型';
        const embedRec = models.find((m: string) => m.includes('embed')) || '请先安装任意向量模型';
        setModelStatuses([
          { category: '对话模型', recommend: chatRec, installed: models.some(m => !m.includes('embed')), pullCommand: models.some(m => !m.includes('embed')) ? `已安装：${chatRec}` : 'ollama pull <对话模型名>' },
          { category: '向量模型', recommend: embedRec, installed: models.some(m => m.includes('embed')), pullCommand: models.some(m => m.includes('embed')) ? `已安装：${embedRec}` : 'ollama pull <向量模型名>' },
        ]);
      })
      .catch(() => setModelStatuses([]))
      .finally(() => setLoadingModels(false));
  }, [cloudModels.length]);

  const [loadingModels, setLoadingModels] = useState(false);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-accent" />
            <h4 className="text-xs font-bold text-muted uppercase tracking-widest">当前能力</h4>
          </div>
          <button
            onClick={handleRunDiagnosis}
            disabled={isDiagnosing}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-teal-900/10 rounded-xl text-2xs font-bold text-muted hover:bg-teal-900/5 transition-all disabled:opacity-50"
          >
            {isDiagnosing ? <Loader2 size={12} className="animate-spin text-accent" /> : <Sparkles size={12} className="text-accent" />}
            {isDiagnosing ? '诊断中' : '一键诊断'}
          </button>
        </div>
        {(() => {
          const hasChat = ollamaStatus?.chatModelReady || cloudModels.length > 0;
          const hasEmbedding = ollamaStatus?.embeddingModelReady;
          const chatSource = cloudModels.length > 0
            ? `云端 ${cloudModels.length} 个模型`
            : ollamaStatus?.chatModelReady ? '本地 Ollama' : '未配置';
          const expansionSource = cloudModels.length > 0
            ? `云端 ${cloudModels.length} 个模型`
            : ollamaStatus?.chatModelReady ? '本地 Ollama' : '未配置';
          const items = [
            { label: '对话生成', ok: hasChat, source: chatSource },
            { label: 'Query Expansion', ok: hasChat, source: expansionSource },
            { label: 'FTS5 全文检索', ok: true, source: '本地（始终可用）' },
            { label: '向量语义搜索', ok: hasEmbedding, source: hasEmbedding ? '本地 Ollama' : '需本地 Ollama' },
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
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">模型配置</h4>
        </div>
        <div className="space-y-4">
          <details open={ollamaStatus?.connected} className="group bg-teal-900/5 rounded-2xl border border-teal-900/5 overflow-hidden">
            <summary className="flex items-center justify-between px-6 py-4 cursor-pointer select-none list-none">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${ollamaStatus?.connected ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Cpu size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">本地 Ollama</p>
                  <p className="text-2xs text-muted">{ollamaStatus?.connected ? '已连接 · 完整 RAG 能力' : '未连接 · 可选配置'}</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground block">API 服务地址</label>
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
                    {ollamaTestStatus === 'testing' ? '检测中' : ollamaTestStatus === 'connected' ? '已连接' : ollamaTestStatus === 'failed' ? '未连接' : '测试'}
                  </button>
                </div>
                <p className="text-2xs text-muted">默认端口通常为 11434，修改后点击测试验证连接</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground block">计算资源</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'auto', label: '自动', desc: 'Ollama 自动选择' },
                    { value: 'gpu', label: 'GPU', desc: '使用显卡加速' },
                    { value: 'cpu', label: 'CPU', desc: '纯 CPU 运行' },
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
                <p className="text-2xs text-muted">切换后下次请求生效。无 GPU 时会自动降级</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-foreground">模型参数</label>
                  <details className="relative">
                    <summary className="text-2xs text-muted cursor-pointer hover:text-accent list-none flex items-center gap-1">
                      <Sparkles size={12} />
                      {Object.keys(modelParams).length > 0 ? '已配置' : '默认'}
                    </summary>
                    <div className="absolute right-0 top-6 w-64 bg-white rounded-xl border border-teal-900/10 shadow-lg p-4 space-y-4 z-10">
                      <p className="text-2xs text-muted">调节参数会影响模型输出行为</p>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-2xs mb-1">
                            <span className="text-muted">Temperature</span>
                            <span className="font-mono">{modelParams.temperature ?? '默认'}</span>
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
                          <p className="text-2xs text-muted mt-0.5">低=确定，高=创意</p>
                        </div>
                        <div>
                          <div className="flex justify-between text-2xs mb-1">
                            <span className="text-muted">Top P</span>
                            <span className="font-mono">{modelParams.top_p ?? '默认'}</span>
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
                          <p className="text-2xs text-muted mt-0.5">候选词范围</p>
                        </div>
                        <div>
                          <div className="flex justify-between text-2xs mb-1">
                            <span className="text-muted">Max Tokens</span>
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
                          <p className="text-2xs text-muted mt-0.5">最大输出长度</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleModelParamChange('temperature', undefined)}
                        className="w-full text-2xs text-muted hover:text-accent transition-colors"
                      >
                        重置为默认
                      </button>
                    </div>
                  </details>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground block">默认推理模型</label>
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
                  <p className="text-2xs font-bold text-muted uppercase tracking-widest">已安装模型</p>
                  {modelStatuses.map((status, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl border border-teal-900/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${status.installed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {status.installed ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground">{status.category}</p>
                          <p className="text-2xs text-muted">推荐: <span className="font-mono">{status.recommend}</span></p>
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
                          <span>安装</span>
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
                  <p className="text-sm font-bold text-foreground">云端 API</p>
                  <p className="text-2xs text-muted">{cloudModels.length > 0 ? `已配置 ${cloudModels.length} 个模型` : '可选配置'}</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-6 space-y-4">
              {cloudModels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-2xs font-bold text-muted uppercase tracking-widest">已配置的云端模型</p>
                  {cloudModels.map((cm, idx) => (
                    <div key={cm.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-teal-900/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cm.testStatus === 'connected' ? 'bg-emerald-100 text-emerald-600' : cm.testStatus === 'failed' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {cm.testStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : cm.testStatus === 'connected' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{cm.name || cm.modelName}</p>
                          <p className="text-2xs text-muted">{cm.provider} · {cm.modelName}</p>
                          {cm.capabilities && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {CAPABILITY_OPTIONS.filter(opt => cm.capabilities[opt.key]).map(opt => (
                                <span key={opt.key} className="px-1.5 py-0.5 rounded text-2xs bg-accent/10 text-accent">
                                  {opt.label}
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
                          title="测试连接"
                        >
                          {cm.testStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : cm.testStatus === 'connected' ? <Wifi size={12} className="text-green-500" /> : <WifiOff size={12} className="text-red-500" />}
                        </button>
                        <button
                          onClick={() => handleStartEdit(cm)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-muted hover:text-blue-500 transition-colors"
                          title="编辑"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`确定删除 "${cm.name || cm.modelName}"?`)) handleDeleteCloudModel(cm.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                          title="删除"
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
                      <p className="text-sm font-bold text-foreground">编辑模型</p>
                      <button onClick={handleCancelEdit} className="p-1.5 rounded-lg hover:bg-teal-900/5 text-muted">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="显示名称（如：GPT-4o）" className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
                      <select value={editForm.provider} onChange={e => setEditForm(f => ({ ...f, provider: e.target.value }))} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-accent/50">
                        <option value="">选择提供商</option>
                        <option value="openai">OpenAI</option>
                        <option value="claude">Claude (Anthropic)</option>
                        <option value="zhipu">智谱 AI</option>
                        <option value="dashscope">通义千问</option>
                        <option value="custom">自定义 (OpenAI 兼容)</option>
                      </select>
                      {editForm.provider && (
                        <>
                          <input type="password" value={editForm.apiKey} onChange={e => setEditForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="API Key" className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50" />
                          <input type="text" value={editForm.baseUrl} onChange={e => setEditForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder={`Base URL（留空使用默认 ${getDefaultBaseUrl(editForm.provider)}）`} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50" />
                          <input type="text" value={editForm.modelName} onChange={e => setEditForm(f => ({ ...f, modelName: e.target.value }))} placeholder={`模型标识（如 ${getDefaultModel(editForm.provider)}）`} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50" />
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
                          取消
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editForm.provider || !editForm.apiKey || !editForm.modelName}
                          className="flex-1 px-3 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all disabled:opacity-50"
                        >
                          保存修改
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {showAddCloud ? (
                <div className="p-4 bg-white rounded-2xl border border-teal-900/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">添加云端模型</p>
                    <button onClick={() => { setShowAddCloud(false); setAddCloudForm({ name: '', provider: '', apiKey: '', baseUrl: '', modelName: '', capabilities: { ...defaultCapabilities } }); setAddCloudTestStatus('idle') }} className="text-2xs text-muted hover:text-foreground">取消</button>
                  </div>
                  <div className="space-y-2">
                    <input type="text" value={addCloudForm.name} onChange={e => setAddCloudForm(f => ({ ...f, name: e.target.value }))} placeholder="显示名称（如：GPT-4o）" className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
                  </div>
                  <div className="space-y-2">
                    <select value={addCloudForm.provider} onChange={e => setAddCloudForm(f => ({ ...f, provider: e.target.value }))} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-accent/50">
                      <option value="">选择提供商</option>
                      <option value="openai">OpenAI</option>
                      <option value="claude">Claude (Anthropic)</option>
                      <option value="zhipu">智谱 AI</option>
                      <option value="dashscope">通义千问</option>
                      <option value="custom">自定义 (OpenAI 兼容)</option>
                    </select>
                  </div>
                  {addCloudForm.provider && (
                    <>
                      <input type="password" value={addCloudForm.apiKey} onChange={e => setAddCloudForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="API Key" className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50" />
                      <input type="text" value={addCloudForm.baseUrl} onChange={e => setAddCloudForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder={`Base URL（留空使用默认 ${getDefaultBaseUrl(addCloudForm.provider)}）`} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50" />
                      <input type="text" value={addCloudForm.modelName} onChange={e => setAddCloudForm(f => ({ ...f, modelName: e.target.value }))} placeholder={`模型标识（如 ${getDefaultModel(addCloudForm.provider)}）`} className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50" />
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
                          {addCloudTestStatus === 'testing' ? '检测中' : addCloudTestStatus === 'connected' ? '已连接' : '测试'}
                        </button>
                        <button
                          onClick={handleAddCloudModel}
                          disabled={!addCloudForm.provider || !addCloudForm.apiKey || !addCloudForm.modelName}
                          className="flex-1 px-3 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all disabled:opacity-50"
                        >
                          保存
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowAddCloud(true)}
                  className="w-full px-4 py-3 rounded-xl border border-dashed border-teal-900/10 text-xs font-bold text-muted hover:text-accent hover:border-accent/30 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  添加云端模型
                </button>
              )}
            </div>
          </details>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">高级配置</h4>
        </div>

        <div className="bg-teal-900/5 p-6 rounded-2xl border border-teal-900/5 space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-bold text-foreground">显示推理过程</p>
              <p className="text-xs text-muted mt-1">聊天中展示模型推理阶段和内容</p>
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
            <p className="text-sm font-bold text-foreground">对话记忆长度</p>
            <p className="text-xs text-muted mt-1">较长的记忆会消耗更多 token，但能保持更好的上下文连贯性</p>
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
                {len}条
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AiTab;
