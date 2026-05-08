/**
 * EasyList 高频拦截规则精选
 *
 * 策略：从 EasyList 主列表中选取 10 条覆盖面最广、命中率最高的规则，
 * 每条规则生成一个对应测试资源 URL。若浏览器加载该 URL 失败（被拦截），
 * 则作为"存在 AdBlock"的证据。
 *
 * 规则类型覆盖：
 *  - ||domain^  (域名拦截)
 *  - /path/*.js  (路径通配)
 *  - &ad_type=  (查询参数)
 *  - ##.selector (元素隐藏，本工具不测隐藏仅测网络拦截)
 */

export interface EasyListRule {
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

export const EASYLIST_RULES: EasyListRule[] = [
  {
    raw: '||pagead2.googlesyndication.com^',
    category: 'domain',
    confidence: 0.95,
    description: 'Google AdSense 广告主域',
    urlTemplate: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?cachebust={RAND}',
    resourceType: 'script',
  },
  {
    raw: '||doubleclick.net^',
    category: 'domain',
    confidence: 0.92,
    description: 'Google DoubleClick 广告平台',
    urlTemplate: 'https://doubleclick.net/dbm/ad?ci={RAND}',
    resourceType: 'image',
  },
  {
    raw: '/ads.js',
    category: 'path',
    confidence: 0.88,
    description: '通用 ads.js 广告脚本',
    urlTemplate: '/ads.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    raw: '||adservice.google.*/^',
    category: 'domain',
    confidence: 0.90,
    description: 'Google Ad Service 广告服务',
    urlTemplate: 'https://adservice.google.com/adsid/integrator.js?domain=test&cb={RAND}',
    resourceType: 'script',
  },
  {
    raw: '||amazon-adsystem.com^',
    category: 'domain',
    confidence: 0.82,
    description: 'Amazon 广告系统',
    urlTemplate: 'https://aax.amazon-adsystem.com/e/dtb/bid?src={RAND}',
    resourceType: 'image',
  },
  {
    raw: '/ad/banner/*$image',
    category: 'path',
    confidence: 0.85,
    description: '通用广告 banner 图片路径',
    urlTemplate: '/ad/banner/728x90.jpg?z={RAND}',
    resourceType: 'image',
  },
  {
    raw: '||taboola.com^',
    category: 'third-party',
    confidence: 0.80,
    description: 'Taboola 内容推荐广告',
    urlTemplate: 'https://cdn.taboola.com/libtrc/loader.js?uid={RAND}',
    resourceType: 'script',
  },
  {
    raw: '||outbrain.com^',
    category: 'third-party',
    confidence: 0.78,
    description: 'Outbrain 内容推荐广告',
    urlTemplate: 'https://widgets.outbrain.com/outbrain.js?cb={RAND}',
    resourceType: 'script',
  },
  {
    raw: '&ad_type=',
    category: 'param',
    confidence: 0.75,
    description: '查询参数 ad_type 拦截',
    urlTemplate: '/api/v1/feed?ad_type=banner&v={RAND}',
    resourceType: 'xmlhttprequest',
  },
  {
    raw: '||googlesyndication.com/safeframe/',
    category: 'domain',
    confidence: 0.87,
    description: 'Google SafeFrame 广告容器',
    urlTemplate: 'https://tpc.googlesyndication.com/safeframe/1-0-40/html/container.html?x={RAND}',
    resourceType: 'image',
  },
];
