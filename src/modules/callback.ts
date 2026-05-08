/**
 * 回调模块 —— 管理单实例的 onDetect 回调链
 *
 * ⚠️ 每个检测器实例应持有独立的 CallbackManager，
 * 而非共享模块级数组，避免多实例互相干扰。
 */

import { DetectionResult } from './detector';

export type CallbackFn = (result: DetectionResult) => void;

interface CallbackEntry {
  fn: CallbackFn;
  once: boolean;
}

/**
 * 回调管理器（实例级，非模块级）
 */
export class CallbackManager {
  private entries: CallbackEntry[] = [];

  /** 注册持续回调 */
  on(fn: CallbackFn): void {
    this.entries.push({ fn, once: false });
  }

  /** 注册一次性回调 */
  once(fn: CallbackFn): void {
    this.entries.push({ fn, once: true });
  }

  /** 移除指定回调 */
  off(fn: CallbackFn): void {
    const idx = this.entries.findIndex((c) => c.fn === fn);
    if (idx !== -1) this.entries.splice(idx, 1);
  }

  /** 清除所有回调 */
  clear(): void {
    this.entries.length = 0;
  }

  /** 触发通知所有订阅者 */
  emit(result: DetectionResult): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      try {
        this.entries[i].fn(result);
      } catch (err) {
        if (typeof console !== 'undefined') {
          console.error('[AdblockDetector] callback error:', err);
        }
      }
      if (this.entries[i].once) {
        this.entries.splice(i, 1);
      }
    }
  }

  /** 当前回调数量 */
  get size(): number {
    return this.entries.length;
  }
}
