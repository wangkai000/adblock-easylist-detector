/**
 * AdblockDetector —— 主入口
 *
 * 基于 EasyList 规则反向探测 + CSS 诱饵元素双重检测的轻量 JS 插件。
 *
 * Usage:
 *   import { createDetector } from 'adblock-easylist-detector';
 *   const detector = createDetector({ timeout: 3000, confidenceThreshold: 0.5 });
 *   // 注册回调后自动触发首次检测
 *   detector.onDetect(result => console.log(result));
 *   // 手动再次检测
 *   const result = await detector.detect();
 */

import { generateAllResources, generateByCategory, generateByConfidence } from './modules/resource-generator';
import { detect, clearCacheById, DetectionResult } from './modules/detector';
import { CallbackManager, CallbackFn } from './modules/callback';
import { EASYLIST_RULES } from './rules/easylist';
import { BaitConfig } from './modules/bait-detector';

export { DetectionResult, SingleResult } from './modules/detector';
export { TestResource } from './modules/resource-generator';
export { CallbackFn } from './modules/callback';
export { EasyListRule, EASYLIST_RULES } from './rules/easylist';
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
}

/* ── Detector 实例 ── */

export interface AdblockDetector {
  /** 执行检测，返回 Promise<DetectionResult>（手动触发） */
  detect(): Promise<DetectionResult>;
  /** 注册持续回调，注册后自动触发首次检测 */
  onDetect(fn: CallbackFn): void;
  /** 注册一次性回调，注册后自动触发首次检测 */
  onceDetect(fn: CallbackFn): void;
  /** 移除回调 */
  offDetect(fn: CallbackFn): void;
  /** 清除缓存 */
  clearCache(): void;
  /** 销毁实例（清缓存+清回调），销毁后 detect() 将 reject */
  destroy(): void;
  /** 实例是否已销毁 */
  readonly destroyed: boolean;
  /** 当前配置（只读） */
  readonly options: Required<Omit<DetectorOptions, 'category' | 'minConfidence' | 'baits'>> & DetectorOptions;
}

/**
 * 工厂函数：创建 Detector 实例
 */
export function createDetector(options: DetectorOptions = {}): AdblockDetector {
  // 每个实例独立回调管理器 + 独立缓存标识
  const callbacks = new CallbackManager();
  const _id = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let _destroyed = false;
  let _pendingDetect: Promise<DetectionResult> | null = null;

  const opts: AdblockDetector['options'] = {
    timeout: options.timeout ?? 3000,
    confidenceThreshold: options.confidenceThreshold ?? 0.5,
    cache: options.cache ?? true,
    category: options.category,
    minConfidence: options.minConfidence,
    enableBait: options.enableBait ?? true,
    baits: options.baits,
    baitTimeout: options.baitTimeout ?? 200,
  };

  function runDetect(): Promise<DetectionResult> {
    if (_pendingDetect) return _pendingDetect;

    _pendingDetect = (async () => {
      try {
        let resources;
        if (opts.category) {
          resources = generateByCategory(opts.category);
        } else if (opts.minConfidence !== undefined) {
          resources = generateByConfidence(opts.minConfidence);
        } else {
          resources = generateAllResources();
        }

        const result = await detect(resources, opts.timeout, opts.cache, {
          enableBait: opts.enableBait,
          baits: opts.baits,
          baitTimeout: opts.baitTimeout,
          instanceId: _id,
        });

        // 根据阈值覆盖 detected 字段
        result.detected = result.confidence >= opts.confidenceThreshold;

        // 触发回调
        callbacks.emit(result);

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
    get options() { return opts; },
    get destroyed() { return _destroyed; },

    async detect(): Promise<DetectionResult> {
      if (_destroyed) {
        throw new Error('[AdblockDetector] Instance has been destroyed');
      }
      return runDetect();
    },

    onDetect(fn) {
      if (_destroyed) return;
      callbacks.on(fn);
      scheduleAutoDetect();
    },
    onceDetect(fn) {
      if (_destroyed) return;
      callbacks.once(fn);
      scheduleAutoDetect();
    },
    offDetect(fn) { callbacks.off(fn); },

    clearCache() { clearCacheById(_id); },

    destroy() {
      _destroyed = true;
      clearCacheById(_id);
      callbacks.clear();
      _pendingDetect = null;
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
