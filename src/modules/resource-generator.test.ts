import { describe, it, expect } from 'vitest';
import {
  generateAllResources,
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

describe('generateAllResources', () => {
  it('生成的资源数等于规则数', () => {
    const resources = generateAllResources();
    expect(resources).toHaveLength(10);
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

  it('极低阈值返回全部', () => {
    const resources = generateByConfidence(0);
    expect(resources).toHaveLength(10);
  });

  it('极高阈值可能返回空', () => {
    const resources = generateByConfidence(1.0);
    // 所有规则 confidence < 1.0
    expect(resources).toHaveLength(0);
  });
});
