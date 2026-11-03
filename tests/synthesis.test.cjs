'use strict';
/* 综合报告分析：规则完整性、全部得分情况的稳健性与示例答卷回归。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const D = require('../assets/omni-data.js');
global.OMNI_DATA = D;
const E = require('../assets/omni-engine.js');
const S = require('../assets/omni-session.js');
const P = require('../assets/omni-profile.js');
const people = require('../assets/omni-people.js');
const SYN = require('../assets/omni-synthesis.js');
Object.assign(global, { OMNI_ENGINE: E, OMNI_PROFILE: P, OMNI_PEOPLE: people, OMNI_SYNTHESIS: SYN });
require('../assets/omni-report.js');

const { B0, B1 } = SYN.markers;
const VERBS = ['', '强烈不同意', '不同意', '略不同意', '中立', '略同意', '同意', '强烈同意'];
const CN = ['一', '二', '三', '四', '五', '六', '七', '八'];
const { build, FIXTURES, anchors, CORE } = require('./synthesis-fixtures.cjs');
function analyze(s) {
  const result = E.analyze(s);
  return SYN.analyze(result, s, { profile: P.analyze(result), people });
}
const allTexts = syn => SYN.texts(syn);
function assertClean(syn, label) {
  for (const text of allTexts(syn)) {
    assert(!/undefined|NaN|Infinity|\[object|null/.test(text), label + ': ' + text);
    const open = text.split(B0).length - 1, close = text.split(B1).length - 1;
    assert.equal(open, close, label + ' unbalanced bold: ' + text);
    let depth = 0;
    for (const ch of text) { if (ch === B0) depth++; if (ch === B1) depth--; assert(depth === 0 || depth === 1, label + ' nested bold'); }
  }
}

test('every module and supplement item belongs to exactly one section and rules reference real items', () => {
  const moduleAndSupplement = [...D.modules.flatMap(m => m.items.map(q => q.id)), ...D.legacySupplement.items.map(q => q.id)];
  const listed = Object.values(SYN.SECTION_ITEMS).flatMap(ids => ids.split(' '));
  assert.equal(new Set(listed).size, listed.length, 'no item is listed twice');
  assert.deepEqual([...listed].sort(), [...moduleAndSupplement].sort());
  for (const q of D.core.items) assert(SYN.SECTIONS.find(s => s.id === SYN.ITEM_SECTION[q.id]).facets.includes(q.axis), q.id);
  assert.deepEqual(SYN.SECTIONS.flatMap(s => s.facets).sort(), D.core.axes.map(a => a.id).sort());
  const ids = SYN.RULES.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);
  const known = new Set([...Object.keys(CORE), ...moduleAndSupplement]);
  const leaves = (c, out = []) => { if (c.all) c.all.forEach(x => leaves(x, out)); else if (c.any) c.any.forEach(x => leaves(x, out)); else if (c.of) c.of.forEach(x => leaves(x, out)); else if (c.not) leaves(c.not, out); else out.push(c); return out; };
  for (const rule of SYN.RULES) {
    assert(SYN.SECTIONS.some(s => s.id === rule.section), rule.id);
    assert(['tension', 'exception', 'pattern'].includes(rule.kind) && [1, 2, 3].includes(rule.severity), rule.id);
    assert(rule.short && rule.text && !/[\u0001\u0002]/.test(rule.short + rule.text + (rule.reading || '')), rule.id);
    for (const id of rule.suppress || []) assert(SYN.RULE_BY_ID[id] && id !== rule.id, rule.id + ' suppresses ' + id);
    for (const leaf of leaves(rule.when)) {
      if (leaf.i) assert(known.has(leaf.i) && ['agree', 'strongAgree', 'disagree', 'strongDisagree', 'neutral', 'notAgree', 'notDisagree', 'undecided'].includes(leaf.a), rule.id + ' ' + leaf.i);
      else assert(D.core.axes.some(a => a.id === leaf.f), rule.id + ' ' + JSON.stringify(leaf));
    }
  }
  for (const [id, f] of Object.entries(SYN.FACET_TEXT)) assert(D.core.axes.some(a => a.id === id) && f.length === 3, id);
});

test('browser and CommonJS builds expose the same rules', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/omni-data.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/omni-synthesis.js'), 'utf8'), context);
  assert.equal(context.OMNI_SYNTHESIS.VERSION, SYN.VERSION);
  assert.deepEqual(JSON.parse(JSON.stringify(context.OMNI_SYNTHESIS.RULES)), JSON.parse(JSON.stringify(SYN.RULES)));
});

// 由规则条件构造一份满足它的答卷，用于证明每条规则都能被触发。
const VALUE = { agree: 6, strongAgree: 7, disagree: 2, strongDisagree: 1, neutral: 4, notAgree: 3, notDisagree: 5, undecided: 4 };
const AVOID = { agree: 3, strongAgree: 4, disagree: 5, strongDisagree: 4, neutral: 6, notAgree: 6, notDisagree: 2, undecided: 6 };
function isFree(cond, plan) {
  if (cond.i) return plan.fixed[cond.i] === undefined;
  if (cond.f) return plan.facets[cond.f] === undefined;
  const kids = cond.all || cond.any || cond.of || [cond.not];
  return kids.every(c => isFree(c, plan));
}
function satisfy(cond, plan, negate = false) {
  if (cond.all) { if (negate) satisfy(cond.all[0], plan, true); else cond.all.forEach(c => satisfy(c, plan)); return; }
  if (cond.any) { if (negate) cond.any.forEach(c => satisfy(c, plan, true)); else satisfy(cond.any.find(c => isFree(c, plan)) || cond.any[0], plan); return; }
  if (cond.atLeast) {
    if (negate) { cond.of.forEach(c => satisfy(c, plan, true)); return; }
    const free = cond.of.filter(c => isFree(c, plan)), rest = cond.of.filter(c => !isFree(c, plan));
    free.concat(rest).slice(0, cond.atLeast).forEach(c => satisfy(c, plan)); return;
  }
  if (cond.not) { satisfy(cond.not, plan, !negate); return; }
  if (cond.i) { plan.fixed[cond.i] = (negate ? AVOID : VALUE)[cond.a]; return; }
  const lo = Math.max(cond.min ?? -100, cond.absMax !== undefined ? -cond.absMax : -100), hi = Math.min(cond.max ?? 100, cond.absMax !== undefined ? cond.absMax : 100);
  if (!negate) plan.facets[cond.f] = cond.min !== undefined && cond.max === undefined ? Math.min(100, lo + 15) : cond.max !== undefined && cond.min === undefined ? Math.max(-100, hi - 15) : Math.round((lo + hi) / 2);
  else plan.facets[cond.f] = cond.min !== undefined ? cond.min - 30 : cond.max !== undefined ? cond.max + 30 : cond.absMax + 30;
}

test('every detection rule can fire (or is replaced by the rule that deliberately suppresses it)', () => {
  for (const rule of SYN.RULES) {
    const plan = { fixed: {}, facets: {} };
    satisfy(rule.when, plan);
    const syn = analyze(build(plan));
    assert.equal(syn.status, 'ok', rule.id);
    const fired = new Set(syn.findings.map(f => f.id));
    const replaced = SYN.RULES.some(r => (r.suppress || []).includes(rule.id) && fired.has(r.id));
    assert(fired.has(rule.id) || replaced, rule.id + ' did not fire: ' + JSON.stringify(plan));
    assertClean(syn, rule.id);
  }
});

test('blank, all-neutral, straight-lined and partial answer sheets get an explicit status instead of an invented position', () => {
  const blank = S.fresh(D); S.finish(blank, 'blank');
  let syn = analyze(blank);
  assert.equal(syn.status, 'insufficient');
  assert.equal(syn.sections.length, 0); assert.equal(syn.tensions.length, 0); assert.equal(syn.overall.quote, '');
  assert.match(syn.overall.paragraphs[0], /暂不生成/);

  syn = analyze(build({ base: 'neutral' }));
  assert.equal(syn.status, 'neutral');
  assert.equal(syn.sections.length, 0); assert.equal(syn.overall.quote, '');
  assert.match(syn.overall.paragraphs[0], /全部选择中立.*不把中立推断为/);
  const neutralWithModule = build({ base: 'neutral', fixed: { S01: 7, S08: 2 } });
  assert.match(analyze(neutralWithModule).overall.paragraphs[0], /另有 2 项非中立回答/);

  for (const value of [7, 1]) {
    const s = build({ base: 'neutral' });
    for (const q of D.core.items) s.answers[q.id] = value;
    syn = analyze(s);
    assert.equal(syn.status, 'uniform', String(value));
    assert.deepEqual(syn.style.flags[0], { id: 'straight', value });
    assert.equal(syn.sections.length, 0); assert.equal(syn.tensions.length, 0);
    assert(syn.overall.paragraphs[0].includes('全部选择“' + VERBS[value] + '”'));
  }

  const partial = build({ facets: { OWN: 50, ALLOC: -30, RED: 40 } });
  for (const q of D.core.items.slice(30)) delete partial.answers[q.id];
  partial.presented = Object.keys(partial.answers);
  syn = analyze(partial);
  assert.equal(syn.status, 'ok');
  assert.deepEqual(syn.sections.map(s => s.id), ['economic', 'political']);
  assert.deepEqual(syn.sections.map(s => s.number), ['一', '二']);
  assert(syn.skipped.includes('生态与技术'));
  assert(syn.overall.paragraphs.some(p => /只有 \d+\/22 个分面可以报告/.test(p)));
  assert(syn.overall.paragraphs[0].includes('经济制度'), 'a clear economic answer is not called weak');
  assert(syn.sections[1].clause.includes('信息不足）'), 'missing facets are noted once, in brackets');

  const evidenceOnly = build({ facets: { EVID: 60 } });
  for (const q of D.core.items) if (q.axis !== 'EVID') delete evidenceOnly.answers[q.id];
  evidenceOnly.presented = Object.keys(evidenceOnly.answers);
  syn = analyze(evidenceOnly);
  assert.equal(syn.status, 'ok');
  assert.deepEqual(syn.sections.map(s => s.id), ['theory']);
  assert.match(syn.overall.paragraphs[0], /只有自报的判断方式/);
  assertClean(syn, 'evidence only');
});

test('response-style checks flag acquiescence, disagreement with both sides, extremes, neutrality and unknown answers', () => {
  const sheet = fn => { const s = build({ base: 'neutral' }); D.core.items.forEach((q, i) => { s.answers[q.id] = fn(q, i); }); return s; };
  const flags = s => analyze(s).style.flags.map(f => f.id);
  assert(flags(sheet((q, i) => [5, 6, 6, 7][i % 4])).includes('acquiescence'));
  assert(flags(sheet((q, i) => [1, 2, 3, 2][i % 4])).includes('disacquiescence'));
  assert(flags(sheet((q, i) => (i * 7) % 3 ? 7 : 1)).includes('extreme'));
  assert(flags(sheet((q, i) => i % 4 ? 4 : (q.sign === '-' ? 2 : 6))).includes('neutralHeavy'));
  assert(flags(sheet((q, i) => i % 5 < 2 ? 'U' : i % 5 === 2 ? 'X' : 5 + (i % 3))).includes('unknownHeavy'));
  const acquiescent = analyze(sheet((q, i) => [5, 6, 6, 7][i % 4]));
  assert(acquiescent.overall.paragraphs[0].startsWith('作答方式提示：'));
});

test('all score situations stay well-formed: randomised sheets never throw, leak markers or misquote answers', () => {
  let seed = 20261103;
  const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = list => list[Math.floor(rand() * list.length)];
  const styles = [() => 1 + Math.floor(rand() * 7), () => pick([1, 7]), () => pick([5, 6, 7]), () => pick([4, 4, 4, 3, 5]), () => pick([1, 2, 3]), () => pick([2, 6])];
  const notes = ['', 'U', '社会主义、自由主义', '<script>alert(1)</script>', B0 + '加粗' + B1 + '无政府主义', '马克思主义 民主社会主义 托洛茨基主义'];
  const statuses = new Set();
  for (let n = 0; n < 400; n++) {
    const style = pick(styles), missing = rand() * 0.7, unknown = rand() * 0.4;
    const answer = () => rand() < unknown ? pick(['U', 'X']) : style();
    const modules = [...new Set([pick(D.modules).id, pick(D.modules).id])].slice(0, Math.floor(rand() * 3));
    const supplements = D.legacySupplement.groups.filter(() => rand() < 0.3).map(g => g.id);
    const cards = {};
    for (let k = Math.floor(rand() * 5); k > 0; k--) cards[pick(D.cards).id] = [answer(), answer(), answer(), Math.floor(rand() * 4), Math.floor(rand() * 4)];
    const s = S.fresh(D); s.stage = 'base';
    const answers = {};
    for (const q of D.core.items) if (rand() >= missing) answers[q.id] = answer();
    for (const id of anchors) answers[id] = answer();
    for (const m of D.modules.filter(m => modules.includes(m.id))) for (const q of m.items) answers[q.id] = answer();
    for (const q of D.legacySupplement.items.filter(q => supplements.includes(q.group))) answers[q.id] = answer();
    for (const sc of D.core.scenarios) if (rand() < 0.8) answers[sc.id] = answer();
    for (const [id, v] of Object.entries(cards)) ['a', 'b', 'c', 'I', 'K'].forEach((k, i) => { answers[id + '.' + k] = v[i]; });
    answers.Z01 = Math.floor(rand() * 4); answers.Z03 = Math.floor(rand() * 4); answers.Z04 = pick(notes);
    Object.assign(s, { selectedModules: modules, selectedSupplements: supplements, selectedCards: Object.keys(cards), answers, presented: Object.keys(answers) });
    S.finish(s, 'random');
    const session = S.validate(D, s);
    const syn = analyze(session);
    statuses.add(syn.status);
    assertClean(syn, 'sheet ' + n);
    assert.deepEqual(analyze(session), syn, 'deterministic');
    if (syn.status !== 'ok') { assert.equal(syn.sections.length, 0); assert.equal(syn.tensions.length, 0); continue; }
    assert.deepEqual(syn.sections.map(x => x.number), CN.slice(0, syn.sections.length));
    assert.equal(syn.summary.length, syn.sections.length);
    assert(syn.overall.paragraphs.length >= 1 && syn.overall.quote.endsWith('。'));
    assert(syn.tensions.length <= 5);
    for (const f of syn.findings) for (const id of f.cites) {
      assert(session.answers[id] !== undefined && (CORE[id] || session.presented.includes(id)), f.id + ' cites unanswered ' + id);
    }
    for (const text of allTexts(syn)) for (const m of text.matchAll(/依据：([^）]+)）/g)) for (const part of m[1].split('；')) {
      const [id, verb] = part.split(' ');
      assert.equal(verb, VERBS[session.answers[id]], 'quoted answer for ' + id);
    }
    for (const text of allTexts(syn)) for (const m of text.matchAll(/(强烈不同意|略不同意|不同意|强烈同意|略同意|同意)“[^”]+”（([A-Z]\d{2,3})）/g)) assert.equal(m[1], VERBS[session.answers[m[2]]], 'item line for ' + m[2]);
    assert(!allTexts(syn).some(t => t.includes('<script>') && !t.startsWith('作答前主动列出')), 'free text appears only in its own sentence');
  }
  assert(statuses.has('ok') && statuses.has('insufficient'), [...statuses].join());
});

test('sample combinations reproduce the structure of the reference analyses', () => {
  const ids = syn => new Set(syn.findings.map(f => f.id));
  const all = syn => allTexts(syn).join('\n');

  const a = analyze(FIXTURES.vanguard());
  assert.equal(a.status, 'ok');
  for (const id of ['P1', 'P3', 'P6', 'E3', 'T2', 'C6', 'K1']) assert(ids(a).has(id), id);
  assert(!ids(a).has('P5'), 'the vanguard/council tension replaces the generic organisation pattern');
  assert(!ids(a).has('P8'), 'social ownership with contested competition is not presented as a settled democratic pattern');
  assert.equal(a.tensions[0].id, 'P1');
  assert(a.overall.paragraphs[0].includes('采用历史唯物主义与结构分析的框架'), 'the analytic framework leads the key combinations');
  assert(/三项主张均支持的是“德莱昂主义”、“社会主义”/.test(all(a)));
  assert(/政治制度.*的相互拉扯最集中/.test(a.overall.paragraphs.join('')));
  assert(/接受干预与威慑、反对扩张战争/.test(all(a)));

  const b = analyze(FIXTURES.market());
  for (const id of ['P2', 'E7', 'E14', 'E13', 'K9', 'C1', 'C2', 'I1', 'I4', 'P4']) assert(ids(b).has(id), id);
  assert(!ids(b).has('P1') && !ids(b).has('E4') && !ids(b).has('P8'));
  assert.equal(b.tensions[0].id, 'P2');
  assert(b.overall.paragraphs[0].includes('市场竞争为基础，辅以公共规则与保障'));
  assert(all(b).includes('整体是非干预为主、保留防御性威慑的立场'));
  assert(all(b).includes('作答前主动列出的思想名称是“社会民主主义、新自由主义，文化议题上倾向于一定保守主义”'));

  const c = analyze(FIXTURES.democratic());
  for (const id of ['C4', 'C11', 'P8', 'E3', 'E5', 'I3', 'I4', 'I6', 'K6', 'G1', 'G3', 'T1', 'N1']) assert(ids(c).has(id), id);
  assert(!ids(c).has('C2'), 'a rejected electoral route is not reported as undecided');
  assert.equal(c.tensions[0].id, 'C4');
  assert(c.summary[1].startsWith(B0 + '政治制度上' + B1 + '：强烈支持可竞争、可替换的执政权'));
  assert(all(c).includes('托洛茨基主义（本次未核验）'));
  const change = c.sections.find(s => s.id === 'change');
  const repeated = SYN.texts(change.blocks).filter(t => t.includes('（Q060）'));
  assert.equal(repeated.length, 0, 'an exception explained by a rule is not repeated in the facet paragraph');

  const d = analyze(FIXTURES.unitary());
  for (const id of ['E1', 'E2', 'E10', 'P7', 'K3', 'K5', 'K11', 'I2', 'N1', 'N3', 'C9', 'G3']) assert(ids(d).has(id), id);
  assert(!ids(d).has('K7') && !ids(d).has('K8') && !ids(d).has('N5'));
  assert(/本人自述政治立场“尚未形成”/.test(d.overall.paragraphs.join('')));
  assert(/经济制度.*的相互拉扯最集中（3 处）/.test(d.overall.paragraphs.join('')));
  assert(d.sections.find(s => s.id === 'economic').clause.endsWith('（资源配置信息不足）'));
});

test('the report places the synthesis first, escapes free text and strips formatting markers', () => {
  const s = FIXTURES.democratic();
  s.answers.Z04 = '<img src=x onerror=alert(1)>' + B0 + '马克思主义' + B1;
  const html = OMNI_REPORT.render(s);
  const syn = html.indexOf('<section class="report-section syn"'), profile = html.indexOf('tendency-profile'), summary = html.indexOf('report-summary');
  assert(summary >= 0 && syn > summary && profile > syn, 'summary → synthesis → profile');
  const part = html.slice(syn, html.indexOf('</section>', html.indexOf('syn-rule')) + 10);
  assert(!/[\u0001\u0002]/.test(part), 'bold markers never reach the synthesis HTML');
  assert(!html.includes('<img src=x'));
  assert(part.includes('&lt;img src=x onerror=alert(1)&gt;马克思主义'));
  for (const heading of ['综合报告分析', '总体定位', '简化成一句话', '最主要的内部张力', '综合概括', '自我认同、思想卡与画像参照']) assert(part.includes(heading), heading);
  assert.equal((part.match(/class="syn-section"/g) || []).length, 8);
  assert.equal((part.match(/<strong>/g) || []).length, (part.match(/<\/strong>/g) || []).length);
  const blank = S.fresh(D); S.finish(blank, 'blank');
  const empty = OMNI_REPORT.render(blank);
  assert(empty.includes('data-status="insufficient"') && !empty.includes('最主要的内部张力'));
  // A failure inside the analysis affects only this section.
  global.OMNI_SYNTHESIS = { markers: SYN.markers, analyze() { throw new Error('boom'); } };
  try {
    const guarded = OMNI_REPORT.render(FIXTURES.market());
    assert(guarded.includes('data-status="error"') && guarded.includes('基本倾向性画像') && guarded.includes('专题逐题记录'));
  } finally { global.OMNI_SYNTHESIS = SYN; }
});

test('the published rule document matches the executable rules', () => {
  const doc = require('../scripts/build-synthesis-doc.cjs');
  const text = fs.readFileSync(path.join(__dirname, '../SYNTHESIS_RULES.md'), 'utf8');
  assert.equal(doc.render(text), text, 'run node scripts/build-synthesis-doc.cjs');
  assert(text.includes('规则版本：' + SYN.VERSION));
  assert.equal((text.match(/^\| [A-Z]\d+ \|/gm) || []).length, SYN.RULES.length);
});
