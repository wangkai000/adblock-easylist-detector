import { describe, it, expect } from 'vitest';
import { EASYLIST_RULES } from './easylist';

describe('EASYLIST_RULES', () => {
  it('应有 10 条规则', () => {
    expect(EASYLIST_RULES).toHaveLength(10);
  });

  it('每条规则字段完整', () => {
    for (const rule of EASYLIST_RULES) {
      expect(rule.raw).toBeTruthy();
      expect(['domain', 'path', 'param', 'third-party']).toContain(rule.category);
      expect(rule.confidence).toBeGreaterThan(0);
      expect(rule.confidence).toBeLessThanOrEqual(1);
      expect(rule.urlTemplate).toContain('{RAND}');
      expect(['script', 'image', 'xmlhttprequest']).toContain(rule.resourceType);
      expect(rule.description).toBeTruthy();
    }
  });

  it('覆盖 4 种分类', () => {
    const categories = new Set(EASYLIST_RULES.map(r => r.category));
    expect(categories.has('domain')).toBe(true);
    expect(categories.has('path')).toBe(true);
    expect(categories.has('param')).toBe(true);
    expect(categories.has('third-party')).toBe(true);
  });

  it('URL 模板格式合法', () => {
    for (const rule of EASYLIST_RULES) {
      // 域名类必须以 https:// 开头或 / 开头
      if (rule.category === 'domain' || rule.category === 'third-party') {
        expect(rule.urlTemplate).toMatch(/^https?:\/\//);
      }
    }
  });
});
