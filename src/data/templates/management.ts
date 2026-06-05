import type { MemoTemplate } from '../templateTypes';

export const MANAGEMENT_TEMPLATES: MemoTemplate[] = [
  {
    id: 'project-charter',
    name: '项目章程',
    description: '项目目标、范围、里程碑和团队',
    icon: 'flag',
    category: '管理文档',
    type: 'document',
    title: '项目章程 - 搜索优化',
    content: `<h1>搜索优化 — 项目章程</h1>
<h2>1. 项目概述</h2>
<h3>1.1 项目背景</h3>
<p>当前搜索功能用户体验差，零结果率高达 35%，用户投诉量持续上升。需要对搜索功能进行系统性优化。</p>
<h3>1.2 项目目标</h3>
<table>
<thead><tr><th>目标</th><th>衡量标准</th><th>目标值</th></tr></thead>
<tbody>
<tr><td>提升搜索准确率</td><td>零结果率</td><td>&lt; 10%</td></tr>
<tr><td>提升搜索速度</td><td>P99 延迟</td><td>&lt; 200ms</td></tr>
<tr><td>提升用户满意度</td><td>NPS 评分</td><td>&gt; 40</td></tr>
</tbody>
</table>
<h3>1.3 项目范围</h3>
<p><strong>包含</strong>：</p>
<ul>
<li>搜索引擎选型与迁移</li>
<li>搜索 API 重构</li>
<li>搜索前端交互优化</li>
</ul>
<p><strong>不包含</strong>：</p>
<ul>
<li>搜索广告系统（独立项目）</li>
<li>跨语言搜索（v2 范围）</li>
</ul>
<h2>2. 团队</h2>
<table>
<thead><tr><th>角色</th><th>姓名</th><th>职责</th></tr></thead>
<tbody>
<tr><td>项目经理</td><td>张明</td><td>项目管理、风险把控</td></tr>
<tr><td>后端开发</td><td>陈杰</td><td>搜索引擎搭建、API 开发</td></tr>
<tr><td>前端开发</td><td>王芳</td><td>搜索交互、结果展示</td></tr>
<tr><td>测试</td><td>李华</td><td>功能测试、性能测试</td></tr>
</tbody>
</table>
<h2>3. 里程碑</h2>
<table>
<thead><tr><th>里程碑</th><th>目标日期</th><th>交付物</th><th>状态</th></tr></thead>
<tbody>
<tr><td>技术方案确认</td><td>4月5日</td><td>技术方案文档</td><td>未开始</td></tr>
<tr><td>搜索引擎部署</td><td>4月20日</td><td>搜索服务上线</td><td>未开始</td></tr>
<tr><td>前后端联调</td><td>5月5日</td><td>联调通过</td><td>未开始</td></tr>
<tr><td>灰度发布</td><td>5月15日</td><td>5% 用户灰度</td><td>未开始</td></tr>
<tr><td>全量上线</td><td>5月30日</td><td>全量发布</td><td>未开始</td></tr>
</tbody>
</table>
<h2>4. 风险管理</h2>
<table>
<thead><tr><th>风险</th><th>概率</th><th>影响</th><th>应对策略</th></tr></thead>
<tbody>
<tr><td>搜索迁移数据丢失</td><td>低</td><td>高</td><td>全量备份 + 灰度发布</td></tr>
<tr><td>性能不达预期</td><td>中</td><td>高</td><td>提前做性能基准测试</td></tr>
</tbody>
</table>`,
    tags: '项目,管理,章程',
  },
  {
    id: 'okr',
    name: 'OKR 设定',
    description: '目标与关键结果设定和追踪',
    icon: 'target',
    category: '管理文档',
    type: 'document',
    title: 'OKR - Q2',
    content: `<h1>OKR — 2026 Q2</h1>
<h2>目标 1：打造行业领先的搜索体验</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>KR1：搜索零结果率从 35% 降至 10%</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>KR2：搜索 NPS 从 28 提升至 45</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>KR3：搜索结果点击率从 30% 提升至 50%</span></label></li>
</ul>
<p>信心指数：🔵🔵🔵⚪⚪</p>
<hr>
<h2>目标 2：建设本地 AI 能力壁垒</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>KR1：AI 对话功能日活用户达到 1000</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>KR2：AI 辅助写作功能上线并获得 500 周活用户</span></label></li>
</ul>
<p>信心指数：🔵🔵🔵🔵⚪</p>
<hr>
<h2>本周聚焦</h2>
<ol>
<li>完成搜索引擎技术选型</li>
<li>AI 对话功能联调测试</li>
</ol>
<h2>阻碍与风险</h2>
<ul>
<li>GPU 资源不足可能影响 AI 功能测试进度</li>
</ul>`,
    tags: 'OKR,目标,管理',
  },
  {
    id: 'sop',
    name: '标准操作流程',
    description: 'SOP：步骤化操作规范和检查清单',
    icon: 'list-checks',
    category: '管理文档',
    type: 'document',
    title: 'SOP - 版本发布流程',
    content: `<h1>版本发布 — 标准操作流程</h1>
<h2>文档信息</h2>
<table>
<tbody>
<tr><td><strong>版本</strong></td><td>v1.0</td></tr>
<tr><td><strong>生效日期</strong></td><td>{{日期}}</td></tr>
<tr><td><strong>负责人</strong></td><td>张明</td></tr>
<tr><td><strong>适用范围</strong></td><td>所有生产环境发布</td></tr>
</tbody>
</table>
<h2>1. 目的</h2>
<p>规范生产环境版本发布流程，确保发布过程可追溯、可回滚，降低线上故障风险。</p>
<h2>2. 前置条件</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>所有测试用例通过</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>Code Review 已完成</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>发布说明已编写</span></label></li>
</ul>
<h2>3. 操作步骤</h2>
<h3>步骤 1：创建发布分支</h3>
<p><strong>操作</strong>：从 develop 分支创建 release/vX.Y.Z 分支</p>
<p><strong>预期结果</strong>：分支创建成功，CI 流水线自动触发</p>
<h3>步骤 2：灰度发布</h3>
<p><strong>操作</strong>：在发布平台选择 5% 灰度，观察 30 分钟</p>
<p><strong>预期结果</strong>：错误率 < 0.1%，核心指标无异常</p>
<p><strong>异常处理</strong>：错误率 > 0.5% 立即回滚</p>
<h3>步骤 3：全量发布</h3>
<p><strong>操作</strong>：灰度无异常后，逐步扩大至 100%</p>
<p><strong>预期结果</strong>：所有用户使用新版本</p>
<h2>4. 检查清单</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>发布分支已创建</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>灰度 30 分钟观察无异常</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>全量发布完成</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>线上监控确认正常</span></label></li>
</ul>
<h2>5. 常见问题</h2>
<h3>Q1：灰度期间发现 Bug 怎么办？</h3>
<p><strong>A</strong>：立即在发布平台点击"回滚"，无需走审批流程。同时通知相关负责人修复。</p>`,
    tags: '管理,SOP,流程',
  },
  {
    id: 'decision-log',
    name: '决策记录',
    description: '架构/技术决策的背景、方案和结论',
    icon: 'git-branch',
    category: '管理文档',
    type: 'document',
    title: '决策记录 - 搜索引擎选型',
    content: `<h1>决策记录 — 搜索引擎选型</h1>
<h2>状态</h2>
<p>✅ 已决定</p>
<h2>背景</h2>
<p>当前使用 MySQL LIKE 查询实现搜索，不支持分词，性能差。需要选型一个搜索引擎满足业务需求。</p>
<h2>驱动因素</h2>
<ol>
<li>支持中文分词搜索</li>
<li>部署和维护成本可控</li>
</ol>
<h2>考虑方案</h2>
<h3>方案 A：Elasticsearch</h3>
<p><strong>优点</strong>：功能最强大，生态成熟，支持大规模数据</p>
<p><strong>缺点</strong>：运维成本高，JVM 内存占用大，学习曲线陡</p>
<h3>方案 B：MeiliSearch</h3>
<p><strong>优点</strong>：轻量级，单二进制部署，支持中文分词，API 简洁</p>
<p><strong>缺点</strong>：大规模数据（>千万）性能不如 ES</p>
<h2>决策</h2>
<p><strong>选择</strong>：方案 B — MeiliSearch</p>
<p><strong>理由</strong>：</p>
<ol>
<li>当前数据量 < 500 万，MeiliSearch 完全满足性能需求</li>
<li>团队 3 人，无专职运维，MeiliSearch 的免维护特性是关键优势</li>
<li>未来数据量超千万时再迁移 ES，架构层面已预留接口</li>
</ol>
<h2>影响</h2>
<ul>
<li>正面：搜索功能 2 周内可上线，运维几乎零成本</li>
<li>负面：未来如需迁移 ES 有一定迁移成本</li>
</ul>`,
    tags: '决策,架构,管理',
  },
  {
    id: 'weekly-report',
    name: '周报',
    description: '一周工作回顾与下周规划',
    icon: 'calendar-range',
    category: '管理文档',
    type: 'document',
    title: '周报 - {{日期}}',
    content: `<h2>📋 本周概要</h2>
<p>搜索功能技术选型完成，选定 MeiliSearch。前端搜索交互设计完成评审。</p>
<h2>✅ 本周完成</h2>
<ol>
<li>搜索引擎技术选型报告，确定使用 MeiliSearch</li>
<li>搜索结果页交互设计完成，已通过评审</li>
<li>修复了 3 个线上 Bug（登录白屏、文件上传进度条卡住、iOS 导航栏遮挡）</li>
</ol>
<h2>📈 关键进展</h2>
<p>搜索功能 P99 延迟在测试环境达到 120ms，超出预期目标 200ms</p>
<h2>⚠️ 遇到的问题</h2>
<p>MeiliSearch 中文分词对专有名词支持不佳，需要补充自定义词典</p>
<h2>📌 下周计划</h2>
<ol>
<li>部署 MeiliSearch 到测试环境</li>
<li>完成搜索 API 开发</li>
<li>前端搜索组件开发</li>
</ol>
<h2>🤝 需要协调</h2>
<p>需要运维协助准备 MeiliSearch 的 Docker 镜像和配置</p>`,
    tags: '周报,管理',
  },
  {
    id: 'training-manual',
    name: '培训手册',
    description: '新员工入职或技能培训的结构化手册',
    icon: 'book-open',
    category: '管理文档',
    type: 'document',
    title: '培训手册 - Git 工作流',
    content: `<h1>Git 工作流 — 培训手册</h1>
<h2>文档信息</h2>
<table>
<tbody>
<tr><td><strong>版本</strong></td><td>v1.0</td></tr>
<tr><td><strong>适用对象</strong></td><td>新入职开发工程师</td></tr>
<tr><td><strong>培训时长</strong></td><td>60 分钟</td></tr>
</tbody>
</table>
<h2>1. 培训目标</h2>
<p>完成培训后，学员能够：</p>
<ol>
<li>正确使用 Git Flow 进行日常开发</li>
<li>规范地提交代码和编写 Commit Message</li>
<li>独立完成 Code Review 流程</li>
</ol>
<h2>2. 培训大纲</h2>
<table>
<thead><tr><th>章节</th><th>内容</th><th>时长</th></tr></thead>
<tbody>
<tr><td>1. 分支策略</td><td>main/develop/feature/release 分支使用规范</td><td>15min</td></tr>
<tr><td>2. Commit 规范</td><td>Conventional Commits 格式和最佳实践</td><td>15min</td></tr>
<tr><td>3. Code Review</td><td>PR 流程、审查要点、常见问题</td><td>30min</td></tr>
</tbody>
</table>
<h2>3. 分支策略</h2>
<h3>3.1 分支命名</h3>
<table>
<thead><tr><th>类型</th><th>命名格式</th><th>示例</th></tr></thead>
<tbody>
<tr><td>功能</td><td>feature/描述</td><td>feature/user-search</td></tr>
<tr><td>修复</td><td>fix/描述</td><td>fix/login-white-screen</td></tr>
<tr><td>发布</td><td>release/版本号</td><td>release/v2.1.0</td></tr>
</tbody>
</table>
<h3>3.2 Commit Message 格式</h3>
<pre><code>type(scope): description

[可选] 详细说明

[可选] 关联 Issue: #123</code></pre>
<p><strong>常用 type</strong>：</p>
<ul>
<li><code>feat</code>：新功能</li>
<li><code>fix</code>：Bug 修复</li>
<li><code>docs</code>：文档更新</li>
<li><code>refactor</code>：代码重构</li>
</ul>
<h2>4. 实操演练</h2>
<h3>练习 1：创建功能分支并提交</h3>
<p><strong>目标</strong>：从 develop 创建 feature 分支，完成一次规范提交</p>
<p><strong>步骤</strong>：</p>
<ol>
<li><code>git checkout develop &amp;&amp; git pull</code></li>
<li><code>git checkout -b feature/my-first-feature</code></li>
<li>修改代码后 <code>git add .</code></li>
<li><code>git commit -m "feat(search): add search suggestion API"</code></li>
</ol>
<h2>5. 考核标准</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>能独立创建功能分支并提交规范 Commit</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>能独立完成 PR 创建和 Code Review</span></label></li>
</ul>`,
    tags: '管理,培训,手册',
  },
  {
    id: 'blank-document',
    name: '空白文档',
    description: '从零开始撰写一篇文档',
    icon: 'file-plus',
    category: '其他',
    type: 'document',
    title: '',
    content: '',
    tags: '',
  },
];
