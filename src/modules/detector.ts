/**
 * 检测引擎 —— 双重检测（网络探测 + 诱饵元素）
 *
 * 网络探测：生成测试资源 URL，检查加载是否被拦截
 * 诱饵检测：创建广告特征 DOM 元素，检查是否被 CSS 规则隐藏
 * 两种方式结合，提高检测准确率
 */

import { TestResource } from './resource-generator';
import { detectByBait, BaitConfig, BaitResult, DEFAULT_BAITS } from './bait-detector';

/* ── 类型 ── */

export interface SingleResult {
  ruleIndex: number;
  url: string;
  /** 是否被拦截（加载失败） */
  blocked: boolean;
  /** 检测耗时 ms */
  duration: number;
  /** 错误信息 */
  error?: string;
}

export interface DetectionResult {
  /** 是否检测到 AdBlock */
  detected: boolean;
  /** 综合置信度 0~1（网络+诱饵加权） */
  confidence: number;
  /** 被拦截的规则数 / 总规则数 */
  blockedCount: number;
  totalCount: number;
  /** 网络探测详细结果 */
  details: SingleResult[];
  /** 诱饵检测详细结果 */
  baitResults: BaitResult[];
  /** 诱饵检测被隐藏数 / 总数 */
  baitHiddenCount: number;
  baitTotalCount: number;
  /** 总检测耗时 ms */
  totalDuration: number;
  /** 是否命中缓存 */
  fromCache: boolean;
  /** 检测时间戳 */
  timestamp: number;
}

/* ── 缓存 ── */

const CACHE_KEY_PREFIX = '__aed_cache_';
const CACHE_TTL = 5 * 60 * 1000;

/** 生成实例级缓存 key，避免多实例冲突 */
function getCacheKey(instanceId: string): string {
  return `${CACHE_KEY_PREFIX}${instanceId}`;
}

let _instanceId = 'default';

/** 设置缓存实例标识（由 createDetector 调用） */
export function setCacheInstanceId(id: string): void {
  _instanceId = id;
}

interface CacheEntry {
  result: DetectionResult;
  savedAt: number;
}

function readCache(): DetectionResult | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(getCacheKey(_instanceId));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.savedAt > CACHE_TTL) {
      sessionStorage.removeItem(getCacheKey(_instanceId));
      return null;
    }
    return { ...entry.result, fromCache: true };
  } catch {
    return null;
  }
}

function writeCache(result: DetectionResult): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const entry: CacheEntry = { result: { ...result, fromCache: false }, savedAt: Date.now() };
    sessionStorage.setItem(getCacheKey(_instanceId), JSON.stringify(entry));
  } catch { /* ignore */ }
}

export function clearCache(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(getCacheKey(_instanceId));
    }
  } catch { /* ignore */ }
}

/* ── 网络探测 ── */

/**
 * 加载单个资源并检测是否被拦截
 *
 * 策略优先级：
 * 1. script 标签：最可靠，AdBlock 会直接拦截脚本加载
 * 2. image：次可靠，图片请求拦截也较常见
 * 3. fetch no-cors：替代 XHR，避免 CORS 误判
 *    ⚠️ no-cors 模式下 fetch 即使被 AdBlock 拦截，
 *    浏览器也可能返回 opaque response 而非 reject。
 *    因此对 xmlhttprequest 类型，优先使用 script 标签二次确认。
 */
function probeResource(resource: TestResource, timeout: number): Promise<SingleResult> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return new Promise<SingleResult>((resolve) => {
    // SSR 安全检查
    if (typeof window === 'undefined') {
      resolve({
        ruleIndex: resource.ruleIndex,
        url: resource.url,
        blocked: false,
        duration: 0,
        error: 'SSR',
      });
      return;
    }

    const getDuration = () => {
      return typeof performance !== 'undefined'
        ? Math.round(performance.now() - start)
        : Math.round(Date.now() - start);
    };

    const timer = setTimeout(() => {
      resolve({
        ruleIndex: resource.ruleIndex,
        url: resource.url,
        blocked: true,
        duration: timeout,
        error: 'TIMEOUT',
      });
    }, timeout);

    const done = (blocked: boolean, error?: string) => {
      clearTimeout(timer);
      resolve({
        ruleIndex: resource.ruleIndex,
        url: resource.url,
        blocked,
        duration: getDuration(),
        error,
      });
    };

    try {
      if (resource.resourceType === 'xmlhttprequest') {
        // xmlhttprequest 类型：先尝试 fetch no-cors，再通过 Image 二次确认
        // fetch no-cors 的 opaque response 不可靠，可能误判
        // 策略：fetch 成功 → 用 Image 加同一 URL 二次验证
        const controller = new AbortController();
        const fetchTimer = setTimeout(() => controller.abort(), timeout);

        fetch(resource.url, { mode: 'no-cors', signal: controller.signal })
          .then((resp) => {
            clearTimeout(fetchTimer);
            // no-cors 成功只代表请求发出了，不代表没被拦截
            // 用 Image 二次验证
            const img = new Image();
            const imgTimer = setTimeout(() => {
              done(true, 'TIMEOUT_SECONDARY');
            }, Math.min(timeout, 1500));
            img.onload = () => {
              clearTimeout(imgTimer);
              done(false);
            };
            img.onerror = () => {
              clearTimeout(imgTimer);
              done(true, 'FETCH_IMAGE_BLOCKED');
            };
            img.src = resource.url;
          })
          .catch((err) => {
            clearTimeout(fetchTimer);
            // fetch 直接 reject → 确定被拦截
            done(true, err.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_BLOCKED');
          });
      } else if (resource.resourceType === 'script') {
        const el = document.createElement('script');
        el.src = resource.url;
        el.async = true;
        const cleanup = () => { try { document.head.removeChild(el); } catch { /* */ } };
        el.onload = () => { cleanup(); done(false); };
        el.onerror = () => { cleanup(); done(true, 'SCRIPT_BLOCKED'); };
        document.head.appendChild(el);
      } else {
        // image
        const img = new Image();
        img.onload = () => done(false);
        img.onerror = () => done(true, 'IMAGE_BLOCKED');
        img.src = resource.url;
      }
    } catch (err: any) {
      done(true, err?.message || 'EXCEPTION');
    }
  });
}

/* ── 主检测 ── */

export interface DetectOptions {
  /** 是否启用诱饵检测（默认 true） */
  enableBait?: boolean;
  /** 自定义诱饵配置 */
  baits?: BaitConfig[];
  /** 诱饵检测超时 ms（默认 200） */
  baitTimeout?: number;
  /** 实例标识，用于缓存隔离 */
  instanceId?: string;
}

/**
 * 执行全量检测（网络 + 诱饵）
 */
export async function detect(
  resources: TestResource[],
  timeout: number = 3000,
  useCache: boolean = true,
  options: DetectOptions = {},
): Promise<DetectionResult> {
  // 设置实例级缓存
  if (options.instanceId) {
    setCacheInstanceId(options.instanceId);
  }

  // 检查缓存
  if (useCache) {
    const cached = readCache();
    if (cached) return cached;
  }

  const startTotal = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const getElapsed = () => typeof performance !== 'undefined'
    ? Math.round(performance.now() - startTotal)
    : Math.round(Date.now() - startTotal);

  // 并行执行网络探测和诱饵检测
  const [details, baitResults] = await Promise.all([
    Promise.all(resources.map((r) => probeResource(r, timeout))),
    (options.enableBait !== false)
      ? detectByBait(options.baits, options.baitTimeout)
      : Promise.resolve([]),
  ]);

  const totalDuration = getElapsed();

  // ── 计算网络探测置信度 ──
  let netWeightedBlocked = 0;
  let netWeightedTotal = 0;

  for (const d of details) {
    const weight = resources[d.ruleIndex]?.rule.confidence ?? 0.5;
    netWeightedTotal += weight;
    if (d.blocked) netWeightedBlocked += weight;
  }

  const netConfidence = netWeightedTotal > 0 ? netWeightedBlocked / netWeightedTotal : 0;

  // ── 计算诱饵检测置信度 ──
  let baitWeightedHidden = 0;
  let baitWeightedTotal = 0;
  let baitHiddenCount = 0;

  for (const b of baitResults) {
    baitWeightedTotal += b.confidence;
    if (b.hidden) {
      baitWeightedHidden += b.confidence;
      baitHiddenCount++;
    }
  }

  const baitConfidence = baitWeightedTotal > 0 ? baitWeightedHidden / baitWeightedTotal : 0;

  // ── 综合置信度 ──
  // 网络探测权重 60%，诱饵检测权重 40%
  // 如果诱饵未启用，则网络探测权重 100%
  let confidence: number;
  if (baitResults.length > 0) {
    confidence = netConfidence * 0.6 + baitConfidence * 0.4;
  } else {
    confidence = netConfidence;
  }

  const blockedCount = details.filter((d) => d.blocked).length;

  const result: DetectionResult = {
    detected: confidence >= 0.5,
    confidence: Math.round(confidence * 1000) / 1000,
    blockedCount,
    totalCount: details.length,
    details,
    baitResults,
    baitHiddenCount,
    baitTotalCount: baitResults.length,
    totalDuration,
    fromCache: false,
    timestamp: Date.now(),
  };

  writeCache(result);

  return result;
}
