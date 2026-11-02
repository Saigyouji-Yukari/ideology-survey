/* Synthetic QQ-style transfer checks. No real participant data or third-party requests. */
'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const D = require('../assets/omni-data.js');
const S = require('../assets/omni-session.js');
const E = require('../assets/omni-engine.js');
const T = require('../assets/omni-transfer.js');
const ROOT = path.resolve(__dirname, '..');
const KEY = 'ideology-survey-omni-2026-11-01';
const QQ = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.0.0 Mobile Safari/537.36 V1_AND_SQ_9.1.15_0_YYB_D QQ/9.1.15.19095';
const output = process.env.OMNI_QA_DIR || path.join(ROOT, '.qa');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  const requested = path.resolve(ROOT, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!requested.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  try { res.setHeader('Content-Type', mime[path.extname(requested)] || 'application/octet-stream'); res.end(fs.readFileSync(requested)); }
  catch (_) { res.writeHead(404); res.end(); }
});
function fixture(id = 'synthetic-qq-transfer') {
  const s = S.fresh(D, 1000000); s.id = id; s.stage = 'base';
  for (const q of S.plan(D, s)) S.answer(s, q, /^Z0[456]$/.test(q.id) ? '合成测试：中文🙂 <img src=x onerror="window.backupXss=1">' : /^Z0[123]$/.test(q.id) ? 0 : 4);
  S.selectModules(D, s, D.modules.slice(0, 2).map(m => m.id));
  for (const q of S.plan(D, s)) S.answer(s, q, 5);
  S.selectSupplements(D, s, D.legacySupplement.groups.map(g => g.id));
  for (const q of S.plan(D, s)) S.answer(s, q, 6);
  S.selectCards(D, s, D.cards.slice(0, 4).map(c => c.id));
  for (const q of S.plan(D, s)) S.answer(s, q, q.part === 'explanation' ? '合成核验🙂' : ['K', 'I'].includes(q.part) ? 0 : 5);
  S.finish(s, '合成测试完成', 1200000);
  return E.validateSession(s);
}
async function downloadJson(page, button) {
  const promise = page.waitForEvent('download'); await button.click();
  const download = await promise;
  assert(download.suggestedFilename().endsWith('.json'));
  return JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const executablePath = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const errors = [], external = [], failed = [], checks = [];
  function watch(page) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(origin) && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) external.push(request.url()); });
    page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  }
  async function context(mode = 'reject', seed) {
    const c = await browser.newContext({ userAgent: QQ, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
    await c.addInitScript(({ mode, seed, key }) => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'missing' ? undefined : { writeText: async () => { throw new Error('QQ blocked clipboard'); } } });
      document.execCommand = () => false;
      if (seed && !sessionStorage.getItem('backup-test-seeded')) { localStorage.setItem(key, JSON.stringify(seed)); sessionStorage.setItem('backup-test-seeded', 'yes'); }
    }, { mode, seed, key: KEY });
    return c;
  }
  const s = fixture(), code = T.encode(s), parts = T.split(code), other = fixture('synthetic-other'), otherParts = T.split(T.encode(other));
  assert.equal(s.presented.length, 307);
  try {
    const c = await context('reject', s), page = await c.newPage(); watch(page);
    await page.goto(origin); await page.locator('[data-action=result]').first().click();
    await page.locator('[data-action=copy]').click();
    await page.locator('.backup-overlay').waitFor();
    assert.equal(await page.locator('#backup-part-select option').count(), parts.length);
    assert.equal(await page.locator('#backup-part-text').inputValue(), parts[0]);
    assert(await page.locator('[data-part-prev]').isDisabled());
    await page.locator('[data-part-copy]').click();
    assert.match(await page.locator('.backup-status').innerText(), /浏览器限制了自动复制.*已选中/);
    assert(!/已复制/.test(await page.locator('.backup-status').innerText()));
    const selection = await page.locator('#backup-part-text').evaluate(el => ({ start: el.selectionStart, end: el.selectionEnd, length: el.value.length, readOnly: el.readOnly }));
    assert.equal(selection.start, 0); assert.equal(selection.end, selection.length); assert(selection.readOnly);
    await page.locator('[data-part-next]').click(); assert.equal(await page.locator('#backup-part-text').inputValue(), parts[1]);
    await page.locator('[data-part-prev]').click(); assert.equal(await page.locator('#backup-part-text').inputValue(), parts[0]);
    for (let i = 0; i < parts.length; i++) {
      await page.locator('#backup-part-select').selectOption(String(i));
      const value = await page.locator('#backup-part-text').inputValue();
      assert.equal(value, parts[i]); assert(value.length <= 1000);
    }
    assert(await page.locator('[data-part-next]').isDisabled());
    await page.locator('.backup-overlay summary').click();
    const full = await page.locator('#backup-full-text').inputValue(); assert.deepEqual(T.decode(full), s);
    await page.locator('[data-full-copy]').click(); assert.match(await page.locator('.backup-status').innerText(), /浏览器限制/);
    const downloaded = await downloadJson(page, page.locator('[data-json-download]')); assert.deepEqual(downloaded, s);
    const visible = await page.locator('body').innerText(); assert(!/OMNI[- ]?2026|OMNI 20|OMNI-2026/.test(visible));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-backup-close]').focus(); await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-parts-download')), true);
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-backup-close')), true);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.backup-overlay').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'copy');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert(!await page.evaluate(() => window.backupXss));
    checks.push('QQ-style clipboard rejection: manual selectable text, navigation, full code, JSON, focus trap, Escape and mobile layout');

    const missingContext = await context('missing', s), missingPage = await missingContext.newPage(); watch(missingPage);
    await missingPage.goto(origin); await missingPage.locator('[data-action=result]').first().click(); await missingPage.locator('[data-action=copy]').click();
    await missingPage.locator('[data-part-copy]').click(); assert.match(await missingPage.locator('.backup-status').innerText(), /浏览器限制.*已选中/);
    await missingContext.close(); checks.push('Missing Clipboard API still leaves the full current segment selected for manual copy');

    const adminContext = await context(), admin = await adminContext.newPage(); watch(admin); await admin.goto(origin + '/omni-admin.html');
    await admin.locator('#import-parts').click();
    async function add(part) { await admin.locator('#backup-import-text').fill(part); await admin.locator('[data-import-add]').click(); }
    await add(parts[1]); assert.match(await admin.locator('.backup-import-status').innerText(), /已收到 1 \/ .*还缺第 1、/);
    await add(parts[0].slice(0, -1)); assert.match(await admin.locator('.backup-import-status').innerText(), /第 1 段校验不通过/);
    await add(otherParts[0]); assert.match(await admin.locator('.backup-import-status').innerText(), /不同答卷/);
    await add(parts[3]); assert.match(await admin.locator('.backup-import-status').innerText(), /已收到 2 \/ /);
    await add(parts[1]); assert.match(await admin.locator('.backup-import-status').innerText(), /已收到 2 \/ /);
    for (let i = parts.length - 1; i >= 0; i--) if (![1, 3].includes(i)) await add(parts[i]);
    await admin.locator('.backup-overlay').waitFor({ state: 'detached' });
    assert.match(await admin.locator('#import-status').innerText(), /导入 1 份/);
    assert.equal(await admin.locator('#session-select option').count(), 1);
    assert.deepEqual(await downloadJson(admin, admin.locator('#export-json')), s);
    assert(!await admin.evaluate(() => window.backupXss));
    checks.push('Incremental admin import: out of order, missing indices, invalid/cross-packet rejection without queue contamination, duplicate deduplication, automatic complete import');
    await admin.locator('#import-parts').click(); await add(parts[0]); await admin.keyboard.press('Escape');
    assert.equal(await admin.evaluate(() => document.activeElement.id), 'import-parts');
    await admin.locator('#import-parts').click(); assert.equal(await admin.locator('#backup-import-text').inputValue(), '');
    assert.match(await admin.locator('.backup-import-status').innerText(), /尚未加入片段/);
    await add(parts[1]); assert.match(await admin.locator('.backup-import-status').innerText(), /已收到 1 \/ /);
    await admin.locator('[data-import-reset]').click(); assert.match(await admin.locator('.backup-import-status').innerText(), /已清空/);
    await admin.keyboard.press('Escape'); assert.equal(await admin.evaluate(() => localStorage.length), 0);
    checks.push('Import queue is memory-only, resettable and discarded when the dialog closes');
    async function batch(text) { await admin.locator('#import-text').fill(text); await admin.locator('#import-run').click(); }
    await batch([...parts].reverse().join('\n')); assert.match(await admin.locator('#import-status').innerText(), /已导入 1 份答卷。/);
    await batch([...parts, ...otherParts].reverse().join('\n')); assert.equal(await admin.locator('#session-select option').count(), 2);
    await batch(E.encodeSession(s) + '\nOMNI1.broken'); assert.match(await admin.locator('#import-status').innerText(), /已导入 1 份答卷，1 项未成功/);
    await batch(JSON.stringify(s) + '\n{"bad":"broken"}'); assert.match(await admin.locator('#import-status').innerText(), /已导入 1 份答卷，1 项未成功/);
    const bad = fixture('synthetic-invalid'); bad.answers['<img src=x onerror="window.backupXss=1">'] = 7;
    await batch(JSON.stringify([s, bad])); assert.match(await admin.locator('#import-status').innerText(), /已导入 1 份答卷，1 项未成功/);
    assert.equal(await admin.locator('#import-errors img').count(), 0); assert(!await admin.evaluate(() => window.backupXss));
    assert.match(await admin.locator('#import-errors').innerText(), /<img src=x/);
    checks.push('Ordinary admin import supports complete segments and separate packets; good legacy/JSON entries survive bad entries; error text is escaped');

    await page.locator('[data-action=home]').first().click();
    await page.getByText('本机记录与答卷导入', { exact: true }).click(); await page.locator('[data-action=import-code]').click();
    await page.locator('#backup-import-text').fill(otherParts.join('\n'));
    page.once('dialog', dialog => dialog.dismiss()); await page.locator('[data-import-add]').click();
    assert.equal(await page.locator('.backup-overlay').count(), 1);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).id, KEY), s.id);
    page.once('dialog', dialog => dialog.accept()); await page.locator('[data-import-add]').click();
    await page.locator('.backup-overlay').waitFor({ state: 'detached' });
    const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY); assert.deepEqual(restored, other);
    assert.match(await page.locator('#report-content').innerText(), new RegExp(other.id));
    assert(!await page.evaluate(() => window.backupXss));
    checks.push('Homepage restore accepts complete segments, asks before replacement, respects cancellation, then preserves every original answer and disclosure record');
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(failed, []);
    fs.writeFileSync(path.join(output, 'backup-browser-result.json'), JSON.stringify({ checks, errors, external, failed, segmentCount: parts.length, maxSegmentLength: Math.max(...parts.map(p => p.length)) }, null, 2));
    checks.forEach(check => console.log('PASS ' + check));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
