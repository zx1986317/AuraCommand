import React, { useState, useMemo } from 'react';
import { FolderOpen, Cloud, Database, Download, Upload } from 'lucide-react';
import type { VaultStats } from './SettingsTypes';

interface StorageTabProps {
  vaultPath: string;
  vaultStats?: VaultStats | undefined;
  onVaultSwitched?: ((newPath: string) => Promise<void> | void) | undefined;
}

const StorageTab: React.FC<StorageTabProps> = ({ vaultPath, vaultStats, onVaultSwitched }) => {
  const [isSwitchingVault, setIsSwitchingVault] = useState(false);

  const vaultPathDisplay = useMemo(() => {
    if (vaultPath.length > 40) {
      return '...' + vaultPath.slice(-37);
    }
    return vaultPath;
  }, [vaultPath]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">知识库管理</h4>
        </div>
        <div className="bg-teal-900/5 p-8 rounded-[2rem] border border-teal-900/5 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground block">当前库路径 (AuraVault)</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={vaultPathDisplay}
                readOnly
                className="flex-1 bg-white/70 border border-teal-900/10 rounded-2xl px-4 py-3 text-2xs font-mono outline-none text-muted"
              />
              <button
                onClick={async () => {
                  setIsSwitchingVault(true);
                  try {
                    const newPath = await window.ipcRenderer.invoke('select-directory');
                    if (!newPath || newPath === vaultPath) return;
                    const result = await window.ipcRenderer.invoke('switch-vault', newPath);
                    if (result.success) {
                      await onVaultSwitched?.(result.path || newPath);
                    } else {
                      alert('切换失败: ' + result.error);
                    }
                  } finally {
                    setIsSwitchingVault(false);
                  }
                }}
                disabled={isSwitchingVault}
                className="px-6 py-3 bg-accent text-white rounded-2xl text-xs font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 active:scale-95 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSwitchingVault ? '切换中...' : '更换目录'}
              </button>
            </div>
            <p className="text-2xs text-muted italic">切换目录后，系统将重新初始化数据库并重新扫描文件。</p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white/70 border border-teal-900/10 rounded-2xl p-4">
              <p className="text-2xs text-muted font-bold uppercase tracking-widest">文件数</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{vaultStats?.totalFiles ?? 0}</p>
            </div>
            <div className="bg-white/70 border border-teal-900/10 rounded-2xl p-4">
              <p className="text-2xs text-muted font-bold uppercase tracking-widest">已索引</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{vaultStats?.indexedCount ?? 0}</p>
            </div>
            <div className="bg-white/70 border border-teal-900/10 rounded-2xl p-4">
              <p className="text-2xs text-muted font-bold uppercase tracking-widest">待索引</p>
              <p className="mt-2 text-2xl font-bold text-orange-500">{vaultStats?.pendingCount ?? 0}</p>
            </div>
            <div className="bg-white/70 border border-teal-900/10 rounded-2xl p-4">
              <p className="text-2xs text-muted font-bold uppercase tracking-widest">总大小</p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {vaultStats?.totalSize
                  ? vaultStats.totalSize > 1024 * 1024
                    ? `${(vaultStats.totalSize / (1024 * 1024)).toFixed(1)} MB`
                    : `${Math.round(vaultStats.totalSize / 1024)} KB`
                  : '0 KB'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="bg-teal-900/5 border border-teal-900/5 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Database size={18} className="text-accent" />
              </div>
              <div>
                <p className="text-2xs text-muted font-bold uppercase">便签</p>
                <p className="text-xl font-bold text-foreground">{vaultStats?.totalMemos ?? 0}</p>
              </div>
            </div>
            <div className="bg-teal-900/5 border border-teal-900/5 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Database size={18} className="text-accent" />
              </div>
              <div>
                <p className="text-2xs text-muted font-bold uppercase">日程</p>
                <p className="text-xl font-bold text-foreground">{vaultStats?.totalSchedules ?? 0}</p>
              </div>
            </div>
            <div className="bg-teal-900/5 border border-teal-900/5 rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                vaultStats?.vectorStatus === 'active' ? 'bg-green-100 text-green-600' :
                vaultStats?.vectorStatus === 'empty' ? 'bg-amber-100 text-amber-600' :
                'bg-red-100 text-red-600'
              }`}>
                <Database size={18} />
              </div>
              <div>
                <p className="text-2xs text-muted font-bold uppercase">向量库</p>
                <p className="text-xs font-bold text-foreground capitalize">{vaultStats?.vectorStatus ?? 'unknown'}</p>
              </div>
            </div>
          </div>

          {vaultStats?.typeStats && vaultStats.typeStats.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {vaultStats.typeStats.map((stat, idx) => (
                <span key={idx} className="text-2xs px-2 py-1 bg-teal-900/5 text-muted rounded-full font-medium">
                  {stat.type}: {stat.count}
                </span>
              ))}
            </div>
          )}

          <div className="h-px bg-teal-900/5"></div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">一键备份库</p>
              <p className="text-xs text-muted mt-1">导出整个 AuraVault 目录为压缩包</p>
            </div>
            <button className="px-6 py-3 bg-white border border-teal-900/10 rounded-2xl text-xs font-bold text-muted hover:text-foreground hover:bg-white transition-all">
              立即导出
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Cloud size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">数据同步</h4>
        </div>
        <div className="bg-blue-500/5 p-8 rounded-[2rem] border border-blue-500/10 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground">本地备份</h5>
              <button
                onClick={async () => {
                  try {
                    const result = await window.ipcRenderer.invoke('sync-export');
                    if (result.success) {
                      const blob = new Blob([atob(result.data)], { type: 'application/octet-stream' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `auracommand_backup_${new Date().toISOString().split('T')[0]}.db`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  } catch (err) { alert('导出失败: ' + err); }
                }}
                className="w-full px-4 py-3 bg-white border border-teal-900/10 rounded-xl text-xs font-bold hover:bg-accent/5 transition-all flex items-center gap-2"
              >
                <Download size={14} className="text-accent" />
                导出数据库
              </button>
              <button
                onClick={async () => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.db';
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const base64 = btoa(String.fromCharCode(...new Uint8Array(reader.result as ArrayBuffer)));
                      const result = await window.ipcRenderer.invoke('sync-import', { base64Data: base64 });
                      alert(result.message || result.error);
                    };
                    reader.readAsArrayBuffer(file);
                  };
                  input.click();
                }}
                className="w-full px-4 py-3 bg-white border border-teal-900/10 rounded-xl text-xs font-bold hover:bg-accent/5 transition-all flex items-center gap-2"
              >
                <Upload size={14} className="text-accent" />
                导入数据库
              </button>
            </div>
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground">WebDAV 同步</h5>
              <input id="webdav-url" type="text" placeholder="WebDAV 地址" className="w-full px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30" />
              <div className="grid grid-cols-2 gap-2">
                <input id="webdav-user" type="text" placeholder="用户名" className="px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30" />
                <input id="webdav-pass" type="password" placeholder="密码" className="px-3 py-2 bg-white border border-teal-900/10 rounded-xl text-2xs outline-none focus:border-accent/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    const url = (document.getElementById('webdav-url') as HTMLInputElement)?.value;
                    const username = (document.getElementById('webdav-user') as HTMLInputElement)?.value;
                    const password = (document.getElementById('webdav-pass') as HTMLInputElement)?.value;
                    if (!url || !username || !password) { alert('请填写完整的 WebDAV 配置'); return; }
                    const result = await window.ipcRenderer.invoke('sync-to-webdav', { url, username, password });
                    alert(result.message || result.error);
                  }}
                  className="px-4 py-2 bg-accent text-white rounded-xl text-2xs font-bold hover:bg-accent/90 transition-all"
                >
                  上传备份
                </button>
                <button
                  onClick={async () => {
                    const url = (document.getElementById('webdav-url') as HTMLInputElement)?.value;
                    const username = (document.getElementById('webdav-user') as HTMLInputElement)?.value;
                    const password = (document.getElementById('webdav-pass') as HTMLInputElement)?.value;
                    if (!url || !username || !password) { alert('请填写完整的 WebDAV 配置'); return; }
                    const result = await window.ipcRenderer.invoke('sync-from-webdav', { url, username, password });
                    alert(result.message || result.error);
                  }}
                  className="px-4 py-2 bg-white border border-teal-900/10 text-muted rounded-xl text-2xs font-bold hover:bg-accent/5 transition-all"
                >
                  恢复数据
                </button>
              </div>
            </div>
          </div>
          <p className="text-2xs text-muted italic">同步会自动备份当前数据库。恢复数据后需重启应用生效。</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Database size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">数据清理</h4>
        </div>
        <div className="bg-red-500/5 p-8 rounded-[2rem] border border-red-500/10 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-600">清空所有索引</p>
              <p className="text-xs text-red-500/60 mt-1">仅删除向量数据库索引，不删除源文件</p>
            </div>
            <button className="px-6 py-3 bg-red-500 text-white rounded-2xl text-xs font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95">
              立即清空
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StorageTab;
