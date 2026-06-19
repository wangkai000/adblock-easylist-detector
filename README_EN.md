# adblock-easylist-detector

> Lightweight AdBlock detection using EasyList reverse-probing + CSS bait element detection.

## Quick Start

```bash
npm install adblock-easylist-detector
```

```ts
import { createDetector } from 'adblock-easylist-detector';

const { detected, confidence } = await createDetector().detect();

if (detected) {
  console.log(`AdBlock detected — confidence: ${(confidence * 100).toFixed(0)}%`);
}
```

---

## How It Works

### 🔥 Dual Detection

| Method | How | Weight |
|--------|-----|:------:|
| **Network Probe** | Requests resources from high-hit-rate EasyList ad domains; blocked = AdBlocker present | 60% |
| **Bait Detection** | Injects DOM elements with ad-like class/id attributes, checks if CSS rules hide them | 40% |

Weighted combination for higher accuracy than either method alone.

### 📋 Rule Pool (32 Rules Total)

Full set of 32 EasyList high-hit rules covering major global ad platforms:

| Category | Count | Examples |
|----------|:-----:|------|
| Domain | 21 | Google AdSense, DoubleClick, Amazon Ads, Criteo, Baidu, Tanx, Tencent… |
| Path | 7 | ads.js, ad/banner, popunder, advertisement… |
| Query Param | 2 | ad_type=, ad_unit= |
| Third-party | 2 | Taboola, Outbrain |

Each rule has a confidence score (0.62–0.95). **10 core rules are active by default** (high coverage, low false-positive).

---

## API

### `createDetector(options?)`

```ts
const detector = createDetector({
  timeout: 3000,              // Per-resource timeout in ms (default 3000)
  confidenceThreshold: 0.5,   // Detection threshold 0–1 (default 0.5)
  cache: true,                // Enable sessionStorage cache, 5-min TTL
  enableBait: true,           // Enable CSS bait detection
  activeRules: [...],         // Custom active rule set; defaults to DEFAULT_ACTIVE_RULE_IDS (10 rules)
  // Advanced
  category: 'domain',         // Only test a specific category
  minConfidence: 0.8,         // Only test rules with confidence ≥ this value
  baitTimeout: 200,           // Bait detection timeout in ms
  baits: [],                  // Custom bait configs
  netWeight: 0.6,             // Network probe weight
  baitWeight: 0.4,            // Bait detection weight
  maxConcurrency: 5,          // Max concurrent probes
  debug: false,               // Enable debug logging
});
```

### `AdblockDetector` Methods

| Method | Description |
|--------|-------------|
| `detect()` | Run detection → `Promise<DetectionResult>` |
| `onDetect(fn)` | Register persistent callback |
| `onceDetect(fn)` | Register one-shot callback |
| `offDetect(fn)` | Remove a callback |
| **Rule Management** | |
| `enableRule(id)` | Enable a rule (takes effect immediately) |
| `disableRule(id)` | Disable a rule |
| `setActiveRules(ids)` | Replace active rule set |
| `getActiveRules()` | Get currently active rule IDs |
| `getAllRules()` | Get all 32 rules with details (id, description, category, confidence) |
| **Other** | |
| `clearCache()` | Clear sessionStorage cache |
| `destroy()` | Destroy instance (clear cache + callbacks) |
| `options` | Current config (read-only) |

### `DetectionResult`

```ts
{
  detected: boolean;        // AdBlock detected?
  confidence: number;       // Overall confidence 0–1
  blockedCount: number;     // Network probes blocked
  totalCount: number;       // Total network probes
  details: [{              // Per-probe details
    rule: EasyListRule;
    url: string;
    blocked: boolean;
    elapsed: number;       // ms
  }];
  baitResults: [{         // Per-bait details
    description: string;
    hidden: boolean;
    reason?: string;      // display:none / visibility:hidden / zero-size / opacity:0 / removed
  }];
  baitHiddenCount: number;
  baitTotalCount: number;
  totalDuration: number;   // Total detection time (ms)
  fromCache: boolean;
  timestamp: number;
}
```

---

## Common Scenarios

### Toggle Rules

```ts
const d = createDetector();

// Add a rule
d.enableRule('criteo');

// Temporarily disable one
d.disableRule('pos-baidu');

// Replace entirely — only Google ads
d.setActiveRules(['pagead2-googlesyndication', 'doubleclick', 'adservice-google']);

// Check what's active
console.log(d.getActiveRules()); // ['pagead2-googlesyndication', 'doubleclick', 'adservice-google']

// Browse all 32 rules and pick your own
d.getAllRules().forEach(r => console.log(r.id, r.description, r.confidence));
```

### Custom Rules at Creation

```ts
const d = createDetector({
  activeRules: ['pagead2-googlesyndication', 'criteo', 'outbrain'],
});

const r = await d.detect();
// r.totalCount === 3
```

### Callback Mode (Continuous Monitoring)

```ts
const d = createDetector();

d.onDetect((result) => {
  if (result.detected) {
    // Show warning, fire analytics, redirect…
    reportAdBlock(result.confidence);
  }
});

await d.detect();            // initial check
button.onclick = () => d.detect(); // re-check on user action
```

### Network Probe Only (No Baits)

```ts
const d = createDetector({ enableBait: false });
const r = await d.detect();
// r.baitTotalCount === 0
```

### Custom Baits

```ts
const d = createDetector({
  baits: [
    { className: 'ad-unit', id: 'top-banner', confidence: 0.9, description: 'Top banner slot' },
    { className: 'sponsored', id: 'sidebar-widget', confidence: 0.85, description: 'Sidebar ad' },
  ],
});
```

### Global Singleton

```ts
import { getInstance } from 'adblock-easylist-detector';
const r = await getInstance().detect();
```

---

## Full Example

```ts
import { createDetector } from 'adblock-easylist-detector';

async function initAdBlockCheck() {
  // 1. Create detector — focused on Google + platform-specific rules
  const detector = createDetector({
    timeout: 4000,
    confidenceThreshold: 0.6,
    activeRules: [
      'pagead2-googlesyndication',
      'doubleclick',
      'ads-js',
      'ad-banner',
      'outbrain',
      'taboola',
    ],
  });

  // 2. Continuous monitoring
  detector.onDetect((result) => {
    if (result.detected) {
      console.warn(
        `[AdBlock] Blocker detected | confidence:${(result.confidence * 100).toFixed(0)}% ` +
        `| network:${result.blockedCount}/${result.totalCount} ` +
        `| bait:${result.baitHiddenCount}/${result.baitTotalCount} ` +
        `| time:${result.totalDuration}ms`
      );
      showAdBlockNotice(result.confidence);
    }
  });

  // 3. First check
  let result = await detector.detect();

  if (result.fromCache) {
    console.log('[AdBlock] Cache hit, skipping probe');
    return;
  }

  // 4. Not detected but some blocks — add more rules and retry
  if (!result.detected && result.blockedCount > 0) {
    detector.enableRule('criteo');
    detector.enableRule('amazon-adsystem');
    result = await detector.detect();
  }

  // 5. Too slow? Disable baits for next round (performance-sensitive)
  if (result.totalDuration > 3000) {
    console.warn('[AdBlock] Detection took too long, disabling baits next time');
    const fastDetector = createDetector({
      enableBait: false,
      activeRules: detector.getActiveRules(),
    });
    await fastDetector.detect();
  }

  // 6. Explore unused rules
  const disabledRules = detector.getAllRules().filter(
    r => !detector.getActiveRules().includes(r.id)
  );
  console.log('Available (not active):', disabledRules.map(r => `${r.id} (${r.description})`));
}

function showAdBlockNotice(confidence: number) {
  // Your business logic: modal, redirect, analytics…
}
```

---

## Import Options

| Method | Code |
|--------|------|
| ESM | `import { createDetector } from 'adblock-easylist-detector'` |
| UMD | `<script src="adblock-easylist-detector.umd.js"></script>` |

UMD global: `AdblockEasylistDetector`

```html
<script src="dist/adblock-easylist-detector.umd.min.js"></script>
<script>
  var d = AdblockEasylistDetector.createDetector();
  d.detect().then(function(r) {
    console.log('AdBlock:', r.detected);
  });
</script>
```

## Build Artifacts

| File | Format | Description |
|------|--------|-------------|
| `adblock-easylist-detector.esm.js` | ESM | Full bundle, tree-shakable |
| `adblock-easylist-detector.umd.js` | UMD | Full bundle, `<script>` ready |
| `*.min.js` | ESM/UMD | Minified |
| `detector.esm.js` | ESM | Detection engine only |
| `resource-generator.esm.js` | ESM | Resource generator only |
| `bait-detector.esm.js` | ESM | Bait detector only |
| `callback.esm.js` | ESM | Callback manager only |

## Technical Details

### Network Probing

- **`<script>`** — Most reliable; AdBlock intercepts script loading (`onerror`)
- **`<img>`** — Image request blocking is also common
- **fetch no-cors + image fallback** — For XHR-type rules; no-cors fetch may return opaque responses (false negatives), so an image probe confirms

### Bait Detection

- Injects `<div>` elements with ad-like class/id into the page
- Dual timing: `requestAnimationFrame` + `setTimeout(50ms)` fallback (rAF may not fire in background tabs)
- Checks: `display:none`, `visibility:hidden`, `opacity:0`, zero-size, DOM removal
- Auto-cleanup after detection

### Caching

- `sessionStorage` cache, 5-minute TTL
- Per-instance isolation (unique cache key)
- SSR-safe: all modules check `typeof window/document`

---

## Development

```bash
npm install        # Install deps
npm run build      # Build
npm test           # Run tests (53 cases)
npm run test:watch # Watch mode
npm run clean      # Clean output
```

## Testing

Vitest + jsdom, 53 test cases covering:

- EasyList rule integrity, id uniqueness, category coverage
- Rule management API (enable/disable/setActive/getActive/getAll)
- Resource URL generation and filtering
- Callback management (on/once/off/clear/multi-instance isolation/error isolation)
- Bait detection (DOM injection/hidden detection/auto-cleanup)
- Detector integration (config/threshold/cache isolation)

Browser test page: open `test/index.html` after building (requires a local server).

## License

MIT
