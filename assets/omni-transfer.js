/* Loss-detecting local answer transfer. CRC32 detects accidental damage; it is not a signature. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./omni-engine.js'));
  else root.OMNI_TRANSFER = factory(root.OMNI_ENGINE);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  if (!E || typeof E.validateSession !== 'function') throw new Error('请先载入答卷计分程序。');
  const MAX_PACKET_LENGTH = 250000, MAX_SEGMENTS = 400, MAX_SEGMENT_LENGTH = 1000, MAX_BATCH_LENGTH = 10 * 1024 * 1024;
  const table = Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    return Uint8Array.from(unescape(encodeURIComponent(text)), c => c.charCodeAt(0));
  }
  function crc32(text) {
    let crc = 0xffffffff;
    for (const b of bytes(text)) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
  }
  function base64url(text) {
    const raw = bytes(text);
    let encoded;
    if (typeof Buffer !== 'undefined') encoded = Buffer.from(raw).toString('base64');
    else { let binary = ''; for (const b of raw) binary += String.fromCharCode(b); encoded = btoa(binary); }
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unbase64url(payload) {
    if (!/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) throw new Error('答卷代码含无效字符或已被截断。请重新复制完整代码。');
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    let raw, text;
    try {
      raw = typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(b64, 'base64')) : Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      if (typeof TextDecoder !== 'undefined') text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
      else text = decodeURIComponent(Array.from(raw, b => '%' + b.toString(16).padStart(2, '0')).join(''));
    } catch (_) { throw new Error('答卷代码的文字编码损坏，可能在复制或转发时丢失。请重新导出。'); }
    if (base64url(text) !== payload) throw new Error('答卷代码的编码不完整或已损坏。请重新复制完整代码。');
    return text;
  }
  function checkText(value, maximum = MAX_PACKET_LENGTH) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('请先粘贴答卷代码或选择答卷文件。');
    if (value.length > maximum) throw new Error('答卷文本超过大小限制。');
    return value.trim();
  }
  function validatedJson(json, legacy) {
    try { JSON.parse(json); }
    catch (_) { throw new Error(legacy ? '旧版答卷代码不完整或已损坏，通常由复制或转发截断造成。请重新导出并分段发送；无法补全缺失内容。' : '答卷内容不是完整的 JSON，可能已被截断或修改。请重新导出。'); }
    // Keep all branch, answer, version and disclosure-history validation in the original engine.
    return E.decodeSession(json);
  }
  function encode(session) {
    const payload = base64url(JSON.stringify(E.validateSession(session)));
    const code = 'OMNI2.' + payload.length + '.' + crc32(payload) + '.' + payload;
    if (code.length > MAX_PACKET_LENGTH) throw new Error('答卷代码超过大小限制，请使用完整答卷文件导出。');
    return code;
  }
  function decodeDirect(input) {
    const value = checkText(input);
    if (value.startsWith('{')) return validatedJson(value, false);
    if (value.startsWith('OMNI1.')) return validatedJson(unbase64url(value.slice(6)), true);
    if (!value.startsWith('OMNI2.')) throw new Error('无法识别答卷格式，请使用本测试导出的代码、完整分段或 JSON 文件。');
    const match = /^OMNI2\.([1-9]\d{0,5})\.([0-9a-fA-F]{8})\.([A-Za-z0-9_-]+)$/.exec(value);
    if (!match) throw new Error('答卷代码头或字符不完整，可能在复制或转发时被截断。请重新复制。');
    const declared = Number(match[1]), payload = match[3];
    if (declared > MAX_PACKET_LENGTH) throw new Error('答卷声明的长度超过大小限制。');
    if (declared !== payload.length) throw new Error('答卷长度不符：应有 ' + declared + ' 个代码字符，实际收到 ' + payload.length + ' 个。代码可能已被截断，请重新复制或分段发送。');
    if (crc32(payload) !== match[2].toLowerCase()) throw new Error('答卷完整性校验不通过：内容已变化或损坏。请重新复制或重新导出。');
    return validatedJson(unbase64url(payload), false);
  }
  function parseSegment(line) {
    if (line.length > MAX_SEGMENT_LENGTH) throw new Error('分段代码超过 ' + MAX_SEGMENT_LENGTH + ' 字符，可能混入了其他内容。');
    const m = /^OMNIP1\.([0-9a-fA-F]{8})\.([1-9]\d{0,2})\.([1-9]\d{0,2})\.([1-9]\d{0,5})\.([0-9a-fA-F]{8})\.([A-Za-z0-9_.-]+)$/.exec(line);
    if (!m) throw new Error('分段格式不完整或含无效字符，请完整复制以 OMNIP1 开头的那一段。');
    const part = { packetCrc: m[1].toLowerCase(), index: Number(m[2]), total: Number(m[3]), length: Number(m[4]), crc: m[5].toLowerCase(), payload: m[6] };
    if (part.total > MAX_SEGMENTS || part.index > part.total) throw new Error('分段序号无效或总段数超过 ' + MAX_SEGMENTS + ' 段。');
    if (part.length > MAX_PACKET_LENGTH || part.total > part.length || part.payload.length > part.length) throw new Error('分段声明的答卷长度无效或超过大小限制。');
    if (crc32(part.payload) !== part.crc) throw new Error('第 ' + part.index + ' 段校验不通过，可能被截断或修改。请重新复制这一段。');
    return part;
  }
  function addPart(group, part) {
    if (group.packetCrc !== part.packetCrc || group.total !== part.total || group.length !== part.length) throw new Error('分段的整包信息冲突，可能混入了不同答卷。请分别导入。');
    if (group.parts.has(part.index) && group.parts.get(part.index) !== part.payload) throw new Error('第 ' + part.index + ' 段出现内容不同的重复段，请核对原始答卷后重新复制。');
    group.parts.set(part.index, part.payload);
    if (Array.from(group.parts.values()).reduce((sum, p) => sum + p.length, 0) > group.length) throw new Error('分段合计长度超出声明长度，答卷可能损坏。');
  }
  function finishGroup(group) {
    const missing = Array.from({ length: group.total }, (_, i) => i + 1).filter(i => !group.parts.has(i));
    if (missing.length) throw new Error('分段尚未收齐：缺第 ' + missing.slice(0, 20).join('、') + ' 段' + (missing.length > 20 ? '等共 ' + missing.length + ' 段' : '') + '（已收到 ' + group.parts.size + '/' + group.total + ' 段）。请补齐后再导入。');
    const code = Array.from({ length: group.total }, (_, i) => group.parts.get(i + 1)).join('');
    if (code.length !== group.length) throw new Error('分段合并后长度不符，可能缺少部分字符。请重新导出。');
    if (crc32(code) !== group.packetCrc) throw new Error('分段合并后的整包校验不通过，可能混入了错误内容。请重新导出。');
    if (!code.startsWith('OMNI2.')) throw new Error('分段中的答卷格式不受支持，请使用当前网页重新分段导出。');
    return code;
  }
  function sourceLines(input) {
    const text = checkText(Array.isArray(input) ? input.join('\n') : input, MAX_BATCH_LENGTH);
    return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }
  function inspectParts(input) {
    if (input === '' || (typeof input === 'string' && !input.trim()) || (Array.isArray(input) && !input.length)) return { packageId: null, total: 0, received: 0, receivedIndices: [], missing: [], complete: false };
    const lines = sourceLines(input);
    let group;
    for (const line of lines) {
      const part = parseSegment(line);
      if (!group) group = { ...part, parts: new Map() };
      if (group.packetCrc !== part.packetCrc) throw new Error('混入了不同答卷的分段，不能拼成一份答卷。请按整包校验号分别导入。');
      addPart(group, part);
    }
    const receivedIndices = Array.from(group.parts.keys()).sort((a, b) => a - b);
    const missing = Array.from({ length: group.total }, (_, i) => i + 1).filter(i => !group.parts.has(i));
    const state = { packageId: group.packetCrc, total: group.total, received: group.parts.size, receivedIndices, missing, complete: missing.length === 0 };
    if (state.complete) {
      state.code = finishGroup(group);
      decodeDirect(state.code);
    }
    return state;
  }
  function assemble(input) {
    const state = inspectParts(input);
    if (!state.total) throw new Error('请先粘贴分段代码。');
    if (!state.complete) throw new Error('分段尚未收齐：缺第 ' + state.missing.slice(0, 20).join('、') + ' 段' + (state.missing.length > 20 ? '等共 ' + state.missing.length + ' 段' : '') + '（已收到 ' + state.received + '/' + state.total + ' 段）。请补齐后再导入。');
    return state.code;
  }
  function split(input, maxLength = MAX_SEGMENT_LENGTH) {
    if (!Number.isInteger(maxLength) || maxLength < 128 || maxLength > MAX_SEGMENT_LENGTH) throw new Error('每段长度须在 128～' + MAX_SEGMENT_LENGTH + ' 字符之间。');
    const session = decodeDirect(input);
    const code = input.trim().startsWith('OMNI2.') ? input.trim() : encode(session);
    const capacity = maxLength - 64, total = Math.ceil(code.length / capacity), packetCrc = crc32(code);
    if (total > MAX_SEGMENTS) throw new Error('分段数超过 ' + MAX_SEGMENTS + ' 段，请增大每段长度或导出答卷文件。');
    return Array.from({ length: total }, (_, n) => {
      const payload = code.slice(n * capacity, (n + 1) * capacity);
      return 'OMNIP1.' + packetCrc + '.' + (n + 1) + '.' + total + '.' + code.length + '.' + crc32(payload) + '.' + payload;
    });
  }
  function decode(input) {
    const text = checkText(input, MAX_BATCH_LENGTH);
    return text.startsWith('OMNIP1.') ? decodeDirect(assemble(text)) : decodeDirect(text);
  }
  // Batch mode deliberately groups distinct packets; assemble() deliberately rejects them.
  // A raw JSON file must stand alone. Codes and segment lines can be pasted together, one per line.
  function parseSources(input) {
    const text = checkText(input, MAX_BATCH_LENGTH);
    if (text.startsWith('{')) return [{ code: text, session: decodeDirect(text), format: 'json', segments: 0 }];
    const groups = new Map(), sources = [], seenCodes = new Set();
    function addCode(code, format, segments = 0) {
      if (seenCodes.has(code)) return;
      sources.push({ code, session: decodeDirect(code), format, segments }); seenCodes.add(code);
    }
    for (const line of sourceLines(text)) {
      if (line.startsWith('OMNIP1.')) {
        const part = parseSegment(line);
        if (!groups.has(part.packetCrc)) groups.set(part.packetCrc, { ...part, parts: new Map() });
        addPart(groups.get(part.packetCrc), part);
      } else addCode(line, line.startsWith('OMNI1.') ? 'legacy' : 'checked');
    }
    for (const group of groups.values()) addCode(finishGroup(group), 'segments', group.total);
    return sources;
  }
  return Object.freeze({ encode, split, decode, assemble, inspectParts, parseSources, crc32,
    MAX_PACKET_LENGTH, MAX_SEGMENTS, MAX_SEGMENT_LENGTH, MAX_BATCH_LENGTH });
});
