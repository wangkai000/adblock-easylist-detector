/**
 * Build script — tsc compile then rollup bundle
 */
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { execSync } from 'child_process';
import { rmSync } from 'fs';

const TEMP = '.temp';

// Step 1: tsc compile
console.log('📝 Compiling TypeScript...');
execSync('npx tsc -p tsconfig.build.json', { stdio: 'inherit' });

// Remove test .d.ts from dist
import { readdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
if (existsSync('dist')) {
  for (const f of readdirSync('dist')) {
    if (f.endsWith('.test.d.ts')) unlinkSync(join('dist', f));
  }
}

console.log('✅ TypeScript compiled\n');

// Step 2: rollup bundle
const resolvePlugin = nodeResolve({ extensions: ['.js', '.mjs'] });

const entries = [
  {
    input: `${TEMP}/index.js`,
    outputs: [
      { file: 'dist/adblock-easylist-detector.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/adblock-easylist-detector.umd.js', format: 'umd', name: 'AdblockEasylistDetector', sourcemap: true, exports: 'named' },
    ],
  },
  {
    input: `${TEMP}/modules/detector.js`,
    outputs: [
      { file: 'dist/detector.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/detector.umd.js', format: 'umd', name: 'AdblockEasylistDetector_Engine', sourcemap: true, exports: 'named' },
    ],
  },
  {
    input: `${TEMP}/modules/resource-generator.js`,
    outputs: [
      { file: 'dist/resource-generator.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/resource-generator.umd.js', format: 'umd', name: 'AdblockEasylistDetector_ResourceGen', sourcemap: true, exports: 'named' },
    ],
  },
  {
    input: `${TEMP}/modules/bait-detector.js`,
    outputs: [
      { file: 'dist/bait-detector.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/bait-detector.umd.js', format: 'umd', name: 'AdblockEasylistDetector_Bait', sourcemap: true, exports: 'named' },
    ],
  },
  {
    input: `${TEMP}/modules/callback.js`,
    outputs: [
      { file: 'dist/callback.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/callback.umd.js', format: 'umd', name: 'AdblockEasylistDetector_Callback', sourcemap: true, exports: 'named' },
    ],
  },
];

async function build() {
  for (const entry of entries) {
    console.log(`📦 Bundling ${entry.input}...`);
    try {
      const bundle = await rollup({
        input: entry.input,
        plugins: [resolvePlugin],
      });
      for (const output of entry.outputs) {
        await bundle.write(output);
        console.log(`  → ${output.file} (${output.format})`);
      }
      await bundle.close();
    } catch (e) {
      console.error(`  ❌ Error: ${e.message}`);
    }
  }

  // Minified versions
  console.log('\n📦 Building minified...');
  try {
    const bundle = await rollup({
      input: `${TEMP}/index.js`,
      plugins: [resolvePlugin, terser()],
    });
    await bundle.write({ file: 'dist/adblock-easylist-detector.esm.min.js', format: 'es' });
    console.log('  → dist/adblock-easylist-detector.esm.min.js');
    await bundle.write({ file: 'dist/adblock-easylist-detector.umd.min.js', format: 'umd', name: 'AdblockEasylistDetector', exports: 'named' });
    console.log('  → dist/adblock-easylist-detector.umd.min.js');
    await bundle.close();
  } catch (e) {
    console.error(`  ❌ Minify error: ${e.message}`);
  }

  // Clean temp
  console.log('\n🧹 Cleaning temp files...');
  rmSync(TEMP, { recursive: true, force: true });
  console.log('✅ Build complete!');
}

build();
