import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallbackManager } from './callback';
import { DetectionResult, SingleResult } from './detector';

function mockResult(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    detected: false,
    confidence: 0,
    blockedCount: 0,
    totalCount: 10,
    details: [],
    baitResults: [],
    baitHiddenCount: 0,
    baitTotalCount: 0,
    totalDuration: 100,
    fromCache: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('CallbackManager', () => {
  let cb: CallbackManager;

  beforeEach(() => {
    cb = new CallbackManager();
  });

  it('on 注册回调后 emit 应触发', () => {
    const fn = vi.fn();
    cb.on(fn);
    const result = mockResult();
    cb.emit(result);
    expect(fn).toHaveBeenCalledWith(result);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('once 注册的回调只触发一次', () => {
    const fn = vi.fn();
    cb.once(fn);
    cb.emit(mockResult());
    cb.emit(mockResult());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('off 移除回调后不再触发', () => {
    const fn = vi.fn();
    cb.on(fn);
    cb.off(fn);
    cb.emit(mockResult());
    expect(fn).not.toHaveBeenCalled();
  });

  it('多实例互不干扰', () => {
    const cb2 = new CallbackManager();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    cb.on(fn1);
    cb2.on(fn2);

    cb.emit(mockResult());
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).not.toHaveBeenCalled();

    cb2.emit(mockResult());
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('clear 清除所有回调', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    cb.on(fn1);
    cb.once(fn2);
    cb.clear();
    cb.emit(mockResult());
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
    expect(cb.size).toBe(0);
  });

  it('回调抛错不影响其他回调', () => {
    const errorFn = vi.fn(() => { throw new Error('boom'); });
    const normalFn = vi.fn();
    cb.on(errorFn);
    cb.on(normalFn);
    // 不应抛错
    cb.emit(mockResult());
    expect(normalFn).toHaveBeenCalled();
  });

  it('size 返回正确数量', () => {
    expect(cb.size).toBe(0);
    cb.on(() => {});
    expect(cb.size).toBe(1);
    cb.once(() => {});
    expect(cb.size).toBe(2);
  });
});
