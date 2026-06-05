export const SAMPLE_WORKSPACE_MEMOS = [
  {
    id: 'sample-memo-1',
    title: '项目例会纪要',
    content: '今天讨论了 AuraCommand 的聚焦方向，结论是先围绕本地知识库、AI 问答和便签沉淀形成闭环。\n\n行动项：\n- [ ] 本周完成 AI 就绪度仪表盘\n- [ ] 优化知识库空状态\n- [ ] 为新用户准备示例工作区\n\n相关资料：[[竞品观察]] [[版本路线图]]',
    project: 'AuraCommand 示例工作区',
    category: '会议',
    tags: ['会议', '产品']
  },
  {
    id: 'sample-memo-2',
    title: '竞品观察',
    content: '对比结论：大众效率产品的核心不是功能数量，而是 3 分钟内让用户感知价值。\n\n观察点：\n1. 首次打开必须可体验\n2. 搜索与总结是最强需求\n3. 复杂自动化应该后置\n\n关联任务：[[发布前检查清单]]',
    project: 'AuraCommand 示例工作区',
    category: '项目',
    tags: ['竞品', '研究']
  },
  {
    id: 'sample-memo-3',
    title: '版本路线图',
    content: 'P0：本地知识库导入、关键词检索、AI 基础问答\nP1：示例工作区、AI 就绪度诊断、上下文面板\nP2：更强的语义关联、跨端记录入口\n\n下一阶段需要验证「知识库 + AI 对话」是否能形成留存飞轮。',
    project: 'AuraCommand 示例工作区',
    category: '工作',
    tags: ['规划', '版本']
  },
  {
    id: 'sample-memo-4',
    title: '用户访谈摘要',
    content: '受访用户普遍提到三件事：\n- 我需要一个安心放资料的地方\n- 我希望 AI 能用我的资料回答问题\n- 我不想先折腾模型才能开始\n\n结论：本地知识库是核心，Ollama 不能成为前置门槛。',
    project: 'AuraCommand 示例工作区',
    category: '工作',
    tags: ['用户研究', '访谈']
  },
  {
    id: 'sample-memo-5',
    title: '发布前检查清单',
    content: '发布前确认：\n- [ ] 便签创建流程顺滑\n- [ ] 知识库拖拽导入可用\n- [ ] AI 未就绪时有清晰引导\n- [ ] 示例工作区可一键导入\n- [ ] 设置页能看懂当前状态',
    project: 'AuraCommand 示例工作区',
    category: '工作',
    tags: ['清单', '发布']
  }
] as const;

export const SAMPLE_WORKSPACE_DOCS = [
  {
    title: '示例-产品需求摘要.md',
    content: '# 产品需求摘要\n\nAuraCommand 需要围绕「本地知识库 + AI 助手 + 便签沉淀」建立主线体验。\n\n## 成功标准\n- 新用户 3 分钟内完成首次资料导入\n- AI 在已有资料上给出可信回答\n- 空状态不再让用户无从下手\n'
  },
  {
    title: '示例-用户访谈记录.txt',
    content: '用户反馈节选：\n1. 我愿意把文档放进本地知识库，但不想先配环境。\n2. 我需要知道 AI 当前为什么不能用。\n3. 我希望写便签时能看到相关资料和待办。\n'
  },
  {
    title: '示例-发布计划.md',
    content: '# 发布计划\n\n## 本周\n- 完成 AI 就绪度仪表盘\n- 上线示例工作区\n- 在编辑器右侧展示当前上下文\n\n## 验证指标\n- 示例工作区导入完成率\n- 首次 AI 对话发起率\n- 知识库首日留存\n'
  }
] as const;
