const test=require('node:test'), assert=require('node:assert/strict');
global.OMNI_DATA=require('../assets/omni-data.js');global.OMNI_ENGINE=require('../assets/omni-engine.js');
const S=require('../assets/omni-session.js');require('../assets/omni-report.js');
test('reports distinguish unpresented from missing and escape free text',()=>{
 const s=S.fresh(OMNI_DATA);s.presented=['Q001','Z01','Z02','Z03','Z04'];s.answers={Z01:3,Z02:'X',Z03:0,Z04:'<img src=x onerror=alert(1)>'};S.finish(s,'test');
 const h=OMNI_REPORT.render(s);assert(h.includes('&lt;img src=x'));assert(!h.includes('<img src=x'));
 assert(h.includes('0 · 尚未形成'));assert(h.includes('3 · 非常担心'));assert(!h.includes('影响了作答'));
 assert(h.includes('未呈现'));assert(h.includes('漏答'));assert(h.includes('358 张未检验'));
});
test('early finish at a nonzero question is a valid exportable report',()=>{
 const s=S.fresh(OMNI_DATA);s.stage='base';s.pos=12;S.finish(s,'early');assert.equal(s.pos,0);assert.doesNotThrow(()=>OMNI_ENGINE.encodeSession(s));
});
test('import rejects responses outside selected branches and invalid review paths',()=>{
 const s=S.fresh(OMNI_DATA);s.answers={'T002.a':6};s.presented=['T002.a'];assert.throws(()=>S.validate(OMNI_DATA,s));
 const t=S.fresh(OMNI_DATA);t.reviewReturn={stage:'result',pos:0};assert.throws(()=>S.validate(OMNI_DATA,t));
});
