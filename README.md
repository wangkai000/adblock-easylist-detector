# adblock-easylist-detector

> 基于 EasyList 规则反向探测 + CSS 诱饵双重检测的轻量 AdBlock 检测插件。

## 一分钟上手

```bash
npm install adblock-easylist-detector
```

```ts
import { createDetector } from 'adblock-easylist-detector';

const { detected, confidence } = await createDetector().detect();

if (detected) {
  console.log(`检测到 AdBlock，置信度 ${(confidence * 100).toFixed(0)}%`);
}
```

---

## 工作原理

### 🔥 双重检测

| 方式 | 原理 | 权重 |
|------|------|:----:|
| **网络探测** | 加载 EasyList 中高命中率广告域名的资源，被拦截=有 AdBlock | 60% |
| **诱饵检测** | 插入带广告特征 class/id 的 DOM 元素，检查是否被 CSS 规则隐藏 | 40% |

两种方式加权综合，比单方案准确率更高。

### 📋 规则池（32 条全覆盖）

内置完整 32 条 EasyList 高命中规则，覆盖国内外主流广告平台：

| 分类 | 数量 | 代表规则 |
|------|:----:|------|
| 域名拦截 | 21 | Google AdSense、DoubleClick、Amazon、百度联盟、Tanx、腾讯广点通… |
| 路径通配 | 7 | ads.js、ad/banner、popunder、advertisement… |
| 查询参数 | 2 | ad_type=、ad_unit= |
| 第三方广告 | 2 | Taboola、Outbrain |

每条规则带有置信度（0.62~0.95），默认启用 10 条高覆盖低误报的核心规则。

---

## API

### `createDetector(options?)`

```ts
const detector = createDetector({
  timeout: 3000,              // 单条资源超时 ms（默认 3000）
  confidenceThreshold: 0.5,   // 判定阈值 0~1（默认 0.5）
  cache: true,                // 启用 sessionStorage 缓存，TTL 5 分钟
  enableBait: true,           // 启用 CSS 诱饵检测
  activeRules: [...],         // 自定义启用规则列表，默认 DEFAULT_ACTIVE_RULE_IDS（10 条）
  // 以下为高级选项
  category: 'domain',         // 仅测某一分类
  minConfidence: 0.8,         // 仅测置信度 ≥ 此值的规则
  baitTimeout: 200,           // 诱饵检测超时 ms
  baits: [],                  // 自定义诱饵配置
  netWeight: 0.6,             // 网络探测权重
  baitWeight: 0.4,            // 诱饵检测权重
  maxConcurrency: 5,          // 最大并发数
  debug: false,               // 开启调试日志
});
```

### `AdblockDetector` 实例方法

| 方法 | 说明 |
|------|------|
| `detect()` | 执行检测 → `Promise<DetectionResult>` |
| `onDetect(fn)` | 注册持续回调，每次 detect 后触发 |
| `onceDetect(fn)` | 注册一次性回调 |
| `offDetect(fn)` | 移除回调 |
| **规则管理** | |
| `enableRule(id)` | 启用指定规则（实时生效） |
| `disableRule(id)` | 禁用指定规则 |
| `setActiveRules(ids)` | 批量设置启用规则 |
| `getActiveRules()` | 获取当前启用的规则 id 列表 |
| `getAllRules()` | 获取全部 32 条规则详情（含 id/描述/分类/置信度） |
| **其他** | |
| `clearCache()` | 清除缓存 |
| `destroy()` | 销毁实例（清缓存+回调） |
| `options` | 当前配置（只读） |

### `DetectionResult`

```ts
{
  detected: boolean;        // 是否检测到 AdBlock
  confidence: number;       // 综合置信度 0~1
  blockedCount: number;     // 网络探测被拦截数
  totalCount: number;       // 网络探测总数
  details: [{              // 网络探测明细
    rule: EasyListRule;
    url: string;
    blocked: boolean;
    elapsed: number;       // 耗时 ms
  }];
  baitResults: [{         // 诱饵检测明细
    description: string;
    hidden: boolean;
    reason?: string;      // display:none / visibility:hidden / zero-size / opacity:0 / removed
  }];
  baitHiddenCount: number;
  baitTotalCount: number;
  totalDuration: number;   // 总耗时 ms
  fromCache: boolean;
  timestamp: number;
}
```

---

## 常见场景

### 规则开关

```ts
const d = createDetector();

// 追加一条规则
d.enableRule('criteo');

// 暂时不用百度联盟
d.disableRule('pos-baidu');

// 批量替换——只测 Google 广告
d.setActiveRules(['pagead2-googlesyndication', 'doubleclick', 'adservice-google']);

// 查看当前启用的规则
console.log(d.getActiveRules()); // ['pagead2-googlesyndication', 'doubleclick', 'adservice-google']

// 浏览全部 32 条规则（挑你要的）
d.getAllRules().forEach(r => console.log(r.id, r.description, r.confidence));
```

### 创建时指定规则

```ts
// 只需要测 Google 和百度
const d = createDetector({
  activeRules: ['pagead2-googlesyndication', 'pos-baidu', 'tanx'],
});

const r = await d.detect();
// r.totalCount === 3
```

### 回调模式（持续监控）

```ts
const d = createDetector();

d.onDetect((result) => {
  if (result.detected) {
    // 弹窗提示、打点上报、跳转页面…
    showWarning(`检测到广告拦截器（置信度 ${result.confidence})`);
  }
});

// 页面加载时测一次
await d.detect();

// 用户操作后再测
button.onclick = () => d.detect();
```

### 仅网络探测（不用诱饵）

```ts
const d = createDetector({ enableBait: false });
const r = await d.detect();
// r.baitTotalCount === 0
```

### 自定义诱饵

```ts
const d = createDetector({
  baits: [
    { className: 'advertisement-box', id: 'banner-01', confidence: 0.9, description: '顶部 banner 位' },
    { className: 'ad-container', id: 'sidebar-ad', confidence: 0.85, description: '侧栏广告位' },
  ],
});
```

### 获取全局单例

```ts
import { getInstance } from 'adblock-easylist-detector';
const r = await getInstance().detect();
```

---

## 综合示例

```ts
import { createDetector } from 'adblock-easylist-detector';

async function initAdBlockCheck() {
  // 1. 创建检测器——国内站侧重百度+腾讯
  const detector = createDetector({
    timeout: 4000,
    confidenceThreshold: 0.6,
    activeRules: [
      'pagead2-googlesyndication',
      'pos-baidu',
      'qzone',
      'ads-js',
      'ad-banner',
    ],
  });

  // 2. 持续监控
  detector.onDetect((result) => {
    if (result.detected) {
      console.warn(
        `[AdBlock] 检测到拦截器 | 置信度:${(result.confidence * 100).toFixed(0)}% ` +
        `| 网络:${result.blockedCount}/${result.totalCount} ` +
        `| 诱饵:${result.baitHiddenCount}/${result.baitTotalCount} ` +
        `| 耗时:${result.totalDuration}ms`
      );

      // 展示友好提示
      showAdBlockNotice(result.confidence);
    }
  });

  // 3. 首次检测
  let result = await detector.detect();

  if (result.fromCache) {
    console.log('[AdBlock] 命中缓存，跳过探测');
    return;
  }

  // 4. 未检测到但怀疑有漏网——动态追加规则复测
  if (!result.detected && result.blockedCount > 0) {
    detector.enableRule('doubleclick');
    detector.enableRule('taboola');
    result = await detector.detect();
  }

  // 5. 按需禁用诱饵检测（性能敏感场景）
  if (result.totalDuration > 3000) {
    console.warn('[AdBlock] 检测耗时过长，下次关闭诱饵');
    // 重建实例去掉诱饵
    const fastDetector = createDetector({
      enableBait: false,
      activeRules: detector.getActiveRules(),
    });
    await fastDetector.detect();
  }

  // 6. 查看未启用的规则，按需挑选
  const disabledRules = detector.getAllRules().filter(
    r => !detector.getActiveRules().includes(r.id)
  );
  console.log('未启用的规则:', disabledRules.map(r => `${r.id}(${r.description})`));
}

function showAdBlockNotice(confidence: number) {
  // 你的业务逻辑：弹窗、跳转、打点…
}
```

---

## 引入方式

| 方式 | 代码 |
|------|------|
| ESM | `import { createDetector } from 'adblock-easylist-detector'` |
| UMD | `<script src="adblock-easylist-detector.umd.js"></script>` |

UMD 全局名为 `AdblockEasylistDetector`：

```html
<script src="dist/adblock-easylist-detector.umd.min.js"></script>
<script>
  var d = AdblockEasylistDetector.createDetector();
  d.detect().then(function(r) {
    console.log('AdBlock:', r.detected);
  });
</script>
```

## 构建产物

| 文件 | 格式 | 说明 |
|------|------|------|
| `adblock-easylist-detector.esm.js` | ESM | 完整包，Tree-shakable |
| `adblock-easylist-detector.umd.js` | UMD | 完整包，`<script>` 直接引入 |
| `*.min.js` | ESM/UMD | 压缩版 |
| `detector.esm.js` | ESM | 仅检测引擎（按需） |
| `resource-generator.esm.js` | ESM | 仅资源生成（按需） |
| `bait-detector.esm.js` | ESM | 仅诱饵检测（按需） |
| `callback.esm.js` | ESM | 仅回调管理（按需） |

## 技术细节

### 网络探测

- **`<script>`** — 最可靠，AdBlock 直接拦截脚本加载（`onerror`）
- **`<img>`** — 图片请求拦截也很常见
- **fetch no-cors + 图片二次验证** — 针对 XHR 类型规则，no-cors fetch 可能返回 opaque response 误判

### 诱饵检测

- 插入带广告特征 class/id 的 `<div>` 到页面
- 双时机检查：`requestAnimationFrame` + `setTimeout(50ms)` 兜底（后台标签页 rAF 可能不触发）
- 检查维度：`display:none`、`visibility:hidden`、`opacity:0`、尺寸归零、DOM 移除
- 检测完成后自动清理

### 缓存

- `sessionStorage` 缓存，TTL 5 分钟
- 每个实例独立缓存（唯一 ID）
- SSR 安全：所有模块含 `typeof window/document` 检查

---

## 开发

```bash
npm install        # 安装依赖
npm run build      # 构建
npm test           # 运行测试（53 条）
npm run test:watch # 监听模式
npm run clean      # 清理产物
```

## 测试

Vitest + jsdom，53 条用例覆盖：

- EasyList 规则完整性、id 唯一性、分类覆盖
- 规则管理 API（enable/disable/setActive/getActive/getAll）
- 资源 URL 生成与规则过滤
- 回调管理（on/once/off/clear/多实例隔离/异常不传播）
- 诱饵检测（DOM 插入/隐藏判定/自动清理）
- 检测器集成（配置/阈值/缓存隔离）

浏览器测试页：构建后打开 `test/index.html`（需本地服务器）。

## License

MIT
