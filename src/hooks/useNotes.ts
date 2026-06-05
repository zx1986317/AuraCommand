import { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { safeInvoke } from '../utils/safeInvoke';

export interface Note {
  id: string;
  type: 'quick_note' | 'document';
  title: string;
  content: string;
  tags: string[];
  category?: string;
  project?: string;
  folder_id?: string;
  file_path?: string;
  size?: number;
  source_url?: string;
  pinned?: boolean;
  images?: any[];
  source_type?: string;
  source_id?: string;
  created_at: string;
  updated_at: string;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadNotes = useCallback(async (filter?: { type?: Note['type']; category?: string }) => {
    const data = await safeInvoke<Note[]>('get-notes', filter, { fallback: [] });
    setNotes(Array.isArray(data) ? data : []);
  }, []);

  const loadAllNotes = useCallback(async () => {
    await loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    const timer = setTimeout(() => { loadAllNotes(); }, 300);
    return () => clearTimeout(timer);
  }, [loadAllNotes]);

  const notesByType = useMemo(() => {
    return {
      quick_notes: notes.filter(n => n.type === 'quick_note'),
      documents: notes.filter(n => n.type === 'document'),
    };
  }, [notes]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(n => {
      if (n.tags && Array.isArray(n.tags)) {
        n.tags.forEach((t: string) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  const allCategories = useMemo(() => {
    const catSet = new Set<string>();
    notes.forEach(n => {
      if (n.category) catSet.add(n.category);
    });
    return Array.from(catSet).sort();
  }, [notes]);

  const saveNote = useCallback(async (note: Partial<Note> & { id: string; title: string; content: string }) => {
    const result = await safeInvoke<any>('save-note', {
      ...note,
      type: note.type || 'quick_note',
      pinned: note.pinned ? 1 : 0,
    }, { fallback: { success: false } });
    if (result?.success) {
      await loadNotes();
    }
    return result || { success: false };
  }, [loadNotes]);

  const deleteNote = useCallback(async (id: string) => {
    const result = await safeInvoke<any>('delete-note', id, { fallback: { success: false } });
    if (result?.success) {
      setNotes(prev => prev.filter(n => n.id !== id));
    }
    return result || { success: false };
  }, []);

  const searchNotes = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      await loadAllNotes();
      return;
    }
    const data = await safeInvoke<Note[]>('search-notes', query, { fallback: [] });
    setNotes(Array.isArray(data) ? data : []);
  }, [loadAllNotes]);

  const createNote = useCallback((type: Note['type'] = 'quick_note'): Note => {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      type,
      title: '',
      content: '',
      tags: [],
      category: type === 'document' ? 'uncategorized' : '',
      project: '',
      pinned: false,
      images: [],
      source_type: 'manual',
      source_id: '',
      created_at: now,
      updated_at: now,
    };
  }, []);

  const saveDocument = useCallback(async (doc: Partial<Note> & { id: string; title: string; content: string }) => {
    const result = await safeInvoke<any>('save-document', {
      ...doc,
      tags: doc.tags || [],
      source_type: doc.source_type || 'manual',
      source_id: doc.source_id || '',
    }, { fallback: { success: false } });
    if (result?.success) {
      await loadNotes();
    }
    return result || { success: false };
  }, [loadNotes]);

  const deleteDocument = useCallback(async (id: string) => {
    const result = await safeInvoke<any>('delete-document', id, { fallback: { success: false } });
    if (result?.success) {
      setNotes(prev => prev.filter(n => n.id !== id));
    }
    return result || { success: false };
  }, []);

  return {
    notes,
    notesByType,
    allTags,
    allCategories,
    searchQuery,
    setSearchQuery,
    loadNotes,
    loadAllNotes,
    saveNote,
    saveDocument,
    deleteNote,
    deleteDocument,
    searchNotes,
    createNote,
  };
}
