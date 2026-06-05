import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, LayoutGrid, List, BarChart3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, addWeeks, subWeeks, startOfDay, endOfDay, addDays, differenceInMinutes, isWithinInterval } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Schedule {
    id: string;
    title: string;
    content: string;
    start_time: string;
    end_time?: string;
    status: string;
    category: string;
    recurrence?: string;
}

interface CalendarViewProps {
    schedules: Schedule[];
    onAddSchedule: (date: Date) => void;
    onEditSchedule: (schedule: Schedule) => void;
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    tasks?: any[];
    onToggleTask?: (taskId: string) => void;
}

const getCategoryColor = (category: string) =>
    category === '会议' ? 'bg-amber-500' :
    category === '工作' ? 'bg-blue-500' :
    category === '截止日期' ? 'bg-red-500' : 'bg-accent';

const getCategoryBg = (category: string) =>
    category === '会议' ? 'bg-amber-50 border-amber-200' :
    category === '工作' ? 'bg-blue-50 border-blue-200' :
    category === '截止日期' ? 'bg-red-50 border-red-200' : 'bg-accent/5 border-accent/20';

const isRecurringOnDate = (schedule: Schedule, date: Date): boolean => {
    if (!schedule.recurrence || schedule.recurrence === 'none') return false;
    const startDate = new Date(schedule.start_time);
    const startDay = startDate.getDay();
    const targetDay = date.getDay();
    switch (schedule.recurrence) {
        case 'daily': return true;
        case 'weekdays': return targetDay >= 1 && targetDay <= 5;
        case 'weekly': return startDay === targetDay;
        case 'monthly': return startDate.getDate() === date.getDate();
        default: return false;
    }
};

const getEffectiveSchedulesForDay = (schedules: Schedule[], day: Date) => {
    const directSchedules = schedules.filter(s => isSameDay(new Date(s.start_time), day));
    const recurringSchedules = schedules.filter(s =>
        s.recurrence && s.recurrence !== 'none' &&
        !isSameDay(new Date(s.start_time), day) &&
        new Date(s.start_time) <= day &&
        isRecurringOnDate(s, day)
    );
    return [...directSchedules, ...recurringSchedules];
};

const hours = Array.from({ length: 24 }, (_, i) => i);

const WeekView: React.FC<{
    schedules: Schedule[];
    currentWeekStart: Date;
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    onAddSchedule: (date: Date) => void;
    onEditSchedule: (s: Schedule) => void;
}> = ({ schedules, currentWeekStart, selectedDate, onSelectDate, onAddSchedule, onEditSchedule }) => {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-teal-900/5">
                <div className="p-2" />
                {weekDays.map((day, i) => {
                    const isToday = isSameDay(day, new Date());
                    const isSelected = isSameDay(day, selectedDate);
                    return (
                        <div key={day.toISOString()} className={`p-2 text-center border-l border-teal-900/5 cursor-pointer ${isSelected ? 'bg-accent/5' : ''}`} onClick={() => onSelectDate(day)}>
                            <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-accent' : 'text-muted'}`}>
                                {format(day, 'EEE', { locale: zhCN })}
                            </p>
                            <p className={`text-lg font-bold ${isToday ? 'bg-accent text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-foreground'}`}>
                                {format(day, 'd')}
                            </p>
                        </div>
                    );
                })}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
                    {hours.map(hour => (
                        <React.Fragment key={hour}>
                            <div className="h-12 border-b border-teal-900/5 flex items-start justify-end pr-2 pt-0.5">
                                <span className="text-xs font-mono text-muted/50">{hour.toString().padStart(2, '0')}:00</span>
                            </div>
                            {weekDays.map(day => {
                                const daySchedules = getEffectiveSchedulesForDay(schedules, day);
                                const hourSchedules = daySchedules.filter(s => new Date(s.start_time).getHours() === hour);
                                return (
                                    <div key={`${day.toISOString()}-${hour}`} className="h-12 border-b border-l border-teal-900/5 relative group/hour cursor-pointer hover:bg-accent/[0.02] transition-colors"
                                        onClick={() => { onSelectDate(day); onAddSchedule(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour)); }}>
                                        {hourSchedules.map(s => (
                                            <div key={s.id} onClick={(e) => { e.stopPropagation(); onEditSchedule(s); }}
                                                className={`absolute left-0.5 right-0.5 px-1 py-0.5 rounded-md text-xs font-bold truncate border cursor-pointer ${getCategoryBg(s.category)}`}>
                                                <div className="flex items-center gap-1">
                                                    <div className={`w-1 h-1 rounded-full ${getCategoryColor(s.category)}`} />
                                                    <span className="truncate">{s.title}</span>
                                                    {s.recurrence && s.recurrence !== 'none' && <span className="text-muted">↻</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TimelineView: React.FC<{
    schedules: Schedule[];
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    onEditSchedule: (s: Schedule) => void;
}> = ({ schedules, selectedDate, onSelectDate, onEditSchedule }) => {
    const daySchedules = getEffectiveSchedulesForDay(schedules, selectedDate)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            <div className="relative">
                {hours.map(hour => (
                    <div key={hour} className="flex items-start gap-4 min-h-[3rem]">
                        <span className="w-10 text-right text-xs font-mono text-muted/50 pt-0.5 shrink-0">{hour.toString().padStart(2, '0')}:00</span>
                        <div className="flex-1 border-t border-teal-900/5 pt-1">
                            {daySchedules.filter(s => new Date(s.start_time).getHours() === hour).map(s => (
                                <div key={s.id} onClick={() => onEditSchedule(s)}
                                    className={`p-3 rounded-xl border mb-2 cursor-pointer hover:shadow-md transition-all ${getCategoryBg(s.category)}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-2 h-2 rounded-full ${getCategoryColor(s.category)}`} />
                                        <span className="text-xs font-bold text-foreground">{s.title}</span>
                                        {s.recurrence && s.recurrence !== 'none' && <span className="text-xs text-muted font-bold">↻ {s.recurrence === 'daily' ? '每天' : s.recurrence === 'weekdays' ? '工作日' : s.recurrence === 'weekly' ? '每周' : '每月'}</span>}
                                    </div>
                                    <div className="flex items-center gap-2 text-2xs text-muted">
                                        <Clock size={10} />
                                        <span className="font-mono">{format(new Date(s.start_time), 'HH:mm')}</span>
                                        {s.content && <span className="truncate opacity-70">· {s.content}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CalendarView: React.FC<CalendarViewProps> = ({ schedules, onAddSchedule, onEditSchedule, selectedDate, onSelectDate, tasks, onToggleTask }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [direction, setDirection] = useState(0);
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'timeline'>('month');
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date()));

    const effectiveSchedules = React.useMemo((): Schedule[] => {
        if (tasks && tasks.length > 0) {
            return tasks.map(task => ({
                id: task.id,
                title: task.title,
                content: task.content || task.description || '',
                start_time: task.due_date || task.created_at,
                status: task.status === 'done' ? 'completed' : task.status,
                category: task.priority === 'high' ? '截止日期' : task.priority === 'medium' ? '工作' : '会议',
            }));
        }
        return schedules;
    }, [tasks, schedules]);

    const handleEditSchedule = React.useCallback((schedule: Schedule) => {
        if (tasks && onToggleTask) {
            onToggleTask(schedule.id);
        } else {
            onEditSchedule(schedule);
        }
    }, [tasks, onToggleTask, onEditSchedule]);

    const handleAddSchedule = React.useCallback((date: Date) => {
        if (!tasks) {
            onAddSchedule(date);
        }
    }, [tasks, onAddSchedule]);

    const nextMonth = () => { setDirection(1); setCurrentMonth(addMonths(currentMonth, 1)); };
    const prevMonth = () => { setDirection(-1); setCurrentMonth(subMonths(currentMonth, 1)); };
    const nextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
    const prevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
        <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl rounded-[2rem] border border-teal-900/10 shadow-glass overflow-hidden">
            <div className="flex items-center justify-between px-8 py-5 border-b border-teal-900/5 bg-white/20">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-display font-bold text-foreground tracking-tight">
                        {viewMode === 'week' ? `${format(currentWeekStart, 'MM月dd日')} - ${format(addDays(currentWeekStart, 6), 'MM月dd日')}` : format(currentMonth, 'yyyy年 MMMM', { locale: zhCN })}
                    </h2>
                    <div className="flex bg-teal-900/5 rounded-xl p-0.5 border border-teal-900/5">
                        <button onClick={viewMode === 'week' ? prevWeek : prevMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-muted hover:text-accent transition-all"><ChevronLeft size={16} /></button>
                        <button onClick={() => { setCurrentMonth(new Date()); setCurrentWeekStart(startOfWeek(new Date())); }} className="px-3 text-2xs font-bold text-muted hover:text-accent transition-all">今天</button>
                        <button onClick={viewMode === 'week' ? nextWeek : nextMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-muted hover:text-accent transition-all"><ChevronRight size={16} /></button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-teal-900/5 rounded-xl p-0.5 border border-teal-900/5">
                        {([['month', LayoutGrid, '月'], ['week', List, '周'], ['timeline', BarChart3, '时间线']] as const).map(([mode, Icon, label]) => (
                            <button key={mode} onClick={() => setViewMode(mode)} className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${viewMode === mode ? 'bg-white shadow-sm text-accent' : 'text-muted hover:text-accent'}`}>
                                <Icon size={12} /><span className="text-xs font-bold">{label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/50 border border-teal-900/5">
                        <div className="w-2 h-2 rounded-full bg-accent" /><span className="text-2xs font-bold text-muted uppercase tracking-wider">个人</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/50 border border-teal-900/5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-2xs font-bold text-muted uppercase tracking-wider">工作</span>
                    </div>
                </div>
            </div>

            {viewMode === 'week' ? (
                <WeekView schedules={effectiveSchedules} currentWeekStart={currentWeekStart} selectedDate={selectedDate} onSelectDate={onSelectDate} onAddSchedule={handleAddSchedule} onEditSchedule={handleEditSchedule} />
            ) : viewMode === 'timeline' ? (
                <TimelineView schedules={effectiveSchedules} selectedDate={selectedDate} onSelectDate={onSelectDate} onEditSchedule={handleEditSchedule} />
            ) : (
                <>
                    <div className="grid grid-cols-7 border-b border-teal-900/5 bg-teal-50/30">
                        {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day, i) => (
                            <div key={day} className={`py-4 text-center text-2xs font-black uppercase tracking-widest ${i === 0 || i === 6 ? 'text-accent/60' : 'text-muted/60'}`}>{day}</div>
                        ))}
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                        <AnimatePresence initial={false} custom={direction} mode="wait">
                            <motion.div key={currentMonth.toISOString()} custom={direction} initial={{ opacity: 0, x: direction * 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -direction * 50 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="grid grid-cols-7 grid-rows-6 h-full">
                                {days.map((day) => {
                                    const daySchedules = getEffectiveSchedulesForDay(effectiveSchedules, day);
                                    const isCurrentMonth = isSameMonth(day, monthStart);
                                    const isToday = isSameDay(day, new Date());
                                    const isSelected = isSameDay(day, selectedDate);
                                    return (
                                        <div key={day.toISOString()} onClick={() => onSelectDate(day)} className={`relative p-2 border-r border-b border-teal-900/5 transition-colors cursor-pointer group flex flex-col min-h-0 ${!isCurrentMonth ? 'bg-teal-900/[0.02] opacity-30' : 'bg-transparent'} ${isSelected ? 'bg-accent/[0.05] ring-1 ring-inset ring-accent/20' : 'hover:bg-accent/[0.02]'}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`w-7 h-7 flex items-center justify-center text-xs font-display font-bold rounded-lg transition-all ${isToday ? 'bg-accent text-white shadow-premium scale-105' : isSelected ? 'bg-accent/20 text-accent' : 'text-foreground/70'}`}>{format(day, 'd')}</span>
                                                {!tasks && <button onClick={() => onAddSchedule(day)} className="opacity-0 group-hover:opacity-100 p-1 bg-accent text-white rounded-lg hover:bg-accent/80 transition-all transform scale-75 group-hover:scale-100 shadow-sm"><Plus size={12} /></button>}
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 max-h-[100px]">
                                                {daySchedules.map(schedule => {
                                                    const time = format(parseISO(schedule.start_time), 'HH:mm');
                                                    return (
                                                        <div key={schedule.id} title={`${time} ${schedule.title}\n${schedule.content || ''}`} onClick={(e) => { e.stopPropagation(); handleEditSchedule(schedule); }} className={`px-2 py-1 rounded-lg text-xs font-bold truncate cursor-pointer transition-all border shadow-sm ${schedule.status === 'completed' ? 'bg-teal-50/50 text-muted/50 border-teal-900/5 line-through' : 'bg-white/80 backdrop-blur-sm text-foreground border-teal-900/5 hover:border-accent/30 hover:shadow-md'}`}>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getCategoryColor(schedule.category)}`} />
                                                                <span className="opacity-60 font-mono">{time}</span>
                                                                <span className="truncate">{schedule.title}</span>
                                                                {schedule.recurrence && schedule.recurrence !== 'none' && <span className="text-accent/50">↻</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {daySchedules.length > 3 && <div className="text-xs font-bold text-muted text-center mt-1 opacity-50">还有 {daySchedules.length - 3} 项...</div>}
                                        </div>
                                    );
                                })}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </>
            )}
        </div>
    );
};

export default CalendarView;
