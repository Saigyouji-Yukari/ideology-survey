'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../assets/omni-session.js');
// A small semantic fixture keeps workflow tests independent of political wording.
const D = {version:'OMNI-TEST', core:{
  items:Array.from({length:132},(_,i)=>({id:'Q'+String(i+1).padStart(3,'0')})),
  scenarios:Array.from({length:12},(_,i)=>({id:'J'+(i+1)})),
  context:Array.from({length:6},(_,i)=>({id:'Z0'+(i+1)}))},
  modules:['S','M','A','L','C','P','G','R','D'].map(id=>({id,anchors:[1,3,8,12].map(i=>id+String(i).padStart(2,'0')),items:Array.from({length:24},(_,i)=>({id:id+String(i+1).padStart(2,'0')}))})),
  cards:Array.from({length:5},(_,i)=>({id:'T'+String(i+1).padStart(3,'0'),a:'a',b:'b',contrast:'c'}))};
const START = 100000;
const EXTENDED = {...D,version:'OMNI-TEST-R2',compatibleVersions:[D.version],limits:{maxResponses:253},legacySupplement:{
  groups:[{id:'economy',name:'经济补充'},{id:'institutions',name:'制度补充'},{id:'culture',name:'文化补充'}],
  items:[{id:'L001',group:'economy'},{id:'L002',group:'institutions'},{id:'L003',group:'culture'}]}};
function fresh(stage='base'){const s=S.fresh(D,START);s.stage=stage;return s;}
function minute(n){return START+n*60000;}
function cardSession(){const s=fresh('cardSelect');S.selectCards(D,s,['T001','T002']);return s;}

test('shared stage contains 186 unique questions; largest answer path contains 250',()=>{
  const s=fresh();assert.equal(S.base(D).length,186);assert.equal(new Set(S.base(D).map(q=>q.id)).size,186);
  S.selectModules(D,s,['S','M']);assert.equal(S.plan(D,s).length,40);
  assert.ok(S.plan(D,s).every(q=>!D.modules.flatMap(m=>m.anchors).includes(q.id)));
  S.selectCards(D,s,['T001','T002','T003','T004']);assert.equal(S.plan(D,s).length,24);
  assert.equal(186+40+24,250);
});
test('module and card choice deduplicate, reject unknown IDs, and cap counts',()=>{
  const s=fresh();S.selectModules(D,s,['?', 'S','S','M','A']);assert.deepEqual(s.selectedModules,['S','M']);
  S.selectCards(D,s,['?', 'T001','T001','T002','T003','T004','T005']);assert.deepEqual(s.selectedCards,['T001','T002','T003','T004']);
});
test('empty branches proceed to next appropriate stage',()=>{
  const s=fresh('moduleSelect');S.selectModules(D,s,[]);assert.equal(s.stage,'cardSelect');S.selectCards(D,s,[]);assert.equal(s.stage,'review');
});
test('answers and next/previous have separate stable operations',()=>{
  const s=fresh();const q=S.plan(D,s)[0];S.answer(s,q,4);assert.equal(s.pos,0);S.advance(D,s);assert.equal(s.pos,1);S.advance(D,s,-1);assert.equal(s.pos,0);S.advance(D,s,-1);assert.equal(s.pos,0);assert.equal(s.answers.Q001,4);
  S.answer(s,q,7);assert.deepEqual(s.presented,['Q001']);assert.equal(s.answers.Q001,7);
});
test('end of each stage transitions without repeating anchors',()=>{
  const s=fresh();s.pos=185;S.advance(D,s);assert.equal(s.stage,'moduleSelect');assert.equal(s.pos,0);
  S.selectModules(D,s,['S']);s.pos=19;S.advance(D,s);assert.equal(s.stage,'cardSelect');
  S.selectCards(D,s,['T001']);s.pos=5;S.advance(D,s);assert.equal(s.stage,'review');
});
test('elapsed time never skips, reviews, or finishes any stage, even after days away',()=>{
  assert.equal(S.LIMIT,null);
  for(const stage of ['instructions','base','moduleSelect','modules','supplementSelect','supplements','cardSelect','cards','review','result']){
    const s=S.fresh(EXTENDED,START);s.stage=stage;
    if(stage==='modules')s.selectedModules=['S'];
    if(stage==='supplements')s.selectedSupplements=['economy'];
    if(stage==='cards')s.selectedCards=['T001'];
    if(stage==='result')s.finished=true;
    const before=JSON.stringify(s);
    for(const minutes of [75,85,91,95,96,24*60,7*24*60]){
      assert.equal(S.enforce(EXTENDED,s,minute(minutes)),false);
      assert.equal(JSON.stringify(s),before);
    }
  }
});
test('new and previously open cards remain answerable after the old time limit',()=>{
  const s=cardSession();assert.equal(S.enforce(D,s,minute(96)),false);
  S.answer(s,S.plan(D,s)[0],7);S.advance(D,s);assert.equal(s.stage,'cards');assert.equal(s.pos,1);
  s.pos=6;assert.equal(S.enforce(D,s,minute(7*24*60)),false);
  S.answer(s,S.plan(D,s)[6],6);assert.equal(s.answers['T002.a'],6);
});
test('long-duration progress validates after reload and stores its full duration at completion',()=>{
  const s=fresh();s.elapsedMs=7*24*60*60000;
  const restored=S.validate(D,JSON.parse(JSON.stringify(s)));
  assert.equal(restored.elapsedMs,s.elapsedMs);assert.equal(restored.stage,'base');
  S.answer(restored,{id:'Q001'},6);S.finish(restored,'自行结束',minute(8*24*60));
  assert.equal(restored.elapsedMs,8*24*60*60000);assert.equal(S.elapsed(restored,minute(9*24*60)),8*24*60*60000);
  assert.doesNotThrow(()=>S.validate(D,restored));
});
test('wall clock elapsed cannot go backwards and completed reports stop the clock',()=>{
  const s=fresh();s.elapsedMs=600000;assert.equal(S.elapsed(s,START+300000),600000);assert.equal(S.elapsed(s,minute(20)),1200000);
  S.finish(s,'自行结束',minute(20));assert.equal(S.elapsed(s,minute(90)),1200000);
  const before=JSON.stringify(s);S.answer(s,{id:'Q001'},7);S.advance(D,s);S.selectCards(D,s,['T001']);S.selectModules(D,s,['S']);assert.equal(JSON.stringify(s),before);
});
test('neutral, unknown, refusal, and valid metadata zero stay distinct',()=>{
  const s=fresh();for(const [id,value] of [['Q001',4],['Q002','U'],['Q003','×'],['Z01',0],['Z02',0],['Z03',0]])S.answer(s,{id},value);
  assert.deepEqual(s.answers,{Q001:4,Q002:'U',Q003:'X',Z01:0,Z02:0,Z03:0});assert.throws(()=>S.answer(s,{id:'Q004'},0));assert.throws(()=>S.answer(s,{id:'Z02'},3));
});
test('card label reveal preserves original answers and marks subsequent edits',()=>{
  const s=cardSession(),qs=S.plan(D,s);for(let i=0;i<3;i++)S.answer(s,qs[i],[7,5,'U'][i]);
  assert.deepEqual(s.cardRevealed,[]);S.present(s,qs[3]);assert.deepEqual(s.cardRevealed,['T001']);assert.deepEqual(s.originalBlindAnswers,{'T001.a':7,'T001.b':5,'T001.c':'U'});
  S.answer(s,qs[0],1);S.answer(s,qs[0],6);S.answer(s,qs[1],5);assert.deepEqual(s.unblindedEdits,['T001.a']);assert.equal(s.originalBlindAnswers['T001.a'],7);assert.equal(s.answers['T001.a'],6);
  S.answer(s,qs[3],0);S.answer(s,qs[4],0);assert.equal(s.answers['T001.K'],0);assert.equal(s.answers['T001.I'],0);
});
test('valid saved progress roundtrips without mutating caller arrays or answer maps',()=>{
  const s=fresh();S.answer(s,{id:'Q001'},4);const imported=S.validate(D,JSON.parse(JSON.stringify(s)));assert.deepEqual(imported,s);imported.answers.Q001=7;imported.presented.push('Q002');assert.equal(s.answers.Q001,4);assert.deepEqual(s.presented,['Q001']);
});
test('validation rejects incompatible answers, IDs, times, branch counts, and stage state',()=>{
  const cases=[
    s=>s.version='old',s=>s.elapsedMs=-1,s=>s.elapsedMs=Infinity,s=>s.elapsedMs=NaN,s=>s.startedAt=-1,s=>s.startedAt=Infinity,s=>s.startedAt=Date.now()+3600000,
    s=>s.pos=186,s=>s.pos=-1,s=>s.stage='unknown',s=>s.stage='result',s=>s.finished=true,
    s=>s.selectedModules=['S','M','A'],s=>s.selectedModules=['S','S'],s=>s.selectedCards=['T001','T002','T003','T004','T005'],s=>s.selectedCards=['unknown'],
    s=>s.selectedSupplements=['unknown'],s=>s.selectedSupplements='economy',s=>s.sourceVersion='unsupported',
    s=>s.presented=['Q001','Q001'],s=>s.presented=['Q999'],s=>s.answers={Q001:7},
    s=>{s.presented=['Q001'];s.answers={Q001:0};},s=>{s.presented=['Q001'];s.answers={Q001:'7'};},
    s=>{s.presented=['Z02'];s.answers={Z02:3};},s=>{s.presented=['Z04'];s.answers={Z04:4};},
    s=>s.cardRevealed=['unknown'],s=>s.unblindedEdits=['Q001'],s=>s.originalBlindAnswers={'Q001':7},
    s=>{s.stage='modules';s.selectedModules=[];}
  ];for(const mutate of cases){const s=fresh();mutate(s);assert.throws(()=>S.validate(D,s));}
});
test('optional legacy groups fit between selected modules and cards without a group cap',()=>{
  const s=S.fresh(EXTENDED,START);s.stage='moduleSelect';
  S.selectModules(EXTENDED,s,[]);assert.equal(s.stage,'supplementSelect');
  S.selectSupplements(EXTENDED,s,['unknown','economy','economy','institutions','culture']);
  assert.deepEqual(s.selectedSupplements,['economy','institutions','culture']);
  assert.equal(s.stage,'supplements');assert.deepEqual(S.plan(EXTENDED,s).map(q=>q.id),['L001','L002','L003']);
  S.answer(s,S.plan(EXTENDED,s)[0],7);S.advance(EXTENDED,s);assert.equal(s.pos,1);
  S.advance(EXTENDED,s,-1);assert.equal(s.pos,0);
  s.reviewReturn={stage:'supplements',pos:2};assert.doesNotThrow(()=>S.validate(EXTENDED,s));
  s.pos=2;S.advance(EXTENDED,s);assert.equal(s.stage,'cardSelect');assert.equal(s.pos,0);
  const skipped=S.fresh(EXTENDED,START);S.selectSupplements(EXTENDED,skipped,[]);assert.equal(skipped.stage,'cardSelect');
  const modules=S.fresh(EXTENDED,START);S.selectModules(EXTENDED,modules,['S']);modules.pos=19;S.advance(EXTENDED,modules);assert.equal(modules.stage,'supplementSelect');
});
test('supplement validation restricts answers to selected groups and honors the data response cap',()=>{
  const s=S.fresh(EXTENDED,START);S.selectModules(EXTENDED,s,['S','M']);S.selectSupplements(EXTENDED,s,['economy','institutions','culture']);S.selectCards(EXTENDED,s,['T001','T002','T003','T004']);
  for(const stage of ['base','modules','supplements','cards'])for(const q of S.plan(EXTENDED,s,stage))S.present(s,q);
  assert.equal(s.presented.length,253);assert.doesNotThrow(()=>S.validate(EXTENDED,s));
  const capped={...EXTENDED,limits:{maxResponses:252}};assert.throws(()=>S.validate(capped,s));
  const derived={...EXTENDED};delete derived.limits;assert.doesNotThrow(()=>S.validate(derived,s));
  const unknown=JSON.parse(JSON.stringify(s));unknown.selectedSupplements=['economy'];assert.throws(()=>S.validate(EXTENDED,unknown));
  const duplicate=JSON.parse(JSON.stringify(s));duplicate.selectedSupplements=['economy','economy'];assert.throws(()=>S.validate(EXTENDED,duplicate));
  const finished=JSON.parse(JSON.stringify(s));S.finish(finished,'完成',minute(200));const before=JSON.stringify(finished);S.selectSupplements(EXTENDED,finished,[]);assert.equal(JSON.stringify(finished),before);
});
test('compatible older progress upgrades without inventing supplement answers or erasing its history',()=>{
  const old=fresh();S.answer(old,{id:'Q001'},6);delete old.selectedSupplements;
  const upgraded=S.validate(EXTENDED,old);assert.equal(upgraded.version,EXTENDED.version);assert.equal(upgraded.sourceVersion,D.version);assert.deepEqual(upgraded.selectedSupplements,[]);assert.equal(upgraded.answers.Q001,6);
  assert.equal(old.version,D.version);assert.equal(old.selectedSupplements,undefined);assert.deepEqual(S.validate(EXTENDED,upgraded),upgraded);
  S.finish(old,'95分钟截止',minute(95));const oldResult=S.validate(EXTENDED,old);assert.equal(oldResult.finished,true);assert.equal(oldResult.stage,'result');assert.equal(oldResult.stopReason,'95分钟截止');assert.equal(oldResult.elapsedMs,95*60000);
  const unrelated={...old,version:'unrelated'};assert.throws(()=>S.validate(EXTENDED,unrelated));
});
test('validation accepts completed partial sessions and rejects forged claim originals',()=>{
  const s=fresh();S.answer(s,{id:'Q001'},'U');S.finish(s,'部分完成',minute(2));assert.equal(S.validate(D,s).stage,'result');
  const c=cardSession();S.answer(c,S.plan(D,c)[0],7);S.present(c,S.plan(D,c)[3]);assert.doesNotThrow(()=>S.validate(D,c));c.originalBlindAnswers['T001.b']=7;assert.throws(()=>S.validate(D,c));
});
