/**
 * 资源生成器 —— 根据 EasyList 规则生成实际测试 URL 和加载配置
 *
 * v1.1: crypto.getRandomValues 替代 Math.random，防 AdBlock 白名单匹配
 * v1.2: 支持 activeRuleIds 过滤，默认仅 10 条核心规则
 */

import { EasyListRule, EASYLIST_RULES, DEFAULT_ACTIVE_RULE_IDS } from '../rules/easylist';

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
 * 生成加密级随机字符串，防 AdBlock 白名单匹配
 */
function randomString(len: number = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let s = '';
    for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
    return s;
  }
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * 将规则模板渲染为真实 URL
 */
export function renderUrl(template: string): string {
  return template.replace('{RAND}', randomString(12) + Date.now().toString(36));
}

/** 内部：从规则全集过滤到激活集 + 生成资源 */
function buildResources(rules: EasyListRule[]): TestResource[] {
  return rules.map((rule, index) => ({
    ruleIndex: index,
    rule,
    url: renderUrl(rule.urlTemplate),
    resourceType: rule.resourceType,
  }));
}

/**
 * 从指定规则 ID 列表生成测试资源
 * 默认使用 DEFAULT_ACTIVE_RULE_IDS（10 条核心规则）
 */
export function generateByRuleIds(ruleIds: string[] = DEFAULT_ACTIVE_RULE_IDS): TestResource[] {
  const idSet = new Set(ruleIds);
  const filtered = EASYLIST_RULES.filter((r) => idSet.has(r.id));
  return buildResources(filtered);
}

/**
 * 从全部 32 条规则生成测试资源
 */
export function generateAllResources(): TestResource[] {
  return buildResources(EASYLIST_RULES);
}

/**
 * 按分类 + 可选 ruleIds 筛选生成
 */
export function generateByCategory(
  category: EasyListRule['category'],
  ruleIds?: string[],
): TestResource[] {
  const source = ruleIds ? EASYLIST_RULES.filter((r) => ruleIds.includes(r.id)) : EASYLIST_RULES;
  return buildResources(source.filter((r) => r.category === category));
}

/**
 * 按最低置信度 + 可选 ruleIds 筛选生成
 */
export function generateByConfidence(minConfidence: number, ruleIds?: string[]): TestResource[] {
  const source = ruleIds ? EASYLIST_RULES.filter((r) => ruleIds.includes(r.id)) : EASYLIST_RULES;
  return buildResources(source.filter((r) => r.confidence >= minConfidence));
}
