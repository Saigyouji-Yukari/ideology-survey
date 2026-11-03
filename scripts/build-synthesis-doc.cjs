#!/usr/bin/env node
/* Regenerate the rule table and the item table in SYNTHESIS_RULES.md from assets/omni-synthesis.js.
   Usage: node scripts/build-synthesis-doc.cjs  (tests call render() to check the document is current). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const D = require(path.join(repo, 'assets/omni-data.js'));
const SYN = require(path.join(repo, 'assets/omni-synthesis.js'));
const DOC = path.join(repo, 'SYNTHESIS_RULES.md');

const PRED = { agree: '同意', strongAgree: '明确同意（≥6）', disagree: '不同意', strongDisagree: '明确不同意（≤2）', neutral: '中立', notAgree: '未表示同意', notDisagree: '未表示不同意', undecided: '中立或“不了解”' };
const KIND = { tension: '张力', exception: '例外', pattern: '组合' };
const sectionTitle = id => SYN.SECTIONS.find(s => s.id === id).title;
const cell = text => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function condition(c, nested) {
  if (c.all) { const t = c.all.map(x => condition(x, true)).join(' 且 '); return nested && c.all.length > 1 ? '［' + t + '］' : t; }
  if (c.any) {
    if (c.any.every(x => x.i && x.a === c.any[0].a)) return c.any.map(x => x.i).join('／') + (c.any.length > 1 ? ' 任一' : ' ') + PRED[c.any[0].a];
    return '（' + c.any.map(x => condition(x, true)).join(' 或 ') + '）';
  }
  if (c.atLeast) return '下列至少 ' + c.atLeast + ' 项（' + c.of.map(x => condition(x, true)).join('；') + '）';
  if (c.not) return c.not.i || c.not.f ? '并非 ' + condition(c.not, true) : '并非' + (c.not.any ? condition(c.not, true) : '（' + condition(c.not, false) + '）');
  if (c.i) return c.i + ' ' + PRED[c.a];
  const parts = [];
  if (c.min !== undefined) parts.push(c.f + ' ≥ ' + c.min);
  if (c.max !== undefined) parts.push(c.f + ' ≤ ' + c.max);
  if (c.absMax !== undefined) parts.push(c.f + ' 绝对值 ≤ ' + c.absMax);
  return parts.join(' 且 ');
}

function ruleTable() {
  const rows = SYN.RULES.map(r => {
    const notes = [];
    if (r.key === 2) notes.push('优先进入总体定位');
    else if (r.key) notes.push('可进入总体定位');
    if ((r.suppress || []).length) notes.push('命中时不再单列 ' + r.suppress.join('、'));
    return '| ' + [r.id, sectionTitle(r.section), KIND[r.kind], r.severity, condition(r.when, false), r.short, notes.join('；') || '—'].map(cell).join(' | ') + ' |';
  });
  return ['| 规则 | 栏目 | 类型 | 级别 | 触发条件 | 报告中的概括 | 说明 |', '| --- | --- | --- | --- | --- | --- | --- |', ...rows].join('\n');
}

function itemTable() {
  const facetName = id => D.core.axes.find(a => a.id === id).name;
  const rows = SYN.SECTIONS.map(s => '| ' + [s.number + '、' + s.title, s.facets.map(id => id + ' ' + facetName(id)).join('、'), SYN.SECTION_ITEMS[s.id].split(' ').join(' ')].map(cell).join(' | ') + ' |');
  return ['| 栏目 | 共同题分面 | 归入本栏目的专题题与补充题 |', '| --- | --- | --- |', ...rows].join('\n');
}

function replaceBlock(text, name, body) {
  const start = '<!-- ' + name + '_START -->', end = '<!-- ' + name + '_END -->';
  const a = text.indexOf(start), b = text.indexOf(end);
  if (a < 0 || b < a || text.indexOf(start, a + 1) >= 0) throw new Error('Expected one ' + name + ' marker pair; no files changed.');
  return text.slice(0, a + start.length) + '\n' + body + '\n' + text.slice(b);
}

function render(text) {
  let out = replaceBlock(text, 'SYNTHESIS_RULES', ruleTable());
  out = replaceBlock(out, 'SYNTHESIS_ITEMS', itemTable());
  return out.replace(/规则版本：SYN-[0-9-]+/, '规则版本：' + SYN.VERSION).replace(/共 \d+ 条检测规则/g, '共 ' + SYN.RULES.length + ' 条检测规则');
}

if (require.main === module) {
  const before = fs.readFileSync(DOC, 'utf8');
  const after = render(before);
  if (after !== before) fs.writeFileSync(DOC, after);
  console.log(after === before ? 'SYNTHESIS_RULES.md is already current.' : 'SYNTHESIS_RULES.md updated: ' + SYN.RULES.length + ' rules.');
}
module.exports = { render, condition, ruleTable, itemTable };
