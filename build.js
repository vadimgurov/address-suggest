import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

try {
  mkdirSync('dist', { recursive: true });
} catch {}

const buildTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

await build({
  entryPoints: ['address-suggest.js'],
  bundle: false, // library is already UMD/IIFE style; no bundling of deps
  minify: true,
  outfile: 'dist/address-suggest.min.js',
  format: 'iife',
  target: 'es2017',
  banner: {
    js: `/*! address-suggest.min.js - built ${buildTime} */`
  }
});

// Update HTML file with build timestamp
const htmlPath = 'address-suggest.html';
let htmlContent = readFileSync(htmlPath, 'utf8');
htmlContent = htmlContent.replace(
  /(\?v=)[^"'\s]*/g, 
  `$1${buildTime}`
);
writeFileSync(htmlPath, htmlContent);

console.log('Built dist/address-suggest.min.js');
console.log(`Updated ${htmlPath} with v=${buildTime}`);
