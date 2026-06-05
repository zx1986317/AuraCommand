import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, RotateCcw, Check, Clock, Timer, FileText, Coffee } from 'lucide-react';

interface FocusModeProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: any;
  onSaveTimeLog: (log: TimeLog) => void;
}

interface TimeLog {
  scheduleId: string;
  scheduleTitle: string;
  focusMinutes: number;
  breakMinutes: number;
  pomodoroCount: number;
  startedAt: string;
  completedAt: string;
}

const POMODORO_WORK = 25;
const POMODORO_BREAK = 5;

const FocusMode: React.FC<FocusModeProps> = ({ isOpen, onClose, schedule, onSaveTimeLog }) => {
  const [phase, setPhase] = useState<'work' | 'break' | 'idle'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(POMODORO_WORK * 60);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [customWorkMin, setCustomWorkMin] = useState(POMODORO_WORK);
  const [customBreakMin, setCustomBreakMin] = useState(POMODORO_BREAK);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = phase === 'work'
    ? ((customWorkMin * 60 - secondsLeft) / (customWorkMin * 60)) * 100
    : phase === 'break'
    ? ((customBreakMin * 60 - secondsLeft) / (customBreakMin * 60)) * 100
    : 0;

  const startWork = useCallback(() => {
    if (phase === 'idle') {
      setStartedAt(new Date().toISOString());
      setTotalFocusSeconds(0);
    }
    setPhase('work');
    setSecondsLeft(customWorkMin * 60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setPomodoroCount(c => c + 1);
          setPhase('break');
          return customBreakMin * 60;
        }
        setTotalFocusSeconds(t => t + 1);
        return prev - 1;
      });
    }, 1000);
  }, [phase, customWorkMin, customBreakMin]);

  const pauseTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase(phase === 'work' ? 'work' : phase);
  };

  const resumeTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (phaseRef.current === 'work') {
            setPomodoroCount(c => c + 1);
            setPhase('break');
            return customBreakMin * 60;
          } else {
            setPhase('work');
            return customWorkMin * 60;
          }
        }
        if (phaseRef.current === 'work') setTotalFocusSeconds(t => t + 1);
        return prev - 1;
      });
    }, 1000);
  };

  const isPaused = phase !== 'idle' && timerRef.current === null;

  const completeSession = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const log: TimeLog = {
      scheduleId: schedule?.id || '',
      scheduleTitle: schedule?.title || '自由专注',
      focusMinutes: Math.round(totalFocusSeconds / 60),
      breakMinutes: pomodoroCount * customBreakMin,
      pomodoroCount,
      startedAt: startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    onSaveTimeLog(log);
    setPhase('idle');
    setPomodoroCount(0);
    setTotalFocusSeconds(0);
    setSecondsLeft(customWorkMin * 60);
  };

  const reset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setPhase('idle');
    setPomodoroCount(0);
    setTotalFocusSeconds(0);
    setSecondsLeft(customWorkMin * 60);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const estimatedMin = schedule?.start_time && schedule?.end_time
    ? Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-[2rem] border border-teal-900/10 shadow-2xl p-8 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-2xl rounded-full -mr-16 -mt-16"></div>

            <div className="relative z-10 flex flex-col items-center">
              <button
                onClick={onClose}
                className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-teal-900/5 transition-all"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <Timer size={16} className="text-accent" />
                <span className="text-2xs font-black uppercase tracking-[0.2em] text-accent">专注模式</span>
              </div>

              <h3 className="text-sm font-bold text-foreground mb-6 text-center truncate max-w-full">
                {schedule?.title || '自由专注'}
              </h3>

              {/* Timer Circle */}
              <div className="relative w-48 h-48 mb-6">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(13,148,136,0.05)" strokeWidth="3" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke={phase === 'work' ? '#0d9488' : phase === 'break' ? '#8b5cf6' : 'rgba(13,148,136,0.1)'}
                    strokeWidth="3"
                    strokeDasharray={`${progressPercent * 2.83} ${283 - progressPercent * 2.83}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-mono font-bold ${phase === 'work' ? 'text-foreground' : phase === 'break' ? 'text-purple-600' : 'text-muted'}`}>
                    {formatTime(secondsLeft)}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider mt-1">
                    {phase === 'work' ? '专注中' : phase === 'break' ? '休息中' : '准备开始'}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-6 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-accent">{pomodoroCount}</span>
                  <span className="text-xs text-muted font-bold uppercase">番茄</span>
                </div>
                <div className="w-px h-8 bg-teal-900/5"></div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-foreground">{Math.round(totalFocusSeconds / 60)}</span>
                  <span className="text-xs text-muted font-bold uppercase">分钟专注</span>
                </div>
                {estimatedMin > 0 && (
                  <>
                    <div className="w-px h-8 bg-teal-900/5"></div>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold text-muted">{estimatedMin}</span>
                      <span className="text-xs text-muted font-bold uppercase">预估分钟</span>
                    </div>
                  </>
                )}
              </div>

              {/* Phase indicator */}
              <div className="flex items-center gap-2 mb-4">
                {phase === 'work' ? (
                  <div className="flex items-center gap-1 px-3 py-1 bg-accent/10 rounded-full">
                    <FileText size={10} className="text-accent" />
                    <span className="text-xs font-bold text-accent">工作中</span>
                  </div>
                ) : phase === 'break' ? (
                  <div className="flex items-center gap-1 px-3 py-1 bg-purple-50 rounded-full">
                    <Coffee size={10} className="text-purple-600" />
                    <span className="text-xs font-bold text-purple-600">休息中</span>
                  </div>
                ) : null}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                {phase === 'idle' && (
                  <button
                    onClick={startWork}
                    className="w-12 h-12 flex items-center justify-center bg-accent text-white rounded-full shadow-lg hover:bg-accent/90 transition-all active:scale-95"
                  >
                    <Play size={20} />
                  </button>
                )}
                {(phase === 'work' || phase === 'break') && !isPaused && (
                  <>
                    <button
                      onClick={pauseTimer}
                      className="w-10 h-10 flex items-center justify-center bg-teal-900/5 text-foreground rounded-full hover:bg-teal-900/10 transition-all"
                    >
                      <Pause size={16} />
                    </button>
                    <button
                      onClick={completeSession}
                      className="w-12 h-12 flex items-center justify-center bg-accent text-white rounded-full shadow-lg hover:bg-accent/90 transition-all active:scale-95"
                    >
                      <Check size={20} />
                    </button>
                  </>
                )}
                {isPaused && (
                  <>
                    <button
                      onClick={resumeTimer}
                      className="w-12 h-12 flex items-center justify-center bg-accent text-white rounded-full shadow-lg hover:bg-accent/90 transition-all active:scale-95"
                    >
                      <Play size={20} />
                    </button>
                    <button
                      onClick={reset}
                      className="w-10 h-10 flex items-center justify-center bg-teal-900/5 text-muted rounded-full hover:bg-teal-900/10 transition-all"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </>
                )}
              </div>

              {/* Custom durations */}
              {phase === 'idle' && (
                <div className="mt-4 flex items-center gap-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-xs text-muted font-bold uppercase">工作</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={customWorkMin}
                      onChange={e => setCustomWorkMin(Math.max(1, Math.min(120, parseInt(e.target.value) || 25)))}
                      className="w-12 text-center text-xs font-bold bg-white/50 border border-teal-900/5 rounded-lg py-1 outline-none focus:border-accent/30"
                    />
                    <span className="text-xs text-muted">分钟</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-xs text-muted font-bold uppercase">休息</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={customBreakMin}
                      onChange={e => setCustomBreakMin(Math.max(1, Math.min(30, parseInt(e.target.value) || 5)))}
                      className="w-12 text-center text-xs font-bold bg-white/50 border border-teal-900/5 rounded-lg py-1 outline-none focus:border-accent/30"
                    />
                    <span className="text-xs text-muted">分钟</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FocusMode;