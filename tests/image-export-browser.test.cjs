/* Full report PNG export: QQ-like mobile browser, complete local-only pages. */
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const D = require('../assets/omni-data.js'), S = require('../assets/omni-session.js');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, '.qa');
fs.mkdirSync(OUT, { recursive:true });
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png' };
const server = http.createServer((req, res) => {
  const target = path.resolve(ROOT, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!target.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  try { res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream'); res.end(fs.readFileSync(target)); }
  catch (_) { res.writeHead(404); res.end(); }
});
function complete() {
  const state = S.fresh(D); state.stage = 'base';
  const profiles = require('../data/tendency_profiles.json');
  const targets = Object.assign({}, ...profiles.sections.map(group => profiles.profiles.find(profile => profile.section === group.section).targets));
  for (const q of S.base(D)) {
    let value = 6;
    if (q.axis) {
      const oriented = 4 + (targets[q.axis] || 0) * 3 / 100;
      const index = D.core.items.filter(item => item.axis === q.axis).findIndex(item => item.id === q.id);
      const level = Math.floor(oriented) + (index < Math.round((oriented - Math.floor(oriented)) * 6) ? 1 : 0);
      value = q.sign === '-' ? 8 - level : level;
    } else if (/^Z0[123]$/.test(q.id)) value = 0;
    else if (/^Z0[456]$/.test(q.id)) value = q.id === 'Z06' ? '长段文字分页验证：' + '此处保留补充说明、真实看法和适用前提。'.repeat(180) : '尚不清楚';
    S.answer(state, q, value);
  }
  state.selectedModules = D.modules.slice(0,2).map(module => module.id);
  state.selectedSupplements = D.legacySupplement.groups.map(group => group.id);
  state.selectedCards = D.cards.slice(0,4).map(card => card.id);
  for (const stage of ['modules','supplements','cards']) {
    state.stage = stage;
    for (const q of S.plan(D, state, stage)) S.answer(state, q, /\.(K|I)$/.test(q.id) ? 2 : q.id.endsWith('.explanation') ? '保留意见：具体问题应按条件判断。' : 6);
  }
  S.finish(state, 'image-export-browser-check'); return state;
}
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport:{width:390,height:844}, userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.128 Mobile Safari/537.36 V1_AND_SQ_9.0.8_YYB_D QQ/9.0.8.14600' });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
  try {
    await page.goto(origin);
    if (!await page.evaluate(() => !!window.html2canvas)) await page.addScriptTag({ url:origin+'/assets/vendor/html2canvas.min.js' });
    if (!await page.evaluate(() => !!window.OMNI_IMAGE_EXPORT)) await page.addScriptTag({ url:origin+'/assets/omni-image-export.js' });
    await page.addStyleTag({ url:origin+'/assets/omni-export.css' });
    const state = complete();
    await page.evaluate(state => {
      document.body.innerHTML = '<main id="fixture"></main>';
      document.querySelector('#fixture').innerHTML = window.OMNI_REPORT.render(state);
      window.OMNI_CHARTS.enhance(document.querySelector('#fixture'));
      window.__originalReport = document.querySelector('.omni-report').innerHTML;
      window.__originalStorage = JSON.stringify(localStorage);
      window.__export = window.OMNI_IMAGE_EXPORT.open(document.querySelector('.omni-report'), { id:state.id });
    }, state);
    await page.evaluate(() => window.__export.ready);
    const metadata = await page.evaluate(() => window.__export.inspect());
    assert(metadata && metadata.pageCount > 12, 'whole report includes more than two batches');
    assert.equal(metadata.pageTexts.join(''), metadata.sourceText, 'all measured text preserved exactly once (table headings repeat deliberately)');
    for (const phrase of ['基本倾向性画像','制度条件情境','22个议题分面','专题逐题记录','未检验的思想卡','Q001','Q132','L001','L057',state.id]) assert(metadata.sourceText.includes(phrase.replace(/\s+/g,'')), phrase);
    const questions = new Map([...D.core.items,...D.modules.flatMap(module=>module.items),...D.legacySupplement.items].map(q=>[q.id,q]));
    for (const id of state.presented) {
      const question = questions.get(id); if (!question) continue;
      assert(metadata.sourceText.includes(id),'presented answer '+id+' is retained');
      assert(metadata.sourceText.includes(question.text.replace(/\s+/g,'')),'full question '+id+' is retained');
    }
    for (const id of state.selectedCards) {
      const card = D.cards.find(card=>card.id===id);
      for (const [suffix,text] of [['a',card.a],['b',card.b],['c',card.contrast]]) {
        assert(metadata.sourceText.includes(id+'.'+suffix)); assert(metadata.sourceText.includes(text.replace(/\s+/g,'')));
      }
    }
    assert.equal(await page.locator('.omni-export-dialog').evaluate(el => el.scrollWidth <= el.clientWidth+1), true, 'QQ phone modal fits screen');
    assert.equal(await page.locator('[role=dialog]').getAttribute('aria-modal'), 'true');
    await page.evaluate(() => {
      const render = window.html2canvas; let failOnce = true;
      window.html2canvas = (sheet, options) => {
        if (failOnce && sheet.querySelector('.omni-image-footer').textContent.startsWith('第 2 /')) { failOnce = false; return Promise.reject(new Error('模拟可重试的单页失败')); }
        return render(sheet, options);
      };
    });
    await page.getByRole('button',{name:'生成本批图片',exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.omni-export-page-image').length === 5 && !document.querySelector('.omni-image-controls button:nth-last-child(2)').disabled, null, { timeout:120000 });
    assert.equal(await page.locator('.omni-export-image-preview .warning').count(),1,'a failed page retains the other successful pages');
    await page.getByRole('button',{name:'重试这一页',exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.omni-export-page-image').length === 6 && !document.querySelector('.omni-image-controls button:nth-last-child(2)').disabled, null, { timeout:120000 });
    assert.equal(await page.locator('.omni-export-page-image').count(),6);
    assert.equal(await page.locator('.omni-export-image-preview .warning').count(),0);
    for (const image of await page.locator('.omni-export-page-image').all()) {
      const info = await image.evaluate(async el => { await el.decode(); return {src:el.src.slice(0,30),w:el.naturalWidth,h:el.naturalHeight}; });
      assert(info.src.startsWith('data:image/png;base64,')); assert.equal(info.w,1140); assert.equal(info.h,1710);
    }
    const first = await page.locator('.omni-export-page-image').first().getAttribute('src');
    fs.writeFileSync(path.join(OUT,'report-export-page-001.png'),Buffer.from(first.split(',')[1],'base64'));
    await page.locator('.omni-export-dialog-head').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(OUT,'report-image-export-phone.png')});
    await page.getByRole('button',{name:'下一批',exact:true}).click();
    assert.equal(await page.locator('.omni-export-page-image').count(),0,'switching batches releases previous image data');
    await page.getByRole('button',{name:'生成本批图片',exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.omni-export-page-image').length === 6 && !document.querySelector('.omni-image-controls button:nth-last-child(2)').disabled, null, { timeout:120000 });
    const result = await page.evaluate(() => window.__export.inspect()); assert.equal(result.generated.length,12);
    const images = await page.locator('.omni-export-page-image').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)); assert(images);
    const graphIndex = metadata.pageGraphics.findIndex(page => page.svg > 0);
    assert(graphIndex >= 0, 'current compass is part of the report');
    for (const batch of [...new Set([Math.floor(graphIndex/6),Math.floor((metadata.pageCount-1)/6)])]) {
      await page.locator('.omni-image-batch').selectOption(String(batch));
      await page.getByRole('button',{name:'生成本批图片',exact:true}).click();
      const count = Math.min(6,metadata.pageCount-batch*6);
      await page.waitForFunction(count => document.querySelectorAll('.omni-export-page-image').length === count && !document.querySelector('.omni-image-controls button:nth-last-child(2)').disabled,count,{timeout:120000});
      assert.equal(await page.locator('.omni-export-image-preview .warning').count(),0);
      const chosen = await page.locator('.omni-export-page-image').nth(batch === Math.floor(graphIndex/6) ? graphIndex%6 : count-1).getAttribute('src');
      fs.writeFileSync(path.join(OUT,batch === Math.floor(graphIndex/6) ? 'report-export-compass.png' : 'report-export-last-page.png'),Buffer.from(chosen.split(',')[1],'base64'));
    }
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    assert.equal(await page.locator('.omni-image-sandbox').count(),0); assert.equal(await page.locator('.omni-export-overlay').count(),0);
    assert(await page.evaluate(() => document.querySelector('.omni-report').innerHTML === window.__originalReport),'details and compass original DOM are unchanged');
    assert(await page.evaluate(() => JSON.stringify(localStorage) === window.__originalStorage),'export does not mutate the answer');
    // Cancel while canvas work is outstanding, and ensure the detached result never reappears.
    await page.evaluate(() => { window.__export = window.OMNI_IMAGE_EXPORT.open(document.querySelector('.omni-report'), {id:'CANCEL-CHECK'}); });
    await page.evaluate(() => window.__export.ready);
    await page.getByRole('button',{name:'生成本批图片',exact:true}).click();
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('.omni-export-overlay,.omni-image-sandbox').count(),0);
    // Closing while a failed-page retry is pending must not access a cleared plan.
    await page.evaluate(() => { window.__export = window.OMNI_IMAGE_EXPORT.open(document.querySelector('.omni-report'), {id:'RETRY-CLOSE'}); });
    await page.evaluate(() => window.__export.ready);
    await page.evaluate(() => { const render = window.html2canvas; let calls=0; window.html2canvas=(sheet,options) => ++calls===1 ? Promise.reject(new Error('模拟重试后关闭')) : render(sheet,options); });
    await page.getByRole('button',{name:'生成本批图片',exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.omni-export-page-image').length===5 && !document.querySelector('.omni-image-controls button:nth-last-child(2)').disabled,null,{timeout:120000});
    await page.getByRole('button',{name:'重试这一页',exact:true}).click();
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('.omni-export-overlay,.omni-image-sandbox').count(),0);
    assert.deepEqual(errors,[]); assert(requests.every(url => url.startsWith(origin) || /^(data|blob):/.test(url)),'no external uploads, CDN or portrait calls');
    fs.writeFileSync(path.join(OUT,'image-export-browser-result.json'),JSON.stringify({passed:true,pageCount:metadata.pageCount,characters:metadata.sourceText.length,generatedPages:result.generated,errors,requests:[...new Set(requests)]},null,2));
    console.log('PASS complete report text coverage, QQ mobile, two six-page PNG batches, portraits/charts, local-only output, release/cancel and unchanged answers');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode=1; });
