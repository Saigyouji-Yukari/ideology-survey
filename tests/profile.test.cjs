'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const D = require('../assets/omni-data.js');
const E = require('../assets/omni-engine.js');
const P = require('../assets/omni-profile.js');
const config = require('../data/tendency_profiles.json');
const result = answers => ({ facets: D.core.axes.map(a => E.facet(a, answers)) });
const group = (answers, section) => P.analyze(result(answers)).find(g => g.section === section);
function answersFor(targets) {
  const answers = {};
  for (const [id, target] of Object.entries(targets)) {
    const sum = Math.round(6 * (4 + 3 * target / 100)), base = Math.floor(sum / 6), extra = sum % 6;
    D.core.items.filter(q => q.axis === id).forEach((q, i) => {
      const v = base + (i < extra ? 1 : 0);
      answers[q.id] = q.sign === '-' ? 8 - v : v;
    });
  }
  return answers;
}

test('six transparent sections retain the existing 22-facet boundary and complete prototypes', () => {
  assert.deepEqual(P.config, config);
  assert.equal(config.sections.length, 6);
  assert.equal(config.profiles.length, 39);
  assert.equal(new Set(config.profiles.map(p => p.id)).size, config.profiles.length);
  assert.deepEqual(config.sections.flatMap(s => s.axes), D.core.axes.map(a => a.id));
  for (const section of config.sections) {
    const profiles = config.profiles.filter(p => p.section === section.section);
    assert(profiles.length >= 4);
    for (const p of profiles) {
      assert.deepEqual(Object.keys(p.targets), section.matchingAxes);
      assert(p.figures.length >= 2 && p.description && p.label);
      assert(p.sourceUrls.length && p.sourceUrls.every(url => /^https:\/\//.test(url)));
      assert(Object.values(p.targets).every(x => Number.isFinite(x) && x >= -100 && x <= 100));
      assert(Object.keys(p.anchors).every(id => section.matchingAxes.includes(id)));
      for (const [id, rule] of Object.entries(p.anchors)) {
        if (rule.min !== undefined) assert(p.targets[id] >= rule.min);
        if (rule.max !== undefined) assert(p.targets[id] <= rule.max);
      }
    }
  }
});

test('browser and CommonJS use exactly the same published rule data', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/omni-profile.js'), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.OMNI_PROFILE.config)), config);
  assert.equal(context.OMNI_PROFILE.analyze({ facets: [] }).length, 6);
});

test('all 39 authored policy combinations are reachable without manufacturing a global identity', () => {
  for (const p of config.profiles) {
    const g = group(answersFor(p.targets), p.section);
    assert.equal(g.status, 'closest', p.id);
    assert.equal(g.candidates[0].id, p.id);
    assert.equal(g.candidates.length, 1);
    assert.equal(g.candidates[0].evidence.length, Object.keys(p.targets).length);
    assert.deepEqual(g.candidates[0].sourceUrls, p.sourceUrls);
    assert.equal(g.coverage.reportable, g.coverage.required);
  }
});

test('blank, neutral, and strong opposing answers with the same zero mean stay distinct', () => {
  assert(P.analyze(result({})).every(g => g.status === 'insufficient' && g.candidates.length === 0));
  const neutral = Object.fromEntries(D.core.items.map(q => [q.id, 4]));
  const crossing = Object.fromEntries(D.core.items.map(q => [q.id, 7]));
  const n = P.analyze(result(neutral)), c = P.analyze(result(crossing));
  assert(n.every(g => g.status === 'neutral' && g.candidates.length === 0));
  assert(c.every(g => g.status === 'mixed' && g.candidates.length === 0));
  for (const g of c) assert(g.mixedFacets.length > 0);
});

test('five valid responses in every matching facet are required, not a pooled completion threshold', () => {
  const profile = config.profiles[0], a = answersFor(profile.targets);
  a.Q001 = 'U'; a.Q003 = 'X';
  const g = group(a, profile.section);
  assert.equal(g.status, 'insufficient');
  assert.equal(g.coverage.valid, 22);
  assert.equal(g.coverage.reportable, 3);
  assert.equal(g.candidates.length, 0);
  a.Q003 = 6;
  assert.notEqual(group(a, profile.section).status, 'insufficient');
});

test('a clear economic ownership conflict cannot be hidden by averaging unrelated policy support', () => {
  const g = group(answersFor({ OWN: -100, ALLOC: 100, RED: 100, LAB: 100 }), '经济制度');
  assert.equal(g.status, 'unmatched');
  assert.equal(g.candidates.length, 0);
});

test('near ties retain more than one reference type and never turn distance into probability', () => {
  const g = group(answersFor({ ECO: 85, TECH: 57 }), '生态技术与判断');
  assert.equal(g.status, 'tentative');
  assert.equal(g.sensitivity.nearTie, true);
  assert.equal(g.candidates.length, 2);
  assert.deepEqual(new Set(g.candidates.map(c => c.id)), new Set(['ecology-preservationism', 'ecology-precautionary-environmentalism']));
  for (const c of g.candidates) { assert.equal(c.probability, undefined); assert.equal(c.percentage, undefined); }
});

test('missing completions and one-option response changes are disclosed at a boundary', () => {
  const a = answersFor({ ECO: 90, TECH: 55 });
  // In oriented form these are five ratings 6,6,6,5,5 and one U.
  const tech = [6,6,6,5,5,'U'];
  D.core.items.filter(q => q.axis === 'TECH').forEach((q, i) => { a[q.id] = tech[i] === 'U' ? 'U' : q.sign === '-' ? 8 - tech[i] : tech[i]; });
  const g = group(a, '生态技术与判断');
  assert.equal(g.status, 'tentative');
  assert.equal(g.sensitivity.nearTie, false);
  assert.equal(g.sensitivity.missing, true);
  assert.equal(g.sensitivity.oneStep, true);
  assert(g.limitations.some(s => s.includes('不是统计置信区间')));
  assert.equal(g.candidates[0].relation, 'current');
  assert.equal(g.candidates[1].relation, 'conditional');
  assert(g.candidates[1].condition.includes('当前不作为同等结论'));
});

test('self-reported revisability never gates ideology, confidence, coverage eligibility, or quality', () => {
  const base = answersFor({ ECO: 90, TECH: 25 });
  const plus = group({ ...base, ...answersFor({ EVID: 100 }) }, '生态技术与判断');
  const minus = group({ ...base, ...answersFor({ EVID: -100 }) }, '生态技术与判断');
  const omitted = group(base, '生态技术与判断');
  for (const g of [plus, minus, omitted]) {
    assert.equal(g.status, 'closest');
    assert.equal(g.candidates[0].id, 'ecology-preservationism');
    assert.equal(g.coverage.reportable, 2);
    assert.equal(g.coverage.required, 2);
    assert.equal(g.candidates[0].evidence.some(e => e.id === 'EVID'), false);
  }
  assert.deepEqual(plus.candidates, minus.candidates);
  assert.deepEqual(plus.sensitivity, omitted.sensitivity);
});

test('the label does not erase internal mixed answers or relabel all force support as militarism', () => {
  const a = answersFor(config.profiles[0].targets);
  // Preserve a strongly positive mean but retain one opposite oriented answer.
  const qs = D.core.items.filter(q => q.axis === 'LAB'), oriented = [7,7,7,7,7,3];
  qs.forEach((q, i) => { a[q.id] = q.sign === '-' ? 8 - oriented[i] : oriented[i]; });
  const g = group(a, '经济制度');
  assert(g.candidates.length > 0);
  assert(g.mixedFacets.includes('LAB'));
  assert(g.limitations.some(s => s.includes('逐题分歧')));
  const international = group(answersFor({ NAT: -75, MEM: 0, INT: -70, FORCE: 75 }), '认同与国际事务');
  assert(international.candidates.length > 0);
  assert(international.limitations.some(s => s.includes('人道干预')));
  assert(international.candidates.every(c => !/军国|法西斯|种族/.test(c.label)));
});

test('analysis is read-only and malformed or absent result data fails closed', () => {
  const r = result(answersFor(config.profiles[0].targets)), before = JSON.stringify(r);
  P.analyze(r);
  assert.equal(JSON.stringify(r), before);
  assert(P.analyze(null).every(g => g.status === 'insufficient'));
  assert(P.analyze({ facets: D.core.axes.map(a => ({ ...a, valid: 6, value: Infinity, rawValue: NaN })) }).every(g => g.status === 'insufficient'));
});

test('figure reference points stay inside their type and every one of the 117 figures is reachable', () => {
  const rule = config.method.figureSelection;
  assert.deepEqual([rule.tieMargin, rule.maximumMeanOffset, rule.minimumSeparation], [3, 30, 7.5]);
  let entries = 0;
  for (const p of config.profiles) {
    const section = config.sections.find(s => s.section === p.section), axes = section.matchingAxes;
    const points = p.figures.map(f => P.figurePoint(p, f));
    p.figures.forEach((f, i) => {
      entries++;
      assert(Object.keys(f.targets).every(id => axes.includes(id) && Number.isFinite(f.targets[id]) && Math.abs(f.targets[id]) <= 100), p.id + '/' + f.personId);
      const point = points[i], mean = (a, b) => axes.reduce((n, id) => n + Math.abs(a[id] - b[id]), 0) / axes.length;
      for (const [id, r] of Object.entries(p.anchors)) {
        if (r.min !== undefined) assert(point[id] >= r.min, p.id + '/' + f.personId + ' ' + id);
        if (r.max !== undefined) assert(point[id] <= r.max, p.id + '/' + f.personId + ' ' + id);
      }
      assert(mean(point, p.targets) <= rule.maximumMeanOffset, p.id + '/' + f.personId + ' offset');
      for (let j = 0; j < i; j++) assert(mean(point, points[j]) >= rule.minimumSeparation, p.id + ': ' + f.personId + ' vs ' + p.figures[j].personId);
      const g = group(answersFor(point), p.section), top = g.candidates[0];
      assert(top && top.id === p.id, p.id + '/' + f.personId + ' reaches ' + (top && top.id));
      assert.equal(top.personId, f.personId, p.id + ' chooses ' + top.personId + ' instead of ' + f.personId);
      assert.equal(top.figure.personId, f.personId);
      assert.deepEqual(top.figures.map(x => x.distance), top.figures.map(x => x.distance).slice().sort((a, b) => a - b));
      assert.equal(top.figures.length, p.figures.length);
    });
  }
  assert.equal(entries, 117);
});

test('figures only choose whom to introduce: type results are identical without them', () => {
  const stripped = JSON.parse(JSON.stringify(config));
  for (const p of stripped.profiles) p.figures = p.figures.slice(0, 1);
  const source = fs.readFileSync(path.join(__dirname, '../assets/omni-profile.js'), 'utf8').replace(/\/\* PROFILE_DATA_START \*\/[\s\S]*?\/\* PROFILE_DATA_END \*\//, JSON.stringify(stripped));
  const context = {}; vm.runInNewContext(source, context);
  const Q = context.OMNI_PROFILE;
  let seed = 20261102;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const summary = groups => JSON.stringify(groups.map(g => [g.status, g.title.replace(/：.*/, ''), g.candidates.map(c => [c.id, c.relation, c.distance]), g.sensitivity]));
  for (let n = 0; n < 300; n++) {
    const answers = {};
    // Mix strong, moderate and missing answers so that ties, conditional candidates and boundaries all occur.
    for (const q of D.core.items) { const r = random(); answers[q.id] = r < 0.06 ? 'U' : 1 + Math.floor(random() * 7); }
    const r = result(answers);
    assert.equal(summary(P.analyze(r)), summary(Q.analyze(r)), 'sample ' + n);
  }
});

test('figure near ties are flagged rather than hidden, and figure distance is never a percentage', () => {
  const p = config.profiles.find(x => x.id === 'ecology-preservationism');
  const ranked = P.figureRanking(p, { ECO: 95, TECH: 32.5 });
  assert.deepEqual(ranked.slice(0, 2).map(f => f.personId).sort(), ['leopold', 'muir']);
  assert(ranked[0].tie && ranked[1].tie);
  assert.equal(ranked[0].distance, ranked[1].distance);
  assert.equal(ranked.find(f => f.personId === 'muir').primary, true);
  for (const f of ranked) { assert.equal(f.percentage, undefined); assert.equal(f.probability, undefined); }
  const far = P.figureRanking(p, { ECO: 100, TECH: 40 });
  assert.equal(far[0].personId, 'leopold');
  assert.deepEqual(far.filter(f => f.tie).map(f => f.personId), ['leopold']);
});
