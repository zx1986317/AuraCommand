import React from 'react';
import { Globe, ShieldCheck, Sparkles, Bell } from 'lucide-react';

interface GeneralTabProps {
  onOpenOnboarding?: (() => void) | undefined;
}

const GeneralTab: React.FC<GeneralTabProps> = ({ onOpenOnboarding }) => {
  const [taskNotifyEnabled, setTaskNotifyEnabled] = React.useState(true);

  React.useEffect(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.invoke('get-task-notify-enabled').then((result: any) => {
        if (result?.enabled !== undefined) {
          setTaskNotifyEnabled(result.enabled);
        }
      }).catch(() => {});
    }
  }, []);

  const handleToggleTaskNotify = async (enabled: boolean) => {
    setTaskNotifyEnabled(enabled);
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('set-task-notify-enabled', enabled);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">首次引导</h4>
        </div>
        <div className="flex items-center justify-between gap-6 bg-accent/5 p-6 rounded-[2rem] border border-accent/10">
          <div>
            <p className="text-sm font-bold text-foreground">重新查看产品引导</p>
            <p className="text-xs text-muted mt-1">再次查看"示例工作区、AI 诊断、开始使用"三步 onboarding，适合回看和演示。</p>
          </div>
          <button
            onClick={() => onOpenOnboarding?.()}
            className="shrink-0 px-5 py-3 bg-white border border-teal-900/10 rounded-2xl text-xs font-bold text-foreground hover:bg-teal-900/5 transition-all"
          >
            重新打开引导
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">通知设置</h4>
        </div>
        <div className="space-y-4 bg-teal-900/5 p-6 rounded-[2rem] border border-teal-900/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">逾期任务提醒</p>
              <p className="text-xs text-muted mt-1">每小时检查逾期待办并发送桌面通知</p>
            </div>
            <button
              onClick={() => handleToggleTaskNotify(!taskNotifyEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors ${taskNotifyEnabled ? 'bg-accent' : 'bg-teal-900/10'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${taskNotifyEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">基础设置</h4>
        </div>
        <div className="space-y-4 bg-teal-900/5 p-6 rounded-[2rem] border border-teal-900/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">开机自启动</p>
              <p className="text-xs text-muted mt-1">系统启动时自动运行 AuraCommand</p>
            </div>
            <div className="w-12 h-6 bg-accent/20 rounded-full relative cursor-not-allowed">
              <div className="absolute right-1 top-1 w-4 h-4 bg-accent rounded-full"></div>
            </div>
          </div>
          <div className="h-px bg-teal-900/5"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">语言 (Language)</p>
              <p className="text-xs text-muted mt-1">界面显示语言</p>
            </div>
            <select className="bg-white border border-teal-900/10 rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:border-accent/50 transition-all">
              <option>简体中文</option>
              <option>English</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">隐私与安全</h4>
        </div>
        <div className="bg-teal-900/5 p-6 rounded-[2rem] border border-teal-900/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">本地数据加密</p>
              <p className="text-xs text-muted mt-1">使用系统密钥加密本地 SQLite 数据库</p>
            </div>
            <div className="w-12 h-6 bg-teal-900/10 rounded-full relative cursor-not-allowed">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GeneralTab;
