import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, ArrowRight, BrainCircuit, Database,
  CheckSquare, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

interface Props {
  isOpen: boolean;
  step: number;
  aiStatusLabel: string;
  aiStatusHint: string;
  aiChatReady: boolean;
  aiRagReady: boolean;
  isImporting: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onImportSample: () => void;
  onOpenSettings: () => void;
  onGoToKB: () => void;
  onGoToNotes: () => void;
  onGoToTasks: () => void;
}

const OnboardingModal: React.FC<Props> = ({
  isOpen,
  step,
  aiStatusLabel,
  aiStatusHint,
  aiChatReady,
  aiRagReady,
  isImporting,
  onClose,
  onNext,
  onPrev,
  onImportSample,
  onOpenSettings,
  onGoToKB,
  onGoToNotes,
  onGoToTasks,
}) => {
  const { t } = useTranslation();
  const steps = [t('onboarding.step.welcome'), t('onboarding.step.aiCheck'), t('onboarding.step.start')];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-teal-950/35 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/20 bg-white/95 shadow-2xl"
          >
            <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 left-0 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
            <div className="relative p-8 md:p-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/5 px-3 py-1 text-2xs font-bold uppercase tracking-[0.22em] text-accent">
                    <Sparkles size={12} />
                    {t('onboarding.badge')}
                  </div>
                  <h2 className="mt-4 text-3xl font-display font-bold text-foreground">{t('onboarding.hero.title')}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{t('onboarding.hero.desc')}</p>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-2xl border border-teal-900/10 p-2.5 text-muted hover:bg-teal-900/5 hover:text-foreground transition-all"
                  aria-label={t('common.close')}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-8 flex items-center gap-3">
                {steps.map((item, index) => {
                  const active = index === step;
                  const completed = index < step;
                  return (
                    <React.Fragment key={item}>
                      <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-2xs font-bold transition-all ${
                        active ? 'bg-accent text-white' : completed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-2xs">{index + 1}</span>
                        <span>{item}</span>
                      </div>
                      {index < steps.length - 1 && <div className="h-px flex-1 bg-teal-900/10" />}
                    </React.Fragment>
                  );
                })}
              </div>

              {step === 0 && (
                <div className="mt-8 grid gap-4 md:grid-cols-[1.35fr_1fr]">
                  <div className="rounded-[1.75rem] border border-accent/15 bg-gradient-to-br from-accent/10 via-white to-white p-7">
                    <h3 className="text-xl font-bold text-foreground">{t('onboarding.step0.title')}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{t('onboarding.step0.desc')}</p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {[
                        { icon: <BrainCircuit size={16} />, title: t('onboarding.feature.notesTitle'), desc: t('onboarding.feature.notesDesc') },
                        { icon: <Database size={16} />, title: t('onboarding.feature.kbTitle'), desc: t('onboarding.feature.kbDesc') },
                        { icon: <CheckSquare size={16} />, title: t('onboarding.feature.tasksTitle'), desc: t('onboarding.feature.tasksDesc') },
                      ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-white/60 bg-white/80 p-4">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">{item.icon}</div>
                          <p className="mt-3 text-sm font-bold text-foreground">{item.title}</p>
                          <p className="mt-1 text-2xs text-muted">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={onImportSample}
                        disabled={isImporting}
                        className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent/90 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {isImporting ? t('onboarding.step0.importing') : t('onboarding.step0.import')}
                      </button>
                      <button
                        onClick={onNext}
                        className="inline-flex items-center gap-2 rounded-2xl border border-teal-900/10 bg-white px-5 py-3 text-sm font-bold text-foreground hover:bg-teal-900/5 transition-all"
                      >
                        {t('onboarding.step0.startEmpty')}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-teal-900/10 bg-white/80 p-7">
                    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-muted">{t('onboarding.corePath')}</p>
                    <div className="mt-5 space-y-4">
                      {[
                        t('onboarding.corePath.1'),
                        t('onboarding.corePath.2'),
                        t('onboarding.corePath.3'),
                      ].map((text, index) => (
                        <div key={text} className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-teal-900/5 text-xs font-bold text-accent">{index + 1}</div>
                          <p className="pt-1 text-sm text-foreground/80">{text}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-2xs leading-relaxed text-muted">
                      {t('onboarding.aiOptional')}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="mt-8 grid gap-4 md:grid-cols-[1.25fr_1fr]">
                  <div className="rounded-[1.75rem] border border-teal-900/10 bg-white/85 p-7">
                    <h3 className="text-xl font-bold text-foreground">{t('onboarding.step1.title')}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{t('onboarding.step1.desc')}</p>
                    <div className="mt-6 rounded-3xl border border-teal-900/10 bg-gradient-to-br from-white to-teal-50/60 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-2xs font-bold uppercase tracking-[0.22em] text-muted">{t('onboarding.currentStatus')}</p>
                          <p className="mt-2 text-lg font-bold text-foreground">{aiStatusLabel}</p>
                          <p className="mt-2 text-sm text-muted leading-relaxed">{aiStatusHint}</p>
                        </div>
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${aiChatReady ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {aiChatReady ? <CheckCircle2 size={26} /> : <AlertCircle size={26} />}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className={`rounded-2xl border px-4 py-4 ${aiChatReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        <p className="text-sm font-bold">{t('onboarding.aiChat')}</p>
                        <p className="mt-1 text-2xs leading-relaxed">{aiChatReady ? t('onboarding.aiChatReady') : t('onboarding.aiChatMissing')}</p>
                      </div>
                      <div className={`rounded-2xl border px-4 py-4 ${aiRagReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                        <p className="text-sm font-bold">{t('onboarding.aiRag')}</p>
                        <p className="mt-1 text-2xs leading-relaxed">{aiRagReady ? t('onboarding.aiRagReady') : t('onboarding.aiRagMissing')}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={onOpenSettings}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-foreground border border-teal-900/10 hover:bg-teal-900/5 transition-all"
                      >
                        {t('onboarding.openDiagnosis')}
                      </button>
                      <button
                        onClick={onNext}
                        className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent/90 transition-all"
                      >
                        {t('common.next')}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-teal-900/10 bg-slate-50/80 p-7">
                    <p className="text-2xs font-bold uppercase tracking-[0.2em] text-muted">{t('onboarding.suggestedOrder')}</p>
                    <div className="mt-5 space-y-3 text-sm text-foreground/80">
                      <div className="rounded-2xl bg-white p-4 border border-teal-900/10">{t('onboarding.order.1')}</div>
                      <div className="rounded-2xl bg-white p-4 border border-teal-900/10">{t('onboarding.order.2')}</div>
                      <div className="rounded-2xl bg-white p-4 border border-teal-900/10">{t('onboarding.order.3')}</div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {[
                    {
                      title: t('onboarding.cta.kb'),
                      desc: t('onboarding.cta.kbDesc'),
                      icon: <Database size={18} />,
                      action: onGoToKB,
                    },
                    {
                      title: t('onboarding.cta.notes'),
                      desc: t('onboarding.cta.notesDesc'),
                      icon: <BrainCircuit size={18} />,
                      action: onGoToNotes,
                    },
                    {
                      title: t('onboarding.cta.tasks'),
                      desc: t('onboarding.cta.tasksDesc'),
                      icon: <CheckSquare size={18} />,
                      action: onGoToTasks,
                    },
                  ].map((item) => (
                    <button
                      key={item.title}
                      onClick={item.action}
                      className="group rounded-[1.75rem] border border-teal-900/10 bg-white/85 p-7 text-left hover:border-accent/30 hover:shadow-lg transition-all"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">{item.icon}</div>
                      <h3 className="mt-5 text-lg font-bold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{item.desc}</p>
                      <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent">
                        {t('onboarding.cta.go')}
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <div className="text-2xs text-muted">
                  {step === 0 ? t('onboarding.footer.hint0') : t('onboarding.footer.hintOther')}
                </div>
                <div className="flex items-center gap-3">
                  {step > 0 && (
                    <button
                      onClick={onPrev}
                      className="rounded-2xl px-4 py-2.5 text-sm font-bold text-muted hover:bg-teal-900/5 hover:text-foreground transition-all"
                    >
                      {t('common.prev')}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="rounded-2xl border border-teal-900/10 bg-white px-4 py-2.5 text-sm font-bold text-foreground hover:bg-teal-900/5 transition-all"
                  >
                    {t('onboarding.skip')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingModal;
