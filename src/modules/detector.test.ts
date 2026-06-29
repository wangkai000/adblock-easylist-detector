import { describe, it, expect } from 'vitest';
import { probeResource } from './detector';
import { TestResource } from './resource-generator';

describe('probeResource', () => {
  it('should return blocked=true on TIMEOUT for non-existent resource', async () => {
    const resource: TestResource = {
      ruleIndex: 0,
      url: 'https://nonexistent.invalid/resource?cb=' + Date.now(),
      resourceType: 'image',
      rule: {
        id: 'test-nonexistent',
        raw: '||nonexistent.invalid^',
        category: 'domain',
        confidence: 0.9,
        description: 'test',
        urlTemplate: 'https://nonexistent.invalid/resource',
        resourceType: 'image',
      },
    };

    const result = await probeResource(resource, 3000);
    expect(result.blocked).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.ruleIndex).toBe(0);
  });

  it('should handle SSR environment gracefully', async () => {
    // In jsdom environment, window is defined, so this test verifies
    // that the function doesn't throw unexpected errors
    const resource: TestResource = {
      ruleIndex: 1,
      url: 'https://example.com/test.js?cb=' + Date.now(),
      resourceType: 'script',
      rule: {
        id: 'test-script',
        raw: '/test.js',
        category: 'path',
        confidence: 0.8,
        description: 'test',
        urlTemplate: '/test.js',
        resourceType: 'script',
      },
    };

    const result = await probeResource(resource, 3000);
    expect(result).toBeDefined();
    expect(typeof result.blocked).toBe('boolean');
    expect(result.ruleIndex).toBe(1);
  });

  it('should return correct ruleIndex and url in result', async () => {
    const testUrl = 'https://nonexistent.invalid/test.png?cb=' + Date.now();
    const resource: TestResource = {
      ruleIndex: 42,
      url: testUrl,
      resourceType: 'image',
      rule: {
        id: 'test-index',
        raw: '||nonexistent.invalid^',
        category: 'domain',
        confidence: 0.7,
        description: 'test index',
        urlTemplate: 'https://nonexistent.invalid/test.png',
        resourceType: 'image',
      },
    };

    const result = await probeResource(resource, 3000);
    expect(result.ruleIndex).toBe(42);
    expect(result.url).toBe(testUrl);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});
