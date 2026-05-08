/**
 * 资源生成器 —— 根据 EasyList 规则生成实际测试 URL 和加载配置
 */

import { EasyListRule, EASYLIST_RULES } from '../rules/easylist';

export interface TestResource {
  /** 规则索引 */
  ruleIndex: number;
  /** 原始规则 */
  rule: EasyListRule;
  /** 最终测试 URL */
  url: string;
  /** 资源类型 */
  resourceType: EasyListRule['resourceType'];
}

/**
 * 生成随机字符串，防缓存
 */
function randomString(len: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/**
 * 将规则模板渲染为真实 URL
 */
export function renderUrl(template: string): string {
  return template.replace('{RAND}', randomString(12) + Date.now().toString(36));
}

/**
 * 从全部规则生成测试资源列表
 */
export function generateAllResources(): TestResource[] {
  return EASYLIST_RULES.map((rule, index) => ({
    ruleIndex: index,
    rule,
    url: renderUrl(rule.urlTemplate),
    resourceType: rule.resourceType,
  }));
}

/**
 * 按分类筛选规则
 */
export function generateByCategory(category: EasyListRule['category']): TestResource[] {
  return EASYLIST_RULES
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.category === category)
    .map(({ rule, index }) => ({
      ruleIndex: index,
      rule,
      url: renderUrl(rule.urlTemplate),
      resourceType: rule.resourceType,
    }));
}

/**
 * 按最低置信度筛选规则
 */
export function generateByConfidence(minConfidence: number): TestResource[] {
  return EASYLIST_RULES
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.confidence >= minConfidence)
    .map(({ rule, index }) => ({
      ruleIndex: index,
      rule,
      url: renderUrl(rule.urlTemplate),
      resourceType: rule.resourceType,
    }));
}
