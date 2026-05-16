# adblock-easylist-detector

<div align="center">

**English** | [中文](https://github.com/wangkai000/adblock-easylist-detector/blob/main/README.md)

> A lightweight blocker detection plugin using dual detection: EasyList rule reverse-probing + CSS bait element checking. Detects not only AdBlock/AdBlock Plus, but also uBlock Origin, AdGuard, and any other EasyList-based ad/content blockers.

</div>

---

## Features

- **Dual Detection** — Network probing (EasyList reverse-probing) + CSS bait element detection with weighted scoring
- **High-hit Rules** — Selects 10 high-hit-rate rules from the EasyList main list, covering domain, path, param, and third-party categories
- **Weighted Scoring** — Network 60% + bait 40%, each rule carries a confidence weight (0.75–0.95)
- **Multi-probe Strategy** — Script tags, image tags, fetch no-cors + Image secondary validation
- **Auto Caching** — sessionStorage-based with 5-minute TTL and multi-instance isolation
- **SSR Safe** — All modules include `typeof window/document` checks and gracefully degrade in Node.js
- **Zero Dependencies** — Pure frontend, no extra dependencies needed
- **Tree-shakable** — ESM modular exports, supports on-demand imports

---

## Install

```bash
npm install -D adblock-easylist-detector
# or
pnpm add -D adblock-easylist-detector
# or
yarn add -D adblock-easylist-detector
```

---

## Quick Start

### Callback Style (Recommended)

```typescript
import { createDetector } from 'adblock-easylist-detector';

const detector = createDetector({
  timeout: 3000,
  confidenceThreshold: 0.5,
  enableBait: true,
});

// Register callback — fires automatically when detection completes
detector.onDetect((result) => {
  if (result.detected) {
    console.log('Blocker detected! Confidence:', result.confidence);
  }
});

// Start detection (non-blocking)
detector.detect();
```

### Promise / await Style

```typescript
const detector = createDetector({ timeout: 3000 });

// await only suspends the current async function — it does NOT block the page
const result = await detector.detect();
console.log(result.detected);        // boolean
console.log(result.confidence);      // 0~1
console.log(result.blockedCount);    // Number of blocked rules
console.log(result.baitHiddenCount); // Number of hidden baits
```

---

## API

### `createDetector(options?)`

Creates a detector instance with independent callback chain and cache.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `3000` | Per-resource load timeout (ms) |
| `confidenceThreshold` | `number` | `0.5` | Confidence threshold for AdBlock detection (0~1) |
| `cache` | `boolean` | `true` | Enable sessionStorage caching (5 min TTL) |
| `enableBait` | `boolean` | `true` | Enable CSS bait element detection |
| `baits` | `BaitConfig[]` | 5 built-in | Custom bait configurations |
| `baitTimeout` | `number` | `200` | Bait detection timeout (ms) |
| `category` | `'domain' \| 'path' \| 'param' \| 'third-party'` | - | Test only rules of a specific category |
| `minConfidence` | `number` | - | Test only rules with confidence ≥ this value |

**Returns:** `AdblockDetector` instance

### `AdblockDetector` Interface

| Method / Property | Description |
|--------|-------------|
| `detect()` | Run detection, returns `Promise<DetectionResult>` |
| `onDetect(fn)` | Register a persistent callback |
| `onceDetect(fn)` | Register a one-time callback |
| `offDetect(fn)` | Remove a callback |
| `clearCache()` | Clear sessionStorage cache |
| `destroy()` | Destroy instance (clear cache + callbacks); `detect()` will throw after destroy |
| `destroyed` | `boolean`, whether the instance has been destroyed (read-only) |
| `options` | Current configuration (read-only) |

### `DetectionResult` Structure

```typescript
interface DetectionResult {
  detected: boolean;       // Whether AdBlock was detected
  confidence: number;      // Overall confidence 0~1
  blockedCount: number;    // Number of blocked resources
  totalCount: number;      // Total rules tested
  details: SingleResult[]; // Network probe details
  baitResults: BaitResult[]; // Bait detection details
  baitHiddenCount: number; // Number of hidden baits
  baitTotalCount: number;  // Total baits tested
  totalDuration: number;   // Total detection time (ms)
  fromCache: boolean;      // Whether result came from cache
  timestamp: number;       // Detection timestamp
}
```

### Exported TypeScript Types

```typescript
import type {
  DetectionResult,       // Detection result
  SingleResult,          // Single rule probe result
  DetectorOptions,       // createDetector options
  AdblockDetector,       // Detector instance interface
  CallbackFn,            // Callback function type
  TestResource,          // Test resource
  EasyListRule,          // EasyList rule definition
  BaitConfig,            // Bait configuration
  BaitResult,            // Bait detection result
} from 'adblock-easylist-detector';
```

### `getInstance(options?)`

Returns a global singleton for simple use cases.

```typescript
import { getInstance } from 'adblock-easylist-detector';
const detector = getInstance();
const result = await detector.detect();
```

---

## Advanced Usage

### Test Only a Specific Category

```typescript
const detector = createDetector({ category: 'domain' });
// Only test domain-blocking rules (5 rules)
```

### Custom Baits

```typescript
const detector = createDetector({
  baits: [
    {
      className: 'my-ad-class',
      id: 'ad-slot-1',
      confidence: 0.9,
      description: 'Custom ad slot',
    },
  ],
});
```

### Network Probing Only (No Baits)

```typescript
const detector = createDetector({ enableBait: false });
```

### UMD Usage

```html
<script src="dist/adblock-easylist-detector.umd.js"></script>
<script>
  var detector = AdblockEasylistDetector.createDetector();
  detector.detect().then(function(result) {
    console.log('AdBlock detected:', result.detected);
  });
</script>
```

### CommonJS Usage

```javascript
const { createDetector } = require('adblock-easylist-detector');

const detector = createDetector({ timeout: 3000 });
detector.onDetect((result) => {
  console.log('AdBlock detected:', result.detected);
});
detector.detect();
```

---

## Build Artifacts

| File | Format | Description |
|------|--------|-------------|
| `adblock-easylist-detector.esm.js` | ESM | ES Module, Tree-shakable |
| `adblock-easylist-detector.cjs.js` | CJS | CommonJS, `require()` import |
| `adblock-easylist-detector.umd.js` | UMD | CJS / AMD / `<script>` compatible |
| `adblock-easylist-detector.esm.min.js` | ESM | Minified |
| `adblock-easylist-detector.cjs.min.js` | CJS | Minified |
| `adblock-easylist-detector.umd.min.js` | UMD | Minified |
| `detector.esm.js` | ESM | Detection engine only |
| `detector.cjs.js` | CJS | Detection engine only |
| `resource-generator.esm.js` | ESM | Resource generator only |
| `resource-generator.cjs.js` | CJS | Resource generator only |
| `bait-detector.esm.js` | ESM | Bait detector only |
| `bait-detector.cjs.js` | CJS | Bait detector only |
| `callback.esm.js` | ESM | Callback manager only |
| `callback.cjs.js` | CJS | Callback manager only |

---

## Technical Details

### Dual Detection Mechanism

1. **Network Probing**: Selects 10 high-hit-rate rules from the EasyList main list, generates corresponding test resource URLs, and attempts to load them. If loading fails (timeout/blocked), it serves as evidence of an AdBlocker.
2. **Bait Element Detection**: Creates DOM elements with ad-specific class/id attributes, inserts them into the page, and checks whether they are hidden by AdBlock CSS rules (`display:none` / `visibility:hidden` / zero-size).

Both methods are combined with weighted scoring (network 60% + bait 40%) for improved accuracy.

### EasyList Rule Coverage

| Category | Rules | Description |
|----------|-------|-------------|
| domain | 5 | Domain blocking (Google AdSense, DoubleClick, Amazon, etc.) |
| path | 2 | Path wildcards (ads.js, ad/banner/*) |
| param | 1 | Query parameter blocking (ad_type=) |
| third-party | 2 | Third-party ads (Taboola, Outbrain) |

Each rule carries a confidence weight (0.75–0.95) used in weighted result calculation.

### Network Probing Strategy

- **Script tags**: Most reliable — AdBlock directly blocks script loading (`onerror` fires)
- **Image tags**: Secondary — image request blocking is also common
- **Fetch no-cors + Image secondary validation**: For `xmlhttprequest` types, `fetch` in `no-cors` mode may return opaque responses causing false negatives. An Image probe is added as confirmation.

### Bait Detection Strategy

- Creates `<div>` elements with ad-specific class/id, inserted into DOM
- Dual timing: `requestAnimationFrame` + `setTimeout(50ms)` fallback (rAF may not fire in background tabs)
- Check dimensions: `display:none`, `visibility:hidden`, `opacity:0`, zero-size, removed from DOM
- Auto-cleanup: elements are removed after detection

### Caching

- Uses `sessionStorage` to cache detection results
- TTL: 5 minutes
- Instance isolation: each `createDetector()` instance has a unique cache key

### SSR Safety

All modules include `typeof window/document` checks and gracefully degrade in Node.js environments.

---

## License

MIT
