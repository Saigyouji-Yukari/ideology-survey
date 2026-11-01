/* 意识形态测试调查 · 作答与结果分析 */
(function () {
  'use strict';
  const D = window.SURVEY_DATA, E = window.IdeoEngine;
  E.init(D);
  const $ = id => document.getElementById(id);
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const KEY = 'ideology-survey-v5';
  const ITN = {}, ITC = {}; for (const it of D.items) { ITN[it.n] = it; ITC[it.c] = it; }
  const STEPS = D.items.map(it => it.n);
  const LIK = ['非常不同意', '不同意', '有点不同意', '中立（两边相当）', '有点同意', '同意', '非常同意'];
  const TRD = ['完全倾向A', '明显倾向A', '略倾向A', '两者相当', '略倾向B', '明显倾向B', '完全倾向B'];
  const SIZE = ['s3', 's2', 's1', 's0', 's1', 's2', 's3'];

  // ---------------- 本机保存 ----------------
  const store = {
    load() { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 无痕模式等情况下无法保存，不影响作答 */ } },
    clear() { try { localStorage.removeItem(KEY); } catch (e) { /* 同上 */ } },
  };
  function makeCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = new Uint32Array(6);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(r); else for (let i = 0; i < 6; i++) r[i] = Math.floor(Math.random() * 1e9);
    let s = 'W-'; for (const x of r) s += A[x % A.length]; return s;
  }
  const fresh = () => ({ v: 5, code: makeCode(), ans: {}, cards: {}, pos: 0, activeMs: 0, lastTs: 0, started: false, finished: false, fu: null, view: 'intro' });
  let S = store.load(); if (!S || S.v !== 5) S = fresh();
  const save = () => store.save(S);

  // ---------------- 提示、复制、下载 ----------------
  let toastT = null;
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
  async function copy(text, fallbackId) {
    try { await navigator.clipboard.writeText(text); toast('已复制'); }
    catch (e) { const el = fallbackId && $(fallbackId); if (el) { el.focus(); el.select(); toast('已选中，请按 Ctrl+C（或长按）复制'); } else toast('复制没有成功，请手动选择复制'); }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---------------- 作答状态 ----------------
  function colsOf(n) {
    const it = ITN[n];
    if (it.k === 'context' && it.s === 'C') return [n + '甲', n + '乙'];
    if (it.k === 'priority') return ['258第一', '258第二', '258第三', '258最不看重'];
    return [String(n)];
  }
  const val = c => (S.ans[c] === undefined || S.ans[c] === null) ? '' : String(S.ans[c]);
  function stepStatus(n) {
    const v = colsOf(n).map(val);
    if (ITN[n].k === 'priority') return v[0] ? 'done' : 'empty';
    if (v.every(x => x === '')) return 'empty';
    if (v.every(x => x === 'U')) return 'u';
    if (v.every(x => x === '×')) return 'x';
    return v.every(x => x !== '') ? 'done' : 'part';
  }
  function tick() { const now = Date.now(); if (S.lastTs) S.activeMs += Math.min(now - S.lastTs, 180000); S.lastTs = now; }
  function setAns(col, v) { S.ans[col] = v; tick(); save(); }
  const minutes = () => Math.max(1, Math.round(S.activeMs / 60000));

  // ---------------- 视图 ----------------
  const VIEWS = ['intro', 'quiz', 'review', 'followup', 'result'];
  function allowed(v) { return v === 'intro' || (v === 'quiz' || v === 'review' ? S.started : S.finished); }
  function show(v, push) {
    if (!allowed(v)) v = 'intro';
    S.view = v; save();
    for (const x of VIEWS) $('view-' + x).hidden = x !== v;
    if (push !== false) { const h = v === 'intro' ? ' ' : '#' + v; if ((location.hash || ' ') !== h) history.pushState(null, '', v === 'intro' ? location.pathname + location.search : h); }
    window.scrollTo(0, 0);
    ({ intro: renderIntro, quiz: renderQuiz, review: renderReview, followup: renderFU, result: renderResult })[v]();
  }
  window.addEventListener('popstate', () => show((location.hash || '#intro').slice(1), false));
  $('brand').addEventListener('click', e => { e.preventDefault(); show('intro'); });

  // ---------------- 首页 ----------------
  function renderIntro() {
    document.querySelectorAll('[data-total]').forEach(el => { el.textContent = D.total; });
    $('instr-list').innerHTML = D.instructions.map(([lead, text]) => `<li>${lead ? `<b>${esc(lead)}</b>` : ''}${esc(text)}</li>`).join('');
    const done = STEPS.filter(n => stepStatus(n) !== 'empty').length;
    let h = '';
    if (S.finished) h = `<button class="btn primary big" data-act="result">查看我的结果</button><button class="btn" data-act="quiz">修改答案</button>`;
    else if (S.started) h = `<button class="btn primary big" data-act="quiz">继续作答（已答 ${done} / ${D.total} 题）</button>`;
    else h = `<button class="btn primary big" data-act="start">开 始 测 试</button>`;
    if (S.started) h += `<button class="linkbtn" data-act="reset">清除本机记录并重新开始</button>`;
    $('intro-actions').innerHTML = h;
  }
  $('intro-actions').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'start') { S.started = true; S.lastTs = Date.now(); S.pos = 0; save(); show('quiz'); }
    else if (a === 'quiz') { S.lastTs = Date.now(); show('quiz'); }
    else if (a === 'result') show('result');
    else if (a === 'reset') { if (window.confirm('确定要清除这台设备上保存的全部答案吗？清除后无法恢复。')) { store.clear(); S = fresh(); save(); show('intro'); toast('已清除'); } }
  });

  // ---------------- 题目卡片 ----------------
  function dots(col, cur, labels, ends) {
    return `<div class="scale" role="radiogroup" aria-label="${esc(ends ? ends.join('—') : '同意程度')}">
      ${ends ? `<div class="scale-ends"><span>${esc(ends[0])}</span><span>${esc(ends[1])}</span></div>` : ''}
      <div class="dots">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button class="dot ${SIZE[i - 1]}" role="radio" aria-checked="${cur === String(i)}" data-col="${esc(col)}" data-v="${i}" aria-label="${i} ${esc(labels ? labels[i - 1] : '')}">${i}</button>`).join('')}</div>
      ${labels ? `<div class="scale-labels">${labels.map(l => `<span>${esc(l)}</span>`).join('')}</div>` : ''}
    </div>`;
  }
  function alt(col, cur) {
    return `<div class="alt"><button class="chipbtn" role="radio" aria-checked="${cur === 'U'}" data-col="${esc(col)}" data-v="U">不了解或无法判断（U）</button><button class="chipbtn" role="radio" aria-checked="${cur === '×'}" data-col="${esc(col)}" data-v="×">不愿回答（×）</button></div>`;
  }
  function secIntro(it) {
    const sec = D.sections[it.sec];
    if (!sec.intro) return '';
    if (it.n === sec.first) return `<div class="sec-intro"><b>${esc(sec.title)}</b>　${esc(sec.intro)}</div>`;
    return `<details class="sec-more"><summary>本部分说明</summary><p>${esc(sec.intro)}</p></details>`;
  }
  function itemHTML(it, mode) {
    const n = it.n, col = String(n), cur = val(col);
    let h = mode === 'quiz' ? secIntro(it) : '';
    if (it.bg) h += `<p class="bg-note">${esc(it.bg)}</p>`;
    if (it.k === 'tradeoff') {
      const [a, b] = it.t.split('｜');
      h += `<h2 class="q-text">当二者冲突时，你更倾向于哪一方？</h2><div class="trade"><div><small>A</small>${esc(a)}</div><div><small>B</small>${esc(b)}</div></div>` + dots(col, cur, TRD) + alt(col, cur);
    } else if (it.k === 'context' && it.s === 'C') {
      h += `<h2 class="q-text">${esc(it.t)}</h2>`;
      h += ['甲', '乙'].map(side => { const c = n + side, cv = val(c); return `<div class="ctx-row"><h3>${side}国</h3><p class="q-sub">${side === '甲' ? '以公有制为主体，由社会主义政党执政' : '以私有制和市场经济为主体，由非社会主义政党执政'}</p>${dots(c, cv, LIK)}${alt(c, cv)}</div>`; }).join('');
    } else if (it.k === 'priority') {
      const P = D.priority, pick = ['258第一', '258第二', '258第三'].map(val), least = val('258最不看重');
      h += `<h2 class="q-text">在下面12个议题中，你最看重哪几项？</h2><p class="q-sub">先依次点选最看重的三项（按重要程度），再点选最不看重的一项。点已选的项可以取消。</p>
        <p class="pick-h">最看重的三项</p><div class="opts">${P.map(p => { const k = pick.indexOf(p[0]); return `<button class="opt" role="checkbox" aria-checked="${k >= 0}" data-prio="${p[0]}"><span class="k">${p[0]}</span>${esc(p[1])}${k >= 0 ? `<span class="badge">第${'一二三'[k]}</span>` : ''}</button>`; }).join('')}</div>
        <p class="pick-h">最不看重的一项</p><div class="opts">${P.map(p => `<button class="opt" role="radio" aria-checked="${least === p[0]}" data-least="${p[0]}"><span class="k">${p[0]}</span>${esc(p[1])}</button>`).join('')}</div>
        <div class="q-actions"><button class="btn primary" data-go="next">下一题</button></div>`;
    } else if (it.c === 'Q1') {
      h += `<h2 class="q-text">${esc(it.wt || it.t)}</h2><div class="opts">${D.ident.map(o => { const k = o[0]; return `<button class="opt" role="radio" aria-checked="${cur === k}" data-col="259" data-v="${k}"><span class="k">${k}</span>${esc(o.slice(2))}</button>`; }).join('')}</div>`;
      if (cur === 'O') h += `<div class="field"><label for="f-259o">写明你认同的立场：</label><input class="txt" id="f-259o" maxlength="40" value="${esc(val('259写明'))}" placeholder="可以不填"><button class="btn primary" data-go="next">下一题</button></div>`;
    } else if (n >= 261 && n <= 264) {
      h += `<h2 class="q-text">${esc(it.wt || it.t)}</h2><div class="scale"><div class="scale-ends"><span>0 = ${esc(it.ends[0])}</span><span>10 = ${esc(it.ends[1])}</span></div><div class="scale11" role="radiogroup">${Array.from({ length: 11 }, (_, i) => `<button role="radio" aria-checked="${cur === String(i)}" data-col="${col}" data-v="${i}">${i}</button>`).join('')}</div></div>` + alt(col, cur);
    } else if (it.c === 'Q2' || it.c === 'Q5') {
      h += `<h2 class="q-text">${esc(it.wt || it.t)}</h2>` + dots(col, cur, null, it.ends) + alt(col, cur);
    } else if (it.c === 'Q6') {
      h += `<h2 class="q-text">${esc(it.wt || it.t)}</h2><div class="yesno"><button class="btn" role="radio" aria-checked="${cur === '是'}" data-col="266" data-v="是">是</button><button class="btn" role="radio" aria-checked="${cur === '否'}" data-col="266" data-v="否">否</button></div>`;
    } else if (it.c === 'Q7') {
      if (!val('267')) S.ans['267'] = String(minutes());
      h += `<h2 class="q-text">${esc(it.wt || it.t)}</h2><p class="q-sub">网页记录的作答时间约 ${minutes()} 分钟（中途离开的时间不计入）。如果不准确，可以修改。</p><div class="field"><input class="num" id="f-267" inputmode="numeric" value="${esc(val('267'))}" aria-label="作答分钟数"><span>分钟</span></div><div class="q-actions"><button class="btn primary" data-go="next">完成作答</button></div>`;
    } else {
      h += `<h2 class="q-text">${esc(it.wt || it.t)}</h2>` + dots(col, cur, LIK) + alt(col, cur);
    }
    return h;
  }

  // ---------------- 逐题作答 ----------------
  function renderQuiz() {
    S.pos = Math.min(Math.max(0, S.pos), STEPS.length - 1);
    const n = STEPS[S.pos], it = ITN[n], sec = D.sections[it.sec];
    $('q-sec').textContent = sec.title;
    $('q-count').textContent = `第 ${n} 题 / 共 ${D.total} 题`;
    const answered = STEPS.filter(m => stepStatus(m) !== 'empty').length;
    $('q-bar').style.width = (answered / STEPS.length * 100).toFixed(1) + '%';
    $('q-card').innerHTML = itemHTML(it, 'quiz');
    $('q-prev').disabled = S.pos === 0;
    $('q-next').textContent = S.pos === STEPS.length - 1 ? '完成 →' : stepStatus(n) === 'empty' ? '跳过 →' : '下一题 →';
  }
  let advT = null;
  function go(d) {
    clearTimeout(advT);
    const np = S.pos + d;
    if (np < 0) return;
    if (np >= STEPS.length) { save(); show('review'); return; }
    S.pos = np; save(); renderQuiz();
    const top = document.querySelector('.q-top'); if (top && window.scrollY > top.offsetTop) window.scrollTo(0, top.offsetTop);
  }
  function autoNext() { clearTimeout(advT); advT = setTimeout(() => go(1), 170); }
  function onChoose(col, v) {
    const n = parseInt(col, 10), it = ITN[n];
    setAns(col, v);
    if (col === '259' && v !== 'O') S.ans['259写明'] = '';
    if (S.view === 'quiz') {
      renderQuiz();
      const st = stepStatus(n);
      if (it.c === 'Q1' && v === 'O') { const f = $('f-259o'); if (f) f.focus(); return; }
      if (st === 'done' || st === 'u' || st === 'x') autoNext();
    } else if (S.view === 'followup') { renderFU(); fuAuto(); }
  }
  $('q-card').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.col) return onChoose(b.dataset.col, b.dataset.v);
    if (b.dataset.prio) {
      const cols = ['258第一', '258第二', '258第三']; const cur = cols.map(val).filter(Boolean);
      const k = cur.indexOf(b.dataset.prio);
      if (k >= 0) cur.splice(k, 1); else if (cur.length < 3) cur.push(b.dataset.prio); else { toast('已经选了三项，先取消一项'); return; }
      cols.forEach((c, i) => { S.ans[c] = cur[i] || ''; }); tick(); save(); renderQuiz(); return;
    }
    if (b.dataset.least) { setAns('258最不看重', val('258最不看重') === b.dataset.least ? '' : b.dataset.least); renderQuiz(); return; }
    if (b.dataset.go === 'next') { const f = $('f-267'); if (f) { const m = f.value.replace(/[^\d.]/g, ''); setAns('267', m); } go(1); }
  });
  $('q-card').addEventListener('input', e => {
    if (e.target.id === 'f-259o') { S.ans['259写明'] = e.target.value.replace(/[\r\n,"]/g, ' ').trim(); save(); }
    if (e.target.id === 'f-267') { S.ans['267'] = e.target.value.replace(/[^\d.]/g, ''); save(); }
  });
  $('q-prev').addEventListener('click', () => go(-1));
  $('q-next').addEventListener('click', () => go(1));

  // 键盘
  let tenBuf = null;
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') { if (e.key === 'Enter' && S.view === 'quiz') { e.preventDefault(); const f = $('f-267'); if (f) setAns('267', f.value.replace(/[^\d.]/g, '')); go(1); } return; }
    if (!$('map-overlay').hidden) { if (e.key === 'Escape') closeMap(); return; }
    if (S.view !== 'quiz' && S.view !== 'followup') return;
    const k = e.key;
    if (S.view === 'quiz' && (k === 'ArrowLeft' || k === 'Backspace')) { e.preventDefault(); go(-1); return; }
    if (S.view === 'quiz' && (k === 'ArrowRight' || k === 'Enter')) { e.preventDefault(); go(1); return; }
    const target = currentTarget(); if (!target) return;
    const { col, type } = target;
    const pick = (c, v) => (S.view === 'followup' ? chooseFU(c, v) : onChoose(c, v));
    if (type === 'ident') { if (/^[a-pA-P]$/.test(k)) { e.preventDefault(); onChoose('259', k.toUpperCase()); } return; }
    if (type === 'yesno') { if (/^[yY]$/.test(k)) onChoose(col, '是'); else if (/^[nN]$/.test(k)) onChoose(col, '否'); return; }
    if (/^[uU]$/.test(k)) { e.preventDefault(); pick(col, 'U'); return; }
    if (/^[xX*]$/.test(k)) { e.preventDefault(); pick(col, '×'); return; }
    if (type === 'scale10' && /^\d$/.test(k)) {
      e.preventDefault();
      if (tenBuf === '1' && k === '0') { tenBuf = null; onChoose(col, '10'); return; }
      if (k === '1') { tenBuf = '1'; setTimeout(() => { if (tenBuf === '1') { tenBuf = null; onChoose(col, '1'); } }, 600); return; }
      onChoose(col, k); return;
    }
    if (type === 'likert' && /^[1-7]$/.test(k)) { e.preventDefault(); pick(col, k); }
  });
  function currentTarget() {
    if (S.view === 'followup') { const f = S.fu; if (!f || f.stage === 'intro') return null; const t = fuItem(); return t ? { col: t.col, type: 'likert' } : null; }
    const n = STEPS[S.pos], it = ITN[n];
    if (it.k === 'priority' || it.c === 'Q7') return null;
    if (it.c === 'Q1') return { col: '259', type: 'ident' };
    if (it.c === 'Q6') return { col: '266', type: 'yesno' };
    if (n >= 261 && n <= 264) return { col: String(n), type: 'scale10' };
    if (it.k === 'context' && it.s === 'C') return { col: val(n + '甲') === '' ? n + '甲' : n + '乙', type: 'likert' };
    return { col: String(n), type: 'likert' };
  }

  // 题目总览
  function openMap() {
    const cls = { done: 'done', part: 'done', u: 'u', x: 'x', empty: '' };
    $('map-grid').innerHTML = D.sections.map((sec, si) => `<div class="map-sec">${esc(sec.title)}</div><div class="map-cells">${STEPS.filter(n => ITN[n].sec === si).map(n => `<button class="${cls[stepStatus(n)]}${STEPS[S.pos] === n ? ' cur' : ''}" data-jump="${n}" aria-label="第${n}题">${n}</button>`).join('')}</div>`).join('');
    $('map-overlay').hidden = false; $('map-close').focus();
  }
  function closeMap() { $('map-overlay').hidden = true; }
  $('q-map').addEventListener('click', openMap);
  $('map-close').addEventListener('click', closeMap);
  $('map-overlay').addEventListener('click', e => {
    if (e.target === $('map-overlay')) return closeMap();
    const b = e.target.closest('[data-jump]'); if (!b) return;
    S.pos = STEPS.indexOf(+b.dataset.jump); closeMap(); if (S.view !== 'quiz') show('quiz'); else { save(); renderQuiz(); }
  });

  // ---------------- 交卷前检查 ----------------
  function renderReview() {
    const st = STEPS.map(stepStatus);
    const cnt = k => st.filter(x => x === k).length;
    const empty = STEPS.filter((n, i) => st[i] === 'empty' || st[i] === 'part');
    $('review-body').innerHTML = `
      <p>你已经答完全部题目。生成结果之前，可以先检查还没有答的题。</p>
      <div class="stats"><div><b>${cnt('done')}</b><span>已作答</span></div><div><b>${cnt('u')}</b><span>不了解或无法判断</span></div><div><b>${cnt('x')}</b><span>不愿回答</span></div><div><b>${empty.length}</b><span>还没有答</span></div></div>
      ${empty.length ? `<p class="small">还没有答的题（点题号回去作答）：</p><div class="jumplist">${empty.map(n => `<button data-jump="${n}">${n}</button>`).join('')}</div>` : '<p class="small muted">所有题都已经作答。</p>'}
      <div class="actions"><button class="btn primary big" data-act="finish">生成我的分析结果</button><button class="btn" data-act="back">回去检查</button></div>`;
  }
  $('review-body').addEventListener('click', e => {
    const j = e.target.closest('[data-jump]');
    if (j) { S.pos = STEPS.indexOf(+j.dataset.jump); show('quiz'); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'back') { show('quiz'); return; }
    if (b.dataset.act === 'finish') {
      if (!val('267')) S.ans['267'] = String(minutes());
      S.finished = true; S.finishedAt = Date.now();
      startFU();
    }
  });

  // ---------------- 补充题 ----------------
  const compute = () => E.compute(S.ans, S.cards);
  const cardFilled = id => (S.cards[id] || []).some(v => v);
  function startFU() {
    const R = compute();
    if (R.suspect) { S.fu = { stage: 'done' }; save(); show('result'); return; }
    const reask = R.recs.reask.slice();
    const needCard0 = R.recs.card0 && !cardFilled('卡0');
    const needPair = R.recs.pair && !cardFilled(R.recs.pair.id);
    if (!reask.length && !needCard0 && !needPair) { S.fu = { stage: 'done' }; save(); show('result'); return; }
    S.fu = { stage: 'intro', reask, idx: 0, est: reask.length + (needCard0 ? 4 : 0) + (needPair ? 4 : 0) };
    save(); show('followup');
  }
  function nextStage() {
    const f = S.fu, R = compute();
    if (f.stage === 'intro' || f.stage === 'reask') {
      if (R.recs.card0 && !cardFilled('卡0')) { f.stage = 'card'; f.card = '卡0'; f.idx = 0; save(); renderFU(); return; }
    }
    if (f.stage !== 'pair' && R.recs.pair && !cardFilled(R.recs.pair.id)) { f.stage = 'pair'; f.card = R.recs.pair.id; f.idx = 0; save(); renderFU(); return; }
    f.stage = 'done'; save(); show('result');
  }
  function fuItem() {
    const f = S.fu;
    if (f.stage === 'reask') { const n = f.reask[f.idx]; return n === undefined ? null : { kind: 'item', n, col: String(n) }; }
    if (f.stage === 'card' || f.stage === 'pair') { const c = D.cards.find(x => x.id === f.card); return f.idx < 4 ? { kind: 'card', card: c, i: f.idx, col: 'card:' + c.id + ':' + f.idx } : null; }
    return null;
  }
  function renderFU() {
    const f = S.fu, box = $('fu-body');
    if (!f || f.stage === 'done') { show('result'); return; }
    if (f.stage === 'intro') {
      box.innerHTML = `<div class="panel"><h2>最后几道补充题</h2>
        <p>根据你的回答，有几个问题还不足以作出判断。请再看一下下面这些题（最多约 ${f.est} 道）。你可以补答，也可以保持原来的选择；补充题不会告诉你它们和哪种立场有关。</p>
        <div class="actions"><button class="btn primary big" data-act="go">开始补答</button><button class="btn" data-act="skip">跳过，直接看结果</button></div></div>`;
      return;
    }
    const t = fuItem();
    if (!t) { nextStage(); return; }
    let head, body;
    if (t.kind === 'item') {
      head = `补答 ${f.idx + 1} / ${f.reask.length} · 原来的回答：${({ U: '不了解', '×': '不愿回答' })[val(t.col)] || '未答'}`;
      const it = ITN[t.n];
      body = `<p class="q-sub">${esc(D.sections[it.sec].title)} · 第 ${t.n} 题</p>` + itemHTML(it, 'fu');
    } else {
      head = `补充题 ${t.i + 1} / 4`;
      const cur = (S.cards[t.card.id] || [])[t.i] || '';
      body = `<h2 class="q-text">${esc(t.card.items[t.i][0])}</h2>` + dots(t.col, cur, LIK) + alt(t.col, cur);
    }
    box.innerHTML = `<div class="q-top"><div class="q-meta"><span class="q-sec">补充作答</span><span class="q-count">${esc(head)}</span></div></div>
      <article class="q-card" id="fu-card">${body}</article>
      <nav class="q-nav"><button class="btn ghost" data-act="prev">← 上一题</button><button class="btn ghost" data-act="keep">保持原样 →</button></nav>
      <p class="kbd-hint">键盘：数字键作答，U 不了解，X 不愿回答。</p>`;
  }
  function fuAuto() { clearTimeout(advT); advT = setTimeout(() => { S.fu.idx++; save(); renderFU(); }, 170); }
  function chooseFU(col, v) {
    if (col.startsWith('card:')) { const [, id, i] = col.split(':'); const arr = (S.cards[id] || ['', '', '', '']).slice(); arr[+i] = v; S.cards[id] = arr; tick(); save(); renderFU(); fuAuto(); }
    else onChoose(col, v);
  }
  $('fu-body').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const f = S.fu;
    if (b.dataset.act === 'go') { if (f.reask.length) { f.stage = 'reask'; f.idx = 0; save(); renderFU(); } else nextStage(); return; }
    if (b.dataset.act === 'skip') { f.stage = 'done'; save(); show('result'); return; }
    if (b.dataset.act === 'keep') { f.idx++; save(); renderFU(); return; }
    if (b.dataset.act === 'prev') { if (f.idx > 0) { f.idx--; save(); renderFU(); } return; }
    if (b.dataset.col) chooseFU(b.dataset.col, b.dataset.v);
  });

  // ================= 结果分析 =================
  const SUBP = E.SUBPOLE;
  const SCL = {}; for (const s of D.scales) SCL[s.code] = s;
  const DIMN = { E: '经济', L: '政治制度', R: '变革路径', V: '政党与组织', S: '社会文化' };
  const ANSW = { 1: '非常不同意', 2: '不同意', 3: '有点不同意', 4: '中立', 5: '有点同意', 6: '同意', 7: '非常同意' };
  const strip = s => s.replace(/^偏/, '');
  const cleanCard = s => s.replace(/经补问卡\d+区分/g, '经补充题区分');
  const pctOf = t => Math.round(t.pt / 8 * 100);
  function bandWord(code, d) {
    const s = SCL[code], b = E.band(d.T);
    return b === '++' ? '强烈偏向' + s.pos : b === '+' ? '明显偏向' + s.pos : b === '−' ? '明显偏向' + s.neg : b === '−−' ? '强烈偏向' + s.neg : '处在中间';
  }
  function subWord(name, d) {
    if (!d.report) return '未答较多';
    const b = E.band(d.T), [p, q] = SUBP[name];
    return b === '++' ? '强烈' + p : b === '+' ? '明显' + p : b === '−' ? '明显' + q : b === '−−' ? '强烈' + q : '居中';
  }
  const pos = v => ((v + 100) / 2).toFixed(2) + '%';
  function axis(name, d, neg, posL, text, sub) {
    const has = d.report && d.T !== null;
    const range = d.k > 0 && d.lo !== null ? `<div class="ax-range" style="left:${pos(d.lo)};width:${((d.hi - d.lo) / 2).toFixed(2)}%" title="未答题造成的可能范围"></div>` : '';
    const v = has ? `${E.sgn(d.T)} · ${text}` : d.a ? `未答较多，可能范围 ${E.sgn(d.lo)}～${E.sgn(d.hi)}` : '未作答';
    return `<div class="axis${sub ? ' sub' : ''}"><div class="ax-head"><span class="ax-name">${esc(name)}</span><span class="ax-val">${esc(v)}</span></div>
      <div class="ax-track"><div class="ax-mid"></div>${[25, 75].map(p => `<div class="ax-tick" style="left:${p}%"></div>`).join('')}${range}${has ? `<div class="ax-marker" style="left:${pos(d.T)}"></div>` : ''}</div>
      <div class="ax-poles"><span>${esc(neg)}</span><span>${esc(posL)}</span></div></div>`;
  }
  const chip = (cls, t) => `<span class="chip ${cls}">${esc(t)}</span>`;
  function itemStance(it, raw) {
    if (it.k === 'tradeoff') { const [a, b] = it.t.split('｜'); const x = +raw; return x < 4 ? `在“${a}”与“${b}”之间，你${TRD[x - 1].replace('A', '“' + a + '”')}` : `在“${a}”与“${b}”之间，你${TRD[x - 1].replace('B', '“' + b + '”')}`; }
    return `${ANSW[raw]}“${it.wt || it.t}”`;
  }
  // 一个维度的文字分析
  function dimAnalysis(R, code) {
    const d = R.dims[code], name = DIMN[code];
    if (!d.report) return `你在${name}方面未答的题较多，只能确定大致范围（${E.sgn(d.lo)}～${E.sgn(d.hi)}），这里不作判断。`;
    let t = `你在${name}方面${bandWord(code, d)}（${E.sgn(d.T)}）。`;
    const row = R.layer1.dims.find(x => x.code === code);
    if (E.band(d.T) === '0') {
      const mt = row.notes.find(n => ['内部交叉', '中立', '温和', '中间'].includes(n));
      if (mt === '内部交叉') t += '这不是温和：你在这一方面的不同问题上持有强烈而方向相反的看法，平均下来才落在中间。';
      else if (mt === '中立') t += '多数题你都选择了中立，认为两边的理由相当。';
      else if (mt === '温和') t += '多数题你只是略有倾向，没有强烈的立场。';
    }
    const subs = R.layer1.subs[code];
    if (subs) {
      const groups = {};
      for (const sr of subs.rows) { const w = subWord(sr.name, sr.d); (groups[w] = groups[w] || []).push(sr.name + (sr.d.report ? `（${E.sgn(sr.d.T)}）` : '')); }
      t += '分项来看：' + Object.entries(groups).map(([w, ns]) => `${ns.join('、')}${w}`).join('；') + '。';
      if (subs.divergent) t += '各分项方向不一，说明你在这一领域的看法是一种组合，而不是简单的“左”或“右”。';
    }
    if (row.notes.some(n => n.startsWith('只含价值题'))) t += '你在这一方面的位置有一部分来自对事实或效果的判断，而不只是价值取向。';
    if (row.notes.includes('可能受作答风格影响')) t += '你的回答整体偏向同意（或不同意），这一得分可能受作答习惯影响。';
    const strong = (R.scaleItems[code] || []).map(e => ({ it: e.it, raw: R.ans[e.key] })).filter(x => /^[1-7]$/.test(x.raw) && Math.abs(+x.raw - 4) === 3).slice(0, 3);
    if (strong.length) t += `你在这方面最鲜明的态度：${strong.map(x => itemStance(x.it, x.raw)).join('；')}。`;
    return t;
  }
  function summaryText(R) {
    const parts = [];
    for (const c of ['E', 'L', 'R', 'V', 'S']) { const d = R.dims[c]; if (d.report) parts.push(`${DIMN[c]}上${bandWord(c, d)}`); }
    let s = parts.length ? `你在${parts.join('，')}。` : '';
    const eSubs = R.layer1.subs.E.rows.filter(x => x.d.report && Math.abs(x.d.T) >= 50);
    if (eSubs.length) s += `经济领域中，${eSubs.map(x => x.name + subWord(x.name, x.d)).join('、')}。`;
    if (!R.suspect) s += cleanCard(E.conclusionText(R));
    return s;
  }
  function coreSummary(t) {
    if (t.cat === '排除') return ['bad', '核心目标相反'];
    if (t.cat === '不相容') return ['neutral', '核心目标不相符'];
    if (t.cat === '待定') return ['warn', '核心目标信息不足'];
    return t.sup === 3 ? ['ok', '三项核心目标都相容'] : ['accent', '两项核心目标相容'];
  }
  function rankList(R) {
    const r = R.trad, order = { '候选': 0, '待定': 1, '不相容': 2, '排除': 3 };
    const names = Object.keys(r).sort((a, b) => (order[r[a].cat] - order[r[b].cat]) || (r[b].pt - r[a].pt));
    const lead = R.final.who.filter(n => names.includes(n));
    return lead.concat(names.filter(n => !lead.includes(n)));
  }
  function tradDetail(R, name) {
    const t = R.trad[name], tr = D.trad.find(x => x.name === name);
    const line = n => { const it = ITN[n], dir = tr.m[it.c], raw = R.ans[String(n)]; return `<li>${esc(it.wt || it.t)}<span class="st">你：${esc(ANSW[raw] || '未答')}；该传统通常${dir === '+' ? '同意' : '不同意'}</span></li>`; };
    const conds = t.st.map(c => `${E.condTxt(c)}：${c.s === '支持' ? '成立' : c.s === '冲突' ? '相反' : c.s}${c.crit ? '（临界）' : ''}，${c.lo === c.hi ? '你的得分 ' + E.sgn(c.T) : '你的范围 ' + E.sgn(c.lo) + '～' + E.sgn(c.hi)}`).join('；');
    return `<details class="more"><summary>你与它一致和不同的地方</summary>
      ${t.hits.length ? `<p class="small"><b>一致的主张（${t.hits.length}）</b></p><ul class="items">${t.hits.map(line).join('')}</ul>` : ''}
      ${t.misses.length ? `<p class="small"><b>不同的主张（${t.misses.length}）</b></p><ul class="items">${t.misses.map(line).join('')}</ul>` : ''}
      ${t.neutral.length ? `<p class="small"><b>你选了中立的（${t.neutral.length}）</b></p><ul class="items">${t.neutral.map(line).join('')}</ul>` : ''}
      ${t.miss.length ? `<p class="small muted">未答：第 ${t.miss.join('、')} 题</p>` : ''}
      <p class="small"><b>核心目标：</b>${esc(conds)}</p></details>`;
  }
  function verdictBig(R) {
    if (R.suspect) return '<span class="lab">作答质量存疑</span>，不给出思想传统方面的结论';
    const f = R.final;
    switch (f.label) {
      case '稳定接近': case '较接近': case '部分接近': return `<span class="lab">${f.label}</span> ${esc(f.who[0])}`;
      case '兼有': return `<span class="lab">兼有</span> ${esc(f.who.join('与'))}的特点`;
      case '无法区分': return `与${esc(f.who.join('、'))}都接近，<span class="lab">还不能区分</span>`;
      case '信息不足': return '<span class="lab">信息不足</span>，暂不下思想传统方面的结论';
      default: return '<span class="lab">未覆盖</span>：不属于14个传统中任何一个的典型位置';
    }
  }
  function exportRow() {
    const cell = x => { const s = String(x === null || x === undefined ? '' : x).replace(/[\r\n]+/g, ' '); return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const cardV = c => { const m = c.match(/^(卡\d+)-(\d)$/); return ((S.cards[m[1]] || [])[+m[2] - 1]) || ''; };
    return [S.code, ...D.cols.map(c => val(c)), ...D.cardCols.map(cardV)].map(cell).join(',');
  }
  function shareText(R) {
    const f = R.final, head = R.suspect ? '' : f.label === '稳定接近' || f.label === '较接近' || f.label === '部分接近' ? `${f.label}${f.who[0]}` : f.label === '兼有' ? `兼有${f.who.join('与')}的特点` : f.label === '无法区分' ? `与${f.who.join('、')}都接近` : f.label;
    const dims = ['E', 'L', 'R', 'V', 'S'].filter(c => R.dims[c].report).map(c => `${DIMN[c]}${bandWord(c, R.dims[c])}（${E.sgn(R.dims[c].T)}）`).join('，');
    return `我的意识形态测试调查结果${head ? '：' + head : ''}。${dims}。（只在问卷比较的14个思想传统之间比较）\n${location.origin}${location.pathname}`;
  }
  function renderResult() {
    const R = compute(), q = R.quality, f = R.final, L = R.layer1, T3 = R.layer3, X = R.extra;
    const date = new Date(S.finishedAt || Date.now());
    const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    let h = '';
    // 一、总结论
    h += `<section class="hero-result"><div class="eyebrow">你的分析结果 · ${ds} · 匿名编号 ${esc(S.code)}</div><div class="big">${verdictBig(R)}</div><p class="summary">${esc(summaryText(R))}</p>`;
    if (L.mods.length) h += `<div class="tags">${L.mods.map(m => `<span class="tag">${esc(m.label)}</span>`).join('')}</div>`;
    if (R.suspect) h += `<p class="notice bad">作答质量存疑：${esc(q.flags.map(x => x.text).join('；'))}。按计分规则，下面照常给出各维度的分析和与各传统的比较，但不给出思想传统方面的结论。</p>`;
    else if (q.flags.length) h += `<p class="notice warn">提示：${esc(q.flags.map(x => x.text).join('；'))}。结果仍然给出，解读时请留意。</p>`;
    h += `</section>`;
    // 二、思想传统排名
    const names = rankList(R);
    h += `<section class="block"><h2>与14个思想传统的比较</h2><p class="sub">排序先看核心目标是否相容，再看关键主张一致度。一致度是你在区分该传统的8道关键题上，与其典型主张一致的比例（选中立计一半，未答按一半估计），不是“属于该传统的概率”。</p>`;
    names.slice(0, 3).forEach((n, i) => {
      const t = R.trad[n], [cc, ct] = coreSummary(t), p = pctOf(t);
      h += `<article class="trank${i === 0 ? ' first' : ''}"><div class="rank">#${i + 1}</div><div class="tbody">
        <div class="thead"><span class="tname">${esc(n)}</span>${chip(cc, ct)}</div>
        <div class="tmeta">关键主张一致度 <b>${p}%</b>${t.miss.length ? `<span class="muted">（有 ${t.miss.length} 道未答）</span>` : ''}</div>
        <div class="tbar"><i style="width:${p}%"></i></div>
        <p class="tdesc">${esc(D.tdesc[n] || '')}</p>${tradDetail(R, n)}</div></article>`;
    });
    h += `<h3>全部14个传统</h3><div class="allrank">${names.map((n, i) => { const t = R.trad[n], [cc, ct] = coreSummary(t), p = pctOf(t); return `<div class="arow"><span class="ri">${i + 1}</span><span class="an">${esc(n)}</span><span class="ap">${p}%</span><div class="mini"><i class="${cc}" style="width:${p}%"></i></div><span class="ac">${chip(cc, ct)}</span></div>`; }).join('')}</div>`;
    if (!R.suspect) {
      const basis = E.basisLines(R), ex = E.excludedLines(R);
      h += `<details class="more"><summary>结论是怎样得出的</summary><div class="lines">${basis.map(l => `<p>${esc(cleanCard(l))}</p>`).join('')}${ex.length ? '<p><b>排除了什么：</b></p>' + ex.map(l => `<p>${esc(l)}</p>`).join('') : ''}</div></details>`;
    }
    h += `</section>`;
    // 三、维度分析
    h += `<section class="block"><h2>各维度详细分析</h2><p class="sub">圆点是你的得分（−100～+100）；中间灰色一段是“中间”区域（−20～+20）；有未答的题时，浅色条表示可能的范围。</p>`;
    h += `<p class="pos-line"><b>两个主维度的组合：</b>${esc(L.position)}</p>`;
    for (const code of ['E', 'L', 'R', 'V', 'S']) {
      const row = L.dims.find(x => x.code === code), s = SCL[code];
      h += `<div class="dimcard"><h3>${esc(DIMN[code])}</h3>${axis(`${code} ${row.name}`, row.d, s.neg, s.pos, row.d.report ? bandWord(code, row.d) : '')}`;
      if (L.subs[code]) for (const sr of L.subs[code].rows) { const [p, q2] = SUBP[sr.name]; h += axis(sr.name, sr.d, strip(q2), strip(p), sr.d.report ? subWord(sr.name, sr.d) : '', true); }
      h += `<p class="analysis">${esc(dimAnalysis(R, code))}</p></div>`;
    }
    h += `<h3>其他维度</h3><p class="sub">这些维度题数较少（2～11题），只作描述。</p><div class="refgrid">${L.dims.filter(x => !x.main).map(row => { const s = SCL[row.code]; return `<div class="refcell">${axis(row.name, row.d, s.neg, s.pos, row.d.report ? bandWord(row.code, row.d) : '', true)}</div>`; }).join('')}</div>`;
    const strong = L.strong.filter(s => s.agree.length || s.disagree.length);
    h += `<details class="more"><summary>你明确同意和明确不同意的全部主张</summary>${strong.map(s => `<h3>${esc(s.title)}</h3>${s.agree.length ? `<p class="small"><b>明确同意：</b></p><ul class="items">${s.agree.map(it => `<li>${esc(it.wt || it.t)}</li>`).join('')}</ul>` : ''}${s.disagree.length ? `<p class="small"><b>明确不同意：</b></p><ul class="items">${s.disagree.map(it => `<li>${esc(it.wt || it.t)}</li>`).join('')}</ul>` : ''}`).join('') || '<p class="small muted">没有选1、2、6、7的题。</p>'}</details>`;
    h += `</section>`;
    // 四、自我认同与其他发现
    const mc = { '一致': 'ok', '部分一致': 'accent', '不同': 'warn' }[T3.match] || 'neutral';
    const pr = X.prio;
    h += `<section class="block"><h2>自我认同与其他发现</h2>
      <p>你选择的立场：<b>${esc(T3.label)}</b>${T3.letter === 'O' && T3.text ? '（' + esc(T3.text) + '）' : ''}　${chip(mc, '与分析结果' + (T3.match === '部分一致' ? '部分一致' : T3.match === '一致' ? '一致' : T3.match === '不同' ? '不同' : ''))}</p>
      ${T3.match === '不同' ? '<p class="small muted">两者不同，不说明谁对谁错：你可能与本问卷对同一名称的理解不同，问卷可能没有覆盖你看重的内容，你的观点也可能来自几个传统。</p>' : ''}
      <div class="tbl"><table><thead><tr><th>你的自评</th><th class="num">自评</th><th class="num">换算</th><th class="num">作答得分</th><th></th></tr></thead><tbody>${T3.self.map(x => `<tr><td>${esc(x.nm)}</td><td class="num">${x.v === '' ? '—' : esc(x.v)}</td><td class="num">${E.sgn(x.selfT)}</td><td class="num">${E.sgn(x.T)}</td><td>${x.big ? chip('warn', '差距较大') : x.diff === null ? '' : chip('ok', '相近')}</td></tr>`).join('')}</tbody></table></div>
      <p><b>最看重的议题：</b>${esc([pr.first, pr.second, pr.third].filter(Boolean).map(p => p.label).join('、') || '未答')}${pr.least ? `；最不看重：${esc(pr.least.label)}` : ''}</p>
      ${X.goalMeans.length ? `<p><b>目标与手段：</b>${esc(X.goalMeans.join('；'))}。这是一种组合，不是前后矛盾。</p>` : ''}
      <p><b>同一原则在不同国家：</b>${X.ctxType ? esc(X.ctxType) : '<span class="muted">第十一部分作答不足，不归类</span>'}${X.home ? '；' + esc(X.home) : ''}</p>
      <details class="more"><summary>这些结论怎么读</summary><ul class="items">
        <li><b>稳定接近：</b>三项核心目标都成立，关键主张高度一致；即使把未答的题按最不利的情况计算，结论也不变。</li>
        <li><b>较接近、部分接近：</b>与某一传统明显最接近；“部分接近”表示有一项核心目标不在该传统的典型位置。</li>
        <li><b>兼有：</b>确实介于两个传统之间，是一种混合立场。</li>
        <li><b>还不能区分：</b>与两个传统都接近，但关键题未答，分不出来。</li>
        <li><b>信息不足：</b>决定结论的核心问题没有回答。</li>
        <li><b>未覆盖：</b>不属于这14个传统中任何一个的典型位置，不表示没有立场。</li>
      </ul><p class="small muted">结果概括的是你在问卷所列议题上的表态，不是对你意识形态的诊断；比较只在问卷选定的14个传统之间进行，不写成“你是某某主义者”；计分规则尚未经过真实样本检验，也不能说明你在某一人群中处于什么位置。</p></details>
    </section>`;
    // 五、保存
    const report = E.reportText(R, S.code), row = exportRow();
    h += `<section class="block exports"><h2>保存结果</h2>
      <p class="sub">这些内容只在你的设备上生成，不会自动上传。</p>
      <div class="actions"><button class="btn primary" data-act="copy-share">复制结果摘要</button><button class="btn" data-act="dl-report">下载完整报告（TXT）</button><button class="btn" data-act="edit">修改答案</button><button class="linkbtn" data-act="reset">清除本机记录</button></div>
      <textarea class="code" id="share-text" readonly hidden>${esc(shareText(R))}</textarea>
      <textarea class="report" id="report-text" readonly hidden>${esc(report)}</textarea>
      <details class="more"><summary>需要把答卷交给施测者？</summary><p class="small">如果有人请你参加这项调查并要求提交答卷，请把下面的答卷代码发给他（只发给他）。它包含你的全部答案，不含任何身份信息。</p>
        <textarea class="code" id="code-text" readonly>${esc(row)}</textarea>
        <div class="actions"><button class="btn" data-act="copy-code">复制答卷代码</button><button class="btn" data-act="dl-csv">下载答卷（CSV）</button></div></details>
    </section>`;
    $('result-body').innerHTML = h;
  }
  $('result-body').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'copy-share') copy($('share-text').value);
    else if (a === 'copy-code') copy($('code-text').value, 'code-text');
    else if (a === 'dl-csv') download(`意识形态测试调查_答卷_${S.code}.csv`, '﻿' + ['编号', ...D.cols, ...D.cardCols].join(',') + '\r\n' + exportRow() + '\r\n', 'text/csv;charset=utf-8');
    else if (a === 'dl-report') download(`意识形态测试调查_结果_${S.code}.txt`, $('report-text').value);
    else if (a === 'edit') { S.pos = 0; show('quiz'); }
    else if (a === 'reset') { if (window.confirm('确定要清除这台设备上保存的全部答案和结果吗？清除后无法恢复。')) { store.clear(); S = fresh(); save(); show('intro'); toast('已清除'); } }
  });

  // ---------------- 启动 ----------------
  const fromHash = (location.hash || '').slice(1);
  show(VIEWS.includes(fromHash) ? fromHash : (S.view === 'quiz' || S.view === 'review' ? 'intro' : S.view), false);
})();
