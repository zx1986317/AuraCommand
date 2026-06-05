import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { DocCategory } from '../types';
import type { Note } from './useNotes';

const DEFAULT_DOC_CATEGORIES: DocCategory[] = [
  { id: '工作计划', name: '工作计划', color: '#3b82f6', sort_order: 0, created_at: '', updated_at: '' },
  { id: '项目文档', name: '项目文档', color: '#8b5cf6', sort_order: 1, created_at: '', updated_at: '' },
  { id: '技术笔记', name: '技术笔记', color: '#10b981', sort_order: 2, created_at: '', updated_at: '' },
  { id: '会议记录', name: '会议记录', color: '#f59e0b', sort_order: 3, created_at: '', updated_at: '' },
  { id: '个人', name: '个人', color: '#ef4444', sort_order: 4, created_at: '', updated_at: '' },
  { id: '归档', name: '归档', color: '#6b7280', sort_order: 5, created_at: '', updated_at: '' },
];

export function useDeskCategories(documents: Note[]) {
  const [docCategories, setDocCategories] = useState<DocCategory[]>(() => {
    const stored = localStorage.getItem('deskDocCategories');
    if (stored) {
      try { return JSON.parse(stored); } catch {}
    }
    return DEFAULT_DOC_CATEGORIES;
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const catDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('deskDocCategories', JSON.stringify(docCategories));
  }, [docCategories]);

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

  const handleCreateDocCategory = useCallback((name: string, color: string) => {
    const newCat: DocCategory = {
      id: crypto.randomUUID(),
      name,
      color,
      sort_order: docCategories.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDocCategories(prev => [...prev, newCat]);
  }, [docCategories.length]);

  const handleUpdateDocCategory = useCallback((id: string, name: string, color: string) => {
    setDocCategories(prev => prev.map(c =>
      c.id === id ? { ...c, name, color, updated_at: new Date().toISOString() } : c
    ));
  }, []);

  const handleDeleteDocCategory = useCallback((id: string) => {
    setDocCategories(prev => prev.filter(c => c.id !== id));
    setSelectedCategory(prev => prev === id ? null : prev);
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
