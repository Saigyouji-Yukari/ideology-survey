/* End-to-end regression checks. npm install, then npm run test:browser. */
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const D = require('../assets/omni-data.js');
const M = require('../assets/omni-session.js');
const E = require('../assets/omni-engine.js');
const ROOT = path.resolve(__dirname,'..');
const KEY = 'ideology-survey-omni-2026-11-01';
const output = process.env.OMNI_QA_DIR || path.join(ROOT,'.qa');
fs.mkdirSync(output,{recursive:true});
const server = http.createServer((req,res)=>{
  const requested = path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if (!requested.startsWith(ROOT+path.sep)) {res.writeHead(403);res.end();return;}
  try{const content=fs.readFileSync(requested);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(requested)]||'text/plain');res.end(content);}catch(_){res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:'+server.address().port;
  const chrome=process.env.CHROME_PATH || (process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':undefined);
  const browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})});
  const errors=[], requests=[];
  const context=await browser.newContext({viewport:{width:1360,height:980},acceptDownloads:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  async function state(){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);}
  async function seed(s){await page.evaluate(({s,key})=>{localStorage.setItem(key,JSON.stringify(s));window.addEventListener('pagehide',()=>localStorage.setItem(key,JSON.stringify(s)),{once:true});},{s,key:KEY});await page.reload();await page.locator('[data-action=resume], [data-action=result]').first().click();}
  async function choose(v){const id=await page.locator('[data-question]').getAttribute('data-question');await page.locator('[data-value="'+v+'"]').click();await page.waitForFunction(id=>document.querySelector('[data-question]')?.dataset.question!==id,id);}
  try {
    await page.goto(origin);await page.getByRole('heading',{name:'让观点先于标签'}).waitFor();
    await page.screenshot({path:path.join(output,'homepage-desktop.png'),fullPage:true});
    const homepageText=await page.locator('#app').innerText();
    assert.match(homepageText,/358/);assert(!homepageText.includes('全景版'));
    assert(!(await page.title()).includes('全景版'));
    assert.equal(await page.locator('.instr-list > li').count(),10);assert(!/95\s*分钟(?:自动结束|截止|停止)|倒计时/.test(homepageText));
    await page.locator('[data-action=start]').click();await page.locator('[data-action=begin]').click();
    assert.equal(await page.locator('[data-question]').getAttribute('data-question'),'Q001');
    await choose(7);await choose('U');
    await page.locator('[data-action=prev]').click();
    assert.equal(await page.locator('[data-question]').getAttribute('data-question'),'Q002');
    await choose(4);await page.reload();await page.locator('[data-action=resume]').click();
    assert.equal(await page.locator('[data-question]').getAttribute('data-question'),'Q003');
    assert.equal((await state()).answers.Q002,4);
    console.log('PASS auto advance, previous edit, neutral/unknown, reload');
    // Every question and claim title fits on one line on a desktop-width card (long ones shrink slightly).
    const titles=[...D.core.items,...D.core.scenarios,...D.core.context,...D.modules.flatMap(m=>m.items),...D.legacySupplement.items].map(q=>q.text).concat(D.cards.flatMap(c=>[c.a,c.b,c.contrast]));
    const wrapped=await page.evaluate(list=>{const h1=document.getElementById('question-title'),keep=[h1.textContent,h1.style.getPropertyValue('--qlen')],bad=[];
      const em=t=>{let n=0;for(const ch of t)n+=ch.charCodeAt(0)<256?(ch===' '?0.3:0.56):1;return Math.ceil(n*1.02+0.6);};
      if(String(em(keep[0]))!==keep[1].trim())bad.push('page --qlen differs from the formula: '+keep[1]);
      for(const t of list){h1.textContent=t;h1.style.setProperty('--qlen',em(t));const r=document.createRange();r.selectNodeContents(h1);if(new Set([...r.getClientRects()].map(x=>Math.round(x.top))).size>1)bad.push(t);}
      h1.textContent=keep[0];h1.style.setProperty('--qlen',keep[1]);return bad;},titles);
    assert.deepEqual(wrapped,[]);
    console.log('PASS all '+titles.length+' question titles fit on one line at desktop width');
    // Actual clicks traverse all common questions, then both selected branches.
    while(await page.locator('[data-question]').count()) {
      const q=await page.locator('[data-question]').getAttribute('data-question');
      if(q==='Z04'||q==='Z05'||q==='Z06'){
        await page.locator('#free-answer').fill(q==='Z04'?'社会民主主义':'希望结合具体条件理解。');
        await page.locator('[data-action=text-next]').click();
        await page.waitForFunction(q=>document.querySelector('[data-question]')?.dataset.question!==q,q);
      }else if(/^Z0[123]$/.test(q))await choose(0);
      else await choose(q.startsWith('Q')?4:6);
    }
    assert.equal((await state()).stage,'moduleSelect');
    await page.locator('[data-module=S]').check();await page.locator('[data-module=L]').check();await page.locator('[data-module=C]').click();
    assert.equal(await page.locator('[data-module=C]').isChecked(),false);
    await page.locator('[data-action=modules-confirm]').click();
    let count=0;while(await page.locator('[data-question]').count()){await choose(6);count++;}
    assert.equal(count,40);assert.equal((await state()).stage,'supplementSelect');
    const supplementalOptions=page.locator('[data-supplement]');
    const supplementalGroups=await supplementalOptions.count();assert(supplementalGroups>0);
    for(let i=0;i<await supplementalOptions.count();i++)await supplementalOptions.nth(i).check();
    await page.locator('[data-action=supplements-confirm]').click();
    let supplementalCount=0;
    while(await page.locator('[data-question]').count()){
      const q=await page.locator('[data-question]').getAttribute('data-question');
      assert.match(q,/^L/);await choose(supplementalCount===0?'U':supplementalCount===1?'X':6);supplementalCount++;
      if(supplementalCount===2){await page.reload();await page.locator('[data-action=resume]').click();assert.equal((await state()).stage,'supplements');}
    }
    assert.equal(supplementalCount,D.legacySupplement.items.length);assert.equal((await state()).stage,'cardSelect');
    await page.locator('[data-action=toggle-names]').click();
    await page.locator('#card-search').fill('社会民主');
    assert((await page.locator('#card-options').innerText()).includes('社会民主'));
    await page.locator('#card-search').fill('');
    const checked=page.locator('[data-card]:checked');
    while(await checked.count())await checked.first().uncheck();
    for(const card of D.cards.slice(0,4))await page.locator('[data-card='+card.id+']').check();
    await page.locator('[data-card='+D.cards[4].id+']').click();assert.equal(await page.locator('[data-card='+D.cards[4].id+']').isChecked(),false);
    await page.locator('[data-action=cards-confirm]').click();
    assert.equal(await page.locator('[data-question]').getAttribute('data-question'),'T001.a');
    assert(!(await page.locator('.q-card').innerText()).includes('上位家族'));
    while(await page.locator('[data-question]').count()) {
      const q=await page.locator('[data-question]').getAttribute('data-question');
      if(q.endsWith('.explanation')){await page.locator('#free-answer').fill('支持所列安排；对邻近思想保留意见。');await page.locator('[data-action=text-next]').click();await page.waitForFunction(q=>document.querySelector('[data-question]')?.dataset.question!==q,q);}
      else await choose(q.endsWith('.K')||q.endsWith('.I')?0:6);
    }
    assert.equal((await state()).presented.length,250+supplementalCount);
    await page.locator('[data-jump="T001.a"]').click();await choose(5);
    assert.equal((await state()).stage,'review');assert.equal((await state()).originalBlindAnswers['T001.a'],6);
    assert((await state()).unblindedEdits.includes('T001.a'));
    await page.reload();await page.locator('[data-action=resume]').click();
    await page.locator('[data-action=finish]').click();await page.locator('.omni-report').waitFor();
    assert.equal(await page.locator('.report-axis').count(),22);
    let full=await state();assert.equal(full.finished,true);assert.equal(E.analyze(full).coverage.testedCardCount,4);
    const report=page.locator('.omni-report'),reportText=await report.textContent();
    assert(reportText.includes('补充议题画像'));assert.equal(await page.locator('.report-supplement').count(),supplementalGroups);
    assert(reportText.includes('主张与题型'));
    for(const item of D.legacySupplement.items){assert(reportText.includes(item.id));assert(reportText.includes(item.text));}
    const supplementDetails=page.locator('.report-supplement details').first();
    await supplementDetails.locator('summary').click();assert.equal(await supplementDetails.evaluate(el=>el.open),true);
    assert((await supplementDetails.innerText()).includes('价值主张'));
    await page.screenshot({path:path.join(output,'report-desktop.png'),fullPage:true});
    // Charts: 3-D compass rotates and switches axes, the closing figure exports a PNG and reflows on phones.
    assert(await page.locator('.vz-figure').count()>=12);await page.locator('.vz-compass[data-ready]').waitFor();
    const compass=page.locator('.vz-compass-svg'),beforeTurn=await compass.innerHTML();await compass.focus();await page.keyboard.press('ArrowRight');
    await page.waitForFunction(before=>document.querySelector('.vz-compass-svg').innerHTML!==before,beforeTurn);
    await page.locator('select[data-axis="2"]').selectOption('ECO');assert((await page.locator('.vz-compass-table').innerText()).includes('生态目标'));
    const png=page.waitForEvent('download');await page.locator('[data-export=summary]').click();
    assert.equal(fs.readFileSync(await (await png).path()).subarray(0,4).toString('hex'),'89504e47');
    await page.setViewportSize({width:390,height:844});await page.locator('.vz-summary-svg.compact').waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.screenshot({path:path.join(output,'report-mobile.png'),fullPage:true});await page.setViewportSize({width:1360,height:980});
    console.log('PASS charts: compass rotation and axis choice, summary PNG export, phone layout');
    const download=page.waitForEvent('download');await page.locator('[data-action=export]').click();const file=await download;const json=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.deepEqual(json.answers,full.answers);
    console.log('PASS full '+(250+supplementalCount)+'-response flow, supplemental groups, 2-module/4-card caps, report and JSON export');
    await page.goto(origin+'/omni-admin.html');await page.locator('#import-text').fill(E.encodeSession(full));await page.locator('#import-run').click();await page.locator('#admin-report .omni-report').waitFor();
    assert.match(await page.locator('#import-status').innerText(),/1 份/);
    await page.locator('#import-text').fill(E.encodeSession(full)+'\ninvalid');await page.locator('#import-run').click();assert.match(await page.locator('#import-status').innerText(),/1 份.*1 项/);
    assert((await page.locator('#import-errors').innerText()).includes('invalid')===false); // Error must stay a format message.
    console.log('PASS shared admin import and partial batch errors');
    await page.goto(origin);let s=M.fresh(D);s.stage='base';s.pos=1;s.answers.Q001=7;s.presented=['Q001'];await seed(s);
    page.once('dialog',dialog=>dialog.accept());await page.locator('[data-action=finish-early]').click();await page.locator('.omni-report').waitFor();assert.equal(E.analyze(await state()).coverage.testedCardCount,0);
    for(const age of [96*60000,48*60*60000]){
      s=M.fresh(D,Date.now()-age);s.stage='base';await seed(s);
      assert.equal((await state()).stage,'base');assert.equal((await state()).finished,false);
      assert.equal(await page.locator('[data-question]').getAttribute('data-question'),'Q001');await choose(7);
      assert.equal((await state()).answers.Q001,7);
    }
    s=M.fresh(D,Date.now()-86*60000);s.stage='cards';s.selectedCards=['T001'];await seed(s);
    assert.equal((await state()).stage,'cards');assert.equal((await state()).finished,false);await choose(6);assert.equal((await state()).answers['T001.a'],6);
    s=M.fresh(D,Date.now()-96*60000);s.version='OMNI-2026-11-01';delete s.selectedSupplements;s.stage='base';s.pos=1;s.answers.Q001=7;s.presented=['Q001'];await seed(s);
    const migrated=await state();assert.equal(migrated.version,D.version);assert.equal(migrated.sourceVersion,'OMNI-2026-11-01');assert.deepEqual(migrated.selectedSupplements,[]);assert.equal(migrated.answers.Q001,7);
    assert.equal(await page.locator('[data-question]').getAttribute('data-question'),'Q002');await choose(4);
    s=M.fresh(D);s.stage='supplementSelect';await seed(s);await page.locator('[data-action=skip-supplements]').click();assert.equal((await state()).stage,'cardSelect');
    console.log('PASS partial finish, optional supplement skip, legacy migration and unrestricted 96-minute/48-hour resume');
    await page.evaluate(key=>{localStorage.removeItem(key);window.addEventListener('pagehide',()=>localStorage.removeItem(key),{once:true});},KEY);await page.reload();await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(output,'homepage-mobile.png'),fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.locator('[data-action=start]').click();await page.locator('[data-action=begin]').click();await page.screenshot({path:path.join(output,'question-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.keyboard.press('4');await page.waitForFunction(()=>document.querySelector('[data-question]')?.dataset.question==='Q002');
    await page.goto(origin+'/legacy.html');await page.locator('#view-intro').waitFor();await page.goto(origin+'/admin.html');
    assert.deepEqual(errors,[]);assert(requests.every(url=>url.startsWith(origin)||url.startsWith('data:')||url.startsWith('blob:')));
    console.log('PASS mobile fit, keyboard, legacy pages and no external requests');
    fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({passed:true,errors,requests:[...new Set(requests)]},null,2));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
