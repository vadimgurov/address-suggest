import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

try {
  mkdirSync('dist', { recursive: true });
} catch {}

await build({
  entryPoints: ['address-suggest.js'],
  bundle: false, // library is already UMD/IIFE style; no bundling of deps
  minify: true,
  outfile: 'dist/address-suggest.min.js',
  format: 'iife',
  target: 'es2017',
  banner: {
    js: `/*! address-suggest.min.js - built ${new Date().toISOString()} */`
  }
});

console.log('Built dist/address-suggest.min.js');
