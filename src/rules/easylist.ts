/**
 * EasyList 高频拦截规则精选
 *
 * 策略：从 EasyList 主列表中选取覆盖面最广、命中率最高的规则，
 * 每条规则生成一个对应测试资源 URL。若浏览器加载该 URL 失败（被拦截），
 * 则作为"存在 AdBlock"的证据。
 *
 * v1.1: 规则数从 10 扩至 32 条，覆盖更多广告平台与拦截模式
 *
 * 规则类型覆盖：
 *  - ||domain^  (域名拦截)
 *  - /path/*.js  (路径通配)
 *  - &ad_type=  (查询参数)
 *  - third-party  (第三方广告脚本/像素)
 *  - ##.selector (元素隐藏，本工具不测隐藏仅测网络拦截)
 */

export interface EasyListRule {
  /** 唯一标识 */
  id: string;
  /** 原始 EasyList 规则文本 */
  raw: string;
  /** 规则分类 */
  category: 'domain' | 'path' | 'param' | 'third-party';
  /** 该规则的置信度权重 0~1，越常见越高 */
  confidence: number;
  /** 规则说明 */
  description: string;
  /** 用于生成测试 URL 的模板，{RAND} 会被替换为随机串防缓存 */
  urlTemplate: string;
  /** 测试资源类型 */
  resourceType: 'script' | 'image' | 'xmlhttprequest';
}

/** 默认启用的 10 条核心规则（高覆盖、低误报） */
export const DEFAULT_ACTIVE_RULE_IDS = [
  'pagead2-googlesyndication',
  'doubleclick',
  'adservice-google',
  'ads-js',
  'safeframe',
  'googleadservices',
  'ad-banner',
  'googletagservices',
  'amazon-adsystem',
  'pos-baidu',
];

export const EASYLIST_RULES: EasyListRule[] = [
  // ── Google 广告生态（高覆盖） ──
  {
    id: 'pagead2-googlesyndication',
    raw: '||pagead2.googlesyndication.com^',
    category: 'domain',
    confidence: 0.95,
    description: 'Google AdSense 广告主域',
    urlTemplate: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?cachebust={RAND}',
    resourceType: 'script',
  },
  {
    id: 'doubleclick',
    raw: '||doubleclick.net^',
    category: 'domain',
    confidence: 0.92,
    description: 'Google DoubleClick 广告平台',
    urlTemplate: 'https://doubleclick.net/dbm/ad?ci={RAND}',
    resourceType: 'image',
  },
  {
    id: 'adservice-google',
    raw: '||adservice.google.*/^',
    category: 'domain',
    confidence: 0.90,
    description: 'Google Ad Service 广告服务',
    urlTemplate: 'https://adservice.google.com/adsid/integrator.js?domain=test&cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'safeframe',
    raw: '||googlesyndication.com/safeframe/',
    category: 'domain',
    confidence: 0.87,
    description: 'Google SafeFrame 广告容器',
    urlTemplate: 'https://tpc.googlesyndication.com/safeframe/1-0-40/html/container.html?x={RAND}',
    resourceType: 'image',
  },
  {
    id: 'googleadservices',
    raw: '||googleadservices.com^',
    category: 'domain',
    confidence: 0.86,
    description: 'Google 广告服务',
    urlTemplate: 'https://googleadservices.com/pagead/conversion.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'googletagservices',
    raw: '||googletagservices.com^',
    category: 'domain',
    confidence: 0.84,
    description: 'Google DFP 广告管理系统',
    urlTemplate: 'https://www.googletagservices.com/tag/js/gpt.js?cb={RAND}',
    resourceType: 'script',
  },

  // ── 第三方广告平台 ──
  {
    id: 'amazon-adsystem',
    raw: '||amazon-adsystem.com^',
    category: 'domain',
    confidence: 0.82,
    description: 'Amazon 广告系统',
    urlTemplate: 'https://aax.amazon-adsystem.com/e/dtb/bid?src={RAND}',
    resourceType: 'image',
  },
  {
    id: 'taboola',
    raw: '||taboola.com^',
    category: 'third-party',
    confidence: 0.80,
    description: 'Taboola 内容推荐广告',
    urlTemplate: 'https://cdn.taboola.com/libtrc/loader.js?uid={RAND}',
    resourceType: 'script',
  },
  {
    id: 'outbrain',
    raw: '||outbrain.com^',
    category: 'third-party',
    confidence: 0.78,
    description: 'Outbrain 内容推荐广告',
    urlTemplate: 'https://widgets.outbrain.com/outbrain.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'criteo',
    raw: '||criteo.com^',
    category: 'domain',
    confidence: 0.76,
    description: 'Criteo 重定向广告',
    urlTemplate: 'https://static.criteo.net/js/ld/publishertag.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'adsrvr',
    raw: '||adsrvr.org^',
    category: 'domain',
    confidence: 0.74,
    description: 'The Trade Desk 广告技术',
    urlTemplate: 'https://adsrvr.org/track/up?cb={RAND}',
    resourceType: 'image',
  },
  {
    id: 'adnxs',
    raw: '||adnxs.com^',
    category: 'domain',
    confidence: 0.73,
    description: 'AppNexus/Xandr 广告交易',
    urlTemplate: 'https://ib.adnxs.com/seg?add=1&cb={RAND}',
    resourceType: 'image',
  },
  {
    id: 'casalemedia',
    raw: '||casalemedia.com^',
    category: 'domain',
    confidence: 0.72,
    description: 'Casale Media 广告网络',
    urlTemplate: 'https://js-sec.indexww.com/ht/p/184000-309234814.js?cb={RAND}',
    resourceType: 'script',
  },

  // ── 国内广告平台 ──
  {
    id: 'pos-baidu',
    raw: '||pos.baidu.com^',
    category: 'domain',
    confidence: 0.80,
    description: '百度联盟广告',
    urlTemplate: 'https://pos.baidu.com/vem?di=123&cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'cpro-baidu',
    raw: '||cpro.baidustatic.com^',
    category: 'domain',
    confidence: 0.78,
    description: '百度 SSP 广告',
    urlTemplate: 'https://cpro.baidustatic.com/cpro/ui/cm.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'tanx',
    raw: '||tanx.com^',
    category: 'domain',
    confidence: 0.75,
    description: '阿里妈妈 Tanx 广告',
    urlTemplate: 'https://tanx.com/ex?i=m123&cb={RAND}',
    resourceType: 'image',
  },
  {
    id: 'qzone',
    raw: '||p2.qzone.qq.com^',
    category: 'domain',
    confidence: 0.70,
    description: '腾讯广点通',
    urlTemplate: 'https://p2.qzone.qq.com/ads/qzoneshow?cb={RAND}',
    resourceType: 'image',
  },

  // ── 通用路径规则 ──
  {
    id: 'ads-js',
    raw: '/ads.js',
    category: 'path',
    confidence: 0.88,
    description: '通用 ads.js 广告脚本',
    urlTemplate: '/ads.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'ad-banner',
    raw: '/ad/banner/*$image',
    category: 'path',
    confidence: 0.85,
    description: '通用广告 banner 图片路径',
    urlTemplate: '/ad/banner/728x90.jpg?z={RAND}',
    resourceType: 'image',
  },
  {
    id: 'banner-gif',
    raw: '/banner/*.gif$image',
    category: 'path',
    confidence: 0.72,
    description: '通用 banner GIF 广告路径',
    urlTemplate: '/banner/468x60.gif?z={RAND}',
    resourceType: 'image',
  },
  {
    id: 'advertisement',
    raw: '/advertisement/*$script',
    category: 'path',
    confidence: 0.75,
    description: '通用 advertisement 脚本路径',
    urlTemplate: '/advertisement/advertisement.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'adverts',
    raw: '/adverts/*$script',
    category: 'path',
    confidence: 0.73,
    description: '通用 adverts 脚本路径',
    urlTemplate: '/adverts/adverts.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'popunder',
    raw: '/popunder/*$script',
    category: 'path',
    confidence: 0.68,
    description: '弹窗广告脚本路径',
    urlTemplate: '/popunder/popunder.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'adv-image',
    raw: '/adv/*$image',
    category: 'path',
    confidence: 0.70,
    description: '通用广告图片路径',
    urlTemplate: '/adv/300x250.jpg?z={RAND}',
    resourceType: 'image',
  },

  // ── 查询参数规则 ──
  {
    id: 'ad-type-param',
    raw: '&ad_type=',
    category: 'param',
    confidence: 0.75,
    description: '查询参数 ad_type',
    urlTemplate: '/api/v1/feed?ad_type=banner&v={RAND}',
    resourceType: 'xmlhttprequest',
  },
  {
    id: 'ad-unit-param',
    raw: '&ad_unit=',
    category: 'param',
    confidence: 0.68,
    description: '查询参数 ad_unit',
    urlTemplate: '/api/v1/ads?ad_unit=leaderboard&cb={RAND}',
    resourceType: 'xmlhttprequest',
  },

  // ── 更多第三方 ──
  {
    id: 'moatads',
    raw: '||moatads.com^',
    category: 'domain',
    confidence: 0.65,
    description: 'Moat 广告测量',
    urlTemplate: 'https://z.moatads.com/adxmoatheader1234567/moatheader.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'pubmatic',
    raw: '||pubmatic.com^',
    category: 'domain',
    confidence: 0.66,
    description: 'PubMatic SSP',
    urlTemplate: 'https://ads.pubmatic.com/AdServer/js/showad.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'rubicon',
    raw: '||rubiconproject.com^',
    category: 'domain',
    confidence: 0.64,
    description: 'Rubicon Magnite SSP',
    urlTemplate: 'https://ads.rubiconproject.com/ad/12345.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'openx',
    raw: '||openx.net^',
    category: 'domain',
    confidence: 0.63,
    description: 'OpenX 广告网络',
    urlTemplate: 'https://js.openx.net/hb/12345.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    id: 'scorecard',
    raw: '||scorecardresearch.com^',
    category: 'domain',
    confidence: 0.65,
    description: 'Comscore 追踪像素',
    urlTemplate: 'https://sb.scorecardresearch.com/p?c1=2&c2=123&cv=2.0&cj=1&cb={RAND}',
    resourceType: 'image',
  },
  {
    id: 'quantserve',
    raw: '||quantserve.com^',
    category: 'domain',
    confidence: 0.62,
    description: 'Quantcast 广告追踪',
    urlTemplate: 'https://pixel.quantserve.com/pixel/p-123.gif?cb={RAND}',
    resourceType: 'image',
  },
];
