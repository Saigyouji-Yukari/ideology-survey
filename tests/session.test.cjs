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
test('75 minute deadline stops base/module stages, retaining missing answers',()=>{
  for(const stage of ['instructions','base','moduleSelect','modules']){
    const s=fresh(stage);if(stage==='modules')s.selectedModules=['S'];
    assert.equal(S.enforce(D,s,minute(74.999)),false);assert.equal(S.enforce(D,s,minute(75)),true);assert.equal(s.stage,'cardSelect');assert.deepEqual(s.answers,{});
  }
});
test('85 minute deadline prevents new cards but allows finishing an open card',()=>{
  const s=cardSession();S.enforce(D,s,minute(85));assert.equal(s.stage,'review');
  const open=cardSession();S.present(open,S.plan(D,open)[0]);S.enforce(D,open,minute(85));assert.equal(open.stage,'cards');
  open.pos=1;S.enforce(D,open,minute(86));assert.equal(open.stage,'cards');
  open.pos=6;S.enforce(D,open,minute(86));assert.equal(open.stage,'review');
  const select=fresh('cardSelect');S.enforce(D,select,minute(85));assert.equal(select.stage,'review');
});
test('91 minute deadline moves unfinished stages to review',()=>{
  for(const stage of ['instructions','base','moduleSelect','modules','cardSelect','cards']){
    const s=fresh(stage);if(stage==='modules')s.selectedModules=['S'];if(stage==='cards')s.selectedCards=['T001'];
    S.enforce(D,s,minute(91));assert.equal(s.stage,'review');assert.equal(s.finished,false);
  }
});
test('95 minute hard deadline finishes even a reloaded or backgrounded session',()=>{
  for(const stage of ['instructions','base','moduleSelect','modules','cardSelect','cards','review']){
    const s=fresh(stage);S.enforce(D,s,minute(96));assert.equal(s.finished,true);assert.equal(s.stage,'result');assert.equal(s.elapsedMs,S.LIMIT);
  }
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
    s=>s.version='old',s=>s.elapsedMs=-1,s=>s.elapsedMs=S.LIMIT+1,s=>s.startedAt=-1,s=>s.startedAt=Date.now()+3600000,
    s=>s.pos=186,s=>s.pos=-1,s=>s.stage='unknown',s=>s.stage='result',s=>s.finished=true,
    s=>s.selectedModules=['S','M','A'],s=>s.selectedModules=['S','S'],s=>s.selectedCards=['T001','T002','T003','T004','T005'],s=>s.selectedCards=['unknown'],
    s=>s.presented=['Q001','Q001'],s=>s.presented=['Q999'],s=>s.answers={Q001:7},
    s=>{s.presented=['Q001'];s.answers={Q001:0};},s=>{s.presented=['Q001'];s.answers={Q001:'7'};},
    s=>{s.presented=['Z02'];s.answers={Z02:3};},s=>{s.presented=['Z04'];s.answers={Z04:4};},
    s=>s.cardRevealed=['unknown'],s=>s.unblindedEdits=['Q001'],s=>s.originalBlindAnswers={'Q001':7},
    s=>{s.stage='modules';s.selectedModules=[];}
  ];for(const mutate of cases){const s=fresh();mutate(s);assert.throws(()=>S.validate(D,s));}
});
test('validation accepts completed partial sessions and rejects forged claim originals',()=>{
  const s=fresh();S.answer(s,{id:'Q001'},'U');S.finish(s,'部分完成',minute(2));assert.equal(S.validate(D,s).stage,'result');
  const c=cardSession();S.answer(c,S.plan(D,c)[0],7);S.present(c,S.plan(D,c)[3]);assert.doesNotThrow(()=>S.validate(D,c));c.originalBlindAnswers['T001.b']=7;assert.throws(()=>S.validate(D,c));
});
