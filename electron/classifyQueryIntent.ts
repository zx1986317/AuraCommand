import type { McpToolCategory } from './mcpTools'

const INTENT_RULES: Array<{ categories: McpToolCategory[]; patterns: RegExp[] }> = [
  {
    categories: ['web-search'],
    patterns: [
      /天气|新闻|最新|热搜|热榜|股市|汇率|油价|实时|目前|现在|今天|明日|明天|最近|近期|快讯|资讯/i,
      /search.*web|联网|上网搜|查一下|搜索一下|百度|google|bing/i,
      /排行榜|排名|榜单|热门|趋势/i,
    ],
  },
  {
    categories: ['browser'],
    patterns: [
      /打开.*网页|访问.*网站|浏览|截图.*页面|翻到|滚动|点击|输入|百度一下/i,
      /帮我搜|帮我查|打开.*链接|访问.*链接/i,
    ],
  },
  {
    categories: ['web-read'],
    patterns: [
      /阅读.*文章|读取.*链接|打开.*网址|提取.*内容|抓取|爬取|这个网页|这篇文章|那个链接/i,
      /总结.*文章|摘要.*网页|提炼.*内容/i,
    ],
  },
  {
    categories: ['file'],
    patterns: [
      /文件|目录|文件夹|保存.*到|新建.*文件|读取.*文件|编辑.*文件|搜索.*文件|查找.*文件/i,
      /项目.*目录|代码.*目录|工作.*目录|目录结构|文件列表/i,
    ],
  },
  {
    categories: ['memory'],
    patterns: [
      /记住|回忆|之前说过|上次|我的.*信息|个人信息|我记得|你记得/i,
      /关于我|我的名字|我的职业|我的爱好/i,
    ],
  },
  {
    categories: ['database'],
    patterns: [
      /数据库|查询.*数据|统计|报表|分析.*数据|数据.*分析/i,
      /数据.*查询|搜索.*数据库|表.*结构/i,
    ],
  },
  {
    categories: ['reasoning'],
    patterns: [
      /思考|分析|推理|比较|对比|评估|判断|利弊|优缺点|怎么选/i,
      /为什么|原因|影响|后果|意味着|含义/i,
    ],
  },
]

const INTENT_PRIORITY: McpToolCategory[] = [
  'web-search',
  'browser',
  'web-read',
  'file',
  'memory',
  'database',
  'reasoning',
  'other',
]

export function classifyQueryIntent(query: string): McpToolCategory[] {
  if (!query || typeof query !== 'string') return ['other']

  const matched = new Set<McpToolCategory>()

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(query)) {
        for (const cat of rule.categories) {
          matched.add(cat)
        }
        break
      }
    }
  }

  if (matched.size === 0) {
    return ['other']
  }

  return INTENT_PRIORITY.filter(cat => matched.has(cat))
}
