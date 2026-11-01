/* Versioned, browser-local questionnaire flow. No network or identity collection. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OMNI_SESSION = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMIT = 95 * 60000;
  const CARD_SUFFIXES = ['a', 'b', 'c', 'K', 'I', 'explanation'];
  function fresh(data, now = Date.now()) {
    return {version: data.version, id: 'O-' + now.toString(36).toUpperCase(), startedAt: now,
      elapsedMs: 0, stage: 'instructions', pos: 0, answers: {}, presented: [],
      selectedModules: [], selectedCards: [], cardRevealed: [], unblindedEdits: [], originalBlindAnswers: {},
      catalogSeen: false, finished: false, stopReason: ''};
  }
  function base(data) {
    return [...data.core.items, ...data.modules.flatMap(m => m.anchors.map(id => m.items.find(q => q.id === id))),
      ...data.core.scenarios, ...data.core.context];
  }
  function plan(data, session, stage = session.stage) {
    if (stage === 'base') return base(data);
    if (stage === 'modules') return session.selectedModules.flatMap(id => {
      const m = data.modules.find(m => m.id === id);
      return m ? m.items.filter(q => !m.anchors.includes(q.id)) : [];
    });
    if (stage === 'cards') return session.selectedCards.flatMap(id => {
      const card = data.cards.find(c => c.id === id);
      return card ? CARD_SUFFIXES.map(part => ({id: id + '.' + part, cardId: id, part,
        text: part === 'c' ? card.contrast : card[part]})) : [];
    });
    return [];
  }
  function elapsed(session, now = Date.now()) {
    return session.finished ? session.elapsedMs : Math.max(session.elapsedMs || 0, now - session.startedAt, 0);
  }
  function finish(session, reason, now = Date.now()) {
    session.elapsedMs = Math.min(LIMIT, elapsed(session, now));
    session.finished = true; session.stopReason = reason; session.stage = 'result'; session.pos = 0;
    return session;
  }
  function enforce(data, s, now = Date.now()) {
    if (s.finished) return false;
    const before = s.stage + ':' + s.pos, minutes = elapsed(s, now) / 60000;
    if (minutes >= 95) { finish(s, '95分钟截止', now); return true; }
    if (minutes >= 91 && !['review', 'result'].includes(s.stage)) {
      s.stage = 'review'; s.pos = 0; s.stopReason = '91分钟停止核验，进入检查';
    } else if (minutes >= 85 && s.stage === 'cardSelect') {
      s.stage = 'review'; s.pos = 0; s.stopReason = '85分钟后未开启新卡';
    } else if (minutes >= 85 && s.stage === 'cards') {
      const q = plan(data, s)[s.pos];
      if (q && q.part === 'a' && !s.presented.includes(q.id)) {
        s.stage = 'review'; s.pos = 0; s.stopReason = '85分钟后未开启新卡';
      }
    } else if (minutes >= 75 && ['instructions', 'base', 'moduleSelect', 'modules'].includes(s.stage)) {
      s.stage = minutes >= 85 ? 'review' : 'cardSelect'; s.pos = 0;
      s.stopReason = '75分钟停止共同题与专题，保留未完成项';
    }
    return before !== s.stage + ':' + s.pos;
  }
  function present(s, q) {
    if (!s.presented.includes(q.id)) s.presented.push(q.id);
    if (q.cardId && ['K','I','explanation'].includes(q.part) && !s.cardRevealed.includes(q.cardId)) {
      s.originalBlindAnswers = s.originalBlindAnswers || {};
      for (const part of ['a','b','c']) {
        const id = q.cardId + '.' + part;
        if (Object.prototype.hasOwnProperty.call(s.answers, id)) s.originalBlindAnswers[id] = s.answers[id];
      }
      s.cardRevealed.push(q.cardId);
    }
  }
  function answer(s, q, value) {
    if (s.finished) return;
    value = normalizeAnswer(q.id, value);
    present(s, q);
    if (q.cardId && ['a','b','c'].includes(q.part) && s.cardRevealed.includes(q.cardId) && s.answers[q.id] !== value && !s.unblindedEdits.includes(q.id)) s.unblindedEdits.push(q.id);
    s.answers[q.id] = value;
  }
  function advance(data, s, delta = 1) {
    if (s.finished || !['base','modules','cards'].includes(s.stage) || ![-1,1].includes(delta)) return;
    const list = plan(data, s);
    if (s.pos + delta < 0) return;
    s.pos += delta;
    if (s.pos >= list.length) {
      s.stage = ({base:'moduleSelect',modules:'cardSelect',cards:'review'})[s.stage] || s.stage;
      s.pos = 0;
    }
  }
  function selectModules(data, s, ids) {
    if (s.finished) return;
    s.selectedModules = [...new Set(ids)].filter(id => data.modules.some(m => m.id === id)).slice(0,2);
    s.stage = s.selectedModules.length ? 'modules' : 'cardSelect'; s.pos = 0;
  }
  function selectCards(data, s, ids) {
    if (s.finished) return;
    s.selectedCards = [...new Set(ids)].filter(id => data.cards.some(c => c.id === id)).slice(0,4);
    s.stage = s.selectedCards.length ? 'cards' : 'review'; s.pos = 0;
  }
  function normalizeAnswer(id, value) {
    if (value === '×') value = 'X';
    if (value === 'U' || value === 'X' || value === '') return value;
    if (/^Z0[456]$|\.explanation$/.test(id)) {
      if (typeof value !== 'string' || value.length > 20000) throw new Error('文字答案无效：' + id);
      return value;
    }
    const maximum = id === 'Z02' ? 2 : /^Z0[123]$|\.[KI]$/.test(id) ? 3 : 7;
    const minimum = maximum <= 3 ? 0 : 1;
    if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error('答案选项无效：' + id);
    return value;
  }
  function validate(data, value) {
    if (!value || value.version !== data.version || !value.answers || Array.isArray(value.answers) || typeof value.answers !== 'object') throw new Error('答卷版本或答案格式不兼容。旧版请使用旧版计分器。');
    const s = {...fresh(data), ...value};
    const questionIds = new Set([...base(data).map(q => q.id), ...data.modules.flatMap(m => m.items.map(q => q.id)), ...data.cards.flatMap(c => CARD_SUFFIXES.map(part => c.id + '.' + part))]);
    const cardIds = new Set(data.cards.map(c => c.id));
    for (const key of ['presented','selectedModules','selectedCards','cardRevealed','unblindedEdits']) {
      if (!Array.isArray(s[key]) || s[key].some(x => typeof x !== 'string')) throw new Error('答卷记录不完整：' + key);
      if (new Set(s[key]).size !== s[key].length) throw new Error('答卷含重复记录：' + key);
      s[key] = [...s[key]];
    }
    if (!Number.isFinite(s.startedAt) || s.startedAt < 0 || s.startedAt > Date.now() + 300000 || !Number.isFinite(s.elapsedMs) || s.elapsedMs < 0 || s.elapsedMs > LIMIT || !Number.isInteger(s.pos) || s.pos < 0) throw new Error('作答时间或位置无效。');
    if (!['instructions','base','moduleSelect','modules','cardSelect','cards','review','result'].includes(s.stage)) throw new Error('作答阶段无效。');
    if (s.selectedModules.length > 2 || s.selectedCards.length > 4 || s.selectedModules.some(id => !data.modules.some(m => m.id === id)) || s.selectedCards.some(id => !data.cards.some(c => c.id === id))) throw new Error('分支范围无效。');
    if (typeof s.finished !== 'boolean' || typeof s.catalogSeen !== 'boolean' || (s.stage === 'result') !== s.finished) throw new Error('完成状态无效。');
    if (typeof s.id !== 'string' || s.id.length > 100 || typeof s.stopReason !== 'string' || s.stopReason.length > 1000) throw new Error('答卷标记无效。');
    const questions = plan(data, s);
    if ((questions.length && s.pos >= questions.length) || (!questions.length && (s.pos !== 0 || ['base','modules','cards'].includes(s.stage)))) throw new Error('作答位置超出本阶段题目。');
    if (s.presented.some(id => !questionIds.has(id)) || s.cardRevealed.some(id => !cardIds.has(id))) throw new Error('呈现记录含未知题目。');
    const allowed = new Set([...base(data), ...plan(data, s, 'modules'), ...plan(data, s, 'cards')].map(q => q.id));
    if (s.presented.length > 250 || s.presented.some(id => !allowed.has(id)) || s.cardRevealed.some(id => !s.selectedCards.includes(id))) throw new Error('呈现记录超出本次分支。');
    if (s.reviewReturn !== undefined) {
      const back = s.reviewReturn;
      if (!back || !['base','modules','cards','review'].includes(back.stage) || !Number.isInteger(back.pos) || back.pos < 0 || (back.stage === 'review' ? back.pos !== 0 : back.pos >= plan(data,s,back.stage).length)) throw new Error('复核返回位置无效。');
      s.reviewReturn = {stage:back.stage,pos:back.pos};
    }
    s.answers = {};
    for (const [id, answer] of Object.entries(value.answers)) {
      if (!questionIds.has(id) || !s.presented.includes(id)) throw new Error('答案缺少合法呈现记录：' + id);
      s.answers[id] = normalizeAnswer(id, answer);
    }
    if (!s.originalBlindAnswers || typeof s.originalBlindAnswers !== 'object' || Array.isArray(s.originalBlindAnswers)) throw new Error('原始核验答案格式无效。');
    s.originalBlindAnswers = {...s.originalBlindAnswers};
    for (const [id, answer] of Object.entries(s.originalBlindAnswers)) {
      if (!questionIds.has(id) || !/\.[abc]$/.test(id) || !s.cardRevealed.includes(id.split('.')[0]) || !s.presented.includes(id)) throw new Error('原始核验答案无效：' + id);
      s.originalBlindAnswers[id] = normalizeAnswer(id, answer);
    }
    if (s.unblindedEdits.some(id => !questionIds.has(id) || !/\.[abc]$/.test(id) || !s.cardRevealed.includes(id.split('.')[0]) || !s.presented.includes(id))) throw new Error('核验修改记录无效。');
    return s;
  }
  return {LIMIT, fresh, base, plan, elapsed, finish, enforce, present, answer, advance, selectModules, selectCards, validate};
});
