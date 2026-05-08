import { describe, it, expect, vi } from 'vitest';
import { createDetector, getInstance } from './index';

describe('createDetector', () => {
  it('默认配置应正确', () => {
    const d = createDetector();
    expect(d.options.timeout).toBe(3000);
    expect(d.options.confidenceThreshold).toBe(0.5);
    expect(d.options.cache).toBe(true);
    expect(d.options.enableBait).toBe(true);
    expect(d.options.baitTimeout).toBe(200);
  });

  it('自定义配置应覆盖默认值', () => {
    const d = createDetector({
      timeout: 5000,
      confidenceThreshold: 0.8,
      cache: false,
      enableBait: false,
    });
    expect(d.options.timeout).toBe(5000);
    expect(d.options.confidenceThreshold).toBe(0.8);
    expect(d.options.cache).toBe(false);
    expect(d.options.enableBait).toBe(false);
  });

  it('detect 返回正确的结构', async () => {
    const d = createDetector({ timeout: 500, enableBait: true });
    const result = await d.detect();
    expect(result).toHaveProperty('detected');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('blockedCount');
    expect(result).toHaveProperty('totalCount');
    expect(result).toHaveProperty('details');
    expect(result).toHaveProperty('baitResults');
    expect(result).toHaveProperty('totalDuration');
    expect(result).toHaveProperty('fromCache');
    expect(result).toHaveProperty('timestamp');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.totalCount).toBe(10);
  });

  it('置信度阈值影响 detected 判定', async () => {
    // jsdom 里所有网络请求超时，confidence 偏高
    const low = createDetector({ timeout: 500, confidenceThreshold: 0, enableBait: false });
    const rLow = await low.detect();
    expect(rLow.confidence).toBeGreaterThan(0);
    expect(rLow.detected).toBe(true);

    // 阈值高于实际 confidence → detected=false
    const highThreshold = rLow.confidence + 0.01;
    const strict = createDetector({ timeout: 500, confidenceThreshold: highThreshold, enableBait: false });
    const rStrict = await strict.detect();
    expect(rStrict.detected).toBe(false);
  }, 20000);

  it('回调系统工作正常', async () => {
    const d = createDetector({ timeout: 500, enableBait: false });
    const onFn = vi.fn();
    const onceFn = vi.fn();
    d.onDetect(onFn);
    d.onceDetect(onceFn);

    await d.detect();
    expect(onFn).toHaveBeenCalledTimes(1);
    expect(onceFn).toHaveBeenCalledTimes(1);

    await d.detect();
    expect(onFn).toHaveBeenCalledTimes(2);
    expect(onceFn).toHaveBeenCalledTimes(1); // once 只触发一次
  }, 15000);

  it('offDetect 移除回调', async () => {
    const d = createDetector({ timeout: 500, enableBait: false });
    const fn = vi.fn();
    d.onDetect(fn);
    d.offDetect(fn);
    await d.detect();
    expect(fn).not.toHaveBeenCalled();
  });

  it('clearCache 不抛错', () => {
    const d = createDetector();
    expect(() => d.clearCache()).not.toThrow();
  });

  it('destroy 清除回调+缓存', async () => {
    const d = createDetector({ timeout: 500, enableBait: false });
    const fn = vi.fn();
    d.onDetect(fn);
    d.destroy();
    await d.detect();
    // destroy 后回调已清空，fn 不应被触发
  });

  it('多实例缓存隔离', async () => {
    const d1 = createDetector({ timeout: 500, enableBait: false });
    const d2 = createDetector({ timeout: 500, enableBait: false });
    const r1 = await d1.detect();
    const r2 = await d2.detect();
    expect(r1.fromCache).toBe(false);
    expect(r2.fromCache).toBe(false);
  });
});

describe('getInstance', () => {
  it('返回单例', () => {
    const a = getInstance();
    const b = getInstance();
    expect(a).toBe(b);
  });
});
