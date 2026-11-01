/* Targeted browser checks for the six-dimension report profile. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const D = require('../assets/omni-data.js');
const S = require('../assets/omni-session.js');
const E = require('../assets/omni-engine.js');
const ROOT = path.resolve(__dirname, '..');
const KEY = 'ideology-survey-omni-2026-11-01';
const output = process.env.OMNI_QA_DIR || path.join(ROOT, '.qa');
const THEMES = ['经济制度', '政治制度', '变革与公共责任', '文化与社会平等', '认同与国际事务', '生态技术与判断'];
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const requested = path.resolve(ROOT, '.' + (urlPath === '/' ? '/index.html' : urlPath));
  if (!requested.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  try { const data = fs.readFileSync(requested); res.setHeader('Content-Type', mime[path.extname(requested)] || 'application/octet-stream'); res.end(data); }
  catch (_) { res.writeHead(404); res.end(); }
});

function session(value) {
  const s = S.fresh(D); s.stage = 'base';
  for (const q of D.core.items) {
    const answer = typeof value === 'function' ? value(q) : value;
    if (answer !== undefined) S.answer(s, q, answer);
  }
  S.finish(s, 'profile-browser-check');
  return s;
}

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
    await page.getByRole('heading', { name: '基本倾向性画像', exact: true }).waitFor();
  }
  async function structure() {
    assert.equal(await page.locator('.tendency-profile').count(), 1);
    assert.equal(await page.locator('.tendency-dimension').count(), 6);
    const profileText = await page.locator('.tendency-profile').innerText();
    for (const name of THEMES) assert(profileText.includes(name), name);
    const order = await page.evaluate(() => {
      const summary = document.querySelector('.report-summary'), profile = document.querySelector('.tendency-profile'), atlas = document.querySelector('.vz-atlas');
      return !!(summary && profile && atlas && (summary.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING) && (profile.compareDocumentPosition(atlas) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    assert(order, 'new profile follows the summary and precedes the existing atlas');
    assert.equal(await page.locator('.report-axis').count(), 22);
    await page.locator('.vz-compass[data-ready]').waitFor();
    assert(!/NaN|undefined|Infinity/.test(await page.locator('.tendency-profile').innerText()));
  }
  try {
    await page.goto(origin);
    await seed(session(undefined)); await structure();
    assert.equal(await page.locator('.tendency-match').count(), 0, 'blank answers must not invent a closest ideology');
    console.log('PASS blank report: all six dimensions present, no invented match, existing charts retained');

    await seed(session(4)); await structure();
    assert.equal(await page.locator('.tendency-match').count(), 0, 'uniformly neutral answers must not be assigned an arbitrary ideology');
    assert(/中立|方向不明显|尚无明显/.test(await page.locator('.tendency-profile').innerText()));
    console.log('PASS neutral report: no arbitrary winner');

    // Agreeing with both sides gives 3 positive and 3 negative oriented answers per facet.
    await seed(session(7)); await structure();
    const mixedText = await page.locator('.tendency-profile').innerText();
    assert(/分歧|交叉|混合|不确定|未形成|保留|两端|中立/.test(mixedText), 'mixed answers retain an explanation rather than claiming certain membership');
    assert.equal(await page.locator('.tendency-match').count(), 0, 'balanced conflicting claims must not be averaged into an ideological winner');
    console.log('PASS cross-cutting answers: valid report with explicit limits');

    // Reproduce one authored target in every dimension rather than relying on a
    // particular political direction being present in every reference library.
    const profileData = require('../data/tendency_profiles.json');
    const expected = profileData.sections.map(section => profileData.profiles.find(p => p.section === section.section));
    assert(expected.every(Boolean), 'every dimension has a reference profile');
    const targets = Object.assign({}, ...expected.map(p => p.targets));
    const complete = session(q => {
      const oriented = Math.max(1, Math.min(7, 4 + (targets[q.axis] || 0) * 3 / 100));
      const low = Math.floor(oriented), highCount = Math.round((oriented - low) * 6);
      const index = D.core.items.filter(item => item.axis === q.axis).findIndex(item => item.id === q.id);
      const value = low + (index < highCount ? 1 : 0);
      return q.sign === '-' ? 8 - value : value;
    });
    await seed(complete); await structure();
    const profileText = await page.locator('.tendency-profile').innerText();
    for (const candidate of expected) assert.equal(await page.locator('[data-tendency="' + candidate.id + '"]').count(), 1, candidate.label + ' target is included in its dimension');
    const portraitPaths = await page.evaluate(() => Object.values(window.OMNI_PEOPLE).map(person => person.portrait));
    assert(portraitPaths.length > 0);
    assert(portraitPaths.every(src => /^assets\/portraits\/[a-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(src)), 'portrait catalogue contains only site-local image paths');
    const portraitDecodes = await page.evaluate(paths => Promise.all(paths.map(src => new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve({ src, loaded: image.naturalWidth > 0 && image.naturalHeight > 0 });
      image.onerror = () => resolve({ src, loaded: false }); image.src = src;
    }))), portraitPaths);
    assert(portraitDecodes.every(image => image.loaded), JSON.stringify(portraitDecodes.filter(image => !image.loaded)));
    for (const image of await page.locator('.tendency-match img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(el => el.complete ? Promise.resolve() : new Promise((resolve, reject) => { el.addEventListener('load', resolve, { once: true }); el.addEventListener('error', () => reject(new Error(el.src)), { once: true }); }));
      assert(await image.evaluate(el => el.naturalWidth > 0 && el.naturalHeight > 0), 'real portrait loads');
      assert(await image.getAttribute('alt'), 'portrait has accessible alternative text');
      assert(new URL(await image.getAttribute('src'), origin).origin === origin, 'portrait is hosted with the site');
    }
    await page.locator('.tendency-profile').screenshot({ path: path.join(output, 'tendency-profile-desktop.png') });
    const textDownload = page.waitForEvent('download'); await page.locator('[data-action=report-text]').click();
    const exportedText = fs.readFileSync(await (await textDownload).path(), 'utf8');
    assert(exportedText.includes('基本倾向性画像'));
    for (const name of THEMES) assert(exportedText.includes(name), name);
    assert(exportedText.includes(profileText.split('\n').find(line => line.includes('派') || line.includes('主义')) || '基本倾向性画像'));
    await page.emulateMedia({ media: 'print' });
    assert(await page.locator('.tendency-profile').isVisible());
    for (const dimension of await page.locator('.tendency-dimension').all()) assert(await dimension.isVisible());
    await page.pdf({ path: path.join(output, 'tendency-profile-print.pdf'), format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390px report does not overflow');
    assert(await page.locator('.tendency-profile').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'profile fits its phone column');
    await page.locator('.tendency-profile').screenshot({ path: path.join(output, 'tendency-profile-mobile.png') });
    console.log('PASS candidate portraits, text export, print/PDF and mobile layout');

    // Import uses the same report and must preserve the exact profile text.
    await page.setViewportSize({ width: 1360, height: 980 });
    await page.goto(origin + '/omni-admin.html');
    await page.locator('#import-text').fill(E.encodeSession(complete)); await page.locator('#import-run').click();
    await page.locator('#admin-report .tendency-profile').waitFor();
    assert.equal(await page.locator('#admin-report .tendency-profile').innerText(), profileText);
    const hostile = session(undefined);
    hostile.presented.push('Z04'); hostile.answers.Z04 = '<img src=x onerror=alert(1)>';
    await page.locator('#import-text').fill(E.encodeSession(hostile)); await page.locator('#import-run').click();
    assert.equal(await page.locator('#admin-report img[src=x]').count(), 0);
    assert((await page.locator('#admin-report').textContent()).includes('<img src=x onerror=alert(1)>'));
    assert.equal(await page.locator('.tendency-match').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(failedResponses, []);
    assert(requests.every(url => url.startsWith(origin) || /^(data|blob):/.test(url)), 'report never needs external requests');
    fs.writeFileSync(path.join(output, 'profile-browser-result.json'), JSON.stringify({ passed: true, errors, failedResponses, requests: [...new Set(requests)] }, null, 2));
    console.log('PASS shared admin report, escaped free text and site-local resources');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
