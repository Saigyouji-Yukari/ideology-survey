/* Report charts redraw existing scores; these checks keep them consistent with the scoring rules. */
const test = require('node:test'), assert = require('node:assert/strict');
global.OMNI_DATA = require('../assets/omni-data.js');
global.OMNI_ENGINE = require('../assets/omni-engine.js');
global.OMNI_CHARTS = require('../assets/omni-charts.js');
const S = require('../assets/omni-session.js'); require('../assets/omni-report.js');
const C = OMNI_CHARTS, D = OMNI_DATA, E = OMNI_ENGINE;

function session(fill) {
  const s = S.fresh(D); s.stage = 'base';
  for (const q of S.plan(D, s, 'base')) { const v = fill(q); if (v !== undefined) S.answer(s, q, v); }
  S.finish(s, 'test');
  return s;
}

test('every facet pole has its own icon', () => {
  for (const a of D.core.axes) { assert(C.ICONS[a.id + '-'], a.id + '-'); assert(C.ICONS[a.id + '+'], a.id + '+'); }
  assert.equal(new Set(Object.values(C.ICONS)).size, Object.keys(C.ICONS).length);
});

test('answer shares add to 100 and reproduce the facet value and the missing-answer bounds', () => {
  let seed = 3; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let n = 0; n < 150; n++) {
    const s = session(q => /^Q/.test(q.id) ? (rnd() < .2 ? ['U', 'X', ''][Math.floor(rnd() * 3)] : 1 + Math.floor(rnd() * 7)) : undefined);
    for (const f of E.analyze(s).facets) {
      const { raw, pct } = C.shares(f);
      assert.equal(pct.neg + pct.neu + pct.mis + pct.pos, 100);
      assert(Math.abs(100 * (raw.pos - raw.neg - raw.mis) - f.rawBounds[0]) < 1e-9);
      assert(Math.abs(100 * (raw.pos - raw.neg + raw.mis) - f.rawBounds[1]) < 1e-9);
      if (f.rawValue !== null) assert(Math.abs(100 * (raw.pos - raw.neg) * 6 / f.valid - f.rawValue) < 1e-9);
    }
  }
});

test('prominent tendencies need |score| >= 34 and a direction that missing answers cannot reverse', () => {
  const facets = [{ id: 'OWN', value: 40, bounds: [10, 60] }, { id: 'RED', value: 40, bounds: [-5, 70] }, { id: 'CIV', value: 30, bounds: [30, 30] }, { id: 'DEM', value: -50, bounds: [-70, -20] }, { id: 'ORG', value: null, bounds: [-100, 100] }];
  assert.deepEqual(C.marked(facets).map(f => f.id), ['DEM', 'OWN']);
});

test('the report gains the requested charts while the scored text stays the same', () => {
  const s = session(q => /^Q/.test(q.id) ? 6 : undefined), h = OMNI_REPORT.render(s);
  for (const part of ['立场图谱', '三维罗盘', '各维度方向一览', '22 个分面雷达图', '雷达图与逐题得分', '总结：作答倾向图', '作答倾向总览']) assert(h.includes(part), part);
  assert.equal((h.match(/class="report-axis"/g) || []).length, 22);
  assert.equal((h.match(/class="vz-theme-block"/g) || []).length, 6);
  assert(!/NaN|undefined|Infinity/.test(h));
  assert(h.indexOf('立场图谱') < h.indexOf('本次覆盖了什么'));
  assert(h.indexOf('总结：作答倾向图') < h.indexOf('作答条件与完整性'));
});

test('the closing figure lists tendencies, never ideology names, in the wide and phone layouts', () => {
  const s = session(q => /^Q/.test(q.id) ? (q.sign === '+' ? 7 : 1) : undefined);
  const model = C.summaryModel(E.analyze(s), { id: s.id });
  for (const compact of [false, true]) {
    const svg = C.summarySVG(model, compact);
    assert.equal((svg.match(/class="vz-s-row"/g) || []).length, 22);
    assert.equal((svg.match(/class="vz-badge"/g) || []).length, 6);
    for (const card of D.cards) assert(!svg.includes('>' + card.name + '<'), card.name);
  }
});

test('the compass draws only the possible range when an axis has no score', () => {
  const s = session(q => /^Q/.test(q.id) && q.axis !== 'CULT' ? 5 : undefined);
  const svg = C.compassSVG(C.compassModel(E.analyze(s)));
  assert(svg.includes('只显示缺答可能范围'));
  assert(!svg.includes('class="vz-point"'));
  const full = C.compassSVG(C.compassModel(E.analyze(session(q => /^Q/.test(q.id) ? 5 : undefined))));
  assert(full.includes('class="vz-point"'));
});

test('charts keep their colours when the stylesheet is missing (pasted copies, PDF converters)', () => {
  const s = session(q => /^Q/.test(q.id) ? (q.id < 'Q050' ? 'U' : 6) : undefined), h = OMNI_REPORT.render(s);
  // Unstyled SVG paints shapes black; every drawn SVG element must carry its own fill or stroke.
  const bare = [...h.matchAll(/<(rect|circle|line|polygon|path) class="([^"]+)"([^>]*)>/g)].filter(m => !/ (fill|stroke)="/.test(m[3])).map(m => m[2]);
  assert.deepEqual([...new Set(bare)], []);
  const unboxed = [...h.matchAll(/<span class="(vz-bar [a-z]+|vz-range[a-z ]*|vz-seg r\d|vz-dot-h [a-z]+)"( style="([^"]*)")?/g)].filter(m => !/position:absolute/.test(m[3] || '')).map(m => m[1]);
  assert.deepEqual([...new Set(unboxed)], []);
  assert(!/ fill="[^"]*"[^<>]* fill="/.test(h), 'no duplicated presentation attributes');
});

test('chart labels are escaped', () => {
  const f = { id: 'X', name: '<img src=x onerror=alert(1)>', negative: '"a"', positive: "'b'", section: 'S', value: 10, mean: 4.3, valid: 6, bounds: [10, 10], items: [] };
  const h = C.overview({ facets: [f] });
  assert(!h.includes('<img src=x')); assert(h.includes('&lt;img'));
});
