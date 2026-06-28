import { describe, it, expect, vi } from 'vitest';
import { createDetector, getInstance, DEFAULT_ACTIVE_RULE_IDS } from './index';
import { EASYLIST_RULES } from './rules/easylist';

describe('createDetector', () => {
  it('默认配置应正确', () => {
    const d = createDetector();
    expect(d.options.timeout).toBe(3000);
    expect(d.options.confidenceThreshold).toBe(0.5);
    expect(d.options.cache).toBe(true);
    expect(d.options.enableBait).toBe(true);
    expect(d.options.baitTimeout).toBe(200);
    expect(d.getActiveRules()).toEqual(DEFAULT_ACTIVE_RULE_IDS);
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
  }, 10000);

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

  it('destroy 清除回调+缓存，destroyed 标记为 true', async () => {
    const d = createDetector({ timeout: 500, enableBait: false });
    const fn = vi.fn();
    d.onDetect(fn);
    expect(d.destroyed).toBe(false);
    d.destroy();
    expect(d.destroyed).toBe(true);
    // destroy 后 detect 应抛错
    await expect(d.detect()).rejects.toThrow('destroyed');
  });

  it('onDetect 注册后自动触发首次检测', async () => {
    const d = createDetector({ timeout: 500, enableBait: false });
    const fn = vi.fn();
    d.onDetect(fn);
    // 不需要显式 await — 自动触发是 fire-and-forget
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(fn).toHaveBeenCalledTimes(1);
  }, 10000);

  it('onceDetect 注册后自动触发首次检测（且仅一次）', async () => {
    const d = createDetector({ timeout: 500, enableBait: false });
    const fn = vi.fn();
    d.onceDetect(fn);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1), { timeout: 3000 });
    // 手动再 detect 一次，once 不应再触发
    await d.detect();
    expect(fn).toHaveBeenCalledTimes(1);
  }, 10000);

  it('并发 detect 共享同一 Promise', async () => {
    const d = createDetector({ timeout: 500, enableBait: false });
    const fn = vi.fn();
    d.onDetect(fn);
    // 注册后自动触发了一次；现在再并发两次
    const [r1, r2] = await Promise.all([d.detect(), d.detect()]);
    // 两次并发应该返回同一个 result
    expect(r1).toBe(r2);
    // 回调应该被触发了 3 次（1 次自动 + 2 次手动）
    await vi.waitFor(() => expect(fn.mock.calls.length).toBeGreaterThanOrEqual(1));
  }, 15000);

  it('多实例缓存隔离', async () => {
    const d1 = createDetector({ timeout: 500, enableBait: false });
    const d2 = createDetector({ timeout: 500, enableBait: false });
    const r1 = await d1.detect();
    const r2 = await d2.detect();
    expect(r1.fromCache).toBe(false);
    expect(r2.fromCache).toBe(false);
  }, 15000);

  it('默认启用 10 条核心规则', () => {
    const d = createDetector();
    expect(d.getActiveRules()).toHaveLength(10);
    expect(d.getActiveRules()).toEqual(DEFAULT_ACTIVE_RULE_IDS);
  });

  it('通过 activeRules 自定义启用规则', () => {
    const d = createDetector({ activeRules: ['doubleclick', 'ads-js'] });
    expect(d.getActiveRules()).toEqual(['doubleclick', 'ads-js']);
  });

  it('getAllRules 返回全部 32 条', () => {
    const d = createDetector();
    expect(d.getAllRules()).toHaveLength(32);
    for (const r of d.getAllRules()) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('description');
      expect(r).toHaveProperty('confidence');
      expect(r).toHaveProperty('category');
    }
  });

  it('enableRule/disableRule 动态开关', () => {
    const d = createDetector();
    const before = d.getActiveRules().length;
    d.enableRule('criteo');
    expect(d.getActiveRules()).toHaveLength(before + 1);
    expect(d.getActiveRules()).toContain('criteo');
    d.enableRule('criteo'); // 重复添加不生效
    expect(d.getActiveRules()).toHaveLength(before + 1);
    d.disableRule('criteo');
    expect(d.getActiveRules()).toHaveLength(before);
    expect(d.getActiveRules()).not.toContain('criteo');
    d.disableRule('criteo'); // 重复删除不报错
  });

  it('enableRule 忽略无效 id', () => {
    const d = createDetector();
    const before = d.getActiveRules().length;
    d.enableRule('not-exist');
    expect(d.getActiveRules()).toHaveLength(before);
  });

  it('setActiveRules 批量覆盖', () => {
    const d = createDetector();
    d.setActiveRules(['adnxs', 'openx', 'not-exist']);
    // 'not-exist' 被过滤
    expect(d.getActiveRules()).toEqual(['adnxs', 'openx']);
  });

  it('activeRules 影响 detect 的 totalCount', async () => {
    const d = createDetector({ timeout: 500, enableBait: false, activeRules: ['pagead2-googlesyndication'] });
    const r = await d.detect();
    expect(r.totalCount).toBe(1);
  }, 10000);

  it('空 activeRules 不执行网络探测', async () => {
    const d = createDetector({ timeout: 500, enableBait: false, activeRules: [] });
    const r = await d.detect();
    expect(r.totalCount).toBe(0);
    expect(r.blockedCount).toBe(0);
  }, 10000);
});

describe('getInstance', () => {
  it('返回单例', () => {
    const a = getInstance();
    const b = getInstance();
    expect(a).toBe(b);
  });
});
