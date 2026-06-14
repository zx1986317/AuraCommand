import { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '../utils/safeInvoke';
import { useAppStore } from '../store/appStore';

export function useDeskProjects() {
  const { setCurrentProjectName, currentProjectName } = useAppStore();
  const [projects, setProjects] = useState<string[]>([]);
  const selectedProject = currentProjectName;
  const setSelectedProject = (name: string | null) => setCurrentProjectName(name);
  const [projectItemIds, setProjectItemIds] = useState<Record<string, string[]>>({
    note: [], document: [], clip: [], task: [], kb_file: [],
  });
  const [showProjectPickerFor, setShowProjectPickerFor] = useState<{ type: string; id: string } | null>(null);
  const [newProjectName, setNewProjectName] = useState('');

  const loadProjects = useCallback(async () => {
    const result = await safeInvoke<string[]>('list-projects', undefined, { fallback: [] });
    setProjects(result || []);
  }, []);

  const loadProjectItems = useCallback(async (projectName: string) => {
    const result = await safeInvoke<any>('list-project-items', { projectName }, { fallback: {} });
    const byType = { note: [] as string[], document: [] as string[], clip: [] as string[], task: [] as string[], kb_file: [] as string[] };
    if (result?.notes) byType.note = result.notes.map((n: any) => n.id);
    if (result?.documents) byType.document = result.documents.map((d: any) => d.id);
    if (result?.clips) byType.clip = result.clips.map((c: any) => c.id);
    if (result?.tasks) byType.task = result.tasks.map((t: any) => t.id);
    if (result?.kb_files) byType.kb_file = result.kb_files.map((f: any) => f.id);
    setProjectItemIds(byType);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectItems(selectedProject);
    } else {
      setProjectItemIds({ note: [], document: [], clip: [], task: [], kb_file: [] });
    }
  }, [selectedProject, loadProjectItems]);

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
