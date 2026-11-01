/* 意识形态测试调查 · 计分引擎（与《施测者计分说明》一一对应） */
(function (root) {
  'use strict';
  let D = null, ITN = {}, ITC = {}, SC = {}, TR = [], NAMES = [];
  const r6 = x => (x === null || x === undefined || !isFinite(x)) ? x : Math.round(x * 1e6) / 1e6;
  const AXN = { Eo: '所有制目标', Er: '再分配', E: 'E 经济', L: 'L 政治', R: 'R 路径', V: 'V 组织', S: 'S 社会', N1: 'N1 民族·认同', N2: 'N2 民族·成员资格' };
  const SUBPOLE = {
    '所有制目标': ['偏公有', '偏私有'], '公共部门': ['偏公营', '偏私营'], '资源配置': ['偏计划', '偏市场'], '再分配': ['偏高福利', '偏低福利'], '劳资关系': ['偏劳方', '偏资方'],
    '目标与国家观': ['偏阶级国家观', '偏权利国家观'], '变革路径': ['偏革命路径', '偏议会道路'], '变革速度': ['偏急进', '偏渐进'], '暴力': ['接受暴力手段', '拒绝暴力手段'],
    '先锋队与国家': ['偏先锋队', '偏工人自治'], '党内集中': ['偏集中', '偏党内多元'], '领导产生': ['偏稳定任期', '偏选举罢免'], '组织独立': ['偏党的领导', '偏组织独立'],
  };
  const MOD = { R: ['革命取向', '改良取向'], V: ['集中取向', '自治取向'], S: ['社会进步', '社会传统'], N1: ['阶级／人类认同', '国家／民族认同'],
    N2: ['包容型成员观', '排他型成员观'], N3: ['国际合作', '主权优先'], I1: ['积极参与国际事务', '对外少介入'], I2: ['接受强制干预', '反对强制干预'],
    G1: ['生态优先', '增长优先'], G2: ['技术审慎', '技术乐观'], Ha: ['信念坚守', '证据开放'], Hb: ['规律史观', '多元史观'], Hc: ['制度刚性', '制度可逆'],
    Hd: ['目的优先', '手段约束'], PO: ['人民—精英对立', '多元与专业取向'], K: ['忠诚优先', '能力优先'] };

  function init(data) {
    D = data; ITN = {}; ITC = {}; SC = {};
    for (const it of D.items) { ITN[it.n] = it; ITC[it.c] = it; }
    for (const s of D.scales) SC[s.code] = s;
    TR = D.trad; NAMES = TR.map(t => t.name);
    D.cardCols = [];
    for (const c of D.cards) for (let i = 1; i <= 4; i++) D.cardCols.push(c.id + '-' + i);
  }

  // ---------------- 作答规范化 ----------------
  const FW = '０１２３４５６７８９';
  function normChar(v) {
    if (v === null || v === undefined) return '';
    let s = String(v).replace(/[​ \s]+/g, '');
    s = s.replace(/[０-９]/g, ch => String(FW.indexOf(ch)));
    s = s.replace(/[Ａ-Ｚａ-ｚ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    return s;
  }
  const isX = s => /^[xX×✕✗╳*＊]$/.test(s);
  function fieldType(col) {
    if (/写明$/.test(col)) return 'text';
    const n = parseInt(col, 10);
    if (n === 258) return 'prio';
    if (n === 259) return 'ident';
    if (n >= 261 && n <= 264) return 'scale10';
    if (n === 266) return 'yesno';
    if (n === 267) return 'minutes';
    return 'likert';
  }
  function normField(col, v) {
    const t = fieldType(col);
    let s = normChar(v);
    const ok = x => ({ v: x, bad: false }), bad = { v: '', bad: true };
    if (t === 'text') return ok(String(v === null || v === undefined ? '' : v).trim());
    if (s === '') return ok('');
    if (t === 'likert') {
      if (/^[1-7](\.0+)?$/.test(s)) return ok(s[0]);
      if (/^[uU]$/.test(s)) return ok('U');
      if (isX(s)) return ok('×');
      return bad;
    }
    if (t === 'scale10') {
      if (/^(10|[0-9])(\.0+)?$/.test(s)) return ok(String(parseInt(s, 10)));
      if (/^[uU]$/.test(s)) return ok('U');
      if (isX(s)) return ok('×');
      return bad;
    }
    if (t === 'prio') { s = s.toUpperCase(); return /^[A-L]$/.test(s) ? ok(s) : bad; }
    if (t === 'ident') { s = s.toUpperCase(); return /^[A-P]$/.test(s) ? ok(s) : bad; }
    if (t === 'yesno') {
      if (/^(是|有|看过|y|yes|1)$/i.test(s)) return ok('是');
      if (/^(否|无|没有|没看过|未看过|n|no|0)$/i.test(s)) return ok('否');
      if (/^[uU]$/.test(s)) return ok('U');
      if (isX(s)) return ok('×');
      return bad;
    }
    if (t === 'minutes') {
      const m = s.replace(/(分钟|分|mins?|minutes)$/i, '');
      return /^\d+(\.\d+)?$/.test(m) ? ok(m) : bad;
    }
    return bad;
  }
  function normalize(raw) {
    const ans = {}, bad = [];
    for (const col of D.cols) {
      const r = normField(col, raw ? raw[col] : '');
      ans[col] = r.v; if (r.bad) bad.push(col);
    }
    return { ans, bad };
  }
  const dig = v => /^[1-7]$/.test(v);

  // ---------------- 维度与分量表 ----------------
  function stat(list, ans) {
    const n = list.length; let S = 0, a = 0, fa = 0, ra = 0, four = 0, dev = 0; const vals = [];
    for (const e of list) {
      const v = ans[e.key];
      if (dig(v)) {
        const x = +v, sc = e.d === '+' ? x : 8 - x;
        S += sc; a++; vals.push(sc); if (e.d === '+') fa++; else ra++;
        if (x === 4) four++; dev += Math.abs(x - 4);
      }
    }
    const k = n - a;
    const T = a ? r6(100 * (S / a - 4) / 3) : null;
    const lo = n ? r6(100 * ((S + k) / n - 4) / 3) : null;
    const hi = n ? r6(100 * ((S + 7 * k) / n - 4) / 3) : null;
    let s = 1;
    if (a >= 2) { const mean = S / a; let ss = 0; for (const x of vals) ss += (x - mean) * (x - mean); s = Math.max(1, Math.sqrt(ss / (a - 1))); }
    const se = a ? 100 * s / (3 * Math.sqrt(a)) : Infinity;
    return { n, a, k, S, T, lo, hi, se, report: n > 0 && a > 0 && k / n <= 0.2,
      intensity: a ? dev / a : null, four: a ? four / a : null, bias: a ? 100 * (fa - ra) / (3 * a) : 0 };
  }
  const band = T => T === null ? '' : T >= 50 ? '++' : T >= 20 ? '+' : T > -20 ? '0' : T > -50 ? '−' : '−−';

  // ---------------- 核心条件状态 ----------------
  function status(lo, hi, se, op, th, kap) {
    if (op === '>=') {
      if (lo >= th) return ['支持', lo - 1.5 * se < th];
      if (hi <= kap) return ['冲突', hi + 1.5 * se > kap];
      if (hi < th && lo > kap) return ['不符', false];
      return ['证据不足', false];
    }
    if (hi <= th) return ['支持', hi + 1.5 * se > th];
    if (lo >= kap) return ['冲突', lo - 1.5 * se < kap];
    if (lo > th && hi < kap) return ['不符', false];
    return ['证据不足', false];
  }

  function evalTrad(ans, AX) {
    const r = {};
    for (const t of TR) {
      const st = t.core.map(([ax, op, th, kap]) => {
        const x = AX[ax]; const [s, crit] = status(x.lo, x.hi, x.se, op, th, kap);
        return { ax, op, th, kap, s, crit, T: x.T, lo: x.lo, hi: x.hi, report: x.report };
      });
      let lo = 0, pt = 0, hi = 0, a = 0; const miss = [], hits = [], misses = [], neutral = [];
      for (const [code, dir] of Object.entries(t.m)) {
        const it = ITC[code], v = ans[String(it.n)];
        if (dig(v)) {
          a++; const x = +v;
          if (x === 4) { lo += .5; pt += .5; hi += .5; neutral.push(it.n); }
          else {
            const hit = (x >= 5) === (dir === '+');
            if (hit) { lo++; pt++; hi++; hits.push(it.n); } else misses.push(it.n);
          }
        } else { pt += .5; hi += 1; miss.push(it.n); }
      }
      const sup = st.filter(x => x.s === '支持').length, unk = st.filter(x => x.s === '证据不足').length;
      const conf = st.some(x => x.s === '冲突');
      const cand = !conf && sup >= 2;
      const full = !conf && sup === 3 && !st.some(x => x.s === '支持' && x.crit);
      const pend = !conf && sup < 2 && sup + unk >= 2;
      r[t.name] = { name: t.name, st, sup, unk, conf, cand, full, pend,
        cat: conf ? '排除' : cand ? '候选' : pend ? '待定' : '不相容', lo, pt, hi, a, miss, hits, misses, neutral };
    }
    return r;
  }

  function classify(r) {
    const cands = NAMES.filter(n => r[n].cand).sort((a, b) => r[b].pt - r[a].pt);
    const pends = NAMES.filter(n => r[n].pend);
    const others = x => cands.concat(pends).filter(y => y !== x);
    for (const x of cands) {
      if (r[x].full && r[x].lo >= 6 && others(x).every(y => r[x].lo - r[y].hi >= 1.5)) return { label: '稳定接近', who: [x] };
    }
    if (cands.length) {
      const x = cands[0];
      const need = t => (r[t].sup === 3 ? 6 : 6.5);
      if (r[x].pt >= need(x)) {
        const ties = cands.filter(y => y !== x && r[x].pt - r[y].pt < 1 && r[y].pt >= need(y));
        const threat = pends.filter(y => r[y].hi > r[x].pt);
        if (!ties.length && !threat.length && r[x].lo >= 5) {
          if (r[x].sup === 3) return { label: '较接近', who: [x] };
          if (r[x].unk === 0) return { label: '部分接近', who: [x] };
        }
        if (ties.length && !threat.length) {
          const grp = [x, ...ties];
          return { label: grp.every(g => r[g].hi - r[g].lo <= 1) ? '兼有' : '无法区分', who: grp };
        }
      }
    }
    return { label: cands.concat(pends).some(y => r[y].hi >= 6) ? '信息不足' : '未覆盖', who: [] };
  }

  // ---------------- 补问卡 ----------------
  function cardTally(card, vals) {
    let A = 0, B = 0;
    card.items.forEach(([, d], i) => {
      const v = vals ? vals[i] : '';
      if (!dig(v) || v === '4') return;
      if ((+v >= 5) === (d === 'A')) A++; else B++;
    });
    return { A, B, verdict: A >= 3 ? 'A' : B >= 3 ? 'B' : '未能区分' };
  }
  function cardVals(cardAns, id) {
    const raw = (cardAns && cardAns[id]) || [];
    return [0, 1, 2, 3].map(i => normField('1', raw[i]).v);
  }
  const hasAny = vals => vals.some(v => v !== '');

  // ---------------- 主计算 ----------------
  function compute(rawInput, cardAns) {
    const { ans, bad } = normalize(rawInput);
    const R = { ans, bad };
    const scaleItems = {};
    for (const it of D.items) if ((it.k === 'likert' || it.k === 'tradeoff') && SC[it.s]) (scaleItems[it.s] = scaleItems[it.s] || []).push({ key: String(it.n), d: it.d, it });
    R.scaleItems = scaleItems;
    R.dims = {};
    for (const s of D.scales) R.dims[s.code] = stat(scaleItems[s.code] || [], ans);
    // 只含价值题
    R.valOnly = {};
    for (const c of D.main) R.valOnly[c] = stat(scaleItems[c].filter(e => e.it.ty === '价值'), ans);
    // 分量表（卡0并入所有制目标）
    const c0 = D.cards.find(c => c.id === '卡0');
    const c0vals = cardVals(cardAns, '卡0');
    R.card0Used = hasAny(c0vals);
    const ans2 = Object.assign({}, ans);
    c0vals.forEach((v, i) => { ans2['卡0-' + (i + 1)] = v; });
    R.subs = {};
    for (const [p, names] of Object.entries(D.subOrder)) {
      R.subs[p] = {};
      for (const nm of names) {
        let list = scaleItems[p].filter(e => e.it.sub === nm);
        if (p === 'E' && nm === '所有制目标' && R.card0Used) list = list.concat(c0.items.map(([, d], i) => ({ key: '卡0-' + (i + 1), d: d === '+' ? '+' : '-' })));
        R.subs[p][nm] = stat(list, ans2);
      }
    }
    // 作答质量
    R.quality = quality(ans);
    // 第二层
    const AX = { Eo: R.subs.E['所有制目标'], Er: R.subs.E['再分配'], E: R.dims.E, L: R.dims.L, R: R.dims.R, V: R.dims.V, S: R.dims.S, N1: R.dims.N1, N2: R.dims.N2 };
    R.AX = AX;
    R.trad = evalTrad(ans, AX);
    R.base = classify(R.trad);
    // 补问卡（对比卡）
    R.recs = recommend(R);
    R.pairCard = null; R.final = Object.assign({}, R.base);
    if (R.recs.pair) {
      const vals = cardVals(cardAns, R.recs.pair.id);
      if (hasAny(vals)) {
        const tally = cardTally(R.recs.pair, vals);
        R.pairCard = { card: R.recs.pair, vals, tally };
        if (tally.verdict !== '未能区分') {
          const t = tally.verdict === 'A' ? R.recs.pair.A : R.recs.pair.B;
          if (R.base.label === '无法区分') R.final = { label: R.trad[t].sup === 3 ? '较接近' : '部分接近', who: [t], viaCard: R.recs.pair.id };
          else R.final = { label: '兼有', who: R.base.who, lean: t, viaCard: R.recs.pair.id };
        }
      }
    }
    // 其余卡片的作答（未被推荐时只记录）
    R.otherCards = [];
    for (const c of D.cards) {
      if (c.id === '卡0' || (R.recs.pair && c.id === R.recs.pair.id)) continue;
      const vals = cardVals(cardAns, c.id);
      if (hasAny(vals)) R.otherCards.push({ card: c, vals, tally: cardTally(c, vals) });
    }
    R.suspect = R.quality.suspect;
    R.layer1 = layer1(R);
    R.layer3 = layer3(R);
    R.extra = extra(R);
    return R;
  }

  // ---------------- 推荐补问 ----------------
  function recommend(R) {
    const r = R.trad, base = R.base;
    const recs = { card0: false, pair: null, pairNames: null, reask: [], noCard: false };
    const relevant = NAMES.filter(n => r[n].cand || r[n].pend || (r[n].conf && r[n].pt >= 6));
    if (base.label !== '稳定接近') {
      for (const n of relevant) for (const c of r[n].st) if (c.ax === 'Eo' && (c.s === '证据不足' || c.crit)) recs.card0 = true;
    }
    if (base.label === '无法区分' || base.label === '兼有') {
      const [p, q] = base.who;
      recs.pairNames = [p, q];
      recs.pair = D.cards.find(c => c.id !== '卡0' && ((c.A === p && c.B === q) || (c.A === q && c.B === p))) || null;
      recs.noCard = !recs.pair;
    }
    if (base.label !== '稳定接近' && base.label !== '未覆盖') {
      const set = new Set();
      const focus = base.who.length ? base.who.slice() : NAMES.filter(n => (r[n].cand || r[n].pend) && r[n].hi >= 6);
      for (const n of NAMES) if (r[n].pend && r[n].hi >= 6 && !focus.includes(n)) focus.push(n);
      for (const n of focus) {
        for (const q of r[n].miss) set.add(q);
        for (const c of r[n].st) if (c.s === '证据不足' || c.crit) for (const q of axisMissing(R, c.ax)) set.add(q);
      }
      recs.reask = [...set].sort((a, b) => a - b);
      recs.focus = focus;
    }
    return recs;
  }
  function axisMissing(R, ax) {
    const list = ax === 'Eo' ? R.scaleItems.E.filter(e => e.it.sub === '所有制目标') : ax === 'Er' ? R.scaleItems.E.filter(e => e.it.sub === '再分配') : R.scaleItems[ax];
    return list.filter(e => !dig(R.ans[e.key])).map(e => e.it.n);
  }

  // ---------------- 作答质量 ----------------
  function quality(ans) {
    const q = { flags: [] };
    const v132 = ans['132'];
    q.att = v132 === '2';
    let pairsBoth = 0; const pairHits = [];
    for (const [a, b] of D.pairs) if (dig(ans[a]) && dig(ans[b]) && +ans[a] >= 6 && +ans[b] >= 6) { pairsBoth++; pairHits.push([a, b]); }
    q.pairsBoth = pairsBoth; q.pairHits = pairHits;
    let fs = 0, fn = 0, rs = 0, rn = 0;
    for (const it of D.items) if (it.k === 'likert' && SC[it.s]) {
      const v = ans[String(it.n)]; if (!dig(v)) continue;
      if (it.d === '+') { fs += +v; fn++; } else { rs += +v; rn++; }
    }
    q.A = fn && rn ? r6((fs / fn + rs / rn) / 2 - 4) : null;
    let run = 0, best = 0, prev = null;
    let U = 0, X = 0, blank = 0, answered = 0, four = 0;
    for (let n = 1; n <= 219; n++) {
      const v = ans[String(n)];
      if (dig(v)) { answered++; if (v === '4') four++; run = (v === prev) ? run + 1 : 1; prev = v; best = Math.max(best, run); }
      else { run = 0; prev = null; if (v === 'U') U++; else if (v === '×') X++; else blank++; }
    }
    q.run = best; q.U = U; q.X = X; q.blank = blank; q.missRate = (U + X + blank) / 219; q.fourRate = answered ? four / answered : 0; q.answered = answered;
    const mins = ans['267'] === '' ? null : parseFloat(ans['267']);
    q.minutes = mins; q.sawKey = ans['266'] === '是';
    const add = (on, key, text) => { if (on) q.flags.push({ key, text }); };
    add(!q.att, 'att', `注意力检查未通过（第132题填的是“${v132 || '空'}”，应为2）`);
    add(pairsBoth >= 3, 'pairs', `互斥同意 ${pairsBoth} 对（两题都选6或7，达到3对即标记）`);
    add(q.A !== null && Math.abs(q.A) >= 0.5, 'acq', `默认同意指数 A = ${fmt(q.A, 2)}（|A| ≥ 0.5 即标记）`);
    add(best >= 12, 'run', `连续 ${best} 题填同一个数字（12题以上即标记）`);
    add(q.missRate > 0.15, 'miss', `第一至十部分未答 ${U + X + blank} 题，占 ${pctf(q.missRate)}（超过15%即标记）`);
    add(q.fourRate > 0.5, 'four', `已答题中选4的占 ${pctf(q.fourRate)}（超过一半即标记）`);
    add((mins !== null && mins < 25) || q.sawKey, 'time', [mins !== null && mins < 25 ? `作答用时 ${mins} 分钟（少于25分钟）` : '', q.sawKey ? '作答前看过计分说明' : ''].filter(Boolean).join('；'));
    q.suspect = !q.att || q.flags.length >= 2;
    return q;
  }

  // ---------------- 第一层 ----------------
  function dimPhrase(code, d) {
    const s = SC[code];
    if (!d.report) return null;
    const b = band(d.T);
    if (b === '++') return '强烈偏向' + s.pos;
    if (b === '+') return '明显偏向' + s.pos;
    if (b === '−') return '明显偏向' + s.neg;
    if (b === '−−') return '强烈偏向' + s.neg;
    return '中间';
  }
  function midType(d) {
    if (!d.report || band(d.T) !== '0' || d.intensity === null) return '';
    if (d.intensity >= 2) return '内部交叉';
    if (d.intensity < 1 && d.four > 0.5) return '中立';
    if (d.intensity < 1) return '温和';
    return '中间';
  }
  function subWord(name, d) {
    if (!d.report) return '未答较多';
    const b = band(d.T); const [p, n] = SUBPOLE[name];
    return b === '++' || b === '+' ? p : b === '−' || b === '−−' ? n : '居中';
  }
  function layer1(R) {
    const L = {};
    const A = R.quality.A;
    L.dims = D.scales.map(s => {
      const d = R.dims[s.code]; const notes = [];
      const mt = midType(d); if (mt) notes.push(mt);
      if (d.report && Math.abs(d.bias) > 5 && A !== null && Math.abs(A) >= 0.5) notes.push('可能受作答风格影响');
      if (D.main.includes(s.code)) {
        const v = R.valOnly[s.code];
        if (d.T !== null && v.T !== null && Math.abs(d.T - v.T) >= 20) notes.push(`只含价值题的得分为 ${sgn(v.T)}，位置部分来自对事实或效果的判断`);
      }
      if (!d.report) notes.push('未答较多，只报告范围');
      return { code: s.code, name: s.name, main: D.main.includes(s.code), d, band: d.report ? band(d.T) : '', phrase: dimPhrase(s.code, d), notes };
    });
    L.subs = {};
    for (const [p, names] of Object.entries(D.subOrder)) {
      const rows = names.map(nm => ({ name: nm, d: R.subs[p][nm], word: subWord(nm, R.subs[p][nm]) }));
      const rep = rows.filter(x => x.d.report);
      const div = rep.length >= 2 && (Math.max(...rep.map(x => x.d.T)) - Math.min(...rep.map(x => x.d.T)) >= 40);
      L.subs[p] = { rows, divergent: div };
    }
    const E = R.dims.E, Lp = R.dims.L;
    const ew = !E.report ? null : E.T >= 20 ? '社会化' : E.T <= -20 ? '市场化' : '居中';
    const lw = !Lp.report ? null : Lp.T >= 20 ? '自由多元' : Lp.T <= -20 ? '集中权威' : '居中';
    const eDetail = L.subs.E.rows.filter(x => x.d.report && x.word !== '居中' || (x.d.report && ['所有制目标', '资源配置', '再分配'].includes(x.name))).map(x => x.name + x.word).join('、');
    L.position = (ew && lw) ? `经济${ew}${L.subs.E.divergent || ew === '居中' ? '（' + eDetail + '）' : ''}·政治${lw}` : '经济或政治维度未答较多，暂不定位';
    // 明确同意与不同意
    L.strong = [];
    for (let si = 0; si < 10; si++) {
      const sec = D.sections[si]; const agree = [], disagree = [];
      for (const it of D.items) if (it.sec === si && it.c !== 'ATT') {
        const v = R.ans[String(it.n)];
        if (v === '6' || v === '7') agree.push(it); else if (v === '1' || v === '2') disagree.push(it);
      }
      L.strong.push({ title: sec.title, agree, disagree });
    }
    // 4、U、×较集中的部分
    L.conc = D.sections.slice(0, 13).map((sec, si) => {
      const its = D.items.filter(it => it.sec === si && it.c !== 'ATT');
      let four = 0, U = 0, X = 0, tot = 0;
      for (const it of its) {
        const keys = it.k === 'context' && it.s === 'C' ? [it.n + '甲', it.n + '乙'] : [String(it.n)];
        for (const k of keys) { tot++; const v = R.ans[k]; if (v === '4') four++; else if (v === 'U') U++; else if (v === '×') X++; }
      }
      return { title: sec.title, four, U, X, tot };
    });
    // 价值取舍
    L.trade = D.items.filter(it => it.k === 'tradeoff').map(it => {
      const [a, b] = it.t.split('｜'); const v = R.ans[String(it.n)];
      let w = '未答';
      if (dig(v)) { const x = +v; w = x === 4 ? '两者相当' : x < 4 ? ['完全倾向', '明显倾向', '略倾向'][x - 1] + '“' + a + '”' : ['略倾向', '明显倾向', '完全倾向'][x - 5] + '“' + b + '”'; }
      else if (v) w = v === 'U' ? '不了解' : '不愿回答';
      return { n: it.n, a, b, v, w };
    });
    // 修饰标签
    L.mods = D.scales.filter(s => s.code !== 'E' && s.code !== 'L').map(s => {
      const d = R.dims[s.code]; if (!d.report || Math.abs(d.T) < 50) return null;
      return { code: s.code, label: MOD[s.code][d.T > 0 ? 0 : 1], ref: !D.main.includes(s.code) };
    }).filter(Boolean);
    return L;
  }

  // ---------------- 第三层 ----------------
  function layer3(R) {
    const a = R.ans, out = {};
    const letter = a['259'];
    out.letter = letter; out.text = a['259写明'];
    out.trad = /^[A-N]$/.test(letter) ? NAMES['ABCDEFGHIJKLMN'.indexOf(letter)] : null;
    out.label = letter ? (D.ident.find(x => x[0] === letter) || letter) : '未答';
    out.strength = a['260'];
    const fin = R.final;
    if (!letter) out.match = '未答';
    else if (letter === 'O') out.match = '自填其他立场，不与14个传统对照';
    else if (letter === 'P') out.match = '没有明确的立场，只与第一层对照';
    else if (R.suspect) out.match = '作答质量存疑，未作对照';
    else {
      const t = out.trad, r = R.trad[t];
      if ((fin.label === '稳定接近' || fin.label === '较接近') && fin.who[0] === t) out.match = '一致';
      else if (fin.who.includes(t) || (r && r.pend)) out.match = '部分一致';
      else out.match = '不同';
    }
    const self = [['261', '所有制', R.subs.E['所有制目标'], x => 20 * (x - 5)], ['262', '资源配置', R.subs.E['资源配置'], x => 20 * (x - 5)],
      ['263', '再分配', R.subs.E['再分配'], x => 20 * (x - 5)], ['264', '政治制度', R.dims.L, x => 20 * (5 - x)]];
    out.self = self.map(([k, nm, d, f]) => {
      const v = a[k]; if (!/^\d+$/.test(v)) return { k, nm, v, selfT: null, T: d.T, diff: null, big: false };
      const sT = f(+v); const diff = d.T === null ? null : r6(sT - d.T);
      return { k, nm, v, selfT: sT, T: d.T, diff, big: diff !== null && Math.abs(diff) >= 40 };
    });
    out.worry = dig(a['265']) && +a['265'] >= 6;
    out.worryV = a['265'];
    out.saw = a['266'] === '是';
    out.minutes = a['267'] === '' ? null : parseFloat(a['267']);
    out.fast = out.minutes !== null && out.minutes < 25;
    return out;
  }

  // ---------------- 补充信息 ----------------
  function extra(R) {
    const a = R.ans, X = {};
    const g1 = D.items.filter(it => it.k === 'context' && it.s === 'C');
    const scv = (it, v) => (dig(v) ? (it.d === '+' ? +v : 8 - +v) : null);
    X.ctx = g1.map(it => { const A = scv(it, a[it.n + '甲']), B = scv(it, a[it.n + '乙']); return { n: it.n, t: it.t, A, B, D: A !== null && B !== null ? B - A : null }; });
    const done = X.ctx.filter(x => x.D !== null);
    X.ctxN = done.length;
    if (done.length >= 4) {
      const mean = done.reduce((s, x) => s + x.D, 0) / done.length, mabs = done.reduce((s, x) => s + Math.abs(x.D), 0) / done.length;
      X.ctxMean = r6(mean); X.ctxAbs = r6(mabs);
      if (mabs < 1) X.ctxType = '原则一致型';
      else if (Math.abs(mean) >= 0.75 * mabs) X.ctxType = '方向一致的条件型（' + (mean > 0 ? '对甲国更能接受限制' : '对乙国更能接受限制') + '）';
      else X.ctxType = '逐题不同的条件型（|D| ≥ 2 的题：' + (done.filter(x => Math.abs(x.D) >= 2).map(x => '第' + x.n + '题').join('、') || '无') + '）';
    } else X.ctxType = null;
    const freeT = side => { const list = g1.map(it => ({ key: it.n + side, d: it.d })); return stat(list, a); };
    X.freeA = freeT('甲'); X.freeB = freeT('乙');
    const g2 = D.items.filter(it => it.k === 'context' && it.s === 'CR');
    const twin = { 226: 221, 227: 222, 228: 223 };
    let toA = 0, toB = 0, cmp = 0;
    for (const it of g2) {
      const own = scv(it, a[String(it.n)]); const t = ITN[twin[it.n]];
      const A = scv(t, a[t.n + '甲']), B = scv(t, a[t.n + '乙']);
      if (own === null || A === null || B === null) continue;
      cmp++; const dA = Math.abs(own - A), dB = Math.abs(own - B);
      if (dA < dB) toA++; else if (dB < dA) toB++;
    }
    X.home = cmp ? (toA > toB ? '本国回答多数接近甲国' : toB > toA ? '本国回答多数接近乙国' : '本国回答在两者之间') : null;
    // 历史
    const hist = D.items.filter(it => it.k === 'history');
    const markerSet = new Set(); for (const t of TR) for (const c of Object.keys(t.m)) markerSet.add(c);
    X.histU = hist.filter(it => a[String(it.n)] === 'U').length; X.histX = hist.filter(it => a[String(it.n)] === '×').length;
    X.histBlank = hist.filter(it => a[String(it.n)] === '').length;
    X.histLow = X.histU + X.histX >= 6;
    X.histList = hist.filter(it => !markerSet.has(it.c)).map(it => ({ n: it.n, t: it.t, v: a[String(it.n)] }));
    // 优先次序
    const P = D.priority; const pick = k => { const v = a[k]; const p = P.find(x => x[0] === v); return p ? { letter: v, label: p[1], dims: p[2] } : null; };
    X.prio = { first: pick('258第一'), second: pick('258第二'), third: pick('258第三'), least: pick('258最不看重') };
    X.goalMeans = [];
    for (const p of [X.prio.first, X.prio.second, X.prio.third]) {
      if (!p) continue;
      for (const part of p.dims.split('／')) {
        const m = part.trim().match(/^(\w+)\s*([+−-])$/); if (!m) continue;
        const d = R.dims[m[1]]; if (!d || !d.report) continue;
        const want = m[2] === '+' ? 1 : -1;
        if (want * d.T <= -20) X.goalMeans.push(`重视“${p.label}”，但 ${m[1]} ${SC[m[1]].name}偏向${d.T > 0 ? SC[m[1]].pos : SC[m[1]].neg}（${sgn(d.T)}）`);
      }
    }
    X.prioDims = [];
    for (const p of [X.prio.first, X.prio.second, X.prio.third]) if (p) for (const part of p.dims.split('／')) { const m = part.trim().match(/^(\w+)/); if (m && !X.prioDims.includes(m[1])) X.prioDims.push(m[1]); }
    return X;
  }

  // ---------------- 文字 ----------------
  function sgn(x, d = 0) { if (x === null || x === undefined || !isFinite(x)) return '—'; const v = Number(x.toFixed(d)); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d); }
  function fmt(x, d = 1) { if (x === null || x === undefined || !isFinite(x)) return '—'; const v = Number(x.toFixed(d)); return (v < 0 ? '−' : '') + Math.abs(v).toFixed(d); }
  function pctf(x) { return (x * 100).toFixed(0) + '%'; }
  function rng(d) { return d.lo === null ? '—' : `${sgn(d.lo)}～${sgn(d.hi)}`; }
  function scoreTxt(d) { return d.report ? `${sgn(d.T)}${d.k ? `（范围 ${rng(d)}）` : ''}` : `未答较多，范围 ${rng(d)}`; }
  function condTxt(c) { return `${AXN[c.ax]} ${c.op === '>=' ? '≥' : '≤'} ${sgn(c.th)}`; }
  function condVal(c) { return c.lo === c.hi ? `你的得分 ${sgn(c.T)}` : `你的范围 ${sgn(c.lo)}～${sgn(c.hi)}`; }
  function mtxt(t) { return t.lo === t.hi ? fmt(t.pt, 1) : `${fmt(t.pt, 1)}（范围 ${fmt(t.lo, 1)}～${fmt(t.hi, 1)}）`; }
  const short = nm => nm.replace(/（.*）/, '');
  const qlist = arr => arr.map(n => '第' + n + '题').join('、');

  function conclusionText(R) {
    const f = R.final, r = R.trad;
    if (R.suspect) return '作答质量存疑，按规定不给出思想传统方面的结论（下表只列各传统的核心条件和判别分，供参考）。';
    const X = f.who[0];
    switch (f.label) {
      case '稳定接近': return `在本问卷比较的14个思想传统中，你的主张与${X}稳定地接近：${X}的三项核心目标都得到你的回答支持，你对判别题的回答与${X}的典型主张高度一致；即使把未答的题都按最不利的情况计算，这一结论也不变。`;
      case '较接近': return `在本问卷比较的14个思想传统中，你的主张较接近${X}${f.viaCard ? `（经补问${f.viaCard}区分）` : ''}。`;
      case '部分接近': {
        const bad = r[X].st.filter(c => c.s !== '支持').map(c => `${AXN[c.ax]}（典型位置 ${c.op === '>=' ? '≥' : '≤'} ${sgn(c.th)}，${condVal(c)}）`).join('、');
        return `你的主张部分接近${X}${f.viaCard ? `（经补问${f.viaCard}区分）` : ''}，但在${bad || '一项核心条件'}上与${X}的典型位置不同。`;
      }
      case '兼有': {
        const [A, B] = f.who;
        let s = `你的主张兼有${f.who.join('与')}的特点。`;
        const onlyA = r[A].hits.filter(n => !r[B].hits.includes(n)), onlyB = r[B].hits.filter(n => !r[A].hits.includes(n));
        if (onlyA.length || onlyB.length) s += `与${A}一致、与${B}不同的回答见${qlist(onlyA) || '（无）'}；与${B}一致、与${A}不同的回答见${qlist(onlyB) || '（无）'}。`;
        if (f.lean) s += `补问${f.viaCard}（${R.pairCard.card.use}）显示，在这一问题上更接近${f.lean}。`;
        return s;
      }
      case '无法区分': {
        const key = R.recs.pair ? R.recs.pair.use : null;
        return `你的主张与${f.who.join('、')}都接近，现有回答还不能区分${f.who.length > 2 ? '它们' : '二者'}${key ? `；关键在于${key}` : ''}。`;
      }
      case '信息不足': return '影响判断的核心问题尚未回答，暂不给出思想传统方面的结论。';
      default: return '你的主张不属于本问卷所比较的14个传统中任何一个的典型位置。这不表示你没有一贯的立场，具体立场见第一层。';
    }
  }

  function basisLines(R) {
    const r = R.trad, f = R.final, out = [];
    const focus = f.who.length ? f.who : NAMES.filter(n => r[n].cand || r[n].pend).sort((a, b) => r[b].pt - r[a].pt).slice(0, 3);
    for (const n of focus) {
      const t = r[n];
      const conds = t.st.map(c => `${condTxt(c)}：${c.s}${c.crit ? '（临界）' : ''}，${condVal(c)}`).join('；');
      out.push(`${n}——${conds}。判别分 ${mtxt(t)}${t.miss.length ? `，未答 ${qlist(t.miss)}` : ''}。`);
    }
    return out;
  }
  function excludedLines(R) {
    const r = R.trad;
    const ex = NAMES.filter(n => r[n].conf);
    const high = ex.filter(n => r[n].pt >= 6).map(n => `你的部分观点接近${n}，但与${n}的核心目标相反：${r[n].st.filter(c => c.s === '冲突').map(c => `${condTxt(c)}，${condVal(c)}`).join('；')}（判别分 ${mtxt(r[n])}）。`);
    const rest = ex.filter(n => r[n].pt < 6).map(n => short(n));
    const inc = NAMES.filter(n => r[n].cat === '不相容').map(n => short(n));
    const lines = high.slice();
    if (rest.length) lines.push(`至少有一项核心目标与你的回答相反：${rest.join('、')}。`);
    if (inc.length) lines.push(`两项以上核心目标不符：${inc.join('、')}。`);
    return lines;
  }

  function reportText(R, id) {
    const L = R.layer1, T3 = R.layer3, X = R.extra, q = R.quality, lines = [];
    const push = s => lines.push(s);
    push(`意识形态测试调查 · 结果报告${id ? '（编号：' + id + '）' : ''}`);
    push('');
    push('一、作答质量');
    push(q.flags.length ? `标记 ${q.flags.length} 项：${q.flags.map(f => f.text).join('；')}。` : '未见标记。');
    push(`第一至十部分：U ${q.U} 题，× ${q.X} 题，漏答 ${q.blank} 题；选4的占已答题的 ${pctf(q.fourRate)}。${T3.minutes !== null ? `作答约 ${T3.minutes} 分钟。` : ''}`);
    if (R.suspect) push('结论：作答质量存疑。第一层照常报告，第二层不给出结论。');
    if (R.bad.length) push(`另有 ${R.bad.length} 处录入无法识别，已按未答处理：${R.bad.slice(0, 20).join('、')}${R.bad.length > 20 ? '……' : ''}。`);
    push('');
    push('二、第一层　具体立场');
    const order = D.main.slice().sort((a, b) => (X.prioDims.includes(a) ? 0 : 1) - (X.prioDims.includes(b) ? 0 : 1));
    for (const c of order) {
      const row = L.dims.find(x => x.code === c);
      push(`${c} ${row.name}：${row.d.report ? `${row.phrase}，T = ${scoreTxt(row.d)}` : `未答较多，范围 ${rng(row.d)}`}${row.notes.filter(n => !n.startsWith('未答较多')).length ? '（' + row.notes.filter(n => !n.startsWith('未答较多')).join('；') + '）' : ''}。`);
      if (L.subs[c]) push('　分量表：' + L.subs[c].rows.map(x => `${x.name} ${x.d.report ? sgn(x.d.T) : '未答较多'}${x.d.k && x.d.report ? `（${rng(x.d)}）` : ''}（${x.word}）`).join('；') + (L.subs[c].divergent ? '。该维度各分项倾向不同。' : '。'));
    }
    push('参考维度：' + L.dims.filter(x => !x.main).map(x => `${x.code} ${x.name} ${x.d.report ? sgn(x.d.T) : '—'}`).join('；') + '。');
    push(`两个主维度的组合：${L.position}。`);
    for (const s of L.strong) {
      if (!s.agree.length && !s.disagree.length) continue;
      push(`${s.title}——明确同意：${s.agree.map(it => `第${it.n}题“${it.t}”`).join('；') || '无'}；明确不同意：${s.disagree.map(it => `第${it.n}题“${it.t}”`).join('；') || '无'}。`);
    }
    const conc = L.conc.filter(c => c.tot && (c.four + c.U + c.X) / c.tot >= 0.3);
    if (conc.length) push('中立、U或×较集中的部分：' + conc.map(c => `${c.title}（4：${c.four}，U：${c.U}，×：${c.X}）`).join('；') + '。');
    push('');
    push('三、第二层　思想传统接近性');
    push('结论：' + conclusionText(R));
    if (!R.suspect) {
      const bl = basisLines(R); if (bl.length) push('依据：' + bl.join(' '));
      const ex = excludedLines(R); if (ex.length) push('排除了什么：' + ex.join(' '));
      const miss = R.recs.reask; const cardNeed = [];
      if (R.recs.card0 && !R.card0Used) cardNeed.push('卡0（核实所有制目标）');
      if (R.recs.pair && !R.pairCard) cardNeed.push(`${R.recs.pair.id}（${R.recs.pair.title}）`);
      if (R.recs.noCard) cardNeed.push(`${R.recs.pairNames.join('与')}之间没有对应的补问卡，保留较宽结论`);
      if (miss.length || cardNeed.length) push('还缺什么：' + (miss.length ? `影响结论的未答题 ${qlist(miss)}` : '') + (miss.length && cardNeed.length ? '；' : '') + (cardNeed.length ? '建议补问 ' + cardNeed.join('、') : '') + '。');
      if (R.card0Used) push('补问：卡0已并入所有制目标重新计算。');
      if (R.pairCard) push(`补问：${R.pairCard.card.id} 4题中 ${R.pairCard.tally.A} 题指向${short(R.pairCard.card.A)}、${R.pairCard.tally.B} 题指向${short(R.pairCard.card.B)}，${R.pairCard.tally.verdict === '未能区分' ? '未能区分，保留原结论' : '据此调整结论'}。`);
    } else {
      push('（作答质量存疑，以下仅供参考）');
      push(basisLines(R).join(' '));
    }
    push('');
    push('四、第三层　自我认同');
    push(`第259题：${T3.label}${T3.letter === 'O' && T3.text ? '（' + T3.text + '）' : ''}${T3.strength ? `，认同程度 ${T3.strength}` : ''}；与第二层对照：${T3.match}。`);
    const sl = T3.self.filter(x => x.selfT !== null).map(x => `${x.nm} 自评 ${sgn(x.selfT)}，作答 ${sgn(x.T)}${x.big ? '（差距较大）' : ''}`);
    if (sl.length) push('自评对照：' + sl.join('；') + '。');
    const notes = [];
    if (T3.worry) notes.push('作答顾虑较强（第265题选' + T3.worryV + '），涉及政治制度的回答可能偏向较安全的方向');
    if (T3.saw) notes.push('作答者看过计分说明，结果仅供参考');
    if (T3.fast) notes.push('作答过快');
    if (notes.length) push('作答情况：' + notes.join('；') + '。');
    push('');
    push('五、补充信息');
    if (L.mods.length) push('修饰标签：' + L.mods.map(m => m.label + (m.ref ? '（参考）' : '')).join(' · ') + '。');
    push('制度条件性：' + (X.ctxType ? `${X.ctxType}；平均差异 ${fmt(X.ctxMean, 2)}，平均绝对差异 ${fmt(X.ctxAbs, 2)}；甲国自由度 ${sgn(X.freeA.T)}，乙国 ${sgn(X.freeB.T)}` : `两国都已作答的只有 ${X.ctxN} 对，不归类`) + (X.home ? `；${X.home}` : '') + '。');
    push(`历史题：U ${X.histU} 题，× ${X.histX} 题${X.histLow ? '；社会主义各传统之间的区分主要依据原则题，确定程度较低' : ''}。`);
    const hl = X.histList.filter(h => h.v).map(h => `第${h.n}题 ${h.v}`); if (hl.length) push('其余历史判断（原样列出）：' + hl.join('，') + '。');
    const pr = X.prio; if (pr.first || pr.least) push(`议题优先次序：最看重 ${[pr.first, pr.second, pr.third].filter(Boolean).map(p => p.label).join('、') || '未答'}；最不看重 ${pr.least ? pr.least.label : '未答'}。`);
    if (X.goalMeans.length) push('目标—手段组合：' + X.goalMeans.join('；') + '。');
    const tr = L.trade.filter(t => t.v && dig(t.v) && t.v !== '4').map(t => t.w); if (tr.length) push('价值取舍：' + tr.join('；') + '。');
    push('');
    push('说明：本结果概括的是作答者在问卷所列议题上的表态，不是对其意识形态的诊断；思想传统的比较依据编者设定的核心条件、判别题和门槛，只在本问卷所比较的14个传统之间进行，尚未经过真实样本检验。');
    return lines.join('\n');
  }

  // ---------------- 批量粘贴 ----------------
  function parseTable(text) {
    const rows = []; const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return { rows, errors: ['没有读到任何数据'] };
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const split = l => sep === '\t' ? l.split('\t') : csvSplit(l);
    let header = null; const errors = [];
    const first = split(lines[0]).map(s => s.trim());
    if (first.includes('编号') || (first.includes('1') && first.includes('2') && first.includes('259'))) header = first;
    const body = header ? lines.slice(1) : lines;
    const nC = D.cols.length, nK = D.cardCols.length;
    const putCard = (cards, col, v) => { const m = col.match(/^(卡\d+)-(\d)$/); if (!m) return; (cards[m[1]] = cards[m[1]] || ['', '', '', ''])[+m[2] - 1] = (v || '').trim(); };
    body.forEach((l, i) => {
      const cells = split(l); const raw = {}, cards = {}; let id = '';
      if (header) {
        header.forEach((h, j) => {
          if (h === '编号') id = (cells[j] || '').trim();
          else if (D.cols.includes(h)) raw[h] = cells[j];
          else if (D.cardCols.includes(h)) putCard(cards, h, cells[j]);
        });
      } else if ([nC, nC + 1, nC + nK, nC + 1 + nK].includes(cells.length)) {
        let k = 0;
        if (cells.length === nC + 1 || cells.length === nC + 1 + nK) { id = cells[0].trim(); k = 1; }
        D.cols.forEach((c, j) => { raw[c] = cells[k + j]; });
        if (cells.length - k === nC + nK) D.cardCols.forEach((c, j) => putCard(cards, c, cells[k + nC + j]));
      } else {
        errors.push(`第${i + 1 + (header ? 1 : 0)}行有 ${cells.length} 列，应为 ${nC} 列（不含编号）、${nC + 1} 列（含编号），或在此基础上再加 ${nK} 列补问卡答案`);
        return;
      }
      for (const k of Object.keys(cards)) if (!cards[k].some(v => v !== '')) delete cards[k];
      rows.push({ id: id || String(rows.length + 1), raw, cards });
    });
    return { rows, errors, header: !!header };
  }
  function csvSplit(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out;
  }

  const API = { init, normalize, normField, fieldType, compute, classify, evalTrad, status, stat, cardTally, reportText, conclusionText, basisLines, excludedLines, parseTable, csvSplit, band, sgn, fmt, rng, scoreTxt, condTxt, condVal, mtxt, AXN, SUBPOLE, short, qlist, pctf };
  root.IdeoEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
