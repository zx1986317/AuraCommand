import { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { safeInvoke } from '../utils/safeInvoke';

export interface Task {
  id: string;
  title: string;
  description?: string;
  type?: string;
  status: 'inbox' | 'today' | 'next' | 'waiting' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  scheduled_date?: string;
  source_type?: string;
  source_id?: string;
  source_title?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

function normalizeTask(task: any): Task | null {
  if (!task) return null;
  return { ...task, tags: task.tags || [], description: task.description || '' };

}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStats, setTaskStats] = useState({ total: 0, inbox: 0, next: 0, waiting: 0, done: 0 });

  const loadTasks = useCallback(async (filter?: { status?: string }) => {
    const data = await safeInvoke<Task[]>('get-tasks', filter, { fallback: [] });
    const normalized = Array.isArray(data) ? data.map(normalizeTask).filter((t): t is Task => t !== null) : [];
    setTasks(normalized);
  }, []);

  const loadTaskStats = useCallback(async () => {
    const stats = await safeInvoke<any>('get-task-stats', undefined, { fallback: { total: 0, inbox: 0, next: 0, waiting: 0, done: 0 } });
    setTaskStats(stats || { total: 0, inbox: 0, next: 0, waiting: 0, done: 0 });
  }, []);

  useEffect(() => {
    loadTasks();
    loadTaskStats();
  }, [loadTasks, loadTaskStats]);

  const tasksByStatus = useMemo(() => {
    return {
      inbox: tasks.filter(t => t.status === 'inbox'),
      today: tasks.filter(t => t.status === 'today'),
      next: tasks.filter(t => t.status === 'next'),
      done: tasks.filter(t => t.status === 'done'),
    };
  }, [tasks]);

  const saveTask = useCallback(async (task: Partial<Task> & { id: string; title: string }) => {
    const result = await safeInvoke<any>('save-task', task, { fallback: { success: false } });
    if (result?.success) {
      await loadTasks();
      await loadTaskStats();
    }
    return result || { success: false };
  }, [loadTasks, loadTaskStats]);

  const deleteTask = useCallback(async (id: string) => {
    const result = await safeInvoke<any>('delete-task', id, { fallback: { success: false } });
    if (result?.success) {
      setTasks(prev => prev.filter(t => t.id !== id));
      await loadTaskStats();
    }
    return result || { success: false };
  }, [loadTaskStats]);

  const updateTaskStatus = useCallback(async (id: string, status: Task['status']) => {
    const result = await safeInvoke<any>('update-task-status', { id, status }, { fallback: { success: false } });
    if (result?.success) {
      await loadTasks();
      await loadTaskStats();
    }
    return result || { success: false };
  }, [loadTasks, loadTaskStats]);

  const searchTasks = useCallback(async (query: string) => {
    return await safeInvoke<Task[]>('search-tasks', query, { fallback: [] }) || [];
  }, []);

  const getTasksBySourceId = useCallback((sourceId: string): Task[] => {
    return tasks.filter(t => t.source_id === sourceId);
  }, [tasks]);

  const createTask = useCallback((overrides?: Partial<Task>): Task => {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      title: '',
      description: '',
      type: 'task',
      status: 'inbox',
      priority: 'medium',
      due_date: '',
      scheduled_date: '',
      source_type: 'manual',
      source_id: '',
      source_title: '',
      tags: [],
      created_at: now,
      updated_at: now,
      completed_at: null,
      ...overrides,
    };
  }, []);

  return {
    tasks,
    tasksByStatus,
    taskStats,
    loadTasks,
    loadTaskStats,
    saveTask,
    deleteTask,
    updateTaskStatus,
    searchTasks,
    getTasksBySourceId,
    createTask,
  };
}
