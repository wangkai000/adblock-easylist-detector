# adblock-easylist-detector

A lightweight AdBlock detection plugin using dual detection: EasyList rule reverse-probing + CSS bait element checking.

## How It Works

### 🔥 Dual Detection Mechanism

1. **Network Probing**: Selects 10 high-hit-rate rules from the EasyList main list, generates corresponding test resource URLs, and attempts to load them. If loading fails (timeout/blocked), it serves as evidence of an AdBlocker.
2. **Bait Element Detection**: Creates DOM elements with ad-specific class/id attributes, inserts them into the page, and checks whether they are hidden by AdBlock CSS rules (`display:none` / `visibility:hidden` / zero-size).

Both methods are combined with weighted scoring (network 60% + bait 40%) for improved accuracy.

### 📋 EasyList Rule Coverage

| Category | Rules | Description |
|----------|-------|-------------|
| domain | 5 | Domain blocking (Google AdSense, DoubleClick, Amazon, etc.) |
| path | 2 | Path wildcards (ads.js, ad/banner/*) |
| param | 1 | Query parameter blocking (ad_type=) |
| third-party | 2 | Third-party ads (Taboola, Outbrain) |

Each rule carries a confidence weight (0.75–0.95) used in weighted result calculation.

## Installation

```bash
npm install -D adblock-easylist-detector
```

## Quick Start

```typescript
import { createDetector } from 'adblock-easylist-detector';

// Create a detector instance
const detector = createDetector({
  timeout: 3000,            // Per-resource timeout (ms)
  confidenceThreshold: 0.5, // Confidence threshold
  enableBait: true,         // Enable bait detection
});

// Register callback
detector.onDetect((result) => {
  if (result.detected) {
    console.log('AdBlock detected! Confidence:', result.confidence);
  }
});

// Run detection
const result = await detector.detect();
console.log(result.detected);      // boolean
console.log(result.confidence);    // 0~1
console.log(result.blockedCount);  // Number of blocked rules
console.log(result.baitHiddenCount); // Number of hidden baits
```

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
| `category` | `string` | - | Test only rules of a specific category |
| `minConfidence` | `number` | - | Test only rules with confidence ≥ this value |

**Returns:** `AdblockDetector` instance

### `AdblockDetector` Interface

| Method | Description |
|--------|-------------|
| `detect()` | Run detection, returns `Promise<DetectionResult>` |
| `onDetect(fn)` | Register a persistent callback |
| `onceDetect(fn)` | Register a one-time callback |
| `offDetect(fn)` | Remove a callback |
| `clearCache()` | Clear sessionStorage cache |
| `destroy()` | Destroy instance (clear cache + callbacks) |
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

### `getInstance(options?)`

Returns a global singleton for simple use cases.

```typescript
import { getInstance } from 'adblock-easylist-detector';
const detector = getInstance();
const result = await detector.detect();
```

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

## Build Artifacts

| File | Format | Description |
|------|--------|-------------|
| `adblock-easylist-detector.esm.js` | ESM | ES Module, Tree-shakable |
| `adblock-easylist-detector.umd.js` | UMD | CommonJS / AMD / `<script>` compatible |
| `adblock-easylist-detector.esm.min.js` | ESM | Minified |
| `adblock-easylist-detector.umd.min.js` | UMD | Minified |
| `detector.esm.js` | ESM | Detection engine only |
| `resource-generator.esm.js` | ESM | Resource generator only |
| `bait-detector.esm.js` | ESM | Bait detector only |
| `callback.esm.js` | ESM | Callback manager only |

## Technical Details

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

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode tests
npm run test:watch

# Clean build artifacts
npm run clean
```

## Testing

Using Vitest + jsdom with 35 test cases covering:

- EasyList rule completeness and category coverage
- Resource URL generation and filtering
- Callback management (on/once/off/clear/multi-instance isolation/error isolation)
- Bait element detection (DOM insertion/hidden detection/auto-cleanup)
- Detector integration (configuration/threshold/cache isolation)

## Browser Test Page

After building, open `test/index.html` (requires a local server) for a visual detection result dashboard. Toggle AdBlock on/off and refresh to compare.

## License

MIT
