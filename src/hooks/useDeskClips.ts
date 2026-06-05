import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '../utils/safeInvoke';

const CLIPS_PER_PAGE = 12;

export function useDeskClips(activeTab: string, projectClipIds: string[]) {
  const [clips, setClips] = useState<any[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [showAddClipModal, setShowAddClipModal] = useState(false);
  const [previewClip, setPreviewClip] = useState<any | null>(null);
  const [clipSelectionMode, setClipSelectionMode] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [clipGroups, setClipGroups] = useState<any[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [selectedClipGroupId, setSelectedClipGroupId] = useState<string | null>(null);
  const [clipsPage, setClipsPage] = useState(1);

  const loadClips = useCallback(async () => {
    setClipsLoading(true);
    const result = await safeInvoke<any[]>('get-clips', undefined, { fallback: [] });
    setClips(result || []);
    setClipsLoading(false);
  }, []);

  const loadClipGroups = useCallback(async () => {
    const result = await safeInvoke<any[]>('get-clip-groups', undefined, { fallback: [] });
    setClipGroups(result || []);
  }, []);

  useEffect(() => {
    loadClips();
    loadClipGroups();
  }, []);

  useEffect(() => {
    if (activeTab === 'clips') {
      loadClips();
      loadClipGroups();
    }
  }, [activeTab, loadClips, loadClipGroups]);

  const filteredClips = useMemo(() => {
    let result = clips;
    if (projectClipIds.length > 0) {
      result = result.filter((c: any) => projectClipIds.includes(c.id));
    }
    if (selectedClipGroupId) {
      result = result.filter((c: any) =>
        c.group_id === selectedClipGroupId ||
        (c.groups && c.groups.some((g: any) => g.id === selectedClipGroupId))
      );
    }
    return result;
  }, [clips, projectClipIds, selectedClipGroupId]);

  const totalClipsPages = Math.max(1, Math.ceil(filteredClips.length / CLIPS_PER_PAGE));
  const paginatedClips = filteredClips.slice((clipsPage - 1) * CLIPS_PER_PAGE, clipsPage * CLIPS_PER_PAGE);

  return {
    clips,
    clipsLoading,
    filteredClips,
    paginatedClips,
    clipsPage,
    setClipsPage,
    totalClipsPages,
    showAddClipModal,
    setShowAddClipModal,
    previewClip,
    setPreviewClip,
    clipSelectionMode,
    setClipSelectionMode,
    selectedClipIds,
    setSelectedClipIds,
    clipGroups,
    loadClips,
    loadClipGroups,
    showCreateGroupModal,
    setShowCreateGroupModal,
    newGroupName,
    setNewGroupName,
    showGroupSelector,
    setShowGroupSelector,
    selectedClipGroupId,
    setSelectedClipGroupId,
  };
}
