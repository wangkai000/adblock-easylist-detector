/**
 * 诱饵元素检测 —— 通过创建广告特征 DOM 元素，检测是否被 AdBlock CSS 规则隐藏
 *
 * 原理：大多数 AdBlock 不仅拦截网络请求，还会通过 CSS 规则隐藏广告占位元素。
 * 创建一个带广告特征 class/id 的 div，插入 DOM 后检查其 display/visibility，
 * 若被隐藏则说明存在 AdBlock。
 *
 * v1.1: 诱饵从 5 扩至 12，覆盖更多 AdBlock 规则
 */

/** 诱饵元素配置 */
export interface BaitConfig {
  /** 广告特征 CSS class 名 */
  className: string;
  /** 广告特征 ID */
  id?: string;
  /** 诱饵元素内部 HTML（某些 AdBlock 规则匹配内部内容） */
  innerHTML?: string;
  /** 该诱饵的置信度权重 */
  confidence: number;
  /** 说明 */
  description: string;
}

/** 默认诱饵配置列表 */
export const DEFAULT_BAITS: BaitConfig[] = [
  {
    className: 'ad-banner ad_leaderboard',
    id: 'ad-container',
    innerHTML: '<span class="ad_text">Advertisement</span>',
    confidence: 0.90,
    description: '通用广告 banner 容器',
  },
  {
    className: 'adsbox ads-widget',
    confidence: 0.88,
    description: '通用广告盒子',
  },
  {
    className: 'sponsor-box sponsored-content',
    confidence: 0.82,
    description: '赞助内容容器',
  },
  {
    className: 'textads banner-ads',
    id: 'google_ads_frame',
    confidence: 0.92,
    description: 'Google 广告帧',
  },
  {
    className: 'ad-placement',
    id: 'ad-wrapper',
    confidence: 0.85,
    description: '广告占位容器',
  },
  // ── v1.1 新增 ──
  {
    className: 'adsbygoogle',
    confidence: 0.91,
    description: 'Google AdSense 常见 class',
  },
  {
    className: '',
    id: 'div-gpt-ad',
    confidence: 0.87,
    description: 'Google DFP 广告容器 ID',
  },
  {
    className: 'google_ad',
    id: 'google_ad',
    innerHTML: '<ins class="adsbygoogle"></ins>',
    confidence: 0.89,
    description: 'Google Ad 复合诱饵',
  },
  {
    className: 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links',
    confidence: 0.86,
    description: '通用广告尺寸 + 文字广告 class 组合',
  },
  {
    className: 'banner-ad-container adunit',
    confidence: 0.80,
    description: '通用 banner 广告容器组合',
  },
  {
    className: 'ad_slot ad_unit',
    confidence: 0.78,
    description: '广告槽位',
  },
  {
    className: 'advertisement ad-300x250',
    confidence: 0.79,
    description: '广告显示容器',
  },
];

export interface BaitResult {
  /** 诱饵配置索引 */
  baitIndex: number;
  /** 是否被隐藏 */
  hidden: boolean;
  /** 检测方式 */
  reason: 'display_none' | 'visibility_hidden' | 'zero_size' | 'not_in_dom' | 'none';
  /** 置信度权重 */
  confidence: number;
  /** 说明 */
  description: string;
}

/**
 * 创建并检测单个诱饵元素
 */
function probeBait(bait: BaitConfig, index: number, timeout: number): Promise<BaitResult> {
  return new Promise((resolve) => {
    // SSR 安全检查
    if (typeof document === 'undefined') {
      resolve({
        baitIndex: index,
        hidden: false,
        reason: 'none',
        confidence: bait.confidence,
        description: bait.description,
      });
      return;
    }

    // v1.3: 对照组检查 — 宿主页面自身CSS误判防护
    let skipThisBait = false;
    if (bait.className || bait.id) {
      // 临时创建引用元素检查自然状态
      const refEl = document.createElement('div');
      refEl.className = bait.className;
      if (bait.id) refEl.id = bait.id;
      refEl.style.cssText = 'position:absolute!important;top:-9999px!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;pointer-events:none!important;';
      document.body.appendChild(refEl);
      const refStyle = window.getComputedStyle(refEl);
      if (refStyle.display === 'none' || refStyle.visibility === 'hidden') {
        // 页面自身有隐藏该 class/id 的规则 → 该诱饵不可靠，标记跳过
        skipThisBait = true;
      }
      try { refEl.remove(); } catch { /* */ }
    }
    if (skipThisBait) {
      resolve({
        baitIndex: index,
        hidden: false,
        reason: 'none',
        confidence: 0,  // 权重降为0，不参与置信度计算
        description: bait.description + ' [skipped: page has hidden rule for this class]',
      });
      return;
    }

    const el = document.createElement('div');
    el.className = bait.className;
    if (bait.id) el.id = bait.id;
    if (bait.innerHTML) el.innerHTML = bait.innerHTML;

    // 设置不可见样式，避免影响页面布局
    el.style.cssText = 'position:absolute!important;top:-9999px!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;pointer-events:none!important;';

    document.body.appendChild(el);

    let resolved = false;

    const checkHidden = (): BaitResult => {
      // 检查元素是否还在 DOM 中
      if (!el.parentElement) {
        return { baitIndex: index, hidden: true, reason: 'not_in_dom', confidence: bait.confidence, description: bait.description };
      }

      const style = window.getComputedStyle(el);

      if (style.display === 'none') {
        return { baitIndex: index, hidden: true, reason: 'display_none', confidence: bait.confidence, description: bait.description };
      }

      if (style.visibility === 'hidden' || style.opacity === '0') {
        return { baitIndex: index, hidden: true, reason: 'visibility_hidden', confidence: bait.confidence, description: bait.description };
      }

      // 检查是否被压缩为 0 尺寸（某些 AdBlock 会这样做）
      if (parseInt(style.height) === 0 && parseInt(style.width) === 0) {
        return { baitIndex: index, hidden: true, reason: 'zero_size', confidence: bait.confidence, description: bait.description };
      }

      // 检查子元素是否被隐藏（AdBlock 可能只隐藏子元素如 ins.adsbygoogle）
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i] as HTMLElement;
        const childStyle = window.getComputedStyle(child);
        if (childStyle.display === 'none' || childStyle.visibility === 'hidden') {
          return { baitIndex: index, hidden: true, reason: 'display_none', confidence: bait.confidence, description: bait.description };
        }
      }

      return { baitIndex: index, hidden: false, reason: 'none', confidence: bait.confidence, description: bait.description };
    };

    const finish = (result: BaitResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try { el.remove(); } catch { try { document.body.removeChild(el); } catch { /* */ } }
      resolve(result);
    };

    // 超时兜底
    const timer = setTimeout(() => {
      finish(checkHidden());
    }, Math.min(timeout, 200));

    // 使用双重检查：rAF + setTimeout 确保 AdBlock CSS 生效后再检测
    // v1.3: 50ms → 150ms，适配 MutationObserver 异步隐藏在慢机上的延迟
    requestAnimationFrame(() => {
      const immediate = checkHidden();
      if (immediate.hidden) {
        finish(immediate);
      } else {
        setTimeout(() => finish(checkHidden()), 150);
      }
    });
  });
}

/**
 * 执行诱饵元素检测
 */
export async function detectByBait(
  baits: BaitConfig[] = DEFAULT_BAITS,
  timeout: number = 200,
): Promise<BaitResult[]> {
  return Promise.all(baits.map((bait, i) => probeBait(bait, i, timeout)));
}
