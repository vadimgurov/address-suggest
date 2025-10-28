import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

function run(cmd){
  execSync(cmd, { stdio: 'inherit' });
}

function bumpVersion(type){
  run(`npm version ${type} --no-git-tag-version`);
  const pkg = JSON.parse(readFileSync('package.json','utf8'));
  return pkg.version;
}

function updateHtml(version){
  const htmlPath = 'address-suggest.html';
  let html = readFileSync(htmlPath, 'utf8');
  // Point jsDelivr URLs to the new tag
  html = html.replace(/(cdn\.jsdelivr\.net\/gh\/vadimgurov\/address-suggest@)([^/]+)(\/delivery-fc\.js)/,
    `$1v${version}$3`);
  html = html.replace(/(cdn\.jsdelivr\.net\/gh\/vadimgurov\/address-suggest@)([^/]+)(\/dist\/address-suggest\.min\.js)(\?v=[^"'\s]*)?/,
    `$1v${version}$3?v=${version}`);
  writeFileSync(htmlPath, html);
}

function main(){
  const type = process.argv[2] || 'patch';
  run('npm run build');
  const version = bumpVersion(type);
  updateHtml(version);
  // Commit built files and HTML and package files
  try { run('git add dist address-suggest.html package.json package-lock.json'); } catch {}
  run(`git commit -m "chore(release): v${version}"`);
  run(`git tag v${version}`);
  run('git push');
  run('git push --tags');
  console.log(`Release v${version} pushed. CDN URL: https://cdn.jsdelivr.net/gh/vadimgurov/address-suggest@v${version}/dist/address-suggest.min.js`);
}

main();
