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


test('supplement report includes current claims, separate statuses and item types without a pooled score',()=>{
 const q=OMNI_DATA.legacySupplement.items[0],s=S.fresh(OMNI_DATA);s.selectedSupplements=[q.group];s.presented=[q.id];s.answers={[q.id]:'U'};S.finish(s,'test');
 const h=OMNI_REPORT.render(s);assert(h.includes('补充议题画像'));assert(h.includes(q.id));assert(h.includes(OMNI_REPORT.escape(q.text)));assert(h.includes('价值主张')); assert(h.includes('不了解 1'));assert(h.includes('不计算跨题政治总分'));assert.equal((h.match(/class="report-axis"/g)||[]).length,22);
});

test('old OMNI report migration preserves its history and does not fabricate supplement responses',()=>{
 const s=S.fresh(OMNI_DATA);s.version=OMNI_DATA.compatibleVersions[0];delete s.selectedSupplements;s.finished=true;s.stage='result';s.stopReason='95分钟截止';s.elapsedMs=95*60000;
 const h=OMNI_REPORT.render(s);assert(h.includes('95分钟截止'));assert(h.includes('本答卷已完成格式兼容处理'));assert(!h.includes(s.version));assert(h.includes('当前题库中尚未作答的题目不会自动填答'));assert(h.includes('本次未选择本组'));
});
