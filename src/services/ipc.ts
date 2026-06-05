type IpcRenderer = Window['ipcRenderer'];

const ipc: IpcRenderer = window.ipcRenderer;

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const ipcService = {
  invoke: (channel: string, ...args: any[]): Promise<any> => {
    if (!ipc) return Promise.reject(new Error('ipcRenderer not available'));
    return ipc.invoke(channel, ...args);
  },

  on: (channel: string, listener: (...args: any[]) => void) => {
    if (!ipc) return;
    ipc.on(channel, listener);
  },

  off: (channel: string, listener: (...args: any[]) => void) => {
    if (!ipc) return;
    ipc.off(channel, listener);
  },

  memos: {
    getAll: () => ipcService.invoke('get-memos'),
    getById: (id: string) => ipcService.invoke('get-memo-by-id', id),
    save: (memo: any) => ipcService.invoke('save-memo', memo),
    delete: (id: string) => ipcService.invoke('delete-memo', id),
    searchByTitle: async (titleQuery: string) => {
      const memos = await ipcService.invoke('get-memos');
      const query = titleQuery.trim().toLowerCase();
      if (!query) return memos;
      return (memos || []).filter((memo: any) => String(memo.title || '').toLowerCase().includes(query));
    },
    searchByTag: (tag: string) => ipcService.invoke('search-memos-by-tag', { tag }),
    getBacklinks: async (memoId: string) => {
      const memo = await ipcService.invoke('get-memo-by-id', memoId);
      if (!memo?.title) return [];
      return ipcService.invoke('get-memo-backlinks', { title: memo.title, excludeId: memoId });
    },
    deleteTag: (tagName: string) => ipcService.invoke('delete-tag', tagName),
    renameTag: (oldName: string, newName: string) => ipcService.invoke('rename-tag', { oldName, newName }),
    batchDelete: (ids: string[]) => ipcService.invoke('batch-delete-memos', ids),
  },

  documents: {
    getAll: () => ipcService.invoke('get-documents'),
    getById: (id: string) => ipcService.invoke('get-document-by-id', id),
    save: (document: any) => ipcService.invoke('save-document', document),
    delete: (id: string) => ipcService.invoke('delete-document', id),
    search: (query: string) => ipcService.invoke('search-documents', query),
  },

  files: {
    getAll: () => ipcService.invoke('get-vault-files'),
    import: (paths: string[]) => ipcService.invoke('import-files', { filePaths: paths }),
    delete: (id: string) => ipcService.invoke('delete-file', { id }),
  },

  export: {
    markdown: async (title: string, content: string, type: 'memo' | 'chat') => {
      const safeTitle = (title || type).replace(/[\\/:*?"<>|]/g, '-');
      downloadTextFile(`${safeTitle}.md`, content, 'text/markdown;charset=utf-8');
      return { success: true };
    },
  },

  clipboard: {
    write: async (text: string) => {
      await navigator.clipboard.writeText(text);
      return { success: true };
    },
  },

  quickNote: {
    save: (content: string) => ipcService.invoke('save-memo', {
      id: crypto.randomUUID(),
      title: '快捷笔记',
      content,
      project: '默认项目',
      category: '收件箱',
      tags: [],
      images: []
    }),
    close: async () => {
      window.close();
      return { success: true };
    },
  },

  workflow: {
    list: async () => {
      const result = await ipcService.invoke('get-agent-workflows');
      return result?.workflows || [];
    },
    save: (workflow: any) => ipcService.invoke('save-agent-workflow', workflow),
    delete: (id: string) => ipcService.invoke('delete-agent-workflow', { id }),
    run: (params: { workflowId: string; variables?: Record<string, string>; model?: string; searxngUrl?: string }) =>
      ipcService.invoke('execute-agent-workflow', { workflowId: params.workflowId, manualTrigger: true }),
    getTools: async () => [],
    onRunLog: (listener: (...args: any[]) => void) => ipcService.on('workflow-run-log', listener),
    offRunLog: (listener: (...args: any[]) => void) => ipcService.off('workflow-run-log', listener),
    onNodeStart: (listener: (...args: any[]) => void) => ipcService.on('workflow-node-start', listener),
    offNodeStart: (listener: (...args: any[]) => void) => ipcService.off('workflow-node-start', listener),
    onNodeComplete: (listener: (...args: any[]) => void) => ipcService.on('workflow-node-complete', listener),
    offNodeComplete: (listener: (...args: any[]) => void) => ipcService.off('workflow-node-complete', listener),
  },
};
