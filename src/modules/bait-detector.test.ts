import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectByBait, DEFAULT_BAITS, BaitResult } from './bait-detector';

describe('detectByBait', () => {
  it('无 AdBlock 时所有诱饵应显示正常', async () => {
    // jsdom 没有 AdBlock 扩展，所有诱饵应不被隐藏
    const results = await detectByBait(DEFAULT_BAITS, 200);
    expect(results).toHaveLength(DEFAULT_BAITS.length);
    for (const r of results) {
      expect(r.hidden).toBe(false);
      expect(r.reason).toBe('none');
    }
  });

  it('空诱饵列表返回空数组', async () => {
    const results = await detectByBait([], 200);
    expect(results).toHaveLength(0);
  });

  it('每条结果包含必要字段', async () => {
    const results = await detectByBait(DEFAULT_BAITS, 200);
    for (let i = 0; i < results.length; i++) {
      expect(results[i].baitIndex).toBe(i);
      expect(typeof results[i].hidden).toBe('boolean');
      expect(results[i].confidence).toBe(DEFAULT_BAITS[i].confidence);
      expect(results[i].description).toBe(DEFAULT_BAITS[i].description);
    }
  });

  it('诱饵元素检测后应被从 DOM 移除', async () => {
    await detectByBait(DEFAULT_BAITS, 200);
    // 检测完成后诱饵元素应已被清理
    for (const bait of DEFAULT_BAITS) {
      if (bait.id) {
        const el = document.getElementById(bait.id);
        expect(el).toBeNull();
      }
    }
  });
});
