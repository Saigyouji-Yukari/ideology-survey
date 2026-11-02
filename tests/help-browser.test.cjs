/* QQ／微信 help: links on home and report pages, the tutorial page itself, and the steps it describes. */
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const D = require('../assets/omni-data.js');
const M = require('../assets/omni-session.js');
const T = require('../assets/omni-transfer.js');
const ROOT = path.resolve(__dirname, '..');
const KEY = 'ideology-survey-omni-2026-11-01';
const WECHAT = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0 Mobile Safari/537.36 MicroMessenger/8.0.47';
const QQ = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.0.8.611 V1_IPH_SQ_9.0.8_1_APP_A';
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0], requested = path.resolve(ROOT, '.' + decodeURIComponent(url === '/' ? '/index.html' : url));
  if (!requested.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  try { const body = fs.readFileSync(requested); res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'})[path.extname(requested)] || 'application/octet-stream'); res.end(body); }
  catch (_) { res.writeHead(404); res.end(); }
});
function finished() {
  const s = M.fresh(D); s.stage = 'base';
  for (const q of M.plan(D, s, 'base')) M.answer(s, q, /^Q/.test(q.id) ? (q.sign === '+' ? 6 : 2) : /^Z0[123]$/.test(q.id) ? 0 : /^Z0[456]$/.test(q.id) ? '' : 4);
  M.finish(s, 'help-test'); return s;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined);
  const browser = await chromium.launch({headless: true, ...(chrome ? {executablePath: chrome} : {})});
  const errors = [], requests = [];
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('request', r => requests.push(r.url())); return page; };
  try {
    const session = finished();
    // Home and report pages link to the help page; ordinary browsers get the plain version.
    const page = watch(await (await browser.newContext({viewport: {width: 1280, height: 900}})).newPage());
    await page.goto(origin);
    await page.evaluate(({s, key}) => localStorage.setItem(key, JSON.stringify(s)), {s: session, key: KEY});
    await page.reload();
    const homeLink = page.locator('#app a.inapp-help.home');
    assert.equal(await homeLink.getAttribute('href'), 'qq-wechat-help.html');
    assert((await homeLink.innerText()).includes('QQ和微信内置浏览器无法下载文件的解决办法'));
    assert.equal(await page.locator('.inapp-help-flag').count(), 0);
    assert.equal(await page.locator('footer a[href="qq-wechat-help.html"]').count(), 1);
    await page.locator('[data-action=result]').first().click();
    const reportLink = page.locator('#app a.inapp-help.report');
    await reportLink.waitFor();
    assert(await reportLink.evaluate(el => !!(el.compareDocumentPosition(document.querySelector('[data-action=copy]')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'link sits above the report buttons');
    assert.equal(await page.locator('#report-content .inapp-help').count(), 0, 'not part of the report itself');
    await reportLink.click(); await page.waitForURL(/qq-wechat-help\.html$/);
    console.log('PASS home and report pages link to the help page');
    // Inside WeChat / QQ the link says which in-app browser was detected.
    for (const [ua, name] of [[WECHAT, '微信'], [QQ, 'QQ']]) {
      const p = watch(await (await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, userAgent: ua})).newPage());
      await p.goto(origin);
      assert.equal(await p.locator('.inapp-help.detected .inapp-help-flag').innerText(), '检测到你正在使用' + name + '内置浏览器');
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    console.log('PASS QQ and WeChat user agents get the detected notice; phone layout fits');
    // The tutorial page: every screenshot loads, copy buttons fall back to selection, phone layout fits.
    const help = watch(await (await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, userAgent: WECHAT})).newPage());
    await help.goto(origin + '/qq-wechat-help.html');
    assert.equal(await help.locator('h1').innerText(), 'QQ和微信内置浏览器无法下载文件的解决办法');
    for (const step of ['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'no-computer']) assert.equal(await help.locator('#' + step).count(), 1, step);
    const text = await help.locator('main').innerText();
    for (const words of ['复制／分段备份', '复制这一段', '复制整份代码', '文件传输助手', '我的电脑', 'Edge', 'Chrome', 'omni-admin.html', '读取并分析', '逐段粘贴导入', '加入片段／导入', '打印 / 保存为 PDF', '另存为 PDF', '保存']) assert(text.includes(words), words);
    await help.evaluate(async () => { for (const img of document.images) { img.loading = 'eager'; if (!img.complete) await new Promise(r => { img.onload = img.onerror = r; }); } });
    const broken = await help.evaluate(() => [...document.images].filter(img => !img.naturalWidth).map(img => img.src));
    assert.deepEqual(broken, []);
    for (const img of await help.evaluate(() => [...document.images].map(img => img.getAttribute('src')))) assert(fs.existsSync(path.join(ROOT, img)), img);
    await help.evaluate(() => { Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true}); });
    await help.locator('[data-copy=admin-url]').click();
    assert.match(await help.locator('#step-2 .help-copy-status').innerText(), /复制|长按/);
    assert.equal(await help.evaluate(() => { const el = document.getElementById('admin-url'); return el.value.slice(el.selectionStart, el.selectionEnd); }), 'https://saigyouji-yukari.github.io/ideology-survey/omni-admin.html');
    assert(await help.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS help page: steps, screenshots, copy fallback and phone layout');
    // The steps work as written: segments and full code import in the scorer, then the renamed print button.
    const admin = watch(await (await browser.newContext({viewport: {width: 1280, height: 900}})).newPage());
    await admin.goto(origin + '/omni-admin.html');
    const code = T.encode(session), parts = T.split(code);
    await admin.click('#import-parts');
    await admin.locator('#backup-import-text').fill(parts[parts.length - 1]); await admin.click('[data-import-add]');
    assert.match(await admin.locator('.backup-import-status').innerText(), /已收到 1 \/ \d+ 段/);
    await admin.locator('#backup-import-text').fill(parts.slice(0, -1).join('\n')); await admin.click('[data-import-add]');
    await admin.locator('#admin-report .omni-report').waitFor();
    assert.equal(await admin.locator('#print-report').innerText(), '打印 / 保存为 PDF');
    assert(await admin.locator('#print-report').isVisible());
    await admin.click('#import-clear');
    await admin.fill('#import-text', code); await admin.click('#import-run');
    await admin.locator('#admin-report .omni-report').waitFor();
    assert.match(await admin.locator('#import-status').innerText(), /已导入 1 份答卷/);
    await admin.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await admin.click('#print-report');
    assert.equal(await admin.evaluate(() => window.__printed), 1);
    assert.equal(await admin.locator('#admin-report details:not([open])').count(), 0, 'printing opens every folded section');
    console.log('PASS scorer: segmented and full-code import, then “打印 / 保存为 PDF”');
    assert.deepEqual(errors, []);
    assert(requests.every(url => url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')), 'no external requests');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
