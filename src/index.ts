/**
 * AdblockDetector —— 主入口
 *
 * 基于 EasyList 规则反向探测 + CSS 诱饵元素双重检测的轻量 JS 插件。
 *
 * v1.1 新增：
 *  - startPolling/stopPolling 定时轮询（Page Visibility API 集成）
 *  - onDetectedChange 状态变化回调
 *  - options 只读保护
 *
 * Usage:
 *   import { createDetector } from 'adblock-easylist-detector';
 *   const detector = createDetector({ timeout: 3000, confidenceThreshold: 0.5 });
 *
 *   // 一次性检测
 *   detector.onDetect(result => console.log(result));
 *   const result = await detector.detect();
 *
 *   // 定时轮询
 *   detector.startPolling({
 *     interval: 5000,
 *     onDetected: (result, prev) => console.log('changed', prev, '→', result),
 *   });
 */

import { generateByRuleIds, generateByCategory, generateByConfidence } from './modules/resource-generator';
import { detect, clearCache as clearEngineCache, DetectionResult } from './modules/detector';
import { CallbackManager, CallbackFn } from './modules/callback';
import { BaitConfig } from './modules/bait-detector';
import { DEFAULT_ACTIVE_RULE_IDS, EASYLIST_RULES } from './rules/easylist';

export { DetectionResult } from './modules/detector';
export { TestResource } from './modules/resource-generator';
export { CallbackFn } from './modules/callback';
export { EasyListRule, EASYLIST_RULES, DEFAULT_ACTIVE_RULE_IDS } from './rules/easylist';
export { BaitConfig, BaitResult, DEFAULT_BAITS } from './modules/bait-detector';

/* ── 配置 ── */

export interface DetectorOptions {
  /** 单条资源超时 ms（默认 3000） */
  timeout?: number;
  /** 判定 AdBlock 存在的置信度阈值 0~1（默认 0.5） */
  confidenceThreshold?: number;
  /** 是否启用缓存（默认 true） */
  cache?: boolean;
  /** 仅测试指定分类的规则 */
  category?: 'domain' | 'path' | 'param' | 'third-party';
  /** 仅测试置信度 ≥ 此值的规则 */
  minConfidence?: number;
  /** 是否启用诱饵元素检测（默认 true） */
  enableBait?: boolean;
  /** 自定义诱饵配置列表 */
  baits?: BaitConfig[];
  /** 诱饵检测超时 ms（默认 200） */
  baitTimeout?: number;
  /** 网络探测权重 0~1（默认 0.6） */
  netWeight?: number;
  /** 诱饵检测权重 0~1（默认 0.4） */
  baitWeight?: number;
  /** 并发探测限制（默认 5） */
  maxConcurrency?: number;
  /** 调试模式（默认 false） */
  debug?: boolean;
  /** 启用的规则 ID 列表（默认 DEFAULT_ACTIVE_RULE_IDS，即 10 条核心规则）。设为 [] 则关闭所有网络探测 */
  activeRules?: string[];
}

/* ── 版本号 ── */

export const VERSION = '1.3.0';

/* ── 轮询配置 ── */

export interface PollingOptions {
  /** 轮询间隔 ms（默认 5000） */
  interval?: number;
  /** 首次检测延迟 ms（默认 0，立即执行） */
  initialDelay?: number;
  /** 页面隐藏时降低频率的倍数（默认 3，设为 0 则隐藏时暂停） */
  hiddenMultiplier?: number;
  /** 最大轮询次数（默认 Infinity） */
  maxPolls?: number;
}

export interface PollingController {
  /** 开始轮询 */
  start(): void;
  /** 停止轮询 */
  stop(): void;
  /** 触发一次即时检测（不重置周期） */
  checkNow(): Promise<DetectionResult>;
  /** 是否正在轮询 */
  readonly running: boolean;
  /** 当前检测次数 */
  readonly pollCount: number;
  /** 最后一次检测结果 */
  readonly lastResult: DetectionResult | null;
}

/* ── Detector 实例 ── */

export interface AdblockDetector {
  /** 执行检测，返回 Promise<DetectionResult> */
  detect(): Promise<DetectionResult>;
  /** 注册持续回调（每次检测都触发） */
  onDetect(fn: CallbackFn): void;
  /** 注册一次性回调 */
  onceDetect(fn: CallbackFn): void;
  /** 移除回调 */
  offDetect(fn: CallbackFn): void;
  /** 注册状态变化回调（仅 detected 值变化时触发） */
  onDetectedChange(fn: (result: DetectionResult, previous: DetectionResult | null) => void): void;
  /** 移除状态变化回调 */
  offDetectedChange(fn: (result: DetectionResult, previous: DetectionResult | null) => void): void;
  /** 启动定时轮询检测 */
  startPolling(options?: PollingOptions): PollingController;
  /** 停止轮询 */
  stopPolling(): void;
  /** 清除缓存 */
  clearCache(): void;
  /** 销毁实例（清缓存+清回调+停止轮询），销毁后 detect() 将 throw */
  destroy(): void;
  /** 实例是否已销毁（只读） */
  readonly destroyed: boolean;
  /** 当前配置（只读） */
  readonly options: Readonly<Required<Omit<DetectorOptions, 'category' | 'minConfidence' | 'baits'>> & DetectorOptions>;
  /** 版本号 */
  readonly version: string;
  /** 启用一条规则（按 id） */
  enableRule(id: string): void;
  /** 禁用一条规则（按 id） */
  disableRule(id: string): void;
  /** 批量设置启用规则（覆盖当前列表） */
  setActiveRules(ids: string[]): void;
  /** 获取当前启用的规则 ID 列表 */
  getActiveRules(): string[];
  /** 获取全部 32 条规则（含 id/描述/分类/置信度） */
  getAllRules(): import('./rules/easylist').EasyListRule[];
}

/* ── 内部实现：轮询控制器 ── */

class PollingControllerImpl implements PollingController {
  private _running = false;
  private _pollCount = 0;
  private _lastResult: DetectionResult | null = null;
  private _interval: number;
  private _maxPolls: number;
  /** 跑探测（带并发去重）的外层函数 */
  private _runDetect: () => Promise<DetectionResult>;
  private _rafId: number | null = null;
  private _lastTick = 0;
  private _visibilityHandler: (() => void) | null = null;
  private _effectiveInterval: number;
  private _instanceId: string;

  constructor(
    runDetect: () => Promise<DetectionResult>,
    options: PollingOptions = {},
    instanceId: string,
  ) {
    this._detector = detector;
    this._instanceId = instanceId;
    this._interval = options.interval ?? 5000;
    this._maxPolls = options.maxPolls ?? Infinity;
    this._effectiveInterval = this._interval;
  }

  get running(): boolean { return this._running; }
  get pollCount(): number { return this._pollCount; }
  get lastResult(): DetectionResult | null { return this._lastResult; }

  start(): void {
    if (this._running) return;
    this._running = true;

    // Page Visibility API 集成
    if (typeof document !== 'undefined') {
      this._visibilityHandler = () => {
        if (document.hidden) {
          // 页面隐藏时完全停止 rAF，避免 CPU 浪费
          // hiddenMultiplier 仅影响恢复后的检测间隔（累积延迟补偿）
          this._stopTicking();
        } else {
          // 恢复可见 → 清缓存（用户可能开关了 AdBlock）+ 立即检测 + 恢复频率
          clearEngineCache(this._instanceId);
          this._effectiveInterval = this._interval;
          this._restartTicking();
          this._doCheck();
        }
      };
      document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    this._lastTick = 0;
    this._startTicking();
  }

  stop(): void {
    this._running = false;
    this._stopTicking();
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
  }

  async checkNow(): Promise<DetectionResult> {
    return this._doCheck();
  }

  private _doCheck = async (): Promise<DetectionResult> => {
    if (this._pollCount >= this._maxPolls) {
      this.stop();
      return this._lastResult ?? {
        detected: false,
        confidence: 0,
        blockedCount: 0,
        totalCount: 0,
        details: [],
        baitResults: [],
        baitHiddenCount: 0,
        baitTotalCount: 0,
        totalDuration: 0,
        fromCache: false,
        timestamp: Date.now(),
      };
    }

    this._pollCount++;
    try {
      // 走外层 runDetect — 自动获得并发去重 + 回调 + 状态变化判断
      const result = await this._runDetect();
      this._lastResult = result;
      return result;
    } catch {
      // 检测异常时静默继续
      if (this._lastResult) {
        return this._lastResult;
      }
      // 首次检测就异常：返回安全默认值，避免 null 导致调用方崩溃
      return {
        detected: false,
        confidence: 0,
        blockedCount: 0,
        totalCount: 0,
        details: [],
        baitResults: [],
        baitHiddenCount: 0,
        baitTotalCount: 0,
        totalDuration: 0,
        fromCache: false,
        timestamp: Date.now(),
      };
    }
  };

  private _startTicking(): void {
    // rAF + 时间差判断，避免 setInterval 在后台标签页被节流
    const tick = (now: number) => {
      if (!this._running) return;
      if (now - this._lastTick >= this._effectiveInterval) {
        this._lastTick = now;
        this._doCheck();
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  private _stopTicking(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _restartTicking(): void {
    this._stopTicking();
    this._lastTick = 0;
    this._startTicking();
  }
}

/* ── 内部实现 ── */

interface InternalDetector {
  detect(): Promise<DetectionResult>;
  /** 上一次检测结果（用于状态变化判断） */
  lastResult(): DetectionResult | null;
}

function createDetectorInternal(
  opts: AdblockDetector['options'],
  callbacks: CallbackManager,
  changeCallbacks: CallbackManager,
  _id: string,
): InternalDetector {
  let _lastResult: DetectionResult | null = null;

  return {
    lastResult() { return _lastResult; },

    async detect(): Promise<DetectionResult> {
      const ruleIds = opts.activeRules ?? DEFAULT_ACTIVE_RULE_IDS;
      let resources;
      if (opts.category) {
        resources = generateByCategory(opts.category, ruleIds);
      } else if (opts.minConfidence !== undefined) {
        resources = generateByConfidence(opts.minConfidence, ruleIds);
      } else {
        resources = generateByRuleIds(ruleIds);
      }

      const result = await detect(resources, opts.timeout, opts.cache, {
        enableBait: opts.enableBait,
        baits: opts.baits,
        baitTimeout: opts.baitTimeout,
        instanceId: _id,
        netWeight: opts.netWeight,
        baitWeight: opts.baitWeight,
        maxConcurrency: opts.maxConcurrency,
      });

      // 根据阈值覆盖 detected 字段
      result.detected = result.confidence >= opts.confidenceThreshold;

      // 触发 onDetect 回调
      callbacks.emit(result);

      // 触发 onDetectedChange 回调（仅在状态变化时）
      const prev = _lastResult;
      if (!prev || prev.detected !== result.detected) {
        changeCallbacks.emitWithPrev(result, prev);
      }
      _lastResult = result;

      return result;
    },
  };
}

/* ── 工厂函数 ── */

/**
 * 工厂函数：创建 Detector 实例
 */
export function createDetector(options: DetectorOptions = {}): AdblockDetector {
  const callbacks = new CallbackManager();
  const changeCallbacks = new CallbackManager();
  const _id = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // P1-9: 内部可变，对外只读
  const _opts = {
    timeout: options.timeout ?? 3000,
    confidenceThreshold: options.confidenceThreshold ?? 0.5,
    cache: options.cache ?? true,
    category: options.category,
    minConfidence: options.minConfidence,
    enableBait: options.enableBait ?? true,
    baits: options.baits,
    baitTimeout: options.baitTimeout ?? 200,
    netWeight: options.netWeight ?? 0.6,
    baitWeight: options.baitWeight ?? 0.4,
    maxConcurrency: options.maxConcurrency ?? 5,
    debug: options.debug ?? false,
    activeRules: options.activeRules ? [...options.activeRules] : [...DEFAULT_ACTIVE_RULE_IDS],
  };

  // 规则快查 map
  const _ruleMap = new Map(EASYLIST_RULES.map(r => [r.id, r]));

  const internal = createDetectorInternal(_opts, callbacks, changeCallbacks, _id);

  let polling: PollingControllerImpl | null = null;
  let _pendingDetect: Promise<DetectionResult> | null = null;
  let _destroyed = false;

  const debug = (...args: any[]) => {
    if (_opts.debug && typeof console !== 'undefined') {
      console.debug('[AdblockDetector]', ...args);
    }
  };

  function runDetect(): Promise<DetectionResult> {
    if (_destroyed) {
      return Promise.reject(new Error('[AdblockDetector] Instance has been destroyed'));
    }
    if (_pendingDetect) return _pendingDetect;

    _pendingDetect = (async () => {
      try {
        const result = await internal.detect();
        return result;
      } finally {
        _pendingDetect = null;
      }
    })();

    return _pendingDetect;
  }

  function scheduleAutoDetect(): void {
    if (_destroyed || _pendingDetect) return;
    runDetect();
  }

  return {
    get options() {
      // 返回只读快照
      return Object.freeze({ ..._opts }) as AdblockDetector['options'];
    },
    get destroyed() { return _destroyed; },
    version: VERSION,

    async detect(): Promise<DetectionResult> {
      debug('detect() called');
      return runDetect();
    },

    onDetect(fn) {
      callbacks.on(fn);
      scheduleAutoDetect();
    },
    onceDetect(fn) {
      callbacks.once(fn);
      scheduleAutoDetect();
    },
    offDetect(fn) { callbacks.off(fn); },

    onDetectedChange(fn) {
      changeCallbacks.on(fn);
    },
    offDetectedChange(fn) {
      changeCallbacks.off(fn);
    },

    startPolling(pollOpts: PollingOptions = {}): PollingController {
      if (polling) {
        polling.stop();
      }
      polling = new PollingControllerImpl(internal, pollOpts, _id);
      polling.start();
      debug('startPolling()', { interval: pollOpts.interval ?? 5000 });
      return polling;
    },

    stopPolling(): void {
      if (polling) {
        polling.stop();
        polling = null;
        debug('stopPolling()');
      }
    },

    clearCache() {
      clearEngineCache(_id);
      debug('clearCache()');
    },

    destroy() {
      this.stopPolling();
      _destroyed = true;
      _pendingDetect = null;
      clearEngineCache(_id);
      callbacks.clear();
      changeCallbacks.clear();
      debug('destroy()');
    },

    enableRule(id: string) {
      if (!_opts.activeRules.includes(id) && _ruleMap.has(id)) {
        _opts.activeRules.push(id);
        debug('enableRule', id);
      }
    },

    disableRule(id: string) {
      const i = _opts.activeRules.indexOf(id);
      if (i >= 0) {
        _opts.activeRules.splice(i, 1);
        debug('disableRule', id);
      }
    },

    setActiveRules(ids: string[]) {
      _opts.activeRules.length = 0;
      _opts.activeRules.push(...ids.filter(id => _ruleMap.has(id)));
      debug('setActiveRules', _opts.activeRules.length);
    },

    getActiveRules(): string[] {
      return [..._opts.activeRules];
    },

    getAllRules() {
      return EASYLIST_RULES;
    },
  };
}

/* ── 全局单例 ── */

let _instance: AdblockDetector | null = null;

/**
 * 获取/创建全局单例
 */
export function getInstance(options?: DetectorOptions): AdblockDetector {
  if (!_instance) {
    _instance = createDetector(options);
  }
  return _instance;
}
