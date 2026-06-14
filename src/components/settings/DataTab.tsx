import React from 'react';
import { Download, Upload } from 'lucide-react';

const DataTab: React.FC = () => {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Download size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">数据导出</h4>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-5 bg-teal-900/[0.02] rounded-2xl border border-teal-900/5">
            <div>
              <p className="text-sm font-bold text-foreground">导出便签为 Markdown</p>
              <p className="text-xs text-muted mt-1">将所有便签导出为 .md 文件，每个便签一个文件</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await window.ipcRenderer.invoke('export-quick-notes-markdown');
                  if (result.success) {
                    alert(`导出成功！共导出 ${result.count} 条便签到:\n${result.dir}`);
                  } else {
                    alert(`导出失败: ${result.error}`);
                  }
                } catch (err: any) {
                  alert(`导出失败: ${err.message}`);
                }
              }}
              className="px-4 py-2 bg-accent/10 text-accent rounded-xl text-xs font-bold hover:bg-accent/20 transition-all"
            >
              导出便签
            </button>
          </div>

          <div className="flex items-center justify-between p-5 bg-teal-900/[0.02] rounded-2xl border border-teal-900/5">
            <div>
              <p className="text-sm font-bold text-foreground">导出日程为 Markdown</p>
              <p className="text-xs text-muted mt-1">将所有日程导出为 .md 文件，按日期分组</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await window.ipcRenderer.invoke('export-schedules-markdown');
                  if (result.success) {
                    alert(`导出成功！共导出 ${result.count} 条日程到:\n${result.dir}`);
                  } else {
                    alert(`导出失败: ${result.error}`);
                  }
                } catch (err: any) {
                  alert(`导出失败: ${err.message}`);
                }
              }}
              className="px-4 py-2 bg-accent/10 text-accent rounded-xl text-xs font-bold hover:bg-accent/20 transition-all"
            >
              导出日程
            </button>
          </div>

          <div className="flex items-center justify-between p-5 bg-teal-900/[0.02] rounded-2xl border border-teal-900/5">
            <div>
              <p className="text-sm font-bold text-foreground">完整备份 Vault</p>
              <p className="text-xs text-muted mt-1">将整个 Vault 目录打包为 .zip 备份文件</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await window.ipcRenderer.invoke('backup-vault');
                  if (result.success) {
                    alert(`备份成功！文件位于:\n${result.path}`);
                  } else {
                    alert(`备份失败: ${result.error}`);
                  }
                } catch (err: any) {
                  alert(`备份失败: ${err.message}`);
                }
              }}
              className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent/90 transition-all shadow-sm"
            >
              创建备份
            </button>
          </div>

          <div className="flex items-center justify-between p-5 bg-teal-900/[0.02] rounded-2xl border border-teal-900/5">
            <div>
              <p className="text-sm font-bold text-foreground">从备份恢复</p>
              <p className="text-xs text-muted mt-1">选择之前备份的 JSON 文件，恢复便签、日程和数据</p>
            </div>
            <button
              onClick={async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e: any) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    if (!parsed.version || parsed.version !== 1) {
                      alert('无效的备份文件格式');
                      return;
                    }
                    const result = await window.ipcRenderer.invoke('restore-vault', { data: text });
                    if (result.success) {
                      alert(`恢复成功！\n便签: ${result.memosCount} 条\n日程: ${result.schedulesCount} 条\n文件记录: ${result.filesCount} 条`);
                      window.location.reload();
                    } else {
                      alert(`恢复失败: ${result.error}`);
                    }
                  } catch (err: any) {
                    alert(`恢复失败: ${err.message}`);
                  }
                };
                input.click();
              }}
              className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all border border-amber-200/50"
            >
              选择备份文件
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Upload size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">数据导入</h4>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-5 bg-teal-900/[0.02] rounded-2xl border border-teal-900/5">
            <div>
              <p className="text-sm font-bold text-foreground">从 Markdown 导入便签</p>
              <p className="text-xs text-muted mt-1">选择 .md 文件或文件夹，自动创建为便签</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await window.ipcRenderer.invoke('import-quick-notes-markdown');
                  if (result.success) {
                    alert(`导入成功！共导入 ${result.count} 条便签`);
                  } else if (result.cancelled) {
                    return;
                  } else {
                    alert(`导入失败: ${result.error}`);
                  }
                } catch (err: any) {
                  alert(`导入失败: ${err.message}`);
                }
              }}
              className="px-4 py-2 bg-accent/10 text-accent rounded-xl text-xs font-bold hover:bg-accent/20 transition-all"
            >
              导入便签
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DataTab;
