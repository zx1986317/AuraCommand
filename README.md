# AuraCommand

**私人 AI 指挥座舱** — 一款基于 Electron + React 的本地知识管理与 AI 助手桌面应用。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28+-blue.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)

---

## ✨ 核心功能

### 📚 书桌 (Desk)
- **便签** — 快速记录想法，支持模板、标签、置顶
- **文档** — 富文本编辑器（TipTap），支持分类管理、双链引用
- **文档分类** — 自定义分类，药丸式选择器，颜色标识
- **AI 侧边栏** — 文档上下文感知对话，支持图片上传、代码高亮、来源跳转

### 💬 AI Chat
- **多会话管理** — 新建、切换、重命名、删除、置顶
- **角色系统** — 预设角色 + 自定义角色，独立 System Prompt
- **快捷指令** — `/` 触发 Prompt 模板库
- **RAG 检索** — 本地知识库增强回答
- **联网搜索** — SearXNG 集成，实时信息获取
- **Agent 模式** — 工具调用，自动化任务执行
- **消息操作** — 编辑重发、重新生成、分支切换、书签收藏

### 🗂️ 知识库 (Knowledge Base)
- **文件导入** — 拖拽导入，支持 PDF、Word、Markdown、TXT 等
- **全文检索** — SQLite FTS5 高效搜索
- **语义检索** — 向量相似度搜索（BGE-M3 / Qwen-Embed）
- **混合检索** — RRF 融合排序，精准匹配
- **标签系统** — 多标签分类，筛选过滤
- **目录树** — 文件夹层级管理

### ✅ 待办事项 (Tasks)
- **多视图** — 列表 / 看板 / 日历
- **优先级** — 四象限分类
- **关联** — 与便签、文档双向链接

### ⚙️ 工作流 (Workflows)
- **自动化** — 定时任务、事件触发
- **可视化编辑** — 拖拽式流程设计
- **MCP 集成** — 外部工具调用

### 🧠 AI 记忆
- **长期记忆** — 持久化用户偏好与上下文
- **关联度评分** — 智能召回相关信息

---

## 🖼️ 界面预览

| 书桌 | AI Chat |
|:---:|:---:|
| ![Desk](screenshots/desk.png) | ![Chat](screenshots/chat.png) |

| 知识库 | 待办事项 |
|:---:|:---:|
| ![KB](screenshots/kb.png) | ![Tasks](screenshots/tasks.png) |

---

## 🚀 快速开始

### 环境要求

- **Node.js** 18+ (推荐 LTS)
- **Ollama** 本地服务运行中
- Windows / macOS / Linux

### 安装 Ollama 模型

```bash
# 对话模型
ollama pull <你的对话模型名>

# 向量模型（用于语义检索）
ollama pull <你的嵌入模型名>
```

### 运行项目

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建打包
npm run build
```

### 数据存储

- 默认 Vault 目录：`~/Documents/AuraVault`
- 所有数据本地存储，隐私安全

---

## ⚙️ 配置

### SearXNG 联网搜索（可选）

如需启用联网搜索功能，请部署 [SearXNG](https://github.com/searxng/searxng) 并在设置中配置地址。

详见 [README-SEARXNG.md](README-SEARXNG.md)

### MCP 服务器（可选）

支持 Model Context Protocol，可连接外部工具和服务。

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron 28+ |
| 前端 | React 18, TypeScript |
| 构建 | Vite |
| 状态管理 | Zustand |
| 编辑器 | TipTap |
| 数据库 | SQLite (better-sqlite3) |
| 向量检索 | LanceDB |
| AI 后端 | Ollama API |
| 样式 | Tailwind CSS, Framer Motion |

---

## 📁 项目结构

```
auracommand-app/
├── electron/           # Electron 主进程
│   ├── ipc/           # IPC 处理模块
│   ├── services/      # 后台服务
│   └── main.ts        # 入口
├── src/
│   ├── components/    # React 组件
│   ├── pages-v2/      # 页面
│   ├── hooks/         # 自定义 Hooks
│   ├── store/         # Zustand 状态
│   └── services/      # 前端服务
├── docs/              # 设计文档
└── package.json
```

---

## 📝 开发路线

- [ ] 多语言支持 (i18n)
- [ ] 云同步
- [ ] 移动端 companion app
- [ ] 插件系统

---

## 🤝 贡献

欢迎 Issue 和 Pull Request！

---

## 📄 许可证

[MIT License](LICENSE)

---

<p align="center">
  <b>AuraCommand</b> — 你的数据，你的 AI，你的指挥座舱
</p>
