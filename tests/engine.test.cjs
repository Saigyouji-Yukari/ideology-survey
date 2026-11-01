'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../assets/omni-data.js');
const E = require('../assets/omni-engine.js');
const S = require('../assets/omni-session.js');

const ownAnswers = values => Object.fromEntries(values.map((v, i) => ['Q' + String(i + 1).padStart(3, '0'), v]));
const session = (answers = {}, extra = {}) => ({ ...S.fresh(D), answers, presented: Object.keys(answers), ...extra });
const cardAnswers = (values, extra = {}) => ({ 'T001.a': values[0], 'T001.b': values[1], 'T001.c': values[2], ...extra });

test('published bank retains complete structure, unique IDs and valid references', () => {
  assert.equal(D.cards.length, 358);
  assert.equal(D.modules.length, 9);
  assert.equal(D.core.axes.length, 22);
  assert.equal(D.core.items.length, 132);
  assert.equal(D.core.scenarios.length, 12);
  assert.equal(D.core.context.length, 6);
  assert.equal(D.sources.length, 82);
  const ids = new Set(D.core.items.map(q => q.id));
  for (const m of D.modules) {
    assert.equal(m.items.length, 24);
    assert.equal(m.anchors.length, 4);
    assert.equal(new Set(m.anchors).size, 4);
    for (const a of m.anchors) assert(m.items.some(q => q.id === a));
    for (const q of m.items) { assert(!ids.has(q.id)); ids.add(q.id); }
  }
  const cardIds = new Set(D.cards.map(c => c.id));
  assert.equal(cardIds.size, D.cards.length);
  for (const c of D.cards) {
    assert.equal(c.keys.length, 4);
    for (const k of c.keys) { assert(ids.has(k.slice(0, -1)), c.id + ':' + k); assert(['+', '-'].includes(k.slice(-1))); }
    for (const near of D.nearCardMap[c.id]) assert(cardIds.has(near));
    for (const ref of c.sources) assert(D.sources.some(s => s.id === ref));
  }
  for (const a of D.core.axes) {
    const items = D.core.items.filter(q => q.axis === a.id);
    assert.equal(items.length, 6); assert.equal(items.filter(q => q.sign === '+').length, 3);
    assert.deepEqual(items.filter(q => q.sign === '+').map(q => q.id), a.positive_ids);
    assert.deepEqual(items.filter(q => q.sign === '-').map(q => q.id), a.negative_ids);
  }
});

test('facet reverses negative items and complete endpoints stay exact', () => {
  const positive = E.facet('OWN', ownAnswers([7, 1, 7, 1, 7, 1]));
  assert.equal(positive.value, 100); assert.equal(positive.mean, 7); assert.deepEqual(positive.bounds, [100, 100]);
  const negative = E.facet('OWN', ownAnswers([1, 7, 1, 7, 1, 7]));
  assert.equal(negative.value, -100); assert.deepEqual(negative.bounds, [-100, -100]);
});

test('neutral and strong crossing can have same mean while remaining distinguishable', () => {
  const neutral = E.facet('OWN', ownAnswers([4, 4, 4, 4, 4, 4]));
  const mixed = E.facet('OWN', ownAnswers([7, 7, 7, 7, 7, 7]));
  assert.equal(neutral.value, 0); assert.equal(mixed.value, 0);
  assert.equal(neutral.pattern, 'neutral'); assert.equal(mixed.pattern, 'mixed');
});

test('five answers permit point; four do not; bounds retain missing uncertainty', () => {
  const five = E.facet('OWN', ownAnswers([7, 1, 7, 1, 7, 'U']));
  assert.equal(five.valid, 5); assert.equal(five.value, 100); assert.deepEqual(five.bounds, [67, 100]);
  const four = E.facet('OWN', ownAnswers([7, 1, 7, 1, 'X', 'U']));
  assert.equal(four.valid, 4); assert.equal(four.value, null); assert.deepEqual(four.bounds, [33, 100]);
  const none = E.facet('OWN', {});
  assert.equal(none.mean, null); assert.equal(none.value, null); assert.deepEqual(none.bounds, [-100, 100]);
});

test('invalid numeric values never enter stance means', () => {
  for (const value of [0, 8, 2.5, '7', NaN, Infinity, null, undefined]) assert.equal(E.validRating(value), false);
  assert.equal(E.facet('OWN', ownAnswers([0, '7', 8, 2.5, 'U', 'X'])).valid, 0);
});

test('card conflicts cannot be averaged away; partial and unknown remain explicit', () => {
  const conflicting = E.card('T001', cardAnswers([7, 7, 1]));
  assert.equal(conflicting.statusCode, 'partial'); assert.equal(conflicting.conflicts[0].key, 'c');
  const unknown = E.card('T001', cardAnswers([7, 1, 'U']));
  assert.equal(unknown.statusCode, 'insufficient'); assert.equal(unknown.conflicts.length, 1); assert.equal(unknown.missing.length, 1);
  const supported = E.card('T001', cardAnswers([5, 5, 5]));
  assert.equal(supported.statusCode, 'supported'); assert.equal(supported.strongSupport, false); assert.equal(supported.sensitive, true);
  assert.equal(E.card('T001', cardAnswers([6, 6, 5])).strongSupport, true);
});

test('unpresented cards and merely displayed unanswered cards are untested', () => {
  assert.equal(E.card('T001', cardAnswers([7, 7, 7]), []).statusCode, 'untested');
  assert.equal(E.card('T001', {}, ['T001.a']).statusCode, 'untested');
  assert.equal(E.card('T001', { 'T001.a': 'U' }, ['T001.a']).statusCode, 'insufficient');
});

test('metadata zero remains meaningful, never counted as stance or identity confirmation', () => {
  const answers = cardAnswers([7, 7, 7], { 'T001.K': 0, 'T001.I': 0, Z01: 0, Z02: 0, Z03: 0 });
  const result = E.analyze(session(answers, { selectedCards: ['T001'] }));
  assert.equal(result.cards[0].familiarity, 0); assert.equal(result.cards[0].identity, 0);
  assert.equal(result.quality.presented, 3); assert.equal(result.quality.valid, 3);
  assert(result.cards[0].identityNote.includes('不认同'));
  const historical = D.cards.find(c => c.kind === '历史路线');
  const a = Object.fromEntries(['a', 'b', 'c'].map(k => [historical.id + '.' + k, 7]));
  a[historical.id + '.K'] = 3; a[historical.id + '.I'] = 3;
  assert(E.card(historical, a).identityNote.includes('不自动确认'));
});

test('scenario directional cancellation retains absolute differences and minimum four pairs', () => {
  const answers = {};
  [3, -3, 3, -3].forEach((d, i) => { const id = 'J0' + (i + 1); answers[id + 'A'] = d > 0 ? 7 : 4; answers[id + 'B'] = d > 0 ? 4 : 7; });
  const result = E.scenario(answers);
  assert.equal(result.complete, 4); assert.equal(result.meanDifference, 0); assert.equal(result.meanAbsoluteDifference, 3);
  delete answers.J04B;
  const partial = E.scenario(answers);
  assert.equal(partial.complete, 3); assert.equal(partial.meanDifference, null); assert.equal(partial.pairs[0].difference, 3);
});

test('coverage and quality use actual presentation, preserving U/refusal/missing separately', () => {
  const result = E.analyze(session({ Q001: 7, Q002: 'U', Q003: 'X', Q005: 4 }, { presented: ['Q001', 'Q002', 'Q003', 'Q004', 'Q005'], selectedCards: ['T001'] }));
  assert.equal(result.quality.presented, 5); assert.equal(result.quality.valid, 2);
  assert.equal(result.quality.unknown, 1); assert.equal(result.quality.refused, 1); assert.equal(result.quality.missing, 1); assert.equal(result.quality.neutral, 1);
  assert.equal(result.quality.rates.unknown, 0.2);
  assert.equal(result.coverage.core.valid, 2); assert.equal(result.coverage.untestedCards.length, 358);
  assert.equal(result.cards[0].statusCode, 'untested');
});

test('candidate routing never invents missing support or removes all alternatives', () => {
  const empty = E.recommendCards({}, ['S']);
  assert(empty.length >= 22); assert(empty.every(c => c.referenceMean === null));
  const c = empty[0], answers = {};
  c.keys.slice(0, 3).forEach(k => { answers[k.slice(0, -1)] = k.endsWith('+') ? 7 : 1; });
  const routed = E.recommendCards(answers, ['S']).find(q => q.id === c.id);
  assert.equal(routed.referenceValid, 3); assert.equal(routed.referenceMean, 7); assert.equal(routed.referenceIncomplete, true);
  assert.equal(E.recommendModules({}).length, 9);
  assert.equal(E.recommendModules({}).filter(m => m.recommended).length, 0);
});

test('reference opposition is retained as clarification, never automatic veto', () => {
  const c = D.cards[0], answers = cardAnswers([7, 7, 7]);
  const key = c.keys[0]; answers[key.slice(0, -1)] = key.endsWith('+') ? 1 : 7;
  const result = E.card(c, answers);
  assert.equal(result.statusCode, 'supported'); assert.equal(result.crossQuestionConflicts.length, 1);
});

test('exports round-trip Unicode and preserve disclosure history; version attacks reject', () => {
  const original = session({ Z04: '社会民主主义，与生态社会主义结合。', Z01: 0 });
  const encoded = E.encodeSession(original);
  assert(encoded.startsWith('OMNI1.'));
  assert.deepEqual(E.decodeSession(encoded).answers, original.answers);
  assert.deepEqual(E.decodeSession(JSON.stringify(original)).answers, original.answers);
  assert.throws(() => E.decodeSession(JSON.stringify({ ...original, version: 'legacy' })));
  assert.throws(() => E.decodeSession('OMNI1.%%%%'));
  assert.throws(() => E.analyze(session({ Q001: 7 }, { presented: [] })));
});


test('legacy supplement has audited sources, unique IDs, and valid optional group references', () => {
  const bank=D.legacySupplement, ids=new Set(D.core.items.concat(...D.modules.map(m=>m.items)).map(q=>q.id));
  assert.equal(bank.groups.length,6);assert.equal(bank.items.length,57);assert.equal(D.limits.minutes,null);
  assert.equal(D.limits.maxResponses,250+bank.items.length);
  for(const group of bank.groups){assert.equal(group.scored,false);assert(bank.items.some(q=>q.group===group.id));}
  for(const q of bank.items){assert(!ids.has(q.id));ids.add(q.id);assert(/^L\d{3}$/.test(q.id));assert(bank.groups.some(g=>g.id===q.group));assert(Number.isInteger(q.sourceQuestion)&&q.sourceQuestion>=1&&q.sourceQuestion<=267);assert(['value','prediction','historical'].includes(q.kind));assert(q.originalText&&q.revisionNote);}
});

test('supplement reports distinguish support, unknown, refusal, missing, and unpresented without altering original scores',()=>{
  const group=D.legacySupplement.groups[0], rows=D.legacySupplement.items.filter(q=>q.group===group.id);
  assert(rows.length>=6);
  const answers=ownAnswers([7,1,7,1,7,1]);
  [7,1,4,'U','X'].forEach((v,i)=>answers[rows[i].id]=v);
  const original=E.facet('OWN',answers);
  const s=session(answers,{selectedSupplements:[group.id],presented:[...Object.keys(answers),rows[5].id]});
  const r=E.analyze(s), g=r.supplements.find(g=>g.id===group.id);
  assert.deepEqual(r.facets[0],original);assert.equal(g.counts.support,1);assert.equal(g.counts.oppose,1);assert.equal(g.counts.neutral,1);assert.equal(g.counts.unknown,1);assert.equal(g.counts.refused,1);assert.equal(g.counts.missing,1);assert.equal(g.counts.unpresented,rows.length-6);
  assert.equal(g.valid,3);assert.equal(g.value,undefined);assert.equal(r.coverage.supplements.valid,3);assert.equal(r.quality.presented,12);assert.equal(r.coverage.testedCardCount,0);
});

test('supplements never change core values, candidate routing, or card claims and cannot import unselected responses',()=>{
  const before=cardAnswers([6,6,6]);const after={...before,...Object.fromEntries(D.legacySupplement.items.map(q=>[q.id,7]))};
  assert.deepEqual(E.card('T001',before),E.card('T001',after));
  assert.deepEqual(E.recommendCards(before,['S']),E.recommendCards(after,['S']));
  assert.deepEqual(E.facet('OWN',before),E.facet('OWN',after));
  const bad=session({[D.legacySupplement.items[0].id]:7});assert.throws(()=>E.analyze(bad));
});
