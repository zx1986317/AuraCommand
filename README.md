# AuraCommand

**私人 AI 指挥座舱** — 本地优先、云端增强的 AI 知识管理桌面应用

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28+-blue.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)

---

## 特性总览

- **双引擎 AI** — Ollama 本地推理 + 云端模型（OpenAI / Claude / 通义千问 / 智谱等），按需切换
- **本地优先** — 所有数据存本地 SQLite，API Key 用系统 Keychain 加密，隐私安全
- **RAG 知识增强** — 向量语义检索 + 全文关键词搜索融合，精准召回
- **Agent 工具链** — MCP 协议集成，联网搜索、文件操作、文档导出等 60+ 工具
- **多语言 & 主题** — 中文/英文切换，浅色/深色/复古主题，跟随系统自动切换
- **无障碍适配** — prefers-reduced-motion 支持，键盘快捷键，ARIA 语义标注

---

## 核心功能

### AI 对话

| 功能 | 说明 |
|------|------|
| 多会话管理 | 新建、切换、重命名、删除、置顶、搜索 |
| 角色系统 | 预设角色 + 自定义角色，独立 System Prompt |
| 快捷指令 | `/` 触发 Prompt 模板库 |
| RAG 检索 | 本地知识库增强回答，来源可追溯 |
| 联网搜索 | SearXNG / 博查 / Bing，实时信息获取 |
| Agent 模式 | 工具调用，自动化任务执行 |
| 消息搜索高亮 | 关键词搜索 + 匹配导航 |
| 表情反应 | 对 AI 消息添加 emoji 反馈 |
| 回滚对话 | 撤销最后一轮对话，回到之前状态 |
| 模型徽章 | 每条 AI 消息显示模型名称 + 云端/本地标记 |
| 费用预估 | 云端调用前估算 token 用量和费用 |

### 书桌 (Desk)

| 功能 | 说明 |
|------|------|
| 便签 | 快速记录，模板、标签、置顶 |
| 文档 | TipTap 富文本编辑，分类管理 |
| 文档分类 | 自定义分类，药丸式选择器，颜色标识 |
| AI 侧边栏 | 文档上下文感知对话，图片上传、代码高亮 |
| 虚拟滚动 | 长列表自动启用虚拟滚动，性能优化 |
| 撤销/重做 | 栈式历史记录 + 防抖合并 |

### 知识库 (Knowledge Base)

| 功能 | 说明 |
|------|------|
| 文件导入 | 拖拽导入，支持 PDF / Word / Markdown / TXT 等 |
| 全文检索 | SQLite FTS5 高效搜索 |
| 语义检索 | 向量相似度搜索（BGE-M3 / Qwen-Embed） |
| 混合检索 | RRF 融合排序，精准匹配 |
| 知识要点 | AI 自动提取文件关键事实，分类浏览 |
| 标签系统 | 多标签分类，筛选过滤 |
| 目录树 | 文件夹层级管理 |

### 待办事项 (Tasks)

| 功能 | 说明 |
|------|------|
| 多视图 | 列表 / 看板 / 日历 |
| 优先级 | 四象限分类 |
| 关联 | 与便签、文档双向链接 |

### 工作流 (Workflows)

| 功能 | 说明 |
|------|------|
| 自动化 | 定时任务、事件触发 |
| 可视化编辑 | 拖拽式流程设计 |
| MCP 集成 | 外部工具调用 |

### AI 记忆

| 功能 | 说明 |
|------|------|
| 长期记忆 | 持久化用户偏好与上下文 |
| 关联度评分 | 高关联度记忆自然融入回答，低关联度仅做风格参考 |
| 记忆分层 | 画像记忆 vs 背景记忆，严格引用规则 |

---

## AI 引擎

### 本地模型 (Ollama)

- 自动检测本地 Ollama 服务和可用模型
- 支持 `think:true` 推理模式，不兼容时自动回退
- Context 超限自动扩展 `num_ctx` 并重试
- 视觉模型（qwen3-vl / minicpm-v 等）图片理解

### 云端模型

| 提供商 | 支持的模型 |
|--------|-----------|
| OpenAI | GPT-4o, GPT-4-turbo, GPT-3.5 等 |
| Anthropic | Claude 3.5/4 Sonnet, Claude 3.5 Haiku, Claude Opus 等 |
| 通义千问 | Qwen-Turbo, Qwen-Plus, Qwen-Max 等 |
| 智谱 | GLM-4, GLM-4V 等 |
| 自定义 | 兼容 OpenAI API 的任意端点 |

### 智能路由

- 本地优先，失败自动降级到云端
- 云端失败自动回退到本地
- 降级时显示横幅通知
- 能力芯片互斥（如 imageGen 与 chat）

---

## 安全

| 特性 | 说明 |
|------|------|
| Keychain 加密 | API Key 使用系统级安全存储（Windows Credential Manager / macOS Keychain / Linux libsecret） |
| 本地数据 | 所有数据存本地 SQLite，不上传 |
| SafeStorage | Electron safeStorage 加密敏感配置 |

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+1~5` | 切换标签页 |
| `Ctrl+N` | 新建便签 |
| `Ctrl+Shift+T` | 新建任务 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Esc` | 关闭弹窗 |
| `Enter` | 搜索下一个匹配 |
| `Shift+Enter` | 搜索上一个匹配 |

---

## 快速开始

### 环境要求

- **Node.js** 18+ (推荐 LTS)
- **Ollama** (本地推理) 或云端 API Key
- Windows / macOS / Linux

### 安装

```bash
# 克隆仓库
git clone https://github.com/zx1986317/AuraCommand.git
cd AuraCommand

# 安装依赖
npm install

# 开发模式
npm run dev
```

### Ollama 模型（可选）

```bash
# 对话模型
ollama pull qwen3:8b

# 视觉模型
ollama pull qwen3-vl:8b

# 向量模型（语义检索）
ollama pull bge-m3
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm test          # 单次运行
npm run test:watch # 监听模式
```

---

## 配置

### 云端模型

在 **设置 → AI 模型** 中添加云端模型，填写 Provider、API Key、Base URL。选择 Provider 时自动填充默认 Base URL。

### SearXNG 联网搜索（可选）

部署 [SearXNG](https://github.com/searxng/searxng) 并在设置中配置地址。

### MCP 服务器（可选）

支持 Model Context Protocol，可连接外部工具和服务。

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron 28+ |
| 前端 | React 18, TypeScript |
| 构建 | Vite, electron-builder |
| 状态管理 | Zustand |
| 编辑器 | TipTap |
| 数据库 | SQLite (better-sqlite3) |
| 向量检索 | LanceDB |
| AI 本地 | Ollama API |
| AI 云端 | OpenAI / Anthropic / 通义千问 / 智谱 |
| 样式 | Tailwind CSS, Framer Motion |
| 国际化 | 自研轻量 i18n (zh-CN / en-US) |
| 测试 | Vitest |

---

## 项目结构

```
auracommand-app/
├── electron/               # Electron 主进程
│   ├── ipc/               # IPC 处理模块（chat, knowledge, cloud, notes...）
│   ├── services/          # 后台服务（digest, memory, rag, workflow...）
│   ├── util/              # 工具函数（apiKeyStore, costEstimate, ttlCache...）
│   ├── search/            # 搜索引擎（queryParser, searxng...）
│   ├── cloudModel.ts      # 云端模型适配层
│   ├── modelRouter.ts     # AI 模型路由（本地/云端/降级）
│   ├── ollama.ts          # Ollama 适配层
│   └── main.ts            # 入口
├── src/
│   ├── components/        # React 组件
│   │   ├── chat/          # 聊天相关（ModelBadge, MessageSearch, Reactions...）
│   │   ├── common/        # 通用组件（LoadingState, EmptyState, VirtualList）
│   │   ├── kb/            # 知识库组件（KBDigestView, KBFileDetail...）
│   │   └── settings/      # 设置面板
│   ├── pages-v2/          # 页面（Chat, Desk, Knowledge, Tasks, Memory...）
│   ├── hooks/             # 自定义 Hooks（useChatStream, useHistory, useShortcuts...）
│   ├── store/             # Zustand 状态管理
│   ├── i18n/              # 国际化（I18nContext, LocaleSwitcher, ThemeSwitcher）
│   ├── shared/            # 主进程/渲染进程共享模块
│   ├── utils/             # 工具函数（chatSearch, modelKind）
│   └── styles/            # 全局样式 + 主题变量
├── test/                   # 测试
│   ├── common/            # 前端测试
│   └── electron/          # 后端测试
├── docs/                   # 设计文档
└── package.json
```

---

## 许可证

[MIT License](LICENSE)

---

<p align="center">
  <b>AuraCommand</b> — 你的数据，你的 AI，你的指挥座舱
</p>
