/* Browser checks for the “综合报告分析” section: placement, statuses, export, print and phone layout. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const D = require('../assets/omni-data.js');
const S = require('../assets/omni-session.js');
const E = require('../assets/omni-engine.js');
const { FIXTURES, build } = require('./synthesis-fixtures.cjs');
const ROOT = path.resolve(__dirname, '..');
const KEY = 'ideology-survey-omni-2026-11-01';
const output = process.env.OMNI_QA_DIR || path.join(ROOT, '.qa');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const requested = path.resolve(ROOT, '.' + (urlPath === '/' ? '/index.html' : urlPath));
  if (!requested.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  try { const data = fs.readFileSync(requested); res.setHeader('Content-Type', mime[path.extname(requested)] || 'application/octet-stream'); res.end(data); }
  catch (_) { res.writeHead(404); res.end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined);
  const browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
  const errors = [], requests = [], failedResponses = [];
  const context = await browser.newContext({ viewport: { width: 1360, height: 980 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => requests.push(req.url()));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push([response.status(), response.url()]); });
  async function seed(s) {
    await page.evaluate(({ s, key }) => {
      localStorage.setItem(key, JSON.stringify(s));
      window.addEventListener('pagehide', () => localStorage.setItem(key, JSON.stringify(s)), { once: true });
    }, { s, key: KEY });
    await page.reload();
    await page.locator('[data-action=result]').first().click();
    await page.getByRole('heading', { name: '综合报告分析', exact: true }).waitFor();
  }
  const synText = () => page.locator('.syn').innerText();
  try {
    await page.goto(origin);

    // A full sheet with modules, supplements, cards and self-identification.
    const rich = FIXTURES.democratic();
    await seed(rich);
    const order = await page.evaluate(() => {
      const [summary, syn, profile, atlas] = ['.report-summary', '.syn', '.tendency-profile', '.vz-atlas'].map(s => document.querySelector(s));
      const after = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      return after(summary, syn) && after(syn, profile) && after(profile, atlas);
    });
    assert(order, 'summary → 综合报告分析 → 基本倾向性画像 → existing atlas');
    assert.equal(await page.locator('.syn').getAttribute('data-status'), 'ok');
    assert.equal(await page.locator('.syn-section').count(), 8);
    assert.deepEqual(await page.locator('.syn-num').allInnerTexts(), ['一', '二', '三', '四', '五', '六', '七', '八']);
    const text = await synText();
    for (const heading of ['总体定位', '简化成一句话：', '自我认同、思想卡与画像参照', '最主要的内部张力', '综合概括']) assert(text.includes(heading), heading);
    assert(!/NaN|undefined|Infinity|null/.test(text));
    assert(await page.locator('.syn-tensions li').count() >= 3);
    const firstTension = (await page.locator('.syn-tensions li').first().innerText()).trim();
    assert(firstTension.includes('长期压制和平反对者'), firstTension);
    assert(await page.locator('.syn-overall strong').count() >= 1, 'section names and the main tension are emphasised');
    assert(text.includes('托洛茨基主义、马克思主义、民主社会主义'));
    // Collapsing a section keeps the headline readable; expanding restores the detail.
    const economic = page.locator('.syn-section[data-section=economic]');
    await economic.locator('summary').click();
    assert.equal(await economic.evaluate(el => el.open), false);
    assert((await economic.locator('summary').innerText()).includes('经济制度'));
    await economic.locator('summary').click();
    assert.equal(await economic.evaluate(el => el.open), true);
    // Wait for the charts further down and the fonts so screenshots see a settled page.
    await page.locator('.vz-compass[data-ready]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const shot = (selector, name) => page.locator(selector).first().screenshot({ path: path.join(output, name), animations: 'disabled', timeout: 60000 });
    await shot('.syn-overall', 'synthesis-overall-desktop.png');
    await shot('.syn-section[data-section=economic]', 'synthesis-section-desktop.png');
    await shot('.syn-tensions', 'synthesis-tensions-desktop.png');
    await shot('.syn-summary', 'synthesis-summary-desktop.png');

    // Text export opens every section and keeps the analysis in reading order.
    await economic.locator('summary').click();
    const textDownload = page.waitForEvent('download'); await page.locator('[data-action=report-text]').click();
    const exported = fs.readFileSync(await (await textDownload).path(), 'utf8');
    assert.equal(await economic.evaluate(el => el.open), false, 'export restores the reader’s own open/closed state');
    const at = name => exported.indexOf(name);
    assert(at('综合报告分析') >= 0 && at('综合报告分析') < at('基本倾向性画像'));
    assert(at('总体定位') < at('最主要的内部张力') && at('最主要的内部张力') < at('综合概括'));
    assert(exported.includes(firstTension));
    assert(exported.includes('因此，经济上'), 'a collapsed section is still exported in full');
    await economic.locator('summary').click();

    // Print keeps every section visible.
    await page.emulateMedia({ media: 'print' });
    assert(await page.locator('.syn').isVisible());
    for (const section of await page.locator('.syn-section').all()) assert(await section.isVisible());
    await page.pdf({ path: path.join(output, 'synthesis-print.pdf'), format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });

    // Phone width: no horizontal overflow in any part of the analysis.
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390px report does not overflow');
    for (const selector of ['.syn', '.syn-overall', '.syn-section', '.syn-tensions', '.syn-summary']) {
      for (const el of await page.locator(selector).all()) assert(await el.evaluate(node => node.scrollWidth <= node.clientWidth + 1), selector + ' fits its phone column');
    }
    await shot('.syn-overall', 'synthesis-overall-mobile.png');
    await shot('.syn-section[data-section=political]', 'synthesis-section-mobile.png');
    await page.setViewportSize({ width: 1360, height: 980 });
    console.log('PASS full sheet: placement, eight sections, tensions, export, print and phone layout');

    // Edge states are stated plainly and never invent a position.
    const blank = S.fresh(D); S.finish(blank, 'synthesis-browser');
    await seed(blank);
    assert.equal(await page.locator('.syn').getAttribute('data-status'), 'insufficient');
    assert.equal(await page.locator('.syn-section, .syn-tensions, .syn-summary').count(), 0);
    assert((await synText()).includes('暂不生成'));
    const uniform = build({ base: 'neutral' });
    for (const q of D.core.items) uniform.answers[q.id] = 7;
    await seed(uniform);
    assert.equal(await page.locator('.syn').getAttribute('data-status'), 'uniform');
    assert.equal(await page.locator('.syn-section').count(), 0);
    assert((await synText()).includes('全部选择“强烈同意”'));
    await seed(build({ base: 'neutral' }));
    assert.equal(await page.locator('.syn').getAttribute('data-status'), 'neutral');
    assert((await synText()).includes('不把中立推断为'));
    console.log('PASS blank, uniform and all-neutral sheets get explicit statuses');

    // The administrator view renders the identical analysis, and free text stays inert.
    await page.goto(origin + '/omni-admin.html');
    await page.locator('#import-text').fill(E.encodeSession(rich)); await page.locator('#import-run').click();
    await page.locator('#admin-report .syn').waitFor();
    assert.equal(await page.locator('#admin-report .syn').innerText(), text);
    const hostile = FIXTURES.unitary();
    hostile.answers.Z04 = '<img src=x onerror=alert(1)>\u0001粗体\u0002';
    await page.locator('#import-text').fill(E.encodeSession(hostile)); await page.locator('#import-run').click();
    await page.locator('#admin-report .syn').waitFor();
    assert.equal(await page.locator('#admin-report img[src=x]').count(), 0);
    const hostileText = await page.locator('#admin-report .syn').innerText();
    assert(hostileText.includes('<img src=x onerror=alert(1)>粗体'));
    assert.equal(await page.locator('#admin-report .syn strong').filter({ hasText: '粗体' }).count(), 0, 'free text cannot add emphasis');
    assert(hostileText.includes('尚未形成'));

    assert.deepEqual(errors, []); assert.deepEqual(failedResponses, []);
    assert(requests.every(url => url.startsWith(origin) || /^(data|blob):/.test(url)), 'report never needs external requests');
    fs.writeFileSync(path.join(output, 'synthesis-browser-result.json'), JSON.stringify({ passed: true, errors, failedResponses, requests: [...new Set(requests)] }, null, 2));
    console.log('PASS shared admin report, escaped free text and site-local resources');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
