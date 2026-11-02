'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const T = require('../assets/omni-transfer.js');
const E = require('../assets/omni-engine.js');
const S = require('../assets/omni-session.js');
const D = require('../assets/omni-data.js');

function fixture(id = 'synthetic-transfer') {
  const s = S.fresh(D, 1000000); s.id = id;
  s.stage = 'base';
  for (const q of S.plan(D, s)) {
    const value = /^Z0[456]$/.test(q.id) ? '合成测试：多行\n中文、𝄞、🙂；不是实际答卷。' : /^Z0[123]$/.test(q.id) ? 0 : 4;
    S.answer(s, q, value);
  }
  S.selectModules(D, s, D.modules.slice(0, 2).map(m => m.id));
  for (const q of S.plan(D, s)) S.answer(s, q, 5);
  S.selectSupplements(D, s, D.legacySupplement.groups.map(g => g.id));
  for (const q of S.plan(D, s)) S.answer(s, q, 6);
  S.selectCards(D, s, D.cards.slice(0, 4).map(c => c.id));
  for (const q of S.plan(D, s)) S.answer(s, q, q.part === 'explanation' ? '合成核验🙂' : ['K', 'I'].includes(q.part) ? 0 : 5);
  S.finish(s, '合成测试完成', 1200000);
  return s;
}
function rewriteSegment(segment, index, value) { const p = segment.split('.'); p[index] = value; return p.join('.'); }

test('checked transfer roundtrips all 307 responses, Unicode and disclosure history', () => {
  const s = fixture(), code = T.encode(s);
  assert.equal(s.presented.length, 307); assert(code.startsWith('OMNI2.'));
  assert.deepEqual(T.decode(code), E.validateSession(s));
  assert.equal(T.crc32('123456789'), 'cbf43926');
});
test('browser transfer uses the same UTF-8 protocol without Buffer or network', () => {
  const context = { OMNI_ENGINE: E, TextEncoder, TextDecoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary') };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/omni-transfer.js'), 'utf8'), context);
  const code = context.OMNI_TRANSFER.encode(fixture());
  assert.equal(code, T.encode(fixture()));
  assert.deepEqual(T.decode(code), context.OMNI_TRANSFER.decode(code));
});
test('new envelope distinguishes truncation, altered content, and malformed characters', () => {
  const code = T.encode(fixture());
  assert.throws(() => T.decode(code.slice(0, -20)), /长度不符/);
  assert.throws(() => T.decode(code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A')), /完整性校验不通过/);
  assert.throws(() => T.decode(code + '='), /代码头或字符不完整/);
  assert.throws(() => T.decode(code.replace(/^OMNI2\.\d+/, 'OMNI2.999999')), /大小限制/);
});
test('segments fit message-sized limits and reassemble in any order with identical duplicates', () => {
  const s = fixture(), code = T.encode(s), parts = T.split(code);
  assert(parts.length > 1); assert(parts.every(p => p.length <= 1000));
  assert.equal(T.assemble([...parts].reverse().concat(parts[0])), code);
  assert.deepEqual(T.decode(parts.join('\n')), E.validateSession(s));
});
test('missing or damaged segments are rejected with actionable segment numbers', () => {
  const parts = T.split(T.encode(fixture()));
  assert.throws(() => T.assemble(parts.filter((_, i) => i !== 1)), /缺第 2 段/);
  assert.throws(() => T.assemble([parts[0].slice(0, -1), ...parts.slice(1)]), /第 1 段校验不通过/);
  assert.equal(T.assemble([parts[0] + ' ', ...parts.slice(1)]), T.assemble(parts));
});
test('different answer packets are never silently combined; batch mode keeps them separate', () => {
  const a = T.split(T.encode(fixture('synthetic-a'))), b = T.split(T.encode(fixture('synthetic-b')));
  assert.throws(() => T.assemble([a[0], b[0]]), /不同答卷/);
  const sources = T.parseSources([...a, ...b].reverse().join('\n'));
  assert.equal(sources.length, 2);
  assert.deepEqual(new Set(sources.map(s => s.session.id)), new Set(['synthetic-a', 'synthetic-b']));
  assert.throws(() => T.parseSources([...a, b[0]].join('\n')), /缺第/);
});
test('incremental paste inspection reports missing indices without accepting a partial answer', () => {
  const parts = T.split(T.encode(fixture()));
  assert.deepEqual(T.inspectParts(''), { packageId: null, total: 0, received: 0, receivedIndices: [], missing: [], complete: false });
  const partial = T.inspectParts([parts[1], parts[1], parts[3]]);
  assert.equal(partial.complete, false); assert.equal(partial.received, 2); assert.deepEqual(partial.receivedIndices, [2, 4]);
  assert.equal(partial.missing[0], 1); assert(!('code' in partial));
  const complete = T.inspectParts(parts);
  assert.equal(complete.complete, true); assert.equal(complete.received, parts.length);
  assert.equal(complete.code, T.assemble(parts));
  assert.throws(() => T.inspectParts([parts[0].slice(0, -1)]), /校验不通过/);
});
test('conflicting repeated segment, metadata and whole-packet checksum reject', () => {
  const parts = T.split(T.encode(fixture())), first = parts[0].split('.');
  const changedPayload = first.slice(6).join('.').replace('O', 'P');
  first[5] = T.crc32(changedPayload); first.splice(6, first.length - 6, changedPayload);
  assert.throws(() => T.assemble([parts[0], first.join('.'), ...parts.slice(1)]), /内容不同的重复段/);
  assert.throws(() => T.assemble(parts.map(p => rewriteSegment(p, 1, '00000000'))), /整包校验不通过/);
  assert.throws(() => T.assemble([parts[0], rewriteSegment(parts[1], 4, '100')]), /长度无效|整包信息冲突/);
});
test('legacy code and raw JSON remain compatible but truncated legacy data stays rejected', () => {
  const s = fixture(), old = E.encodeSession(s);
  assert.deepEqual(T.decode(old), E.validateSession(s));
  assert.deepEqual(T.decode(JSON.stringify(s, null, 2)), E.validateSession(s));
  assert.throws(() => T.decode(old.slice(0, 4500)), /旧版答卷代码不完整|已被截断|编码不完整/);
  assert.deepEqual(T.decode(T.split(old).join('\n')), E.validateSession(s));
});
test('checksum-valid invalid sessions do not bypass existing schema or branch rules', () => {
  const invalid = fixture(); invalid.answers.Q001 = 99;
  const payload = Buffer.from(JSON.stringify(invalid)).toString('base64url');
  const code = 'OMNI2.' + payload.length + '.' + T.crc32(payload) + '.' + payload;
  assert.throws(() => T.decode(code), /答案选项无效/);
  assert.throws(() => T.encode(invalid), /答案选项无效/);
  assert.throws(() => T.decode('OMNI1.' + Buffer.from([0xff]).toString('base64url')), /编码损坏/);
});
test('oversized packets, overmany segments and malformed input are bounded', () => {
  assert.throws(() => T.decode('A'.repeat(T.MAX_PACKET_LENGTH + 1)), /大小限制/);
  assert.throws(() => T.parseSources('A'.repeat(T.MAX_BATCH_LENGTH + 1)), /大小限制/);
  assert.throws(() => T.assemble('OMNIP1.00000000.1.401.10000.00000000.A'), /总段数/);
  assert.throws(() => T.assemble('OMNIP1.00000000.2.1.10000.00000000.A'), /序号/);
  assert.throws(() => T.assemble('OMNIP1.' + 'A'.repeat(1000)), /超过/);
  assert.throws(() => T.decode(''), /先粘贴/);
  assert.throws(() => T.split(T.encode(fixture()), 1001), /每段长度/);
});
test('batch import deduplicates repeated whole codes and supports new, old and segment sources', () => {
  const a = T.encode(fixture('a')), b = E.encodeSession(fixture('b')), c = T.split(T.encode(fixture('c')));
  const result = T.parseSources([a, a, b, ...c].join('\n\n'));
  assert.equal(result.length, 3); assert.deepEqual(result.map(r => r.format), ['checked', 'legacy', 'segments']);
  assert.equal(T.parseSources(JSON.stringify(fixture())).length, 1);
  assert.throws(() => T.parseSources('转发消息：\n' + a), /无法识别答卷格式/);
});
