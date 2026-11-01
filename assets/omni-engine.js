/* OMNI descriptive scoring. No estimated identity probability or winner ranking. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./omni-data.js'), require('./omni-session.js'));
  else root.OMNI_ENGINE = factory(root.OMNI_DATA, root.OMNI_SESSION);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D, Session) {
  'use strict';
  if (!D) throw new Error('请先载入 OMNI 问卷题库。');
  const byId = Object.fromEntries(D.core.items.concat(D.core.scenarios, D.core.context, ...D.modules.map(m => m.items)).map(q => [q.id, q]));
  const cardsById = Object.fromEntries(D.cards.map(c => [c.id, c]));
  const axesById = Object.fromEntries(D.core.axes.map(a => [a.id, a]));
  const modulesById = Object.fromEntries(D.modules.map(m => [m.id, m]));
  const ratings = new Set(D.core.items.concat(D.core.scenarios, ...D.modules.map(m => m.items)).map(q => q.id));
  for (const c of D.cards) for (const key of ['a', 'b', 'c']) ratings.add(c.id + '.' + key);
  const allIds = new Set(Object.keys(byId));
  for (const c of D.cards) for (const key of ['a', 'b', 'c', 'K', 'I', 'explanation']) allIds.add(c.id + '.' + key);
  const anchors = D.modules.flatMap(m => m.anchors);
  const validRating = x => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 7;
  const validMetadata = (x, max = 3) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= max;
  const round = x => Math.round((x + Number.EPSILON) * 10) / 10;
  const integer = x => { const n = Math.round(x); return Object.is(n, -0) ? 0 : n; };
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function classifyAnswer(x) {
    if (x === 'U') return 'unknown';
    if (x === 'X' || x === '×') return 'refused';
    if (!validRating(x)) return 'missing';
    return x === 4 ? 'neutral' : x > 4 ? 'support' : 'oppose';
  }
  function facet(axis, answers = {}) {
    axis = typeof axis === 'string' ? axesById[axis] : axis;
    if (!axis || !axesById[axis.id]) throw new Error('未知分面。');
    const items = D.core.items.filter(q => q.axis === axis.id).map(q => {
      const answer = answers[q.id];
      return { ...q, answer: answer === undefined ? null : answer, oriented: validRating(answer) ? q.sign === '-' ? 8 - answer : answer : null, stance: classifyAnswer(answer) };
    });
    const values = items.filter(q => q.oriented !== null).map(q => q.oriented);
    const valid = values.length, sum = values.reduce((a, b) => a + b, 0), missing = 6 - valid;
    const rawMean = valid ? sum / valid : null;
    const rawValue = valid >= 5 ? 100 * (rawMean - 4) / 3 : null;
    const rawBounds = [100 * ((sum + missing) / 6 - 4) / 3, 100 * ((sum + 7 * missing) / 6 - 4) / 3];
    const mixed = values.some(x => x <= 3) && values.some(x => x >= 5);
    const pattern = valid < 5 ? 'insufficient' : values.every(x => x === 4) ? 'neutral' : mixed ? 'mixed' : rawMean > 4 ? 'positive' : rawMean < 4 ? 'negative' : 'balanced';
    // A one-step change is a sensitivity description, never a statistical error estimate.
    const sensitive = rawValue !== null && values.some(x => x !== 4 && Math.sign(rawMean - 4) !== Math.sign((sum + Math.sign(4 - x)) / valid - 4));
    return { ...axis, value: rawValue === null ? null : integer(rawValue), point: rawValue === null ? null : integer(rawValue), rawValue, mean: rawMean === null ? null : round(rawMean), rawMean, valid, total: 6, bounds: rawBounds.map(integer), rawBounds, items, pattern, sensitive };
  }
  function referenceEvidence(c, answers) {
    return c.keys.map(key => {
      const id = key.slice(0, -1), sign = key.slice(-1), answer = answers[id];
      return { id, sign, text: byId[id] ? byId[id].text : id, answer: answer === undefined ? null : answer, oriented: validRating(answer) ? sign === '-' ? 8 - answer : answer : null };
    });
  }
  function card(cardArg, answers = {}, presentedIds) {
    const c = typeof cardArg === 'string' ? cardsById[cardArg] : cardArg;
    if (!c || !cardsById[c.id]) throw new Error('未知核验卡。');
    const presented = presentedIds === undefined ? new Set(Object.keys(answers)) : new Set(presentedIds);
    const claims = ['a', 'b', 'c'].map(key => {
      const id = c.id + '.' + key, shown = presented.has(id);
      const answer = shown ? answers[id] : undefined;
      return { id, key, text: key === 'c' ? c.contrast : c[key], answer: answer === undefined ? null : answer, presented: shown, stance: classifyAnswer(answer) };
    });
    const support = claims.filter(q => q.stance === 'support'), conflicts = claims.filter(q => q.stance === 'oppose');
    const neutral = claims.filter(q => q.stance === 'neutral'), missing = claims.filter(q => !validRating(q.answer));
    const attempted = claims.some(q => q.presented && q.answer !== null);
    const statusCode = !attempted ? 'untested' : missing.length ? 'insufficient' : support.length === 3 ? 'supported' : 'partial';
    const status = { untested: '未检验', insufficient: '信息不足', supported: '三项均支持', partial: '部分支持或分歧' }[statusCode];
    const strongSupport = statusCode === 'supported' && claims[0].answer >= 6 && claims[1].answer >= 6;
    const familiarityAnswer = presented.has(c.id + '.K') ? answers[c.id + '.K'] : undefined;
    const identityAnswer = presented.has(c.id + '.I') ? answers[c.id + '.I'] : undefined;
    const familiarity = validMetadata(familiarityAnswer) ? familiarityAnswer : null;
    const identity = validMetadata(identityAnswer) ? identityAnswer : null;
    const explanationAnswer = presented.has(c.id + '.explanation') ? answers[c.id + '.explanation'] : undefined;
    const explanation = typeof explanationAnswer === 'string' && !['U', 'X', '×'].includes(explanationAnswer) ? explanationAnswer : '';
    const evidence = referenceEvidence(c, answers);
    const crossQuestionConflicts = statusCode === 'supported' ? evidence.filter(q => q.oriented !== null && q.oriented <= 3) : [];
    const identityLabels = ['本人不认同这一名称', '本人尚不确定是否认同这一名称', '本人部分自我认同这一名称', '本人明确自我认同这一名称'];
    let identityNote = identity === null ? '名称认同尚未记录。' : identityLabels[identity] + '。';
    if (['历史路线', '理论学派'].includes(c.kind)) identityNote += '政策或理论主张与名称认同分开报告；原有理解及近邻区别需人工核对，网页不自动确认历史或学术身份。';
    else if (identity >= 2) identityNote += '这是本人报告的名称认同，不等于全套思想已核验。';
    if (crossQuestionConflicts.length) identityNote += '参考题存在不同取向，适用条件待澄清；不会机械否决或抹去原答。';
    return { ...c, status, statusCode, strongSupport, claims, support, conflicts, neutral, missing, familiarity, familiarityAnswer: familiarityAnswer === undefined ? null : familiarityAnswer, identity, identityAnswer: identityAnswer === undefined ? null : identityAnswer, explanation, identityNote, referenceEvidence: evidence, crossQuestionConflicts, nearCards: (D.nearCardMap[c.id] || []).map(id => ({ id, name: cardsById[id].name, statusCode: 'untested' })), sensitive: statusCode === 'supported' && claims.some(q => q.answer === 5), unblinded: false };
  }
  function scenario(answers = {}) {
    const pairs = Array.from({ length: 6 }, (_, i) => {
      const id = 'J' + String(i + 1).padStart(2, '0'), a = answers[id + 'A'], b = answers[id + 'B'];
      return { id, policy: byId[id + 'A'].policy, a: a === undefined ? null : a, b: b === undefined ? null : b, difference: validRating(a) && validRating(b) ? a - b : null };
    });
    const values = pairs.filter(p => p.difference !== null).map(p => p.difference), complete = values.length;
    return { pairs, complete, meanDifference: complete >= 4 ? round(values.reduce((a, b) => a + b, 0) / complete) : null, meanAbsoluteDifference: complete >= 4 ? round(values.reduce((a, b) => a + Math.abs(b), 0) / complete) : null, note: '仅描述同一政策在甲乙设定下的回答差异。所有制与执政目标同时改变，且顺序未随机化，不能分别解释因果作用，也不能据此评价人格。' };
  }
  function recommendCards(answers = {}, moduleIds = []) {
    const seen = new Set(), result = [];
    for (const moduleId of [...new Set(moduleIds)].filter(id => modulesById[id])) {
      const group = D.cards.filter(c => c.module === moduleId || (c.cross_modules || []).includes(moduleId)).filter(c => !seen.has(c.id)).map(c => {
        seen.add(c.id);
        const evidence = referenceEvidence(c, answers), valid = evidence.filter(q => q.oriented !== null);
        return { ...c, routingModule: moduleId, referenceValid: valid.length, referenceMean: valid.length >= 3 ? round(valid.reduce((s, q) => s + q.oriented, 0) / valid.length) : null, referenceIncomplete: valid.length < 4, referenceEvidence: evidence, nearIds: D.nearCardMap[c.id] || [] };
      });
      group.sort((a, b) => (b.referenceMean === null ? -Infinity : b.referenceMean) - (a.referenceMean === null ? -Infinity : a.referenceMean) || b.referenceValid - a.referenceValid || a.id.localeCompare(b.id));
      result.push(...group);
    }
    return result;
  }
  function recommendModules(answers = {}) {
    const stated = typeof answers.Z04 === 'string' ? answers.Z04.trim() : '';
    const matches = stated ? D.cards.filter(c => [c.name, ...(c.aliases || [])].some(n => n.length > 1 && stated.includes(n))) : [];
    const result = D.modules.map((m, index) => {
      const valid = m.anchors.map(id => answers[id]).filter(validRating);
      const names = matches.filter(c => c.module === m.id || (c.cross_modules || []).includes(m.id)).map(c => c.name);
      const clear = valid.filter(x => x <= 2 || x >= 6).length;
      return { ...m, screeningValid: valid.length, recommended: false, reason: names.length ? '与你在作答前提到的名称相关：' + names.slice(0, 3).join('、') + '。' : clear ? '你在这组筛查题中有 ' + clear + ' 项表达了明确意见，适合进一步核对；这不代表属于该专题的任何流派。' : '可根据兴趣选择；缺答或中立不会排除这一专题。', _self: names.length ? 1 : 0, _clear: clear, _index: index };
    });
    result.sort((a, b) => b._self - a._self || b._clear - a._clear || a._index - b._index);
    for (let i = 0; i < result.length; i++) { result[i].recommended = i < 2 && (result[i]._self > 0 || result[i]._clear > 0); delete result[i]._self; delete result[i]._clear; delete result[i]._index; }
    return result;
  }
  function analyze(session) {
    const s = validateSession(session), answers = s.answers, presented = new Set(s.presented);
    const facets = D.core.axes.map(a => facet(a, answers));
    const cards = s.selectedCards.map(c => card(c, answers, s.presented));
    const evaluated = Object.fromEntries(cards.map(c => [c.id, c]));
    for (const c of cards) {
      c.nearCards = c.nearCards.map(n => ({ ...n, statusCode: evaluated[n.id] ? evaluated[n.id].statusCode : 'untested' }));
      c.unblinded = (s.unblindedEdits || []).some(id => id.startsWith(c.id + '.')) || Number(answers.Z02) > 0 || s.catalogSeen === true;
      c.originalBlindAnswers = Object.fromEntries(Object.entries(s.originalBlindAnswers || {}).filter(([id]) => id.startsWith(c.id + '.')));
      c.unblindedEdits = (s.unblindedEdits || []).filter(id => id.startsWith(c.id + '.'));
    }
    const ratingIds = s.presented.filter(id => ratings.has(id));
    const quality = { presented: ratingIds.length, presentedTotal: s.presented.length, valid: 0, unknown: 0, refused: 0, missing: 0, neutral: 0, rates: {}, elapsedMs: s.elapsedMs, notes: [] };
    for (const id of ratingIds) { const kind = classifyAnswer(answers[id]); if (['support', 'neutral', 'oppose'].includes(kind)) { quality.valid++; if (kind === 'neutral') quality.neutral++; } else quality[kind]++; }
    for (const key of ['valid', 'unknown', 'refused', 'missing', 'neutral']) quality.rates[key] = ratingIds.length ? quality[key] / ratingIds.length : 0;
    const validAnswers = ratingIds.map(id => answers[id]).filter(validRating);
    if (validAnswers.length > 1 && new Set(validAnswers).size === 1) quality.notes.push('所有已答立场题使用同一个选项；请核对是否准确表达本意，不因此自动判作无效。');
    if (answers.Z01 >= 2) quality.notes.push('本人报告了较多表达顾虑；保留原答，不作分数校正。');
    if (Number(answers.Z02) > 0 || s.catalogSeen === true) quality.notes.push('作答前或核验前已看过解释/目录，需按未盲核验理解。');
    if (typeof answers.Z06 === 'string' && answers.Z06.trim() && !['U', 'X'].includes(answers.Z06)) quality.notes.push('本人记录了题意或适用条件补充，请结合原文阅读。');
    quality.notes.push('未呈现题不计入缺答比例；不了解和拒答不等于敷衍。时长、同答和交叉取向均不自动否定答卷。');
    const counts = ids => ({ valid: ids.filter(id => validRating(answers[id])).length, total: ids.length, presented: ids.filter(id => presented.has(id)).length });
    const modules = D.modules.map(m => ({ id: m.id, title: m.title, selected: s.selectedModules.includes(m.id), ...counts(m.items.map(q => q.id)), screeningValid: counts(m.anchors).valid, screeningTotal: m.anchors.length }));
    const tested = new Set(cards.filter(c => c.statusCode !== 'untested').map(c => c.id));
    const coverage = { core: counts(D.core.items.map(q => q.id)), screening: counts(anchors), modules, selectedModules: s.selectedModules, selectedCards: s.selectedCards, untestedModules: modules.filter(m => !m.selected), untestedCards: D.cards.filter(c => !tested.has(c.id)).map(c => ({ id: c.id, name: c.name, module: c.module, kind: c.kind })), testedCardCount: tested.size, totalCards: D.cards.length };
    const summary = { supportedCards: cards.filter(c => c.statusCode === 'supported'), partialCards: cards.filter(c => c.statusCode === 'partial'), insufficientCards: cards.filter(c => c.statusCode === 'insufficient'), untestedCards: cards.filter(c => c.statusCode === 'untested'), descriptiveText: [] };
    const reportable = facets.filter(f => f.value !== null);
    summary.descriptiveText.push('本次可报告 ' + reportable.length + ' 个分面的平均倾向，共核验 ' + tested.size + ' 张思想卡。');
    if (summary.supportedCards.length) summary.descriptiveText.push('在实际核验的主张中，' + summary.supportedCards.map(c => c.name).join('、') + '的三项均得到支持；这不等于完整身份归属。');
    if (summary.partialCards.length) summary.descriptiveText.push('对' + summary.partialCards.map(c => c.name).join('、') + '保留了中立或不同意见，见逐项依据。');
    summary.descriptiveText.push('未检验的思想不作排除；不同专题、不同时间的报告须结合各自覆盖范围比较。');
    return { version: D.version, id: s.id, facets, cards, scenarios: scenario(answers), quality, coverage, summary, context: D.core.context.map(q => ({ ...q, answer: own(answers, q.id) ? answers[q.id] : null })), stopReason: s.stopReason, finished: s.finished };
  }
  function validateSession(input) {
    if (!Session || typeof Session.validate !== 'function') throw new Error('请先载入 OMNI 作答流程。');
    return Session.validate(D, input);
  }
  function encodeSession(session) {
    const json = JSON.stringify(validateSession(session));
    let encoded;
    if (typeof Buffer !== 'undefined') encoded = Buffer.from(json, 'utf8').toString('base64');
    else { const bytes = new TextEncoder().encode(json); let binary = ''; for (const b of bytes) binary += String.fromCharCode(b); encoded = btoa(binary); }
    return 'OMNI1.' + encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeSession(code) {
    if (typeof code !== 'string' || code.length > 250000) throw new Error('答卷文本为空或超过大小限制。');
    const value = code.trim();
    try {
      if (value.startsWith('{')) return validateSession(JSON.parse(value));
      if (!/^OMNI1\.[A-Za-z0-9_-]+$/.test(value)) throw new Error('请使用本版 OMNI1 答卷代码或 JSON 文件。');
      const b64 = value.slice(6).replace(/-/g, '+').replace(/_/g, '/');
      let json;
      if (typeof Buffer !== 'undefined') json = Buffer.from(b64, 'base64').toString('utf8');
      else { const binary = atob(b64), bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); json = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      return validateSession(JSON.parse(json));
    } catch (error) { throw new Error('无法读取答卷：' + (error && error.message ? error.message : '格式不正确。')); }
  }
  return Object.freeze({ facet, card, scenario, analyze, recommendCards, recommendModules, validRating, classifyAnswer, validateSession, encodeSession, decodeSession });
});
