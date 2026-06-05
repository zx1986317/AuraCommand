import type { MemoTemplate } from '../templateTypes';

export const NOTE_TEMPLATES: MemoTemplate[] = [
  {
    id: 'quick-thought',
    name: '随手记',
    description: '快速记录一个想法',
    icon: 'pencil',
    category: '日常',
    type: 'note',
    title: '',
    content: '',
    tags: '',
  },
  {
    id: 'idea',
    name: '灵感捕捉',
    description: '捕捉灵感和创意想法',
    icon: 'lightbulb',
    category: '日常',
    type: 'note',
    title: '灵感 - {{日期}}',
    content: `<h2>💡 灵感描述</h2>
<p>用一句话描述你的灵感：</p>
<p>比如：做一个基于语音输入的快速笔记应用，用户说话就能自动转成结构化笔记</p>
<h2>🎯 为什么觉得有价值</h2>
<ul>
<li>解决了什么问题？通勤/散步时无法打字但想记录</li>
<li>谁会受益？知识工作者、学生、创意从业者</li>
</ul>
<h2>🔨 可以怎么做</h2>
<ul>
<li>最小可行方案：语音转文字 + 自动标题提取</li>
<li>进阶：AI 自动分类标签 + 关联已有笔记</li>
</ul>`,
    tags: '灵感,创意',
  },
  {
    id: 'todo-list',
    name: '待办清单',
    description: '快速列出待办事项',
    icon: 'list-checks',
    category: '日常',
    type: 'note',
    title: '待办 - {{日期}}',
    content: `<h2>🔴 今天必须做</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>回复客户邮件</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>完成周报</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>代码 Review</span></label></li>
</ul>
<h2>🟡 等一下做</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>整理桌面文件</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>更新项目文档</span></label></li>
</ul>
<h2>📝 备注</h2>
<p>下午3点有产品评审会，提前准备演示内容</p>`,
    tags: '待办,清单',
  },
  {
    id: 'meeting-notes',
    name: '会议速记',
    description: '快速记录会议要点',
    icon: 'users',
    category: '工作',
    type: 'note',
    title: '会议速记 - {{日期}}',
    content: `<h2>📋 主题：Q3 产品规划讨论</h2>
<p><strong>时间</strong>：{{日期}} 14:00-15:00</p>
<p><strong>参会人</strong>：张明、李华、王芳、陈杰</p>
<h2>🔑 要点</h2>
<ol>
<li>用户增长放缓，需要新的增长点</li>
<li>竞品上线了 AI 写作功能，用户反馈不错</li>
<li>技术团队建议先做 MVP 验证</li>
</ol>
<h2>✅ 待办</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>张明：出 AI 功能 PRD，下周一前</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>李华：调研竞品 AI 功能详细对比</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>陈杰：评估技术方案可行性</span></label></li>
</ul>`,
    tags: '会议,速记',
  },
  {
    id: 'bug-quick',
    name: '问题速记',
    description: '快速记录 Bug 或问题',
    icon: 'bug',
    category: '工作',
    type: 'note',
    title: '问题 - {{日期}}',
    content: `<h2>🐛 问题：登录页面白屏</h2>
<p><strong>严重程度</strong>：🔴 P0 - 阻断用户使用</p>
<h2>复现步骤</h2>
<ol>
<li>打开 App，进入登录页</li>
<li>输入账号密码后点击"登录"</li>
<li>页面变为白屏，控制台报 TypeError</li>
</ol>
<h2>临时方案</h2>
<p>清除本地缓存后重新打开可以恢复，但不是根本解决方案。怀疑是 token 刷新逻辑有竞态条件。</p>`,
    tags: '问题,Bug',
  },
  {
    id: 'daily-journal',
    name: '日记',
    description: '每日反思与记录',
    icon: 'heart',
    category: '个人',
    type: 'note',
    title: '日记 - {{日期}}',
    content: `<h1>{{日期}}</h1>
<h2>🌅 今日三件好事</h2>
<ol>
<li>早起跑了3公里，精神状态不错</li>
<li>上午的方案评审一次通过了</li>
<li>晚上读完了《思考，快与慢》最后一章</li>
</ol>
<h2>💭 反思</h2>
<p>今天下午被消息打断太多次，深度工作时间不到2小时。明天试试关掉通知，设定固定的消息处理时段。</p>
<h2>📌 明日计划</h2>
<ol>
<li>完成 API 设计文档初稿</li>
<li>和运维确认生产环境部署方案</li>
</ol>`,
    tags: '日记,反思',
  },
  {
    id: 'habit-tracker',
    name: '习惯打卡',
    description: '每日习惯追踪',
    icon: 'list-checks',
    category: '个人',
    type: 'note',
    title: '习惯打卡 - {{日期}}',
    content: `<h2>📅 {{日期}} 习惯追踪</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>🌅 早起（7:00前）</span></label></li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>🧘 冥想 10分钟</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>📖 阅读 30分钟</span></label></li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span>🏃 运动 30分钟</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>📝 写日记</span></label></li>
</ul>
<p><strong>今日完成率</strong>：3/5 ✨ 继续加油！</p>`,
    tags: '习惯,打卡',
  },
  {
    id: 'reading-notes',
    name: '读书摘录',
    description: '摘录书中精彩内容',
    icon: 'book-open',
    category: '学习',
    type: 'note',
    title: '摘录 - 《{{书名}}》',
    content: `<h2>📖 出处</h2>
<p>《思考，快与慢》— 丹尼尔·卡尼曼</p>
<p>第20章：错觉的合理性</p>
<h2>✍️ 摘录</h2>
<blockquote><p>我们对直觉的自信并不是判断其有效性的可靠指标。换句话说，当面对困难问题时，我们很容易将答案的流畅性误认为正确性。</p></blockquote>
<h2>💡 我的感想</h2>
<p>这解释了为什么有时候"想当然"的决策反而最危险——大脑用流畅感伪装了正确性。在重要决策时应该强制自己慢下来，用系统2去验证直觉判断。</p>`,
    tags: '读书,摘录',
  },
  {
    id: 'learning-log',
    name: '学习日志',
    description: '记录每日学习要点',
    icon: 'graduation-cap',
    category: '学习',
    type: 'note',
    title: '学习 - {{日期}}',
    content: `<h2>📚 今日所学：Rust 所有权机制</h2>
<ol>
<li><strong>所有权规则</strong>：每个值有且只有一个所有者，当所有者离开作用域时值被丢弃</li>
<li><strong>借用</strong>：&amp;T 是不可变引用，&amp;mut T 是可变引用，同一时刻只能有其一</li>
<li><strong>生命周期</strong>：编译器通过生命周期标注确保引用不会悬垂</li>
</ol>
<h2>❓ 疑问</h2>
<ul>
<li>循环引用的场景下，Rc 和 Weak 如何选择？</li>
<li>async/await 中的所有权转移和同步代码有什么不同？</li>
</ul>
<h2>📌 明日计划</h2>
<ul>
<li>完成 Rustlings 的所有权练习</li>
<li>写一个简单的链表练手</li>
</ul>`,
    tags: '学习,日志',
  },
  {
    id: 'recipe',
    name: '菜谱记录',
    description: '记录一道菜的做法',
    icon: 'chef-hat',
    category: '生活',
    type: 'note',
    title: '菜谱 - 番茄炒蛋',
    content: `<h2>🍳 番茄炒蛋</h2>
<h3>食材</h3>
<ul>
<li>番茄 2个（熟透的）</li>
<li>鸡蛋 3个</li>
<li>葱花、盐、糖适量</li>
</ul>
<h3>步骤</h3>
<ol>
<li>番茄切小块，鸡蛋打散加少许盐搅匀</li>
<li>热锅凉油，中大火下蛋液，快速划散，八成熟盛出</li>
<li>锅中再加少许油，下番茄翻炒出汁，加一小勺糖提鲜</li>
<li>倒回鸡蛋翻匀，撒葱花出锅</li>
</ol>
<h3>小贴士</h3>
<p>🔥 番茄要选熟透的，出汁多。蛋液不要炒太老，八成熟就好，回锅后会继续熟。</p>`,
    tags: '菜谱,美食',
  },
  {
    id: 'shopping-list',
    name: '购物清单',
    description: '要买的东西列表',
    icon: 'shopping-cart',
    category: '生活',
    type: 'note',
    title: '购物清单 - {{日期}}',
    content: `<h2>🛒 必买</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>牛奶 × 2盒</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>鸡蛋 1盒</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>大米 5kg</span></label></li>
</ul>
<h2>🎁 想买</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>降噪耳机（看评价再决定）</span></label></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span>新书《系统设计面试》</span></label></li>
</ul>
<h2>💰 预算</h2>
<p>日用品 ≤ 200元，非必需品 ≤ 500元</p>`,
    tags: '购物,清单',
  },
];
