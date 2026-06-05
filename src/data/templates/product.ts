import type { MemoTemplate } from '../templateTypes';

export const PRODUCT_TEMPLATES: MemoTemplate[] = [
  {
    id: 'prd',
    name: '产品需求文档',
    description: 'PRD：产品需求、用户故事与验收标准',
    icon: 'file-text',
    category: '产品设计',
    type: 'document',
    title: 'PRD - 智能搜索功能',
    content: `<h1>智能搜索功能 — 产品需求文档</h1>
<h2>版本历史</h2>
<table>
<thead><tr><th>版本</th><th>日期</th><th>作者</th><th>变更说明</th></tr></thead>
<tbody>
<tr><td>v1.0</td><td>{{日期}}</td><td>张明</td><td>初稿</td></tr>
</tbody>
</table>
<h2>1. 背景与目标</h2>
<h3>1.1 背景</h3>
<p>当前搜索功能仅支持关键词精确匹配，用户经常找不到想要的内容。数据显示 35% 的搜索结果为零结果页，用户满意度仅 2.8/5。</p>
<h3>1.2 目标</h3>
<ul>
<li>搜索零结果率从 35% 降至 10% 以下</li>
<li>用户搜索满意度提升至 4.0/5 以上</li>
</ul>
<h3>1.3 成功指标</h3>
<ul>
<li>搜索点击率（CTR）> 40%</li>
<li>搜索结果平均点击位置 < 3</li>
</ul>
<h2>2. 用户故事</h2>
<h3>P0（必须）</h3>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>作为普通用户，我希望输入关键词时能看到实时搜索建议，以便快速找到目标</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>作为普通用户，我希望搜索支持模糊匹配，即使拼写有轻微错误也能找到结果</span></label></li>
</ul>
<h3>P1（应该）</h3>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>作为高级用户，我希望搜索支持筛选器（类型、日期、标签），以便精确定位</span></label></li>
</ul>
<h3>P2（可以）</h3>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>作为用户，我希望搜索记录能跨设备同步</span></label></li>
</ul>
<h2>3. 功能需求</h2>
<h3>3.1 搜索建议</h3>
<p>输入 > 2个字符时，实时展示最多 8 条建议。建议来源：搜索历史 + 热门内容 + 模糊匹配。</p>
<h3>3.2 模糊匹配</h3>
<p>使用编辑距离算法，允许 1-2 个字符的差异。匹配结果按相关度排序。</p>
<h2>4. 非功能需求</h2>
<ul>
<li>性能：搜索建议响应时间 < 200ms</li>
<li>安全：搜索输入需防 XSS 注入</li>
<li>兼容性：支持 Chrome 90+、Safari 15+、Firefox 90+</li>
</ul>
<h2>5. 开放问题</h2>
<ul>
<li>是否需要支持拼音搜索？（待确认）</li>
<li>搜索结果的个性化排序策略？（待讨论）</li>
</ul>`,
    tags: '产品,需求,PRD',
  },
  {
    id: 'user-story-map',
    name: '用户故事地图',
    description: '按用户旅程组织功能和优先级',
    icon: 'map',
    category: '产品设计',
    type: 'document',
    title: '用户故事地图 - 电商平台',
    content: `<h1>电商平台 — 用户故事地图</h1>
<h2>用户角色</h2>
<table>
<thead><tr><th>角色</th><th>描述</th><th>核心场景</th></tr></thead>
<tbody>
<tr><td>买家</td><td>浏览、搜索、下单</td><td>找到心仪商品并完成购买</td></tr>
<tr><td>卖家</td><td>上架、管理、发货</td><td>高效管理商品和订单</td></tr>
</tbody>
</table>
<h2>用户旅程 — 买家</h2>
<h3>阶段 1：发现</h3>
<table>
<thead><tr><th>用户故事</th><th>优先级</th><th>状态</th></tr></thead>
<tbody>
<tr><td>作为买家，我可以通过关键词搜索商品</td><td>P0</td><td>开发中</td></tr>
<tr><td>作为买家，我可以按分类浏览商品</td><td>P0</td><td>待开发</td></tr>
<tr><td>作为买家，我可以看到推荐商品</td><td>P1</td><td>待开发</td></tr>
</tbody>
</table>
<h3>阶段 2：决策</h3>
<table>
<thead><tr><th>用户故事</th><th>优先级</th><th>状态</th></tr></thead>
<tbody>
<tr><td>作为买家，我可以查看商品详情和评价</td><td>P0</td><td>开发中</td></tr>
<tr><td>作为买家，我可以对比多个商品</td><td>P2</td><td>待开发</td></tr>
</tbody>
</table>
<h3>阶段 3：购买</h3>
<table>
<thead><tr><th>用户故事</th><th>优先级</th><th>状态</th></tr></thead>
<tbody>
<tr><td>作为买家，我可以加入购物车</td><td>P0</td><td>已完成</td></tr>
<tr><td>作为买家，我可以使用多种支付方式</td><td>P0</td><td>开发中</td></tr>
</tbody>
</table>
<h2>MVP 范围</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>搜索 + 分类浏览 + 商品详情</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>购物车 + 下单 + 支付</span></label></li>
</ul>`,
    tags: '产品,用户故事',
  },
  {
    id: 'interaction-spec',
    name: '交互设计说明',
    description: '页面流程、状态、反馈和边界情况',
    icon: 'mouse-pointer-click',
    category: '产品设计',
    type: 'document',
    title: '交互说明 - 搜索结果页',
    content: `<h1>搜索结果页 — 交互设计说明</h1>
<h2>页面信息</h2>
<ul>
<li><strong>页面路径</strong>：/search?q=keyword</li>
<li><strong>入口</strong>：顶部搜索栏、搜索建议点击</li>
<li><strong>权限</strong>：所有用户</li>
</ul>
<h2>页面流程</h2>
<p>用户输入关键词 → 展示搜索建议 → 点击搜索/建议 → 展示搜索结果</p>
<h2>状态定义</h2>
<table>
<thead><tr><th>状态</th><th>触发条件</th><th>页面表现</th></tr></thead>
<tbody>
<tr><td>初始</td><td>首次进入搜索页</td><td>显示搜索历史 + 热门搜索</td></tr>
<tr><td>加载中</td><td>提交搜索请求</td><td>Skeleton 加载态，最多 1s</td></tr>
<tr><td>空状态</td><td>搜索结果为空</td><td>友好提示 + 搜索建议</td></tr>
<tr><td>有数据</td><td>结果返回</td><td>卡片列表，每页 20 条</td></tr>
<tr><td>错误</td><td>请求失败</td><td>错误提示 + 重试按钮</td></tr>
</tbody>
</table>
<h2>交互规则</h2>
<h3>规则 1：实时搜索建议</h3>
<ul>
<li><strong>操作</strong>：输入 > 2个字符后 300ms 自动触发</li>
<li><strong>反馈</strong>：输入框下方展示建议下拉</li>
<li><strong>异常</strong>：网络异常时展示最近搜索历史</li>
</ul>
<h3>规则 2：无限滚动</h3>
<ul>
<li><strong>操作</strong>：滚动到底部自动加载下一页</li>
<li><strong>反馈</strong>：底部展示加载动画</li>
<li><strong>异常</strong>：无更多数据时展示"没有更多了"</li>
</ul>
<h2>边界情况</h2>
<ul>
<li>搜索关键词含特殊字符（如 SQL 注入）→ 前端过滤</li>
<li>快速连续搜索 → 防抖 300ms，取消前一次请求</li>
</ul>`,
    tags: '产品,交互,设计',
  },
  {
    id: 'release-note',
    name: '版本发布说明',
    description: '版本更新内容、升级指南和已知问题',
    icon: 'rocket',
    category: '产品设计',
    type: 'document',
    title: '发布说明 - v2.1.0',
    content: `<h1>v2.1.0 发布说明</h1>
<p><strong>发布日期</strong>：{{日期}}</p>
<h2>🎉 新功能</h2>
<ul>
<li><strong>智能搜索</strong>：支持模糊匹配和搜索建议，搜索体验大幅提升</li>
<li><strong>暗黑模式</strong>：全局支持深色主题，自动跟随系统设置</li>
</ul>
<h2>🐛 问题修复</h2>
<ul>
<li>修复大文件上传时进度条卡在 99% 的问题</li>
<li>修复 iOS Safari 下底部导航栏遮挡内容的问题</li>
</ul>
<h2>⚠️ 破坏性变更</h2>
<ul>
<li>搜索 API 响应格式变更：result 字段更名为 items，详见 API 文档</li>
</ul>
<h2>📋 升级指南</h2>
<ol>
<li>更新搜索相关调用，将 result 替换为 items</li>
<li>如果使用了自定义搜索组件，需要适配新的 props 接口</li>
</ol>
<h2>❓ 已知问题</h2>
<ul>
<li>暗黑模式下部分图表颜色对比度不足，将在 v2.1.1 修复</li>
</ul>`,
    tags: '产品,发布,版本',
  },
];
