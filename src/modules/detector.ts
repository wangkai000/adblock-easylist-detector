/**
 * 检测引擎 —— 双重检测（网络探测 + 诱饵元素）
 *
 * 网络探测：生成测试资源 URL，检查加载是否被拦截
 * 诱饵检测：创建广告特征 DOM 元素，检查是否被 CSS 规则隐藏
 * 两种方式结合，提高检测准确率
 *
 * v1.1 优化：
 *  - P0-1/2/4: 统一 cleanup 数组解决 Script/fetch/Image DOM 泄漏
 *  - P0-3: 缓存 instanceId 改参数传递，消灭模块级全局竞态
 *  - P1-2: 置信度权重可配置
 *  - P1-7: 并发控制
 */

import { TestResource } from './resource-generator';
import { detectByBait, BaitConfig, BaitResult } from './bait-detector';

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

let _fallbackInstanceId = 'default';

interface CacheEntry {
  result: DetectionResult;
  savedAt: number;
}

function readCache(instanceId: string): DetectionResult | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(getCacheKey(instanceId));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.savedAt > CACHE_TTL) {
      try { sessionStorage.removeItem(getCacheKey(instanceId)); } catch { /* quota or disabled */ }
      return null;
    }
    return { ...entry.result, fromCache: true };
  } catch {
    return null;
  }
}

function writeCache(result: DetectionResult, instanceId: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const entry: CacheEntry = { result: { ...result, fromCache: false }, savedAt: Date.now() };
    sessionStorage.setItem(getCacheKey(instanceId), JSON.stringify(entry));
  } catch { /* quota exceeded or storage disabled */ }
}

export function clearCache(instanceId?: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (instanceId) {
        sessionStorage.removeItem(getCacheKey(instanceId));
      } else {
        // 清除所有实例的缓存（遍历 sessionStorage）
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith(CACHE_KEY_PREFIX)) {
            sessionStorage.removeItem(key);
          }
        }
      }
    }
  } catch { /* ignore */ }
}

/** @deprecated 保留旧签名兼容，但建议用 detect options 中的 instanceId */
export function setCacheInstanceId(id: string): void {
  _fallbackInstanceId = id;
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
 *
 * P0-1 fix: timeout 路径统一调用 cleanupFns 清理 DOM/连接
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

    // P0 fix: 统一 cleanup 数组 — timeout/load/error 三条路径统一清理
    const cleanupFns: Array<() => void> = [];
    let resolved = false;

    const getDuration = () => {
      return typeof performance !== 'undefined'
        ? Math.round(performance.now() - start)
        : Math.round(Date.now() - start);
    };

    const safeDone = (blocked: boolean, error?: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      // 统一执行清理
      for (const fn of cleanupFns) {
        try { fn(); } catch { /* best effort */ }
      }
      cleanupFns.length = 0;
      resolve({
        ruleIndex: resource.ruleIndex,
        url: resource.url,
        blocked,
        duration: getDuration(),
        error,
      });
    };

    // timeout 回调现在也走 safeDone → 统一清理
    const timer = setTimeout(() => {
      safeDone(true, 'TIMEOUT');
    }, timeout);

    try {
      if (resource.resourceType === 'xmlhttprequest') {
        const controller = new AbortController();
        const fetchTimer = setTimeout(() => controller.abort(), timeout);

        // 注册 cleanup：abort + clear fetchTimer
        cleanupFns.push(() => {
          try { controller.abort(); } catch { /* */ }
          clearTimeout(fetchTimer);
        });

        fetch(resource.url, { mode: 'no-cors', signal: controller.signal })
          .then((_resp) => {
            clearTimeout(fetchTimer);
            // no-cors 成功只代表请求发出了，不代表没被拦截
            // 用 Image 二次验证
            const img = new Image();
            const imgTimer = setTimeout(() => {
              safeDone(true, 'TIMEOUT_SECONDARY');
            }, Math.min(timeout, 1500));

            // 注册 Image cleanup
            cleanupFns.push(() => {
              clearTimeout(imgTimer);
              img.src = '';
            });

            img.onload = () => {
              clearTimeout(imgTimer);
              safeDone(false);
            };
            img.onerror = () => {
              clearTimeout(imgTimer);
              safeDone(true, 'FETCH_IMAGE_BLOCKED');
            };
            img.src = resource.url;
          })
          .catch((err: unknown) => {
            clearTimeout(fetchTimer);
            const errName = err instanceof Error ? err.name : undefined;
            safeDone(true, errName === 'AbortError' ? 'TIMEOUT' : 'FETCH_BLOCKED');
          });
      } else if (resource.resourceType === 'script') {
        const el = document.createElement('script');
        el.src = resource.url;
        el.async = true;

        // 注册 script cleanup
        cleanupFns.push(() => { try { document.head.removeChild(el); } catch { /* */ } });

        el.onload = () => { safeDone(false); };
        el.onerror = () => { safeDone(true, 'SCRIPT_BLOCKED'); };
        document.head.appendChild(el);
      } else {
        // image
        const img = new Image();

        // 注册 image cleanup
        cleanupFns.push(() => { img.src = ''; });

        img.onload = () => safeDone(false);
        img.onerror = () => safeDone(true, 'IMAGE_BLOCKED');
        img.src = resource.url;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'EXCEPTION';
      safeDone(true, msg);
    }
  });
}

/* ── 并发控制工具 ── */

/** 限制并发数的 Promise.all */
async function promiseAllLimit<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
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
  /** 网络探测权重 0~1（默认 0.6，诱饵自动补齐） */
  netWeight?: number;
  /** 诱饵检测权重 0~1（默认 0.4，网络自动补齐） */
  baitWeight?: number;
  /** 并发探测数限制（默认 5） */
  maxConcurrency?: number;
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
  const instanceId = options.instanceId || _fallbackInstanceId;

  // 检查缓存
  if (useCache) {
    const cached = readCache(instanceId);
    if (cached) return cached;
  }

  const startTotal = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const getElapsed = () => typeof performance !== 'undefined'
    ? Math.round(performance.now() - startTotal)
    : Math.round(Date.now() - startTotal);

  // P1-7: 并发控制
  const concurrency = options.maxConcurrency ?? 5;
  const probeTasks = resources.map((r) => () => probeResource(r, timeout));

  // 并行执行网络探测和诱饵检测
  const [details, baitResults] = await Promise.all([
    promiseAllLimit(probeTasks, concurrency),
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

  // ── P1-2: 可配置综合置信度权重 ──
  let confidence: number;
  if (baitResults.length > 0) {
    const netW = options.netWeight ?? 0.6;
    const baitW = options.baitWeight ?? 0.4;
    confidence = netConfidence * netW + baitConfidence * baitW;
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

  writeCache(result, instanceId);

  return result;
}
