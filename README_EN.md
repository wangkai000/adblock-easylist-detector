# adblock-easylist-detector

> Lightweight AdBlock detection using EasyList reverse-probing + CSS bait element detection.  
> Supports ESM / UMD — use via npm or directly in the browser.

```ts
import { createDetector } from 'adblock-easylist-detector';

createDetector()
  .detect()
  .then(r => console.log('AdBlock:', r.detected)); // true = blocker detected, false = clean
```

---

## ✨ Features

- **Dual Detection**: Network probe (60%) + CSS bait detection (40%), weighted for better accuracy
- **32 Built-in Rules**: Covers Google, Baidu, Tencent, Alibaba, Amazon, and more
- **Smart Caching**: sessionStorage cache, 60s TTL, per-instance isolation
- **Fully Configurable**: Rule toggle, weight tuning, custom baits, polling
- **SSR Safe**: All modules check `typeof window/document`

---

## 📦 Installation

```bash
npm install adblock-easylist-detector
```

Or use UMD directly in HTML:

```html
<script src="https://unpkg.com/adblock-easylist-detector/dist/adblock-easylist-detector.umd.min.js"></script>
<script>
  var d = AdblockEasylistDetector.createDetector();
  d.detect().then(function(r) {
    console.log('AdBlock:', r.detected);
  });
</script>
```

---

## 🚀 Quick Start

```ts
import { createDetector } from 'adblock-easylist-detector';

createDetector().detect().then(result => {
  console.log('AdBlock:', result.detected);
});
```

Three lines. `result` also carries confidence, blocked resources and more when you need them.

---

## 🔧 Intermediate Usage

### Rule Management

Enable or disable rules on the fly:

```ts
const d = createDetector();

// Add a rule
d.enableRule('criteo');

// Temporarily disable one
d.disableRule('pos-baidu');

// Replace entirely — only Google ads
d.setActiveRules(['pagead2-googlesyndication', 'doubleclick', 'adservice-google']);

// Check what's active
console.log(d.getActiveRules());

// Browse all 32 rules
d.getAllRules().forEach(r => console.log(r.id, r.description, r.confidence));
```

### Callback Mode

Register callbacks that fire automatically after each detection:

```ts
const d = createDetector();

d.onDetect((result) => {
  if (result.detected) {
    showAdBlockNotice(result.confidence);
  }
});

await d.detect();            // Initial check
button.onclick = () => d.detect(); // Re-check on user action
```

Also supports `onceDetect` (one-shot) and `offDetect` (remove).

### Cache Control

Cache is enabled by default (sessionStorage, 60s TTL). Clear it manually:

```ts
const d = createDetector();
d.clearCache(); // Next detect() will re-probe
```

### Custom Baits

Add your own site-specific ad class/id patterns:

```ts
const d = createDetector({
  baits: [
    { className: 'ad-unit', id: 'top-banner', confidence: 0.9, description: 'Top banner slot' },
    { className: 'sponsored', id: 'sidebar-widget', confidence: 0.85, description: 'Sidebar ad' },
  ],
});
```

### Network Probe Only (No Baits)

For performance-sensitive scenarios:

```ts
const d = createDetector({ enableBait: false });
const r = await d.detect();
// r.baitTotalCount === 0
```

### Custom Rules at Creation

```ts
const d = createDetector({
  activeRules: ['pagead2-googlesyndication', 'criteo', 'outbrain'],
});

const r = await d.detect();
// r.totalCount === 3
```

---

## 🎯 Advanced Usage

### Polling

Auto-detect on an interval with Page Visibility API integration (pauses when the tab is hidden):

```ts
const d = createDetector();

const controller = d.startPolling({
  interval: 5000,           // Check every 5s
  hiddenMultiplier: 3,      // Slow down 3x when hidden
  maxPolls: 100,
});

// Trigger an immediate check
await controller.checkNow();

// Stop polling
controller.stop();

// Check status
console.log(controller.running, controller.pollCount, controller.lastResult);
```

### State Change Callback

Only fires when `detected` changes — avoids duplicate notifications:

```ts
const d = createDetector();

d.onDetectedChange((result, previous) => {
  if (result.detected) {
    console.log('AdBlock was turned on');
  } else {
    console.log('AdBlock was turned off');
  }
});
```

### Global Singleton

Share a single detector across the whole page:

```ts
import { getInstance } from 'adblock-easylist-detector';

const r = await getInstance().detect();
```

### Full Configuration

| Option | Default | Description |
|:---|:---:|:---|
| `timeout` | `3000` | Per-resource timeout in ms |
| `confidenceThreshold` | `0.5` | Detection threshold 0–1 |
| `cache` | `true` | Enable sessionStorage cache |
| `enableBait` | `true` | Enable CSS bait detection |
| `netWeight` | `0.6` | Network probe weight |
| `baitWeight` | `0.4` | Bait detection weight |
| `maxConcurrency` | `5` | Max concurrent probes |
| `category` | — | Test only one category (domain / path / param / third-party) |
| `minConfidence` | — | Test only rules with confidence ≥ this value |
| `baitTimeout` | `200` | Bait detection timeout in ms |
| `debug` | `false` | Enable debug logging |

Complete example:

```ts
const d = createDetector({
  timeout: 4000,
  confidenceThreshold: 0.6,
  activeRules: [
    'pagead2-googlesyndication',
    'doubleclick',
    'ads-js',
    'ad-banner',
    'outbrain',
  ],
});

d.onDetect((result) => {
  if (result.detected) {
    console.warn(
      `[AdBlock] Detected | confidence:${(result.confidence * 100).toFixed(0)}% ` +
      `| network:${result.blockedCount}/${result.totalCount} ` +
      `| bait:${result.baitHiddenCount}/${result.baitTotalCount} ` +
      `| time:${result.totalDuration}ms`
    );
  }
});

await d.detect();
```

### Destroy Instance

```ts
d.destroy(); // Clears cache + callbacks + stops polling
```

---

## 📖 Built-in Rules

32 EasyList high-hit rules covering major ad platforms:

| Category | Count | Examples |
|:---|:---:|:---|
| Domain | 21 | Google AdSense, DoubleClick, Amazon, Baidu, Tanx, Tencent… |
| Path | 7 | ads.js, ad/banner, popunder, advertisement… |
| Query Param | 2 | ad_type=, ad_unit= |
| Third-party | 2 | Taboola, Outbrain |

Each rule has a confidence score (0.62–0.95). 10 core rules are active by default.

---

## ⚙️ Technical Details

### Network Probing

- **`<script>`** — Most reliable; AdBlock intercepts script loading (`onerror`)
- **`<img>`** — Image request blocking is also common
- **fetch no-cors + image fallback** — For XHR-type rules; no-cors fetch may return opaque responses, an image probe confirms

### Bait Detection

- Injects `<div>` elements with ad-like class/id into the page
- Dual timing: `requestAnimationFrame` + `setTimeout(150ms)` fallback
- Checks: `display:none`, `visibility:hidden`, `opacity:0`, zero-size, DOM removal
- Auto-cleanup after detection

### Caching

- `sessionStorage` cache, 60s TTL
- Per-instance isolation (unique cache key)
- SSR-safe: all modules check `typeof window/document`

---

## 🏗️ Build Artifacts

| File | Format | Description |
|:---|:---|:---|
| `adblock-easylist-detector.esm.js` | ESM | Full bundle, tree-shakable |
| `adblock-easylist-detector.umd.js` | UMD | Full bundle, `<script>` ready |
| `*.min.js` | ESM/UMD | Minified |
| `detector.esm.js` | ESM | Detection engine only |
| `resource-generator.esm.js` | ESM | Resource generator only |
| `bait-detector.esm.js` | ESM | Bait detector only |
| `callback.esm.js` | ESM | Callback manager only |

---

## 📄 License

MIT