# 项目生命周期 IPC 契约规格

> **目的**：定义 P0-#3「项目生命周期入口」新增的 3 个 IPC channel、3 个 Zod schema、store 状态、UI 行为，供前后端并行实现时统一参考。
> **目标读者**：sub-agent A（后端）、sub-agent B（前端）、集成验证
> **数据模型约束**：项目 = `project_items.project_name` 的 DISTINCT 字符串，不存在独立 `projects` 表。创建/删除/重命名 = 操作 `project_items` 表。

---

## 1. 新增 Zod Schemas（写入 `electron/ipc/schemas.ts`）

在 `// ─── Projects ───` 分区（紧邻 `SaveSyncConfigSchema` 上方或 `AddToProjectSchema` 同区）追加：

```ts
// ─── Projects (项目生命周期) ─────────────────────
export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, '项目名不能为空').max(100, '项目名最长 100 字符'),
})

export const RenameProjectSchema = z.object({
  oldName: z.string().min(1).max(100),
  newName: z.string().trim().min(1, '项目名不能为空').max(100, '项目名最长 100 字符'),
})

export const DeleteProjectSchema = z.object({
  name: z.string().min(1).max(100),
})
```

**重要**：
- 三个 schema **不能有** `default` 字段，避免吞掉空字符串
- `trim()` 强制去掉首尾空白，UI 二次校验的"已存在"判断应基于 trim 后的值
- 与现有 `AddToProjectSchema` 风格保持一致（`min(1).max(100)`）

---

## 2. 新增 IPC Handlers（写入 `electron/ipc/projects.ts`）

在 `createProjectsModule` 返回对象中追加 3 个 handler：

### 2.1 `create-project`

**签名**：
```ts
'create-project': async (_event: any, args: { name: string }) => Promise<{
  success: true
  projects: string[]
}>
```

**行为**：
1. 用 `validateInput(CreateProjectSchema, args, 'create-project')` 校验
2. 查 `SELECT 1 FROM project_items WHERE project_name = ? LIMIT 1`，若存在则抛 `new Error('项目已存在')`（由 `withErrorHandling` 转成 `{ success: false, error: ... }`）
3. **占位插入**（关键！）：`INSERT OR IGNORE INTO project_items (project_name, item_type, item_id) VALUES (?, '__placeholder__', ?)`，其中 `item_id` 用 `'_init_' + Date.now()`（避免与真实 item_id 冲突；UI 层用 `list-projects` 的 DISTINCT 拿不到这个 placeholder 行，所以无副作用）。**或更优解**：在 migrations 中新建 `projects` 元数据表 —— 详见 §2.2 备选。
4. 返回最新项目列表 `await listProjectsRaw()`，结构为 `string[]`
5. `logInfo('Project created', { name: validated.name })`

### 2.2 备选方案（更干净）：新建 `projects` 元数据表

**问题**：用 `project_items.__placeholder__` 占位会污染 `project_items` 表，RAG 搜索时需排除。

**建议方案**：在 `electron/db/migrations.ts` 末尾追加新 migration（id 自增，不影响既有 migrations）：

```ts
CREATE TABLE IF NOT EXISTS projects (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

然后 `create-project` 改为：
```ts
await dbHelper.runQuery(
  "INSERT INTO projects (name, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))",
  [validated.name]
)
```

`list-projects` 改为 `SELECT name FROM projects ORDER BY created_at DESC`（**注意**：这会改变现有 list-projects 的语义——从"使用过的项目"变成"显式创建的项目"。是否破坏向后兼容？**需要确认**。如果担心破坏，可保留 `list-projects` 用 DISTINCT，新增 `list-all-projects` 用元数据表）。

**最终决定（请 sub-agent A 实施）**：采用**备选方案**，因为它语义清晰、不污染数据。

迁移策略：
- 在 `migrations.ts` 末尾追加新 migration
- 新建 `projects` 表
- **不要**改 `list-projects`（向后兼容），保留 DISTINCT 查询
- 三个新 handler 内部用新表，**互不影响**

### 2.3 `rename-project`

**签名**：
```ts
'rename-project': async (_event: any, args: { oldName: string; newName: string }) => Promise<{
  success: true
  projects: string[]
}>
```

**行为**：
1. 校验
2. 同名校验：`SELECT 1 FROM project_items WHERE project_name = ? AND project_name != ? LIMIT 1`，存在则抛错
3. 更新 `project_items`：
   ```sql
   UPDATE project_items SET project_name = ? WHERE project_name = ?
   ```
4. 更新 `notes.project`（旧字段兼容）：
   ```sql
   UPDATE notes SET project = ? WHERE project = ?
   ```
5. 返回最新列表 + `logInfo('Project renamed', { oldName, newName })`

### 2.4 `delete-project`

**签名**：
```ts
'delete-project': async (_event: any, args: { name: string }) => Promise<{
  success: true
  projects: string[]
}>
```

**行为**：
1. 校验
2. 删除 `project_items`：
   ```sql
   DELETE FROM project_items WHERE project_name = ?
   ```
3. 清空 `notes.project`（仅对当前 project 等于该名的）：
   ```sql
   UPDATE notes SET project = '' WHERE project = ?
   ```
4. 返回最新列表 + `logInfo('Project deleted', { name })`

**不要**：
- ❌ 不要级联删除该项目的便签/任务/知识库文件（项目是"聚合标签"，不应有破坏性）
- ❌ 不要物理删除 `notes` 表数据

### 2.5 公共：`listProjectsRaw` 辅助函数

```ts
async function listProjectsRaw(): Promise<string[]> {
  const rows = await dbHelper.allQuery(
    'SELECT name FROM projects ORDER BY created_at DESC'
  )
  return rows.map((r: any) => r.name)
}
```

---

## 3. 新增 Store 状态（写入 `src/store/appStore.ts`）

在 `AppState` interface 末尾（`currentProjectName` 之后）追加：

```ts
projects: string[]
setProjects: (projects: string[]) => void
addProjectLocal: (name: string) => void
removeProjectLocal: (name: string) => void
renameProjectLocal: (oldName: string, newName: string) => void
```

在 store 实现中追加初始值和方法：

```ts
projects: [],
setProjects: (projects) => set({ projects }),
addProjectLocal: (name) =>
  set((state) =>
    state.projects.includes(name) ? state : { projects: [name, ...state.projects] }
  ),
removeProjectLocal: (name) =>
  set((state) => ({ projects: state.projects.filter((p) => p !== name) })),
renameProjectLocal: (oldName, newName) =>
  set((state) => ({
    projects: state.projects.map((p) => (p === oldName ? newName : p)),
  })),
```

**关键约束**：
- `setProjects` 用于"从后端拉取后整体替换"
- `add/remove/renameLocal` 用于"乐观更新"——handler 返回前先调用，立即反映到 UI
- 命名后缀 `Local` 明确表示"仅修改本地状态，不触发 IPC"

---

## 4. 新增 Service 包装（写入 `src/services/ipc.ts`）

在 `ipcService` 对象中追加 `projects` 命名空间：

```ts
projects: {
  list: () => ipcService.invoke('list-projects'),
  create: (name: string) => ipcService.invoke('create-project', { name }),
  rename: (oldName: string, newName: string) =>
    ipcService.invoke('rename-project', { oldName, newName }),
  delete: (name: string) => ipcService.invoke('delete-project', { name }),
},
```

**风格**：与现有 `memos` / `documents` / `files` / `workflow` 命名空间保持一致（`xxx` + 方法集合）。

---

## 5. UI 行为（写入 `src/components/Sidebar.tsx`）

### 5.1 现状

当前 `Sidebar.tsx` 已有项目切换器（`projectDropdownOpen` 状态 + `handleProjectSelect`），但**无新建/重命名/删除入口**。

### 5.2 新增 UI 元素

**位置**：项目切换器按钮**右侧**（`ChevronDown` 之前或之后），新增两个小图标按钮：

```
┌─────────────────────────────────┐
│ 📁 IoT反控巡检       ＋  ⋯   ▾ │
└─────────────────────────────────┘
```

- **`+` 按钮**（`Plus` 图标，14px）：点击 → 弹出输入型 Modal 让用户输入新项目名
- **`...` 按钮**（`MoreHorizontal` 图标，14px）：点击 → 弹出 Popover/Dropdown 包含 2 项：
  - "重命名"（仅当 `currentProjectName` 不为 null 时启用）
  - "删除"（仅当 `currentProjectName` 不为 null 时启用）

### 5.3 Modal 触发逻辑（用现有 `setModalConfig`）

**新建**：
```ts
setModalConfig({
  isOpen: true,
  title: '新建项目',
  message: '为这个项目起个名字',
  inputDefaultValue: '',
  onConfirm: async (inputValue) => {
    if (!inputValue?.trim()) return
    try {
      const projects = await ipcService.projects.create(inputValue.trim())
      addProjectLocal(inputValue.trim())
      setCurrentProjectName(inputValue.trim())
      setNotification({ message: `已创建项目：${inputValue.trim()}`, type: 'success' })
    } catch (err: any) {
      setNotification({ message: `创建失败：${err.message}`, type: 'error' })
    }
  },
})
```

**重命名**：
```ts
setModalConfig({
  isOpen: true,
  title: '重命名项目',
  message: '新的项目名',
  inputDefaultValue: currentProjectName,
  onConfirm: async (inputValue) => {
    if (!inputValue?.trim() || inputValue === currentProjectName) return
    try {
      await ipcService.projects.rename(currentProjectName, inputValue.trim())
      renameProjectLocal(currentProjectName, inputValue.trim())
      setCurrentProjectName(inputValue.trim())
      setNotification({ message: '已重命名', type: 'success' })
    } catch (err: any) {
      setNotification({ message: `重命名失败：${err.message}`, type: 'error' })
    }
  },
})
```

**删除**（二次确认）：
```ts
setModalConfig({
  isOpen: true,
  title: '删除项目',
  message: `确认删除项目 "${currentProjectName}"？这会移除项目与所有资料的关联，但不会删除资料本身。`,
  type: 'confirm',
  onConfirm: async () => {
    try {
      await ipcService.projects.delete(currentProjectName)
      removeProjectLocal(currentProjectName)
      setCurrentProjectName(null)  // 删除后切回"全部内容"
      setNotification({ message: '项目已删除', type: 'success' })
    } catch (err: any) {
      setNotification({ message: `删除失败：${err.message}`, type: 'error' })
    }
  },
})
```

### 5.4 边界处理

- **`+` 永远可点**（不依赖 `currentProjectName`）
- **`...` 在 `currentProjectName` 为 null 时禁用**（变灰，无 hover 效果），鼠标悬停 tooltip "请先选择一个项目"
- **空输入** → Modal 内部 input 应阻止 onConfirm 触发（检查 `inputValue.trim() === ''`）
- **同名创建** → 后端抛 `项目已存在`，toast 红字提示
- **删除当前项目后** → 自动切到"全部内容"（`setCurrentProjectName(null)`）

### 5.5 通知

成功/失败均通过 `setNotification` 反馈（与全应用 toast 体系一致）。**不要**在 Sidebar 内自建 toast 组件。

---

## 6. 测试要求

### 6.1 后端单测（`test/electron/projects.test.ts`）

用 vitest + better-sqlite3 内存数据库（`:memory:`），覆盖：

| 用例 | 期望 |
|---|---|
| create-project: 正常路径 | 返回 projects 列表，DB 有记录 |
| create-project: 同名 | 抛 `项目已存在` |
| create-project: 空名 | 抛 `项目名不能为空` |
| create-project: 超 100 字符 | 抛 `项目名最长 100 字符` |
| rename-project: 正常 | project_items + notes.project 同步更新 |
| rename-project: 同名（oldName === newName） | 抛错 |
| rename-project: 改成已存在名 | 抛 `项目已存在` |
| delete-project: 正常 | project_items 删除、notes.project 清空 |
| delete-project: 不存在项目 | 抛错 |
| list-projects: 排序 | 按 created_at DESC |

### 6.2 前端单测（`test/components/Sidebar.test.tsx`，可选）

用 vitest + @testing-library/react + jsdom，覆盖：

| 用例 | 期望 |
|---|---|
| 点击 `+` 触发 setModalConfig.inputDefaultValue='' | Modal 打开 |
| `currentProjectName=null` 时 `...` 按钮 disabled | DOM 有 `disabled` 属性 |
| 输入空名点确认 | onConfirm 早 return，不发 IPC |

**前端测试不强制**：若 jsdom + testing-library 集成复杂度高，**可省略**，但需在测试文件加注释说明。**后端测试必须**。

### 6.3 测试运行

```bash
cd auracommand-app
npm install
npm run test
```

预期输出：所有用例通过。

---

## 7. 不应改动的文件 / 不应做的事项

为避免 scope creep（不在 P0-#3 范围），**禁止**：

- ❌ 改动 `list-projects` 现有实现（向后兼容）
- ❌ 改动 `add-to-project` / `remove-from-project` 现有 handler
- ❌ 改动 `docs/项目功能方案.md`
- ❌ 改项目面板 UI（项目切换器样式优化是 P2-#13，不在本任务）
- ❌ 加项目管理侧边栏（重构 UI 是更大范围，超出本任务）
- ❌ 写 Onboarding（属于另一个 P0-#2）
- ❌ 改任何无关文件

---

## 8. 验收标准

1. ✅ `npm run build` 编译通过（无 TS 错误）
2. ✅ `npm run test` 所有后端单测通过
3. ✅ 手动验证 3 个流程（创建/重命名/删除）能跑通
4. ✅ 侧栏项目切换器旁有 `+` 和 `...` 按钮
5. ✅ Toast 通知正确显示成功/失败
6. ✅ 文档（`docs/PROJECTS-IMPLEMENTATION-LOG.md`）记录所有改动 + 测试结果 + 实施过程问题
