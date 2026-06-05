import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileJson, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import type { McpServerConfig } from '../types';

interface ManualFormState {
  name: string
  transport: 'stdio' | 'sse'
  command: string
  args: string
  env: string
  url: string
  auto_connect: boolean
}

interface ManualFormErrors {
  name?: string
  command?: string
  args?: string
  env?: string
  url?: string
}

const EMPTY_MANUAL_FORM: ManualFormState = {
  name: '',
  transport: 'stdio',
  command: '',
  args: '[]',
  env: '{}',
  url: '',
  auto_connect: true,
};

function sanitizeJsonImport(raw: string): string {
  let cleaned = raw.trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);

  return cleaned
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/"([^"\\]|\\.)*"/g, (match) => match.replace(/__COMMENT_SENTINEL__/g, '__ESCAPED_COMMENT_SENTINEL__'))
    .replace(/("(?:[^"\\]|\\.)*")|\/\/.*$/gm, (match, quoted) => quoted || '')
    .replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\//g, (match, quoted) => quoted || '')
    .replace(/__ESCAPED_COMMENT_SENTINEL__/g, '__COMMENT_SENTINEL__')
    .replace(/"\s*`([^`]+)`\s*"/g, (_, value: string) => JSON.stringify(value.trim()))
    .replace(/,\s*([}\]])/g, '$1');
}

function collectEnvPlaceholders(text: string): string[] {
  return Array.from(String(text || '').matchAll(/\$\{([^}]+)\}/g))
    .map(match => match[1]?.trim())
    .filter((name): name is string => !!name);
}

function buildImportedServerConfig(name: string, srv: any): { server: McpServerConfig; usedProxy: boolean } {
  const hasRemoteUrl = typeof srv.url === 'string' && !!srv.url.trim();
  const headers = srv.headers && typeof srv.headers === 'object' && !Array.isArray(srv.headers)
    ? Object.entries(srv.headers).filter(([key]) => !!String(key || '').trim())
    : [];
  const shouldUseRemoteProxy = hasRemoteUrl && headers.length > 0;

  let env: Record<string, string> = typeof srv.env === 'object' && srv.env !== null && !Array.isArray(srv.env)
    ? Object.fromEntries(Object.entries(srv.env).map(([key, value]) => [key, String(value ?? '')]))
    : {};

  if (shouldUseRemoteProxy) {
    const args = ['-y', 'mcp-remote', String(srv.url).trim()];
    for (const [headerKey, headerValue] of headers) {
      const value = String(headerValue ?? '').trim();
      if (!value) continue;
      args.push('--header', `${String(headerKey).trim()}: ${value}`);
      for (const envName of collectEnvPlaceholders(value)) {
        if (!(envName in env)) env[envName] = '';
      }
    }

    return {
      usedProxy: true,
      server: {
        name,
        transport: 'stdio',
        auto_connect: srv.autoConnect ?? true,
        command: 'npx',
        args,
        env,
      },
    };
  }

  return {
    usedProxy: false,
    server: {
      name,
      transport: hasRemoteUrl || srv.transport === 'sse' ? 'sse' : 'stdio',
      auto_connect: srv.autoConnect ?? true,
      command: hasRemoteUrl || srv.transport === 'sse' ? '' : (srv.command || ''),
      args: hasRemoteUrl || srv.transport === 'sse' ? [] : (Array.isArray(srv.args) ? srv.args : []),
      env,
      url: hasRemoteUrl ? String(srv.url).trim() : '',
    },
  };
}

function validateManualForm(form: ManualFormState): {
  valid: boolean
  fieldErrors: ManualFormErrors
  parsedArgs: string[]
  parsedEnv: Record<string, string>
} {
  const fieldErrors: ManualFormErrors = {};
  let parsedArgs: string[] = [];
  let parsedEnv: Record<string, string> = {};

  if (!form.name.trim()) {
    fieldErrors.name = '请输入服务名称';
  }

  if (form.transport === 'sse') {
    if (!form.url.trim()) {
      fieldErrors.url = '请输入 SSE 地址';
    } else {
      try {
        new URL(form.url);
      } catch {
        fieldErrors.url = '请输入有效的 URL';
      }
    }
  } else {
    if (!form.command.trim()) {
      fieldErrors.command = '请输入命令';
    }
    try {
      parsedArgs = JSON.parse(form.args);
      if (!Array.isArray(parsedArgs)) {
        fieldErrors.args = 'args 必须是 JSON 数组';
      }
    } catch {
      fieldErrors.args = 'args 必须是有效的 JSON 数组';
    }
    try {
      parsedEnv = JSON.parse(form.env);
      if (typeof parsedEnv !== 'object' || Array.isArray(parsedEnv)) {
        fieldErrors.env = 'env 必须是有效的 JSON 对象';
      }
    } catch {
      fieldErrors.env = 'env 必须是有效的 JSON 对象';
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    parsedArgs,
    parsedEnv,
  };
}

interface McpServerModalProps {
  isOpen: boolean;
  editingServer?: McpServerConfig | null;
  onClose: () => void;
  onSave: (server: McpServerConfig) => Promise<{ success: boolean; error?: string }>;
  onNotification: (notification: { message: string; type: 'info' | 'error' | 'warning' } | null) => void;
}

type AddMode = 'manual' | 'json';

export const McpServerModal: React.FC<McpServerModalProps> = ({
  isOpen,
  editingServer,
  onClose,
  onSave,
  onNotification,
}) => {
  const [form, setForm] = useState<ManualFormState>(EMPTY_MANUAL_FORM);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ManualFormErrors>({});
  const [addMode, setAddMode] = useState<AddMode>('manual');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingServer) {
        setForm({
          name: editingServer.name || '',
          transport: editingServer.transport || 'stdio',
          command: editingServer.command || '',
          args: JSON.stringify(editingServer.args || [], null, 2),
          env: JSON.stringify(editingServer.env || {}, null, 2),
          url: editingServer.url || '',
          auto_connect: editingServer.auto_connect ?? true,
        });
      } else {
        setForm(EMPTY_MANUAL_FORM);
      }
      setFormError('');
      setFieldErrors({});
      setJsonInput('');
      setJsonError('');
      setAddMode('manual');
    }
  }, [isOpen, editingServer]);

  const clearFieldError = (field: keyof ManualFormErrors) => {
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const resetForm = () => {
    setForm(EMPTY_MANUAL_FORM);
    setFormError('');
    setFieldErrors({});
    setJsonInput('');
    setJsonError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (addMode === 'json' && !editingServer) {
      setJsonError('');
      if (!jsonInput.trim()) {
        setJsonError('请输入 JSON 配置');
        return;
      }
      const cleaned = sanitizeJsonImport(jsonInput)
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr: any) {
        setJsonError('JSON 格式无效：' + (parseErr?.message || '请检查语法'));
        return;
      }
      const servers = parsed?.mcpServers;
      if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
        setJsonError('配置必须包含 mcpServers 对象');
        return;
      }
      setSaving(true);
      try {
        const proxyBackedServers: string[] = [];
        for (const [name, config] of Object.entries(servers)) {
          const srv = config as Record<string, unknown>;
          const { server, usedProxy } = buildImportedServerConfig(String(name), srv);
          if (usedProxy) proxyBackedServers.push(String(name));
          const result = await onSave(server);
          if (!result.success) {
            setJsonError(result.error || `保存 "${name}" 失败`);
            return;
          }
        }
        if (proxyBackedServers.length > 0) {
          onNotification({
            type: 'info',
            message: `已将 ${proxyBackedServers.join('、')} 自动转换为 mcp-remote 代理配置，以支持远程 MCP 请求头。`,
          });
        }
        handleClose();
      } finally {
        setSaving(false);
      }
      return;
    }

    const { fieldErrors: nextFieldErrors, parsedArgs, parsedEnv } = validateManualForm(form);
    setFormError('');

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSaving(true);
    try {
      const transport = form.transport;
      const url = form.url || '';
      const server: McpServerConfig = {
        ...(editingServer?.id ? { id: editingServer.id } : {}),
        name: form.name.trim(),
        transport,
        auto_connect: form.auto_connect,
        ...(transport === 'sse'
          ? { url }
          : {
              command: form.command.trim(),
              args: parsedArgs,
              env: parsedEnv,
            }),
      };

      const result = await onSave(server);
      if (!result.success) {
        setFormError(result.error || '保存失败，请检查配置后重试');
        return;
      }
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white/95 backdrop-blur-2xl border border-teal-900/10 rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.15)] overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-teal-900/5 shrink-0">
            <h3 className="text-base font-bold text-foreground">
              {editingServer ? '编辑 Server' : '添加 Server'}
            </h3>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-black/5 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!editingServer && (
              <div className="flex bg-white rounded-xl border border-teal-900/10 overflow-hidden shrink-0">
                <button
                  onClick={() => { setAddMode('manual'); setJsonError(''); }}
                  className={`flex-1 px-3 py-2 text-xs font-bold transition-all ${addMode === 'manual' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
                >
                  手动填写
                </button>
                <button
                  onClick={() => { setAddMode('json'); setJsonError(''); }}
                  className={`flex-1 px-3 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1 ${addMode === 'json' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
                >
                  <FileJson size={12} />
                  JSON 导入
                </button>
              </div>
            )}

            {editingServer || addMode === 'manual' ? (
              <div className="space-y-4">
                <div className="bg-white/80 rounded-2xl border border-teal-900/10 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">基础信息</p>
                    <p className="text-2xs text-muted mt-1">先定义服务名称，再选择连接方式。</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted block mb-1">名称</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => {
                        const value = e.target.value;
                        setForm(f => ({ ...f, name: value }));
                        if (fieldErrors.name) clearFieldError('name');
                        if (formError) setFormError('');
                      }}
                      className={`w-full bg-white rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50 ${
                        fieldErrors.name ? 'border border-red-200' : 'border border-teal-900/10'
                      }`}
                      placeholder="如：trends-hub"
                    />
                    {fieldErrors.name && <p className="mt-1 text-2xs text-red-500">{fieldErrors.name}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted block mb-1">传输方式</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, transport: 'stdio' }));
                          clearFieldError('url');
                          if (formError) setFormError('');
                        }}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${form.transport === 'stdio' ? 'border-accent/40 bg-accent/5 text-accent' : 'border-teal-900/10 bg-gray-50 text-muted'}`}
                      >
                        stdio (本地命令)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, transport: 'sse' }));
                          clearFieldError('command');
                          clearFieldError('args');
                          clearFieldError('env');
                          if (formError) setFormError('');
                        }}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${form.transport === 'sse' ? 'border-accent/40 bg-accent/5 text-accent' : 'border-teal-900/10 bg-gray-50 text-muted'}`}
                      >
                        SSE (远程地址)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 rounded-2xl border border-teal-900/10 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">连接配置</p>
                    <p className="text-2xs text-muted mt-1">
                      {form.transport === 'sse' ? '填写远程服务地址。' : '填写本地命令、参数和环境变量。'}
                    </p>
                  </div>
                  {form.transport === 'sse' ? (
                    <div>
                      <label className="text-xs font-bold text-muted block mb-1">SSE URL</label>
                      <input
                        type="text"
                        value={form.url}
                        onChange={e => {
                          const value = e.target.value;
                          setForm(f => ({ ...f, url: value }));
                          if (fieldErrors.url) clearFieldError('url');
                          if (formError) setFormError('');
                        }}
                        className={`w-full bg-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50 ${
                          fieldErrors.url ? 'border border-red-200' : 'border border-teal-900/10'
                        }`}
                        placeholder="http://localhost:3000/sse"
                      />
                      {fieldErrors.url && <p className="mt-1 text-2xs text-red-500">{fieldErrors.url}</p>}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-bold text-muted block mb-1">命令 (command)</label>
                        <input
                          type="text"
                          value={form.command}
                          onChange={e => {
                            const value = e.target.value;
                            setForm(f => ({ ...f, command: value }));
                            if (fieldErrors.command) clearFieldError('command');
                            if (formError) setFormError('');
                          }}
                          className={`w-full bg-white rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-accent/50 ${
                            fieldErrors.command ? 'border border-red-200' : 'border border-teal-900/10'
                          }`}
                          placeholder="如：npx"
                        />
                        {fieldErrors.command && <p className="mt-1 text-2xs text-red-500">{fieldErrors.command}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted block mb-1">参数 (args, JSON 数组)</label>
                        <textarea
                          value={form.args}
                          onChange={e => {
                            const value = e.target.value;
                            setForm(f => ({ ...f, args: value }));
                            if (fieldErrors.args) clearFieldError('args');
                            if (formError) setFormError('');
                          }}
                          className={`w-full bg-white rounded-xl px-3 py-2 text-2xs font-mono outline-none focus:border-accent/50 min-h-[60px] ${
                            fieldErrors.args ? 'border border-red-200' : 'border border-teal-900/10'
                          }`}
                          placeholder='["-y", "mcp-trends-hub@1.6.2"]'
                        />
                        {fieldErrors.args && <p className="mt-1 text-2xs text-red-500">{fieldErrors.args}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted block mb-1">环境变量 (env, JSON 对象)</label>
                        <textarea
                          value={form.env}
                          onChange={e => {
                            const value = e.target.value;
                            setForm(f => ({ ...f, env: value }));
                            if (fieldErrors.env) clearFieldError('env');
                            if (formError) setFormError('');
                          }}
                          className={`w-full bg-white rounded-xl px-3 py-2 text-2xs font-mono outline-none focus:border-accent/50 min-h-[60px] ${
                            fieldErrors.env ? 'border border-red-200' : 'border border-teal-900/10'
                          }`}
                          placeholder='{"API_KEY": "xxx"}'
                        />
                        {fieldErrors.env && <p className="mt-1 text-2xs text-red-500">{fieldErrors.env}</p>}
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-white/80 rounded-2xl border border-teal-900/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-foreground">启动策略</p>
                      <p className="text-2xs text-muted mt-1">应用启动时自动连接此 Server。</p>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, auto_connect: !f.auto_connect }))}
                      className={`p-1.5 rounded-lg transition-all ${form.auto_connect ? 'text-green-600' : 'text-gray-300'}`}
                    >
                      {form.auto_connect ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/80 rounded-2xl border border-teal-900/10 p-4 space-y-3">
                <div>
                  <p className="text-xs font-bold text-foreground">JSON 导入</p>
                  <p className="text-2xs text-muted mt-1">支持直接粘贴 `mcpServers` 配置对象，一次导入多个服务。</p>
                </div>
                <textarea
                  value={jsonInput}
                  onChange={e => { setJsonInput(e.target.value); setJsonError(''); }}
                  className="w-full bg-white border border-teal-900/10 rounded-xl px-3 py-2 text-2xs font-mono outline-none focus:border-accent/50 min-h-[220px] resize-y"
                  placeholder={'粘贴 MCP JSON 配置，例如：\n{\n  "mcpServers": {\n    "trends-hub": {\n      "command": "npx",\n      "args": ["-y", "mcp-trends-hub@1.6.2"]\n    }\n  }\n}'}
                />
                {jsonError && (
                  <p className="text-xs text-red-500 font-medium px-1">{jsonError}</p>
                )}
              </div>
            )}

            {formError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-2xs text-red-600 leading-relaxed">{formError}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end p-6 border-t border-teal-900/5 shrink-0">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-xs font-bold text-muted hover:text-foreground transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold bg-accent text-white rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
