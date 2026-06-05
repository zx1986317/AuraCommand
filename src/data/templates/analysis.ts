import type { MemoTemplate } from '../templateTypes';

export const ANALYSIS_TEMPLATES: MemoTemplate[] = [
  {
    id: 'data-analysis-report',
    name: '数据分析报告',
    description: '数据洞察、趋势分析和行动建议',
    icon: 'bar-chart-2',
    category: '分析报告',
    type: 'document',
    title: '分析报告 - 用户留存',
    content: `<h1>用户留存 — 数据分析报告</h1>
<p><strong>报告日期</strong>：{{日期}}</p>
<p><strong>分析周期</strong>：2026年4月</p>
<h2>摘要</h2>
<blockquote><p>4月次月留存率 42%，环比下降 5 个百分点。主要流失发生在注册后第 3 天，新用户引导流程是关键改进方向。</p></blockquote>
<h2>1. 分析背景</h2>
<ul>
<li><strong>业务问题</strong>：留存率连续 2 个月下降</li>
<li><strong>分析目标</strong>：定位流失原因，提出改进建议</li>
<li><strong>数据来源</strong>：用户行为日志 + 问卷调查</li>
</ul>
<h2>2. 关键指标</h2>
<table>
<thead><tr><th>指标</th><th>本期</th><th>上期</th><th>环比</th><th>目标</th><th>达成率</th></tr></thead>
<tbody>
<tr><td>次日留存</td><td>58%</td><td>62%</td><td>-4%</td><td>65%</td><td>89%</td></tr>
<tr><td>7日留存</td><td>35%</td><td>38%</td><td>-3%</td><td>40%</td><td>88%</td></tr>
<tr><td>30日留存</td><td>42%</td><td>47%</td><td>-5%</td><td>50%</td><td>84%</td></tr>
</tbody>
</table>
<h2>3. 趋势分析</h2>
<h3>3.1 整体趋势</h3>
<p>3月改版后新用户引导从 5 步缩减为 2 步，虽然注册转化率提升了 15%，但用户对核心功能的认知度下降，导致第 3 天大量流失。</p>
<h3>3.2 异常点</h3>
<ul>
<li>4月12-15日留存骤降至 28%，对应服务器故障期间</li>
</ul>
<h2>4. 归因分析</h2>
<table>
<thead><tr><th>变化</th><th>正向因素</th><th>负向因素</th></tr></thead>
<tbody>
<tr><td>注册转化 ↑15%</td><td>引导流程简化</td><td>-</td></tr>
<tr><td>3日留存 ↓18%</td><td>-</td><td>核心功能发现率不足</td></tr>
</tbody>
</table>
<h2>5. 结论与建议</h2>
<h3>核心发现</h3>
<ol>
<li>引导流程简化虽提升了注册率，但牺牲了功能认知</li>
<li>第3天是关键流失节点，需加强该时段的触达</li>
</ol>
<h3>行动建议</h3>
<table>
<thead><tr><th>优先级</th><th>建议</th><th>预期效果</th></tr></thead>
<tbody>
<tr><td>P0</td><td>新增第3天 Push 通知，引导发现核心功能</td><td>3日留存提升 10%+</td></tr>
<tr><td>P1</td><td>在引导流程中加入功能亮点展示步骤</td><td>功能认知度提升 20%</td></tr>
</tbody>
</table>`,
    tags: '分析,数据,报告',
  },
  {
    id: 'competitive-analysis',
    name: '竞品分析报告',
    description: '竞品功能对比、SWOT 和差异化策略',
    icon: 'swords',
    category: '分析报告',
    type: 'document',
    title: '竞品分析 - 知识管理工具',
    content: `<h1>知识管理工具 — 竞品分析报告</h1>
<p><strong>分析日期</strong>：{{日期}}</p>
<h2>1. 分析范围</h2>
<table>
<thead><tr><th>竞品</th><th>类型</th><th>定位</th></tr></thead>
<tbody>
<tr><td>Notion</td><td>全能型</td><td>All-in-one 工作空间</td></tr>
<tr><td>Obsidian</td><td>本地型</td><td>双向链接 + 本地优先</td></tr>
<tr><td>飞书文档</td><td>协作型</td><td>企业协作 + 即时通讯</td></tr>
</tbody>
</table>
<h2>2. 功能对比</h2>
<table>
<thead><tr><th>功能</th><th>我们</th><th>Notion</th><th>Obsidian</th></tr></thead>
<tbody>
<tr><td>本地 AI 对话</td><td>✅</td><td>❌</td><td>❌</td></tr>
<tr><td>本地知识库</td><td>✅</td><td>❌</td><td>✅</td></tr>
<tr><td>富文本编辑</td><td>✅</td><td>✅</td><td>⚠️ 插件</td></tr>
<tr><td>团队协作</td><td>❌</td><td>✅</td><td>❌</td></tr>
<tr><td>模板系统</td><td>✅</td><td>✅</td><td>⚠️ 社区</td></tr>
</tbody>
</table>
<h2>3. SWOT 分析</h2>
<h3>优势 (Strengths)</h3>
<ul>
<li>本地 AI 能力，无需联网，数据隐私有保障</li>
<li>轻量级，启动快，不依赖云服务</li>
</ul>
<h3>劣势 (Weaknesses)</h3>
<ul>
<li>不支持多人协作</li>
<li>移动端暂未覆盖</li>
</ul>
<h3>机会 (Opportunities)</h3>
<ul>
<li>数据隐私意识增强，本地化需求上升</li>
<li>开源生态可吸引开发者贡献</li>
</ul>
<h3>威胁 (Threats)</h3>
<ul>
<li>Notion AI 上线后可能蚕食本地 AI 的差异化优势</li>
</ul>
<h2>4. 差异化策略</h2>
<ol>
<li><strong>深度本地 AI</strong>：不满足于对话，要做 AI 辅助写作、AI 自动分类、AI 智能摘要</li>
<li><strong>知识图谱</strong>：可视化笔记关联，做 Obsidian 的双向链接 + Notion 的编辑体验</li>
</ol>`,
    tags: '分析,竞品',
  },
  {
    id: 'market-research',
    name: '市场调研报告',
    description: '市场规模、用户画像和机会分析',
    icon: 'trending-up',
    category: '分析报告',
    type: 'document',
    title: '市场调研 - AI 笔记工具',
    content: `<h1>AI 笔记工具 — 市场调研报告</h1>
<p><strong>调研日期</strong>：{{日期}}</p>
<h2>1. 市场概况</h2>
<h3>1.1 市场规模</h3>
<ul>
<li>TAM（总可触达市场）：全球知识管理工具市场约 150 亿美元</li>
<li>SAM（可服务市场）：AI 驱动的笔记工具约 12 亿美元</li>
<li>SOM（可获得市场）：本地优先的 AI 笔记工具约 2 亿美元</li>
</ul>
<h3>1.2 增长趋势</h3>
<ul>
<li>年复合增长率：28%（2024-2028）</li>
<li>驱动因素：
<ol>
<li>大模型能力快速提升，AI 辅助写作成为刚需</li>
<li>数据隐私法规趋严，本地化需求持续增长</li>
</ol>
</li>
</ul>
<h2>2. 用户画像</h2>
<table>
<thead><tr><th>维度</th><th>主要用户</th><th>次要用户</th></tr></thead>
<tbody>
<tr><td>年龄</td><td>25-35 岁</td><td>35-45 岁</td></tr>
<tr><td>职业</td><td>程序员、产品经理</td><td>研究员、作家</td></tr>
<tr><td>场景</td><td>技术笔记、项目文档</td><td>学术笔记、创作</td></tr>
<tr><td>痛点</td><td>信息碎片化，搜索困难</td><td>整理耗时，写作启动难</td></tr>
</tbody>
</table>
<h2>3. 竞争格局</h2>
<table>
<thead><tr><th>厂商</th><th>份额</th><th>优势</th><th>劣势</th></tr></thead>
<tbody>
<tr><td>Notion</td><td>35%</td><td>生态完整，协作强</td><td>价格贵，数据在云端</td></tr>
<tr><td>Obsidian</td><td>15%</td><td>本地优先，插件丰富</td><td>学习曲线陡，编辑器弱</td></tr>
<tr><td>Logseq</td><td>5%</td><td>开源，大纲式</td><td>性能差，功能不全</td></tr>
</tbody>
</table>
<h2>4. 机会分析</h2>
<table>
<thead><tr><th>机会</th><th>市场规模</th><th>竞争强度</th><th>可行性</th></tr></thead>
<tbody>
<tr><td>本地 AI 对话+写作</td><td>中</td><td>低</td><td>高</td></tr>
<tr><td>企业级本地知识库</td><td>大</td><td>中</td><td>中</td></tr>
</tbody>
</table>
<h2>5. 结论</h2>
<ol>
<li>本地 AI 是明确的差异化方向，竞品尚未重点布局</li>
<li>先攻个人用户，积累口碑后拓展企业市场</li>
</ol>`,
    tags: '分析,市场,调研',
  },
  {
    id: 'retrospective',
    name: '项目复盘报告',
    description: '目标回顾、KPT 复盘和行动项',
    icon: 'refresh-cw',
    category: '分析报告',
    type: 'document',
    title: '复盘 - 搜索功能上线',
    content: `<h1>搜索功能上线 — 复盘报告</h1>
<p><strong>复盘日期</strong>：{{日期}}</p>
<h2>1. 目标回顾</h2>
<table>
<thead><tr><th>维度</th><th>目标</th><th>实际</th><th>偏差</th></tr></thead>
<tbody>
<tr><td>上线时间</td><td>3月底</td><td>4月15日</td><td>延迟 2 周</td></tr>
<tr><td>搜索延迟 P99</td><td>&lt; 200ms</td><td>150ms</td><td>✅ 超预期</td></tr>
<tr><td>零结果率</td><td>&lt; 10%</td><td>8%</td><td>✅ 达成</td></tr>
</tbody>
</table>
<h2>2. 做得好的（Keep）</h2>
<ol>
<li>提前做了分词效果测试，避免了上线后的体验问题</li>
<li>灰度发布策略很好，先对 5% 用户开放，问题早发现</li>
<li>搜索性能优化到位，150ms 的 P99 超出预期</li>
</ol>
<h2>3. 需要改进的（Problem）</h2>
<ol>
<li>需求变更 3 次，导致开发反复，工期延后 2 周</li>
<li>测试环境数据量不够，上线后才发现大数据量下的分页问题</li>
</ol>
<h2>4. 尝试的新方法（Try）</h2>
<ol>
<li>下次需求冻结后不再接受变更，走变更审批流程</li>
<li>测试环境需准备百万级数据集</li>
</ol>
<h2>5. 行动项</h2>
<table>
<thead><tr><th>行动</th><th>负责人</th><th>截止日期</th><th>状态</th></tr></thead>
<tbody>
<tr><td>建立需求变更审批流程</td><td>张明</td><td>下周五</td><td>待启动</td></tr>
<tr><td>准备百万级测试数据集</td><td>陈杰</td><td>月底</td><td>待启动</td></tr>
</tbody>
</table>`,
    tags: '复盘,回顾',
  },
];
