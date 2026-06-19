import { describe, it, expect } from 'vitest';
import {
  generateAllResources,
  generateByRuleIds,
  generateByCategory,
  generateByConfidence,
  renderUrl,
} from './resource-generator';

describe('renderUrl', () => {
  it('应替换 {RAND} 占位符', () => {
    const url = renderUrl('https://example.com/ad.js?cb={RAND}');
    expect(url).not.toContain('{RAND}');
    expect(url).toMatch(/^https:\/\/example\.com\/ad\.js\?cb=.+/);
  });

  it('每次生成的 RAND 不同', () => {
    const a = renderUrl('https://x.com/{RAND}');
    const b = renderUrl('https://x.com/{RAND}');
    expect(a).not.toBe(b);
  });
});

describe('generateByRuleIds', () => {
  it('默认返回 10 条核心规则', () => {
    const resources = generateByRuleIds();
    expect(resources).toHaveLength(10);
  });

  it('按指定 id 生成', () => {
    const resources = generateByRuleIds(['doubleclick', 'ads-js']);
    expect(resources).toHaveLength(2);
    expect(resources[0].rule.id).toBe('doubleclick');
    expect(resources[1].rule.id).toBe('ads-js');
  });

  it('空数组返回空', () => {
    const resources = generateByRuleIds([]);
    expect(resources).toHaveLength(0);
  });

  it('不存在的 id 被忽略', () => {
    const resources = generateByRuleIds(['doubleclick', 'not-exist']);
    expect(resources).toHaveLength(1);
    expect(resources[0].rule.id).toBe('doubleclick');
  });
});

describe('generateAllResources', () => {
  it('生成的资源数等于规则数', () => {
    const resources = generateAllResources();
    expect(resources).toHaveLength(32);
  });

  it('ruleIndex 连续递增', () => {
    const resources = generateAllResources();
    for (let i = 0; i < resources.length; i++) {
      expect(resources[i].ruleIndex).toBe(i);
    }
  });

  it('url 不含 {RAND}', () => {
    const resources = generateAllResources();
    for (const r of resources) {
      expect(r.url).not.toContain('{RAND}');
    }
  });
});

describe('generateByCategory', () => {
  it('按 domain 筛选', () => {
    const resources = generateByCategory('domain');
    expect(resources.length).toBeGreaterThan(0);
    for (const r of resources) {
      expect(r.rule.category).toBe('domain');
    }
  });

  it('按 domain + ruleIds 交集筛选', () => {
    const resources = generateByCategory('domain', ['doubleclick', 'ads-js']);
    // doubleclick 是 domain, ads-js 是 path → 只返回 doubleclick
    expect(resources).toHaveLength(1);
    expect(resources[0].rule.id).toBe('doubleclick');
  });

  it('不存在的分类返回空数组', () => {
    // @ts-expect-error 测试非法输入
    const resources = generateByCategory('nonexistent');
    expect(resources).toHaveLength(0);
  });
});

describe('generateByConfidence', () => {
  it('按置信度筛选', () => {
    const resources = generateByConfidence(0.9);
    for (const r of resources) {
      expect(r.rule.confidence).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('按置信度 + ruleIds 交集筛选', () => {
    const resources = generateByConfidence(0.9, ['pagead2-googlesyndication', 'taboola']);
    // pagead2 0.95 >= 0.9 ✓, taboola 0.80 < 0.9 ✗
    expect(resources).toHaveLength(1);
    expect(resources[0].rule.id).toBe('pagead2-googlesyndication');
  });

  it('极低阈值返回全部', () => {
    const resources = generateByConfidence(0);
    expect(resources).toHaveLength(32);
  });

  it('极高阈值可能返回空', () => {
    const resources = generateByConfidence(1.0);
    // 所有规则 confidence < 1.0
    expect(resources).toHaveLength(0);
  });
});
