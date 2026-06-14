import React from 'react';
import { Globe, ShieldCheck, Sparkles, Bell, Keyboard, Palette } from 'lucide-react';
import { LocaleSwitcher } from '../../i18n/LocaleSwitcher';
import ThemeSwitcher from '../../i18n/ThemeSwitcher';
import { useTranslation } from '../../i18n/I18nContext';

interface KbdProps { children: React.ReactNode; }
const Kbd: React.FC<KbdProps> = ({ children }) => (
  <kbd className="px-1.5 py-0.5 bg-white border border-teal-900/10 rounded text-2xs font-mono text-foreground shadow-sm">{children}</kbd>
);

const SHORTCUTS: { keys: React.ReactNode[]; desc: string }[] = [
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="1">1</Kbd>], desc: '切换到 工作台' },
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="2">2</Kbd>], desc: '切换到 书桌' },
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="3">3</Kbd>], desc: '切换到 对话' },
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="4">4</Kbd>], desc: '切换到 知识库' },
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="5">5</Kbd>], desc: '切换到 待办' },
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="k">K</Kbd>], desc: '全局搜索' },
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="cm">,</Kbd>], desc: '打开设置' },
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="n">N</Kbd>], desc: '新建便签' },
  { keys: [<Kbd key="c">Ctrl</Kbd>, <Kbd key="cs">Shift</Kbd>, <Kbd key="ct">T</Kbd>], desc: '新建任务' },
  { keys: [<Kbd key="e">Esc</Kbd>], desc: '关闭顶层弹窗' },
];

interface GeneralTabProps {
  onOpenOnboarding?: (() => void) | undefined;
}

const GeneralTab: React.FC<GeneralTabProps> = ({ onOpenOnboarding }) => {
  const [taskNotifyEnabled, setTaskNotifyEnabled] = React.useState(true);
  const { t } = useTranslation();

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
            <LocaleSwitcher variant="segmented" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">外观主题</h4>
        </div>
        <div className="space-y-4 bg-teal-900/5 p-6 rounded-[2rem] border border-teal-900/5">
          <div className="mb-2">
            <p className="text-sm font-bold text-foreground">{t('theme.label')}</p>
            <p className="text-xs text-muted mt-1">{t('theme.desc')}</p>
          </div>
          <ThemeSwitcher variant="segmented" />
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

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Keyboard size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">快捷键</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-teal-900/5 p-6 rounded-[2rem] border border-teal-900/5">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 bg-white rounded-xl">
              <span className="text-xs text-muted">{s.desc}</span>
              <span className="flex items-center gap-1 shrink-0">{s.keys}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GeneralTab;
