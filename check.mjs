// Loads every game of the site in headless Chrome and fails on console errors, page errors,
// failed requests or a missing canvas. Usage: node check.mjs [base-url] [shot-dir]
// Base URL defaults to a local server on public/. Playwright comes from the slopout grader
// (PLAYWRIGHT=<path to node_modules/playwright>), so this repo needs no install.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? path.join(os.homedir(), 'code/projects/slopout/grade/node_modules/playwright'));
let [base, shots] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };

let server;
if (!base) { // static server on public/, like Vercel: /dir -> /dir/, /dir/ -> /dir/index.html
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, 'public', url);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.endsWith('/')) { res.writeHead(308, { Location: `${url}/` }); return res.end(); }
      file = path.join(file, 'index.html');
    }
    if (!file.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
}
base = base.replace(/\/$/, '');
const games = await (await fetch(`${base}/games.json`)).json();
const pages = ['/', ...fs.readdirSync(path.join(ROOT, 'public')).filter((d) => fs.existsSync(path.join(ROOT, 'public', d, 'index.html')) && d !== 'play').map((d) => `/${d}/`)];

const browser = await chromium.launch(process.platform === 'darwin'
  ? { channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] }
  : { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let bad = 0;
for (const url of [...pages, ...games, ...games.map((g) => g.replace(/\/$/, ''))]) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) // 404s are caught with their URL below
    errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base + url, { waitUntil: 'load' }).catch((e) => errors.push(String(e).slice(0, 200)));
  await page.waitForTimeout(url.startsWith('/play/') ? 2500 : 300);
  if (url.startsWith('/play/')) {
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
    if (!(await page.$('canvas'))) errors.push('no canvas');
    if (shots) {
      fs.mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, `${url.split('/').filter(Boolean).pop()}${url.endsWith('/') ? '' : '-noslash'}.jpg`), quality: 60, type: 'jpeg' });
    }
  }
  console.log(`${errors.length ? 'FAIL' : 'ok  '} ${url}${errors.length ? `\n     ${errors.join('\n     ')}` : ''}`);
  bad += errors.length > 0;
  await page.close();
}
await browser.close();
server?.close();
console.log(bad ? `${bad} page(s) failed` : 'all pages ok');
process.exit(bad ? 1 : 0);
