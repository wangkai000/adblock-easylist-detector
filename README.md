# adblock-easylist-detector

> 基于 EasyList 规则反向探测 + CSS 诱饵双重检测的轻量 AdBlock 检测插件。  
> 支持 ESM / UMD，浏览器直接使用或通过 npm 引入。

---

## ✨ 特性

- **双重检测**：网络探测（60%）+ CSS 诱饵检测（40%），加权综合更准确
- **内置 32 条规则**：覆盖 Google、百度、腾讯、阿里等主流广告平台
- **智能缓存**：sessionStorage 缓存，60 秒 TTL，多实例隔离
- **灵活可配**：规则开关、权重调整、自定义诱饵、定时轮询
- **SSR 安全**：所有模块含 typeof window/document 检查

---

## 📦 安装

```bash
npm install adblock-easylist-detector
```

或者直接在 HTML 中使用 UMD：

```html
<script src="dist/adblock-easylist-detector.umd.min.js"></script>
<script>
  var d = AdblockEasylistDetector.createDetector();
  d.detect().then(function(r) {
    console.log('AdBlock:', r.detected);
  });
</script>
```

---

## 🚀 快速上手

```ts
import { createDetector } from 'adblock-easylist-detector';

createDetector().detect().then(result => {
  console.log('AdBlock:', result.detected);
});
```

三行搞定。`result` 还包含置信度、拦截详情等信息，需要时再去取。

---

## 🔧 进阶使用

### 规则管理

你可以自由开关规则，精准控制检测范围：

```ts
const d = createDetector();

// 追加一条规则
d.enableRule('criteo');

// 暂时不用百度联盟
d.disableRule('pos-baidu');

// 批量替换——只测 Google 广告
d.setActiveRules(['pagead2-googlesyndication', 'doubleclick', 'adservice-google']);

// 查看当前启用的规则
console.log(d.getActiveRules());

// 浏览全部 32 条规则，按需挑选
d.getAllRules().forEach(r => console.log(r.id, r.description, r.confidence));
```


### 回调模式

注册回调，每次检测后自动触发：

```ts
const d = createDetector();

d.onDetect((result) => {
  if (result.detected) {
    showAdBlockNotice(result.confidence);
  }
});

await d.detect();            // 首次检测
button.onclick = () => d.detect(); // 用户操作后复测
```

支持一次性回调 `onceDetect`，以及移除回调 `offDetect`。

### 缓存控制

默认启用 sessionStorage 缓存，60 秒 TTL。可按需清除：

```ts
const d = createDetector();

// 清除当前实例缓存（下次检测会重新探测）
d.clearCache();
```

### 自定义诱饵

添加你网站特有的广告特征 class/id：

```ts
const d = createDetector({
  baits: [
    { className: 'advertisement-box', id: 'banner-01', confidence: 0.9, description: '顶部 banner 位' },
    { className: 'ad-container', id: 'sidebar-ad', confidence: 0.85, description: '侧栏广告位' },
  ],
});
```

### 关闭诱饵检测

如果只需要网络探测（性能敏感场景）：

```ts
const d = createDetector({ enableBait: false });
const r = await d.detect();
// r.baitTotalCount === 0
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

---

## 🎯 高级使用

### 定时轮询

自动定时检测，支持 Page Visibility API（页面隐藏时自动暂停）：

```ts
const d = createDetector();

const controller = d.startPolling({
  interval: 5000,           // 每隔 5 秒检测一次
  hiddenMultiplier: 3,      // 页面隐藏时降频 3 倍
  maxPolls: 100,            // 最多检测 100 次
});

// 手动触发一次即时检测
await controller.checkNow();

// 停止轮询
controller.stop();

// 查看状态
console.log(controller.running, controller.pollCount, controller.lastResult);
```

### 检测状态变化回调

只在 `detected` 值变化时触发，避免重复通知：

```ts
const d = createDetector();

d.onDetectedChange((result, previous) => {
  if (result.detected) {
    console.log('AdBlock 从无到有');
  } else {
    console.log('AdBlock 已关闭');
  }
});
```

### 全局单例

整个页面共享一个检测器实例：

```ts
import { getInstance } from 'adblock-easylist-detector';

const r = await getInstance().detect();
```

### 细粒度配置

| 选项 | 默认值 | 说明 |
|:---|:---:|:---|
| `timeout` | `3000` | 单条资源超时 ms |
| `confidenceThreshold` | `0.5` | 判定阈值 0~1 |
| `cache` | `true` | 启用缓存 |
| `enableBait` | `true` | 启用诱饵检测 |
| `netWeight` | `0.6` | 网络探测权重 |
| `baitWeight` | `0.4` | 诱饵检测权重 |
| `maxConcurrency` | `5` | 最大并发数 |
| `category` | — | 仅测某一分类（domain / path / param / third-party）|
| `minConfidence` | — | 仅测置信度 ≥ 此值的规则 |
| `baitTimeout` | `200` | 诱饵检测超时 ms |
| `debug` | `false` | 开启调试日志 |

完整示例：

```ts
const d = createDetector({
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

d.onDetect((result) => {
  if (result.detected) {
    console.warn(
      `[AdBlock] 检测到拦截器 | 置信度:${(result.confidence * 100).toFixed(0)}% ` +
      `| 网络:${result.blockedCount}/${result.totalCount} ` +
      `| 诱饵:${result.baitHiddenCount}/${result.baitTotalCount} ` +
      `| 耗时:${result.totalDuration}ms`
    );
  }
});

await d.detect();
```

### 销毁实例

```ts
d.destroy(); // 清缓存 + 清回调 + 停止轮询，彻底释放
```

---

## 📖 内置规则

内置 32 条 EasyList 高命中规则，覆盖主流广告平台：

| 分类 | 数量 | 代表规则 |
|:---|:---:|:---|
| 域名拦截 | 21 | Google AdSense、DoubleClick、Amazon、百度联盟、Tanx、腾讯广点通… |
| 路径通配 | 7 | ads.js、ad/banner、popunder、advertisement… |
| 查询参数 | 2 | ad_type=、ad_unit= |
| 第三方广告 | 2 | Taboola、Outbrain |

每条规则带有置信度（0.62~0.95），默认启用 10 条高覆盖低误报的核心规则。

---

## ⚙️ 技术细节

### 网络探测

- **`<script>`** — 最可靠，AdBlock 直接拦截脚本加载（`onerror`）
- **`<img>`** — 图片请求拦截也很常见
- **fetch no-cors + 图片二次验证** — 针对 XHR 类型规则，no-cors fetch 可能返回 opaque response 误判，用 Image 二次确认

### 诱饵检测

- 插入带广告特征 class/id 的 `<div>` 到页面
- 双时机检查：`requestAnimationFrame` + `setTimeout(150ms)` 兜底（后台标签页 rAF 可能不触发）
- 检查维度：`display:none`、`visibility:hidden`、`opacity:0`、尺寸归零、DOM 移除
- 检测完成后自动清理

### 缓存

- `sessionStorage` 缓存，TTL 60 秒
- 每个实例独立缓存（唯一 ID）
- SSR 安全：所有模块含 `typeof window/document` 检查

---

## 🏗️ 构建产物

| 文件 | 格式 | 说明 |
|:---|:---|:---|
| `adblock-easylist-detector.esm.js` | ESM | 完整包，Tree-shakable |
| `adblock-easylist-detector.umd.js` | UMD | 完整包，`<script>` 直接引入 |
| `*.min.js` | ESM/UMD | 压缩版 |
| `detector.esm.js` | ESM | 仅检测引擎（按需） |
| `resource-generator.esm.js` | ESM | 仅资源生成（按需） |
| `bait-detector.esm.js` | ESM | 仅诱饵检测（按需） |
| `callback.esm.js` | ESM | 仅回调管理（按需） |

---

## 🛠️ 开发

```bash
npm install            # 安装依赖
npm run build          # 构建
npm test               # 运行测试（56 条）
npm run test:watch     # 监听模式
npm run clean          # 清理产物
```

浏览器测试页：构建后打开 `test/index.html`（需本地服务器）。

---

## 📄 License

MIT