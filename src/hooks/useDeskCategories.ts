import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { DocCategory } from '../types';
import type { Note } from './useNotes';

const DEFAULT_DOC_CATEGORIES: DocCategory[] = [
  { id: 'uncategorized', name: '未分类', color: '#6b7280', sort_order: 0, created_at: '', updated_at: '' },
  { id: 'work', name: '工作计划', color: '#3b82f6', sort_order: 1, created_at: '', updated_at: '' },
  { id: 'project', name: '项目文档', color: '#8b5cf6', sort_order: 2, created_at: '', updated_at: '' },
  { id: 'tech', name: '技术笔记', color: '#10b981', sort_order: 3, created_at: '', updated_at: '' },
  { id: 'meeting', name: '会议记录', color: '#f59e0b', sort_order: 4, created_at: '', updated_at: '' },
  { id: 'personal', name: '个人', color: '#ef4444', sort_order: 5, created_at: '', updated_at: '' },
  { id: 'archive', name: '归档', color: '#9ca3af', sort_order: 6, created_at: '', updated_at: '' },
];

export function useDeskCategories(documents: Note[]) {
  const [docCategories, setDocCategories] = useState<DocCategory[]>(DEFAULT_DOC_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const catDropdownRef = useRef<HTMLDivElement>(null);

  // 从数据库加载分类
  useEffect(() => {
    (async () => {
      try {
        const dbCategories = await window.ipcRenderer.invoke('get-doc-categories') as DocCategory[];
        if (dbCategories && dbCategories.length > 0) {
          setDocCategories(dbCategories);
        } else {
          // 数据库无分类时，同步默认分类到数据库
          for (const cat of DEFAULT_DOC_CATEGORIES) {
            await window.ipcRenderer.invoke('create-doc-category', cat);
          }
          setDocCategories(DEFAULT_DOC_CATEGORIES);
        }
      } catch (err) {
        console.error('Failed to load doc categories from DB:', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!catDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catDropdownOpen]);

  const handleCreateDocCategory = useCallback(async (name: string, color: string) => {
    const newCat: DocCategory = {
      id: crypto.randomUUID(),
      name,
      color,
      sort_order: docCategories.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await window.ipcRenderer.invoke('create-doc-category', newCat);
      setDocCategories(prev => [...prev, newCat]);
    } catch (err) {
      console.error('Failed to create doc category:', err);
    }
  }, [docCategories.length]);

  const handleUpdateDocCategory = useCallback(async (id: string, name: string, color: string) => {
    try {
      await window.ipcRenderer.invoke('update-doc-category', { id, name, color, sort_order: 0, created_at: '', updated_at: new Date().toISOString() });
      setDocCategories(prev => prev.map(c =>
        c.id === id ? { ...c, name, color, updated_at: new Date().toISOString() } : c
      ));
    } catch (err) {
      console.error('Failed to update doc category:', err);
    }
  }, []);

  const handleDeleteDocCategory = useCallback(async (id: string) => {
    try {
      await window.ipcRenderer.invoke('delete-doc-category', id);
      setDocCategories(prev => prev.filter(c => c.id !== id));
      setSelectedCategory(prev => prev === id ? null : prev);
    } catch (err) {
      console.error('Failed to delete doc category:', err);
    }
  }, []);

  const handleSelectCategory = useCallback((id: string | null) => {
    setSelectedCategory(prev => prev === id ? null : id);
  }, []);

  const categoryDocCounts = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach(doc => {
      const cat = doc.category || 'uncategorized';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return counts;
  }, [documents]);

  return {
    docCategories,
    selectedCategory,
    setSelectedCategory,
    newCategoryName,
    setNewCategoryName,
    editingCategoryId,
    setEditingCategoryId,
    editingCategoryName,
    setEditingCategoryName,
    catDropdownOpen,
    setCatDropdownOpen,
    catDropdownRef,
    handleCreateDocCategory,
    handleUpdateDocCategory,
    handleDeleteDocCategory,
    handleSelectCategory,
    categoryDocCounts,
  };
}