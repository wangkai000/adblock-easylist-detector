/**
 * 诱饵元素检测 —— 通过创建广告特征 DOM 元素，检测是否被 AdBlock CSS 规则隐藏
 *
 * 原理：大多数 AdBlock 不仅拦截网络请求，还会通过 CSS 规则隐藏广告占位元素。
 * 创建一个带广告特征 class/id 的 div，插入 DOM 后检查其 display/visibility，
 * 若被隐藏则说明存在 AdBlock。
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
    confidence: 0.9,
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

      return { baitIndex: index, hidden: false, reason: 'none', confidence: bait.confidence, description: bait.description };
    };

    const finish = (result: BaitResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try { document.body.removeChild(el); } catch { /* */ }
      resolve(result);
    };

    // 超时兜底
    const timer = setTimeout(() => {
      finish(checkHidden());
    }, Math.min(timeout, 200));

    // 使用双重检查：rAF + setTimeout(0) 确保 AdBlock CSS 生效后再检测
    // rAF 在后台标签页可能不触发，所以 setTimeout 兜底
    requestAnimationFrame(() => {
      const immediate = checkHidden();
      if (immediate.hidden) {
        finish(immediate);
      } else {
        // rAF 检测不到时，再等一个微任务周期
        setTimeout(() => finish(checkHidden()), 50);
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
