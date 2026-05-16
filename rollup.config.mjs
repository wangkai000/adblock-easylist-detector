import terser from '@rollup/plugin-terser';

const basePlugins = (minify) => [
  ...(minify ? [terser()] : []),
];

export default [
  // ── 主入口：全量包 ──
  {
    input: '.temp/index.js',
    output: [
      { file: 'dist/adblock-easylist-detector.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/adblock-easylist-detector.cjs.js', format: 'cjs', sourcemap: true, exports: 'named' },
      { file: 'dist/adblock-easylist-detector.umd.js', format: 'umd', name: 'AdblockEasylistDetector', sourcemap: true, exports: 'named' },
    ],
    plugins: basePlugins(false),
  },

  // ── 分模块：检测引擎 ──
  {
    input: '.temp/modules/detector.js',
    output: [
      { file: 'dist/detector.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/detector.cjs.js', format: 'cjs', sourcemap: true, exports: 'named' },
      { file: 'dist/detector.umd.js', format: 'umd', name: 'AdblockEasylistDetector_Engine', sourcemap: true, exports: 'named' },
    ],
    plugins: basePlugins(false),
  },

  // ── 分模块：资源生成 ──
  {
    input: '.temp/modules/resource-generator.js',
    output: [
      { file: 'dist/resource-generator.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/resource-generator.cjs.js', format: 'cjs', sourcemap: true, exports: 'named' },
      { file: 'dist/resource-generator.umd.js', format: 'umd', name: 'AdblockEasylistDetector_ResourceGen', sourcemap: true, exports: 'named' },
    ],
    plugins: basePlugins(false),
  },

  // ── 分模块：诱饵检测 ──
  {
    input: '.temp/modules/bait-detector.js',
    output: [
      { file: 'dist/bait-detector.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/bait-detector.cjs.js', format: 'cjs', sourcemap: true, exports: 'named' },
      { file: 'dist/bait-detector.umd.js', format: 'umd', name: 'AdblockEasylistDetector_Bait', sourcemap: true, exports: 'named' },
    ],
    plugins: basePlugins(false),
  },

  // ── 分模块：结果回调 ──
  {
    input: '.temp/modules/callback.js',
    output: [
      { file: 'dist/callback.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/callback.cjs.js', format: 'cjs', sourcemap: true, exports: 'named' },
      { file: 'dist/callback.umd.js', format: 'umd', name: 'AdblockEasylistDetector_Callback', sourcemap: true, exports: 'named' },
    ],
    plugins: basePlugins(false),
  },

  // ── 压缩版 ──
  {
    input: '.temp/index.js',
    output: [
      { file: 'dist/adblock-easylist-detector.esm.min.js', format: 'es' },
      { file: 'dist/adblock-easylist-detector.cjs.min.js', format: 'cjs', exports: 'named' },
      { file: 'dist/adblock-easylist-detector.umd.min.js', format: 'umd', name: 'AdblockEasylistDetector', exports: 'named' },
    ],
    plugins: basePlugins(true),
  },
];
