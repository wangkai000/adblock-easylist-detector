import { describe, it, expect } from 'vitest';
import { EASYLIST_RULES, DEFAULT_ACTIVE_RULE_IDS } from './easylist';

describe('EASYLIST_RULES', () => {
  it('应有 32 条规则', () => {
    expect(EASYLIST_RULES).toHaveLength(32);
  });

  it('每条规则含 id 且唯一', () => {
    const ids = EASYLIST_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(32);
    for (const rule of EASYLIST_RULES) {
      expect(rule.id).toBeTruthy();
      expect(typeof rule.id).toBe('string');
    }
  });

  it('每条规则字段完整', () => {
    for (const rule of EASYLIST_RULES) {
      expect(rule.id).toBeTruthy();
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
      if (rule.category === 'domain' || rule.category === 'third-party') {
        expect(rule.urlTemplate).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('DEFAULT_ACTIVE_RULE_IDS', () => {
  it('默认 10 条核心规则', () => {
    expect(DEFAULT_ACTIVE_RULE_IDS).toHaveLength(10);
  });

  it('所有默认 id 存在于 EASYLIST_RULES 中', () => {
    const allIds = new Set(EASYLIST_RULES.map(r => r.id));
    for (const id of DEFAULT_ACTIVE_RULE_IDS) {
      expect(allIds.has(id)).toBe(true);
    }
  });

  it('默认规则包含主流广告平台', () => {
    expect(DEFAULT_ACTIVE_RULE_IDS).toContain('doubleclick');
    expect(DEFAULT_ACTIVE_RULE_IDS).toContain('pos-baidu');
    expect(DEFAULT_ACTIVE_RULE_IDS).toContain('ads-js');
  });
});
