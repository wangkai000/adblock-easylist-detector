# adblock-easylist-detector

<div align="center">

[English](https://github.com/wangkai000/adblock-easylist-detector/blob/main/README_EN.md) | **中文**

> 基于 EasyList 规则反向探测 + CSS 诱饵元素双重检测的轻量级拦截器检测插件。不仅可检测 AdBlock/AdBlock Plus，还能识别 uBlock Origin、AdGuard 等所有基于 EasyList 规则的广告/内容拦截器。

</div>

---

## 功能特点

- **双重检测机制** — 网络探测（EasyList 规则反向探测）+ CSS 诱饵元素检测，加权综合评分
- **高命中率规则** — 从 EasyList 主列表精选 10 条高命中率规则，覆盖 domain、path、param、third-party 四大分类
- **智能加权评分** — 网络 60% + 诱饵 40%，每条规则带有置信度权重（0.75~0.95）
- **多探测策略** — script 标签、image 标签、fetch no-cors + Image 二次验证
- **自动缓存** — 基于 sessionStorage，TTL 5 分钟，多实例隔离
- **SSR 安全** — 所有模块包含 `typeof window/document` 检查，Node.js 环境下安全降级
- **零依赖** — 纯前端运行，无需额外依赖
- **Tree-shakable** — ESM 模块化导出，支持按需引入

---

## 安装

```bash
npm install -D adblock-easylist-detector
# 或
pnpm add -D adblock-easylist-detector
# 或
yarn add -D adblock-easylist-detector
```

---

## 快速开始

### 回调方式（推荐）

```typescript
import { createDetector } from 'adblock-easylist-detector';

const detector = createDetector({
  timeout: 3000,
  confidenceThreshold: 0.5,
  enableBait: true,
});

// 注册回调，检测完成后自动触发
detector.onDetect((result) => {
  if (result.detected) {
    console.log('检测到拦截器！置信度:', result.confidence);
  }
});

// 发起检测（不阻塞主线程）
detector.detect();
```

### Promise / await 方式

```typescript
const detector = createDetector({ timeout: 3000 });

// await 只暂停当前 async 函数，不会阻塞页面
const result = await detector.detect();
console.log(result.detected);        // boolean
console.log(result.confidence);      // 0~1
console.log(result.blockedCount);    // 被拦截规则数
console.log(result.baitHiddenCount); // 被隐藏诱饵数
```

---

## API

### `createDetector(options?)`

创建检测器实例，每个实例拥有独立的回调链和缓存。

**参数：**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeout` | `number` | `3000` | 单条资源加载超时（ms） |
| `confidenceThreshold` | `number` | `0.5` | 判定 AdBlock 的置信度阈值（0~1） |
| `cache` | `boolean` | `true` | 是否启用 sessionStorage 缓存（5 分钟） |
| `enableBait` | `boolean` | `true` | 是否启用 CSS 诱饵元素检测 |
| `baits` | `BaitConfig[]` | 内置 5 条 | 自定义诱饵配置 |
| `baitTimeout` | `number` | `200` | 诱饵检测超时（ms） |
| `category` | `'domain' \| 'path' \| 'param' \| 'third-party'` | - | 仅测试指定分类的规则 |
| `minConfidence` | `number` | - | 仅测试置信度 ≥ 此值的规则 |

**返回：** `AdblockDetector` 实例

### `AdblockDetector` 接口

| 方法/属性 | 说明 |
|------|------|
| `detect()` | 执行检测，返回 `Promise<DetectionResult>` |
| `onDetect(fn)` | 注册持续回调 |
| `onceDetect(fn)` | 注册一次性回调 |
| `offDetect(fn)` | 移除回调 |
| `clearCache()` | 清除 sessionStorage 缓存 |
| `destroy()` | 销毁实例（清缓存 + 清回调），销毁后 `detect()` 将抛错 |
| `destroyed` | `boolean`，实例是否已销毁（只读） |
| `options` | 当前配置（只读） |

### `DetectionResult` 结构

```typescript
interface DetectionResult {
  detected: boolean;       // 是否检测到 AdBlock
  confidence: number;      // 综合置信度 0~1
  blockedCount: number;    // 网络探测被拦截数
  totalCount: number;      // 网络探测总规则数
  details: SingleResult[]; // 网络探测明细
  baitResults: BaitResult[]; // 诱饵检测明细
  baitHiddenCount: number; // 诱饵被隐藏数
  baitTotalCount: number;  // 诱饵总数
  totalDuration: number;   // 总耗时 ms
  fromCache: boolean;      // 是否命中缓存
  timestamp: number;       // 检测时间戳
}
```

### 导出的 TypeScript 类型

```typescript
import type {
  DetectionResult,       // 检测结果
  SingleResult,          // 单条规则探测结果
  DetectorOptions,       // createDetector 配置项
  AdblockDetector,       // 检测器实例接口
  CallbackFn,            // 回调函数类型
  TestResource,          // 测试资源
  EasyListRule,          // EasyList 规则定义
  BaitConfig,            // 诱饵配置
  BaitResult,            // 诱饵检测结果
} from 'adblock-easylist-detector';
```

### `getInstance(options?)`

获取全局单例，适合简单场景。

```typescript
import { getInstance } from 'adblock-easylist-detector';
const detector = getInstance();
const result = await detector.detect();
```

---

## 高级用法

### 仅测试特定分类

```typescript
const detector = createDetector({ category: 'domain' });
// 只测试域名拦截类规则（5 条）
```

### 自定义诱饵

```typescript
const detector = createDetector({
  baits: [
    {
      className: 'my-ad-class',
      id: 'ad-slot-1',
      confidence: 0.9,
      description: '自定义广告位',
    },
  ],
});
```

### 仅使用网络探测（不用诱饵）

```typescript
const detector = createDetector({ enableBait: false });
```

### UMD 方式引入

```html
<script src="dist/adblock-easylist-detector.umd.js"></script>
<script>
  var detector = AdblockEasylistDetector.createDetector();
  detector.detect().then(function(result) {
    console.log('AdBlock detected:', result.detected);
  });
</script>
```

---

## 构建产物

| 文件 | 格式 | 说明 |
|------|------|------|
| `adblock-easylist-detector.esm.js` | ESM | ES Module，Tree-shakable |
| `adblock-easylist-detector.umd.js` | UMD | 兼容 CommonJS / AMD / `<script>` |
| `adblock-easylist-detector.esm.min.js` | ESM | 压缩版 |
| `adblock-easylist-detector.umd.min.js` | UMD | 压缩版 |
| `detector.esm.js` | ESM | 仅检测引擎模块 |
| `resource-generator.esm.js` | ESM | 仅资源生成模块 |
| `bait-detector.esm.js` | ESM | 仅诱饵检测模块 |
| `callback.esm.js` | ESM | 仅回调管理模块 |

---

## 技术细节

### 双重检测机制

1. **网络探测**：从 EasyList 主列表精选 10 条高命中率规则，生成对应测试资源 URL，尝试加载。若加载失败（超时/被拦截），则作为"存在 AdBlock"的证据。
2. **诱饵元素检测**：创建带广告特征 class/id 的 DOM 元素插入页面，检查是否被 AdBlock 的 CSS 隐藏规则（`display:none` / `visibility:hidden` / 尺寸归零）隐藏。

两种方式加权综合（网络 60% + 诱饵 40%），提高检测准确率。

### EasyList 规则覆盖

| 分类 | 规则数 | 说明 |
|------|--------|------|
| domain | 5 | 域名拦截（Google AdSense、DoubleClick、Amazon 等） |
| path | 2 | 路径通配（ads.js、ad/banner/*） |
| param | 1 | 查询参数拦截（ad_type=） |
| third-party | 2 | 第三方广告（Taboola、Outbrain） |

每条规则带有置信度权重（0.75~0.95），用于加权计算综合检测结果。

### 网络探测策略

- **script 标签**：最可靠，AdBlock 直接拦截脚本加载（`onerror` 触发）
- **image 标签**：次可靠，图片请求拦截也常见
- **fetch no-cors + Image 二次验证**：针对 xmlhttprequest 类型，fetch no-cors 可能返回 opaque response 导致误判，因此追加 Image 验证

### 诱饵检测策略

- 创建带广告特征 class/id 的 `<div>`，插入 DOM
- 双重检测时机：`requestAnimationFrame` + `setTimeout(50ms)` 兜底（后台标签页 rAF 可能不触发）
- 检查维度：`display:none`、`visibility:hidden`、`opacity:0`、尺寸归零、被从 DOM 移除
- 检测完成后自动清理 DOM 元素

### 缓存机制

- 使用 `sessionStorage` 缓存检测结果
- TTL：5 分钟
- 多实例隔离：每个 `createDetector()` 实例缓存 key 包含唯一 ID

### SSR 安全

所有模块均包含 `typeof window/document` 检查，Node.js 环境下安全降级。

---

## License

MIT
