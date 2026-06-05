import type { MemoTemplate } from '../templateTypes';

export const TECH_TEMPLATES: MemoTemplate[] = [
  {
    id: 'api-design',
    name: 'API 设计文档',
    description: '接口定义、请求响应格式和错误码',
    icon: 'code',
    category: '技术文档',
    type: 'document',
    title: 'API文档 - 用户模块',
    content: `<h1>用户模块 — API 设计文档</h1>
<h2>概述</h2>
<ul>
<li><strong>Base URL</strong>：<code>/api/v1/</code></li>
<li><strong>认证方式</strong>：Bearer Token</li>
<li><strong>数据格式</strong>：JSON</li>
</ul>
<h2>接口列表</h2>
<h3>1. 获取用户列表</h3>
<p><code>GET /api/v1/users</code></p>
<p><strong>请求参数</strong></p>
<table>
<thead><tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
<tbody>
<tr><td>page</td><td>int</td><td>否</td><td>页码，默认 1</td></tr>
<tr><td>pageSize</td><td>int</td><td>否</td><td>每页条数，默认 20</td></tr>
<tr><td>keyword</td><td>string</td><td>否</td><td>搜索关键词</td></tr>
</tbody>
</table>
<p><strong>响应示例</strong></p>
<pre><code>{
  "code": 0,
  "data": {
    "list": [
      {"id": "u001", "name": "张三", "email": "zhangsan@example.com"}
    ],
    "total": 156
  }
}</code></pre>
<h3>2. 创建用户</h3>
<p><code>POST /api/v1/users</code></p>
<p><strong>请求体</strong></p>
<pre><code>{
  "name": "张三",
  "email": "zhangsan@example.com",
  "role": "user"
}</code></pre>
<p><strong>响应示例</strong></p>
<pre><code>{
  "code": 0,
  "data": {"id": "u002"}
}</code></pre>
<h3>3. 更新用户</h3>
<p><code>PUT /api/v1/users/:id</code></p>
<h3>4. 删除用户</h3>
<p><code>DELETE /api/v1/users/:id</code></p>
<h2>错误码</h2>
<table>
<thead><tr><th>错误码</th><th>说明</th></tr></thead>
<tbody>
<tr><td>400</td><td>参数错误</td></tr>
<tr><td>401</td><td>未认证</td></tr>
<tr><td>403</td><td>无权限</td></tr>
<tr><td>404</td><td>资源不存在</td></tr>
<tr><td>500</td><td>服务端错误</td></tr>
</tbody>
</table>
<h2>变更记录</h2>
<table>
<thead><tr><th>日期</th><th>版本</th><th>变更</th></tr></thead>
<tbody>
<tr><td>{{日期}}</td><td>v1.0</td><td>初稿</td></tr>
</tbody>
</table>`,
    tags: '技术,API,接口',
  },
  {
    id: 'architecture-design',
    name: '架构设计文档',
    description: '系统架构、模块划分和技术选型',
    icon: 'boxes',
    category: '技术文档',
    type: 'document',
    title: '架构设计 - 内容平台',
    content: `<h1>内容平台 — 架构设计文档</h1>
<h2>1. 概述</h2>
<h3>1.1 项目背景</h3>
<p>当前内容管理使用单体架构，随着业务增长，部署频率受限，团队协作效率下降。需要拆分为微服务架构。</p>
<h3>1.2 设计目标</h3>
<ul>
<li>支持独立部署，各模块发布互不影响</li>
<li>核心接口 P99 延迟 < 200ms</li>
</ul>
<h3>1.3 术语表</h3>
<table>
<thead><tr><th>术语</th><th>含义</th></tr></thead>
<tbody>
<tr><td>CMS</td><td>内容管理系统</td></tr>
<tr><td>CDN</td><td>内容分发网络</td></tr>
</tbody>
</table>
<h2>2. 系统架构</h2>
<h3>2.1 整体架构</h3>
<pre><code>┌──────────┐    ┌──────────┐    ┌──────────────┐
│  Web 前端 │ →  │  API 网关 │ →  │  业务服务集群  │
└──────────┘    └──────────┘    └──────────────┘
                                      │
                               ┌──────┴──────┐
                               │  数据层      │
                               │ PostgreSQL   │
                               │ Redis        │
                               └─────────────┘</code></pre>
<h3>2.2 模块划分</h3>
<table>
<thead><tr><th>模块</th><th>职责</th><th>技术栈</th></tr></thead>
<tbody>
<tr><td>用户服务</td><td>认证、权限、用户信息</td><td>Go + PostgreSQL</td></tr>
<tr><td>内容服务</td><td>文章 CRUD、分类、标签</td><td>Node.js + MongoDB</td></tr>
<tr><td>搜索服务</td><td>全文搜索、搜索建议</td><td>Python + Elasticsearch</td></tr>
</tbody>
</table>
<h2>3. 技术选型</h2>
<table>
<thead><tr><th>领域</th><th>选型</th><th>理由</th></tr></thead>
<tbody>
<tr><td>API 网关</td><td>Kong</td><td>插件生态丰富，支持限流/认证</td></tr>
<tr><td>消息队列</td><td>RabbitMQ</td><td>可靠消息投递，支持延迟队列</td></tr>
<tr><td>缓存</td><td>Redis 7</td><td>高性能，支持数据结构丰富</td></tr>
<tr><td>监控</td><td>Prometheus + Grafana</td><td>社区成熟，可视化能力强</td></tr>
</tbody>
</table>
<h2>4. 数据模型</h2>
<pre><code>Entity: Article
  - id: string (PK)
  - title: string
  - content: text
  - author_id: string (FK -> User)
  - status: enum[draft, published, archived]
  - created_at: datetime
  - updated_at: datetime</code></pre>
<h2>5. 性能目标</h2>
<table>
<thead><tr><th>指标</th><th>目标值</th></tr></thead>
<tbody>
<tr><td>接口响应 P99</td><td>&lt; 200ms</td></tr>
<tr><td>并发量</td><td>&gt; 2000 QPS</td></tr>
<tr><td>可用性</td><td>&gt; 99.9%</td></tr>
</tbody>
</table>`,
    tags: '技术,架构,设计',
  },
  {
    id: 'tech-solution',
    name: '技术方案',
    description: '问题分析、方案对比和实施计划',
    icon: 'wrench',
    category: '技术文档',
    type: 'document',
    title: '技术方案 - 全文搜索',
    content: `<h1>技术方案 - 全文搜索</h1>
<h2>1. 问题背景</h2>
<p>当前使用 MySQL LIKE 查询实现搜索，性能差且不支持分词。数据量达到 100 万条后，搜索耗时超过 3 秒，严重影响用户体验。</p>
<h2>2. 需求分析</h2>
<table>
<thead><tr><th>需求</th><th>优先级</th><th>说明</th></tr></thead>
<tbody>
<tr><td>中文分词搜索</td><td>P0</td><td>支持中文智能分词</td></tr>
<tr><td>搜索建议</td><td>P0</td><td>输入时实时推荐</td></tr>
<tr><td>结果高亮</td><td>P1</td><td>搜索结果中高亮匹配词</td></tr>
</tbody>
</table>
<h2>3. 方案对比</h2>
<h3>方案 A：Elasticsearch</h3>
<p>独立的搜索引擎，功能最强大。</p>
<table>
<thead><tr><th>维度</th><th>评分</th></tr></thead>
<tbody>
<tr><td>开发成本</td><td>★★★☆☆ 需要维护集群</td></tr>
<tr><td>搜索性能</td><td>★★★★★ 毫秒级响应</td></tr>
<tr><td>可维护性</td><td>★★★☆☆ 运维成本较高</td></tr>
</tbody>
</table>
<p><strong>优点</strong>：搜索能力强大，生态成熟</p>
<p><strong>缺点</strong>：部署和运维成本高，学习曲线陡</p>
<h3>方案 B：MeiliSearch</h3>
<p>轻量级搜索引擎，开箱即用。</p>
<table>
<thead><tr><th>维度</th><th>评分</th></tr></thead>
<tbody>
<tr><td>开发成本</td><td>★★★★☆ 单二进制部署</td></tr>
<tr><td>搜索性能</td><td>★★★★☆ 50ms 内响应</td></tr>
<tr><td>可维护性</td><td>★★★★☆ 几乎免维护</td></tr>
</tbody>
</table>
<p><strong>优点</strong>：部署简单，支持中文分词，API 友好</p>
<p><strong>缺点</strong>：超大规模数据性能不如 ES</p>
<h2>4. 推荐方案</h2>
<p><strong>选择</strong>：方案 B — MeiliSearch</p>
<p><strong>理由</strong>：当前数据量 < 500万条，MeiliSearch 完全胜任。部署和维护成本低，团队能快速上手。如果未来数据量超过千万级，再考虑迁移 ES。</p>
<h2>5. 实施计划</h2>
<table>
<thead><tr><th>阶段</th><th>任务</th><th>预计</th></tr></thead>
<tbody>
<tr><td>第1周</td><td>部署 MeiliSearch + 数据同步</td><td></td></tr>
<tr><td>第2周</td><td>搜索 API 开发 + 前端接入</td><td></td></tr>
<tr><td>第3周</td><td>搜索建议 + 结果高亮</td><td></td></tr>
</tbody>
</table>
<h2>6. 风险与应对</h2>
<table>
<thead><tr><th>风险</th><th>概率</th><th>影响</th><th>应对</th></tr></thead>
<tbody>
<tr><td>中文分词不准</td><td>中</td><td>高</td><td>提前测试分词效果，准备自定义词典</td></tr>
<tr><td>数据同步延迟</td><td>低</td><td>中</td><td>使用 webhook 实时同步，监控延迟</td></tr>
</tbody>
</table>`,
    tags: '技术,方案',
  },
  {
    id: 'deployment-guide',
    name: '部署文档',
    description: '环境配置、部署步骤和运维手册',
    icon: 'server',
    category: '技术文档',
    type: 'document',
    title: '部署文档 - 内容平台',
    content: `<h1>内容平台 — 部署文档</h1>
<h2>1. 环境要求</h2>
<table>
<thead><tr><th>依赖</th><th>版本</th><th>说明</th></tr></thead>
<tbody>
<tr><td>Node.js</td><td>≥ 18</td><td>前端构建和 SSR</td></tr>
<tr><td>Go</td><td>≥ 1.21</td><td>后端服务</td></tr>
<tr><td>PostgreSQL</td><td>≥ 15</td><td>主数据库</td></tr>
<tr><td>Redis</td><td>≥ 7</td><td>缓存和会话</td></tr>
</tbody>
</table>
<h2>2. 目录结构</h2>
<pre><code>project/
├── web/          # 前端
├── api/          # 后端 API
├── config/       # 配置文件
├── scripts/      # 部署脚本
└── docker/       # Docker 配置</code></pre>
<h2>3. 配置说明</h2>
<table>
<thead><tr><th>配置项</th><th>默认值</th><th>说明</th></tr></thead>
<tbody>
<tr><td>PORT</td><td>3000</td><td>服务端口</td></tr>
<tr><td>DB_HOST</td><td>localhost</td><td>数据库地址</td></tr>
<tr><td>REDIS_URL</td><td>localhost:6379</td><td>Redis 地址</td></tr>
<tr><td>JWT_SECRET</td><td>-</td><td>JWT 签名密钥（必须配置）</td></tr>
</tbody>
</table>
<h2>4. 部署步骤</h2>
<h3>4.1 开发环境</h3>
<pre><code>git clone git@github.com:org/project.git
cp .env.example .env
npm install
npm run dev</code></pre>
<h3>4.2 Docker 部署（生产）</h3>
<pre><code>docker-compose up -d
docker-compose exec api npm run migrate</code></pre>
<h2>5. 健康检查</h2>
<ul>
<li>健康检查接口：<code>GET /health</code></li>
<li>预期响应：<code>{"status": "ok"}</code></li>
</ul>
<h2>6. 常见问题</h2>
<h3>Q1：启动报 "connection refused"</h3>
<p><strong>A</strong>：检查 DB_HOST 和 REDIS_URL 是否正确，确认服务已启动。</p>
<h3>Q2：迁移报错 "relation already exists"</h3>
<p><strong>A</strong>：可能是之前迁移中断，检查 migrations 表记录后手动修复。</p>
<h2>7. 回滚方案</h2>
<ol>
<li>切换镜像版本：<code>docker-compose down && IMAGE_TAG=v2.0 docker-compose up -d</code></li>
<li>数据库回滚：<code>npm run migrate:rollback</code></li>
</ol>`,
    tags: '技术,部署,运维',
  },
  {
    id: 'code-review-checklist',
    name: 'Code Review 清单',
    description: '代码审查要点和检查清单',
    icon: 'check-square',
    category: '技术文档',
    type: 'document',
    title: 'Code Review - 用户模块',
    content: `<h1>Code Review — 用户模块</h1>
<h2>基本信息</h2>
<table>
<tbody>
<tr><td><strong>提交者</strong></td><td>李华</td></tr>
<tr><td><strong>审查者</strong></td><td>张明</td></tr>
<tr><td><strong>日期</strong></td><td>{{日期}}</td></tr>
<tr><td><strong>PR 链接</strong></td><td>#342</td></tr>
</tbody>
</table>
<h2>功能正确性</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>功能符合需求描述</span></label></li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>边界条件已处理（空输入、超长字符串）</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>错误情况已处理（网络异常、服务器错误）</span></label></li>
</ul>
<h2>代码质量</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>命名清晰、有意义</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>函数职责单一（checkAndProcess 建议拆分）</span></label></li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>无重复代码</span></label></li>
</ul>
<h2>安全</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>输入已校验（参数类型、长度）</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>SQL 注入风险已排查（注意 userQuery 方法）</span></label></li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>敏感数据已脱敏（密码、token）</span></label></li>
</ul>
<h2>审查意见</h2>
<h3>必须修改</h3>
<ol>
<li><code>userQuery</code> 方法直接拼接 SQL，存在注入风险，改用参数化查询</li>
</ol>
<h3>建议修改</h3>
<ol>
<li><code>checkAndProcess</code> 函数过长（80行），建议拆分为验证和处理两个函数</li>
</ol>
<h3>亮点</h3>
<ol>
<li>错误处理非常完善，每个场景都有对应的错误码和友好提示</li>
</ol>`,
    tags: '技术,审查,CodeReview',
  },
];
