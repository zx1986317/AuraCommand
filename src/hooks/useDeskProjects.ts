import { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '../utils/safeInvoke';
import { useAppStore } from '../store/appStore';

export function useDeskProjects() {
  const { setCurrentProjectName, currentProjectName } = useAppStore();
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(currentProjectName);
  const [projectItemIds, setProjectItemIds] = useState<Record<string, string[]>>({
    note: [], clip: [], task: [], kb_file: [],
  });
  const [showProjectPickerFor, setShowProjectPickerFor] = useState<{ type: string; id: string } | null>(null);
  const [newProjectName, setNewProjectName] = useState('');

  const loadProjects = useCallback(async () => {
    const result = await safeInvoke<string[]>('list-projects', undefined, { fallback: [] });
    setProjects(result || []);
  }, []);

  const loadProjectItems = useCallback(async (projectName: string) => {
    const result = await safeInvoke<any>('list-project-items', { projectName }, { fallback: { items: [] } });
    const byType = { note: [] as string[], clip: [] as string[], task: [] as string[], kb_file: [] as string[] };
    for (const item of (result?.items || [])) {
      const t = item.item_type as string;
      if (t in byType) byType[t as keyof typeof byType].push(item.item_id);
    }
    setProjectItemIds(byType);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    setCurrentProjectName(selectedProject);
    if (selectedProject) {
      loadProjectItems(selectedProject);
    } else {
      setProjectItemIds({ note: [], clip: [], task: [], kb_file: [] });
    }
  }, [selectedProject, loadProjectItems, setCurrentProjectName]);

  const handleAddToProject = useCallback(async (itemType: string, itemId: string, projectName: string) => {
    await safeInvoke('add-to-project', { projectName, itemType, itemId });
    if (selectedProject === projectName) await loadProjectItems(projectName);
    await loadProjects();
  }, [selectedProject, loadProjectItems, loadProjects]);

  const handleRemoveFromProject = useCallback(async (itemType: string, itemId: string, projectName: string) => {
    await safeInvoke('remove-from-project', { projectName, itemType, itemId });
    if (selectedProject === projectName) await loadProjectItems(projectName);
    await loadProjects();
  }, [selectedProject, loadProjectItems, loadProjects]);

  const handleAssignProject = useCallback(async (itemType: string, itemId: string, projectName: string) => {
    await handleAddToProject(itemType, itemId, projectName);
    setShowProjectPickerFor(null);
    setNewProjectName('');
  }, [handleAddToProject]);

  return {
    projects,
    selectedProject,
    setSelectedProject,
    projectItemIds,
    showProjectPickerFor,
    setShowProjectPickerFor,
    newProjectName,
    setNewProjectName,
    handleAddToProject,
    handleRemoveFromProject,
    handleAssignProject,
  };
}
