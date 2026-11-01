/* 意识形态测试调查 · 施测者计分器界面 */
const DATA = window.SURVEY_DATA;
const EXAMPLES = window.SURVEY_EXAMPLES;
(function () {
  'use strict';
  const E = window.IdeoEngine;
  E.init(DATA);
  const ITN = {}; for (const it of DATA.items) ITN[it.n] = it;
  const MARKERS = new Set(); for (const t of DATA.trad) for (const c of Object.keys(t.m)) MARKERS.add(c);
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const $ = id => document.getElementById(id);
  const short = E.short;
  const KEY = 'ideo-scorer-v5';
  const LS = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 存储不可用时忽略 */ } },
  };
  const state = { cur: null, view: 'single', batch: { text: '', rows: [], cards: {}, example: false }, curBatchIndex: null, lastR: null };
  const blankRecord = () => ({ id: '', raw: {}, cards: {}, example: false });
  const exampleRecord = () => ({ id: '示例', raw: Object.assign({}, EXAMPLES.single), cards: {}, example: true });

  // ---------------- 提示 ----------------
  let toastTimer = null;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400); }
  async function copyText(text, fallbackId) {
    try { await navigator.clipboard.writeText(text); toast('已复制'); }
    catch (e) {
      const el = fallbackId && $(fallbackId);
      if (el) { if (el.closest('details')) el.closest('details').open = true; el.focus(); el.select(); toast('已选中全文，请按 Ctrl+C 复制'); }
      else toast('复制没有成功，请手动选择文字复制');
    }
  }
  let DL = null;
  const IN_CLAUDE = !!(window.claude && typeof window.claude.use === 'function');
  (async () => {
    if (IN_CLAUDE) { try { DL = await window.claude.use('downloads'); } catch (e) { DL = null; } }
    document.body.classList.toggle('has-dl', IN_CLAUDE ? !!DL : true);
  })();
  function plainDownload(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: /\.csv$/.test(name) ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); toast('已开始下载');
  }
  async function saveFile(name, text) {
    if (!IN_CLAUDE) { plainDownload(name, text); return; }
    if (!DL) { toast('这里不能下载文件，请改用复制'); return; }
    try { await DL.save({ filename: name, data: text }); toast('已保存'); }
    catch (e) {
      const c = e && e.code;
      if (c === 'declined') toast('已取消保存');
      else if (c === 'rate_limited') toast('上一个保存窗口还没关闭，请稍后再试');
      else { toast('这里暂时不能下载，请改用复制'); if (c === 'unavailable' || c === 'not_granted') { DL = null; document.body.classList.remove('has-dl'); } }
    }
  }

  // ---------------- 答题卡 ----------------
  const inputs = [], colIndex = {};
  function labelOf(col) {
    const n = parseInt(col, 10);
    if (/甲$|乙$/.test(col)) return `第${n}题${col.slice(-1)}国`;
    if (n === 258) return `第258题${col.slice(3)}`;
    if (col === '259写明') return '第259题写明';
    return `第${n}题`;
  }
  function inp(col, extra) {
    const t = E.fieldType(col);
    const max = t === 'text' ? 40 : t === 'minutes' ? 5 : 2;
    return `<input class="in${extra ? ' ' + extra : ''}" id="a-${esc(col)}" data-col="${esc(col)}" maxlength="${max}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${esc(labelOf(col))}">`;
  }
  function buildSheet() {
    const sheet = $('sheet'); let html = '';
    DATA.sections.forEach((sec, si) => {
      html += `<div class="sheet-sec"><h3>${esc(sec.title)} <span class="rng">${sec.first === sec.last ? sec.first : sec.first + '–' + sec.last}</span></h3><div class="cells">`;
      for (const it of DATA.items) {
        if (it.sec !== si) continue;
        if (it.k === 'context' && it.s === 'C') html += `<div class="cell wide"><span class="num">${it.n}</span><div class="pair"><span>甲</span>${inp(it.n + '甲')}<span>乙</span>${inp(it.n + '乙')}</div></div>`;
        else if (it.k === 'priority') html += `<div class="cell span4"><span class="num">${it.n} 填字母 A～L</span><div class="slots">${['第一', '第二', '第三', '最不看重'].map(s => `<label>${s}${inp(it.n + s)}</label>`).join('')}</div></div>`;
        else if (it.c === 'Q1') html += `<div class="cell span4"><span class="num">${it.n} 填字母 A～P</span><div class="slots"><label>字母${inp('259')}</label><label>选O时写明${inp('259写明', 'txt')}</label></div></div>`;
        else if (it.n === 267) html += `<div class="cell wide"><span class="num">${it.n} 分钟</span>${inp('267', 'mins')}</div>`;
        else html += `<div class="cell${MARKERS.has(it.c) ? ' mark' : ''}"><span class="num">${it.n}</span>${inp(String(it.n))}</div>`;
      }
      html += '</div></div>';
    });
    sheet.innerHTML = html;
    DATA.cols.forEach((col, i) => { inputs.push(document.getElementById('a-' + col)); colIndex[col] = i; });
  }
  function describeCol(col) {
    const n = parseInt(col, 10), it = ITN[n], sec = DATA.sections[it.sec];
    const head = `<span class="fsec">${esc(sec.title)}${MARKERS.has(it.c) ? ' · 判别题' : ''}</span>`;
    if (it.k === 'tradeoff') { const [a, b] = it.t.split('｜'); return head + `<span class="fnum">${n}</span>A ${esc(a)} ←→ B ${esc(b)}<span class="fsec">1 完全倾向A，4 两者相当，7 完全倾向B</span>`; }
    if (/甲$|乙$/.test(col)) return head + `<span class="fnum">${n}${col.slice(-1)}国</span>${esc(it.t)}`;
    if (n === 258) return head + `<span class="fnum">${n} ${esc(col.slice(3))}</span>` + DATA.priority.map(p => `${p[0]} ${esc(p[1])}`).join('；');
    if (col === '259') return head + `<span class="fnum">259</span>` + DATA.ident.map(esc).join('；');
    if (col === '259写明') return head + '<span class="fnum">259</span>选O（其他）时写明名称，可不填。';
    if (n >= 261 && n <= 264) return head + `<span class="fnum">${n}</span>${esc(it.t)}（填0～10，0是有效答案）`;
    if (n === 266) return head + `<span class="fnum">${n}</span>${esc(it.t)}（也可填1/0）`;
    return head + `<span class="fnum">${n}</span>${esc(it.t)}`;
  }
  function styleInput(el) {
    const col = el.dataset.col, r = E.normField(col, el.value);
    el.classList.toggle('bad', r.bad);
    el.classList.toggle('filled', !r.bad && r.v !== '');
    el.classList.toggle('u', r.v === 'U');
    el.classList.toggle('x', r.v === '×');
  }
  function syncSheet() {
    $('cur-id').value = state.cur.id || '';
    for (const el of inputs) {
      const col = el.dataset.col, v = state.cur.raw[col] === undefined || state.cur.raw[col] === null ? '' : String(state.cur.raw[col]);
      const r = E.normField(col, v);
      el.value = (!r.bad && E.fieldType(col) !== 'text') ? r.v : v;
      styleInput(el);
    }
  }
  function shouldAdvance(col, v) {
    const t = E.fieldType(col);
    if (t === 'text' || t === 'minutes') return false;
    const r = E.normField(col, v);
    if (r.bad || r.v === '') return false;
    return !(t === 'scale10' && r.v === '1');
  }
  function focusIdx(i) { if (i < 0 || i >= inputs.length) return; const el = inputs[i]; el.focus(); try { el.select(); } catch (e) { /* 忽略 */ } }
  function touched() { if (state.cur.example) { state.cur.example = false; } }

  function onSheetInput(e) {
    const el = e.target; if (!el.dataset || !el.dataset.col || e.isComposing) return;
    const col = el.dataset.col, t = E.fieldType(col);
    let v = el.value; const r = E.normField(col, v);
    if (!r.bad && r.v !== '' && t !== 'text' && t !== 'minutes' && v !== r.v) { el.value = r.v; v = r.v; }
    state.cur.raw[col] = v; touched(); styleInput(el);
    if (shouldAdvance(col, v)) focusIdx(colIndex[col] + 1);
    schedule();
  }
  function onSheetKey(e) {
    const el = e.target; if (!el.dataset || !el.dataset.col) return;
    const i = colIndex[el.dataset.col], txt = E.fieldType(el.dataset.col) === 'text';
    if (e.key === 'Enter') { e.preventDefault(); focusIdx(i + 1); }
    else if (e.key === 'ArrowRight' && (!txt || el.selectionStart === el.value.length)) { e.preventDefault(); focusIdx(i + 1); }
    else if (e.key === 'ArrowLeft' && (!txt || el.selectionStart === 0)) { e.preventDefault(); focusIdx(i - 1); }
    else if (e.key === 'Backspace' && el.value === '' && i > 0) { e.preventDefault(); focusIdx(i - 1); }
  }
  function onSheetPaste(e) {
    const el = e.target; if (!el.dataset || !el.dataset.col) return;
    const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if (!/[\t\n]/.test(text) && !(text.split(',').length > 3)) return;
    e.preventDefault();
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (lines.length >= 2) {
      const parsed = E.parseTable(text);
      if (parsed.rows.length) {
        state.cur = { id: parsed.rows[0].id, raw: parsed.rows[0].raw, cards: parsed.rows[0].cards || {}, example: false }; state.curBatchIndex = null;
        syncSheet(); schedule(true);
        toast(parsed.rows.length > 1 ? `已填入第一位作答者；共 ${parsed.rows.length} 位，可用“批量计分”` : '已填入整份答卷');
      } else toast(parsed.errors[0] || '没有读到可用的数据');
      return;
    }
    if (colIndex[el.dataset.col] === 0) {
      const one = E.parseTable(lines[0]);
      if (one.rows.length && !one.errors.length) {
        const r0 = one.rows[0];
        const nCells = (lines[0].includes('\t') ? lines[0].split('\t') : E.csvSplit(lines[0])).length;
        const hasId = nCells === DATA.cols.length + 1 || nCells === DATA.cols.length + 1 + DATA.cardCols.length;
        state.cur = { id: hasId ? r0.id : '', raw: r0.raw, cards: r0.cards || {}, example: false }; state.curBatchIndex = null;
        syncSheet(); schedule(true); toast('已填入整份答卷'); return;
      }
    }
    const cells = lines[0].includes('\t') ? lines[0].split('\t') : E.csvSplit(lines[0]);
    let start = colIndex[el.dataset.col];
    if (start === 0 && cells.length === DATA.cols.length + 1) state.cur.id = cells.shift().trim();
    let k = 0;
    for (; k < cells.length && start + k < inputs.length; k++) state.cur.raw[DATA.cols[start + k]] = cells[k].trim();
    touched(); syncSheet(); schedule(true);
    toast(`已填入 ${k} 格`);
  }

  // ---------------- 报告渲染 ----------------
  let timer = null;
  function schedule(now) { clearTimeout(timer); timer = setTimeout(render, now ? 0 : 120); }
  function filledCount() { return DATA.cols.filter(c => state.cur.raw[c] !== undefined && state.cur.raw[c] !== null && String(state.cur.raw[c]).trim() !== '').length; }
  function render() {
    const R = E.compute(state.cur.raw, state.cur.cards);
    state.lastR = R;
    $('fill-count').textContent = `已录入 ${filledCount()} / ${DATA.cols.length} 格`;
    $('example-banner').hidden = !state.cur.example;
    const need = new Set(R.suspect ? [] : R.recs.reask.map(String));
    for (const el of inputs) el.classList.toggle('need', need.has(el.dataset.col));
    const act = document.activeElement, actId = act && $('result').contains(act) ? act.id : null;
    const openK = new Set([...$('result').querySelectorAll('details[open]')].map(d => d.dataset.k));
    $('result').innerHTML = renderAll(R);
    $('result').querySelectorAll('details[data-k]').forEach(d => { if (openK.has(d.dataset.k)) d.open = true; });
    if (actId) { const el = document.getElementById(actId); if (el) { el.focus(); try { const L = el.value.length; el.setSelectionRange(L, L); } catch (e) { /* 忽略 */ } } }
    persist();
  }
  const chip = (cls, text, crit) => `<span class="chip ${cls}${crit ? ' crit' : ''}">${esc(text)}</span>`;
  const stCls = { '支持': 'ok', '冲突': 'bad', '不符': 'neutral', '证据不足': 'warn' };
  const catCls = { '候选': 'accent', '待定': 'warn', '不相容': 'neutral', '排除': 'bad' };

  function verdictHTML(R) {
    if (R.suspect) return '<span class="lab">作答质量存疑</span>，不给出思想传统方面的结论';
    const f = R.final;
    switch (f.label) {
      case '稳定接近': case '较接近': case '部分接近':
        return `<span class="lab">${f.label}</span> ${esc(f.who[0])}${f.viaCard ? ' ' + chip('accent', '经补问' + f.viaCard + '区分') : ''}`;
      case '兼有': return `<span class="lab">兼有</span> ${esc(f.who.join('、'))}${f.lean ? `（补问后：更接近${esc(f.lean)}）` : ''}`;
      case '无法区分': return `<span class="lab">还不能区分</span> ${esc(f.who.join('、'))}`;
      case '信息不足': return '<span class="lab">信息不足</span>，暂不下结论';
      default: return '<span class="lab">未覆盖</span>：不属于14个传统的典型位置';
    }
  }
  function nextSteps(R) {
    const s = [];
    if (R.suspect) return ['先核对作答质量问题；第二层不给结论'];
    const rec = R.recs;
    if (rec.reask.length) s.push(`请作答者再考虑 ${rec.reask.length} 道未答题（答题卡上已用黄框标出）`);
    if (rec.card0 && !R.card0Used) s.push('用补问卡0核实所有制目标');
    if (rec.pair && !R.pairCard) s.push(`用${rec.pair.id}区分${rec.pairNames.map(short).join('与')}`);
    if (rec.noCard) s.push(`${rec.pairNames.map(short).join('与')}之间没有补问卡，保留较宽结论`);
    if (!s.length) s.push('无需补问，可以直接出报告');
    return s;
  }
  function renderAll(R) {
    return renderSummary(R) + renderQuality(R) + renderL1(R) + renderL2(R) + renderL3(R) + renderExtra(R) + renderReport(R);
  }
  function renderSummary(R) {
    const q = R.quality;
    const qc = R.suspect ? chip('bad', '作答质量存疑') : q.flags.length ? chip('warn', `标记 ${q.flags.length} 项`) : chip('ok', '未见标记');
    return `<div class="summary">
      <div class="sum-main"><span class="sum-k">第二层结论</span><div class="verdict">${verdictHTML(R)}</div></div>
      <div><span class="sum-k">作答质量</span>${qc}</div>
      <div><span class="sum-k">下一步</span>${nextSteps(R).map(esc).join('<br>')}</div>
      <div><span class="sum-k">第一层位置</span>${esc(R.layer1.position)}</div>
    </div>`;
  }
  function renderQuality(R) {
    const q = R.quality, has = k => q.flags.some(f => f.key === k);
    const line = (k, name, detail) => `<li>${has(k) ? chip('bad', '标记') : chip('ok', '通过')}<span><b>${name}</b>　<span class="muted">${esc(detail)}</span></span></li>`;
    const v132 = R.ans['132'];
    return `<article class="card"><h2>作答质量 <span class="layer">计分说明第十一节</span></h2>
      <ul class="checks">
        ${line('att', '注意力检查', `第132题应填2，实际为“${v132 || '空'}”`)}
        ${line('pairs', '互斥同意', `两题都选6或7的有 ${q.pairsBoth} 对${q.pairHits.length ? '（' + q.pairHits.map(p => p.join('↔')).join('、') + '）' : ''}；3对以上标记`)}
        ${line('acq', '默认同意指数 A', `A = ${E.fmt(q.A, 2)}；|A| ≥ 0.5 标记`)}
        ${line('run', '连续相同答案', `最长连续 ${q.run} 题；12题以上标记`)}
        ${line('miss', '未答', `第一至十部分 U ${q.U}、× ${q.X}、漏答 ${q.blank}，占 ${E.pctf(q.missRate)}；超过15%标记`)}
        ${line('four', '中立集中', `已答题中选4的占 ${E.pctf(q.fourRate)}；超过一半标记`)}
        ${line('time', '作答时长与计分说明', `${q.minutes === null ? '未填时长' : q.minutes + ' 分钟'}；${q.sawKey ? '看过计分说明' : '未看过计分说明'}`)}
      </ul>
      ${R.bad.length ? `<p class="small" style="color:var(--bad);margin-top:8px">有 ${R.bad.length} 处录入无法识别（答题卡上红色的格子），已按未答处理。</p>` : ''}
      <p class="small muted" style="margin-top:8px">注意力检查未通过，或标记两项及以上，即为“作答质量存疑”：第一层照常报告，第二层不给结论。</p>
    </article>`;
  }
  function dimRow(code, d, name, phrase, notes, cls) {
    return `<tr class="${cls || ''}"><td>${esc(name)}</td><td class="num">${d.report ? E.sgn(d.T) : '—'}</td><td class="num">${d.k ? E.rng(d) : '—'}</td><td class="num">${d.report ? esc(E.band(d.T)) : ''}</td><td>${esc(phrase || '')}</td><td class="small">${esc((notes || []).join('；'))}</td></tr>`;
  }
  function renderL1(R) {
    const L = R.layer1;
    let rows = '';
    for (const row of L.dims.filter(x => x.main)) {
      rows += dimRow(row.code, row.d, `${row.code} ${row.name}`, row.phrase || '未答较多', row.notes);
      if (L.subs[row.code]) for (const s of L.subs[row.code].rows) rows += dimRow('', s.d, s.name + (s.name === '所有制目标' && R.card0Used ? '（含卡0）' : ''), s.word, [], 'sub');
    }
    const divs = Object.entries(L.subs).filter(([, v]) => v.divergent).map(([k]) => k);
    let ref = '';
    for (const row of L.dims.filter(x => !x.main)) ref += dimRow(row.code, row.d, `${row.code} ${row.name}`, row.phrase || '未答较多', row.notes);
    let strong = '';
    for (const s of L.strong) {
      if (!s.agree.length && !s.disagree.length) continue;
      strong += `<details data-k="strong-${esc(s.title)}"><summary>${esc(s.title)}：明确同意 ${s.agree.length} 题，明确不同意 ${s.disagree.length} 题</summary>
        ${s.agree.length ? `<p class="small" style="margin-top:6px"><b>明确同意（选6或7）</b></p><ul class="items small">${s.agree.map(it => `<li>第${it.n}题　${esc(it.t)}</li>`).join('')}</ul>` : ''}
        ${s.disagree.length ? `<p class="small" style="margin-top:6px"><b>明确不同意（选1或2）</b></p><ul class="items small">${s.disagree.map(it => `<li>第${it.n}题　${esc(it.t)}</li>`).join('')}</ul>` : ''}
      </details>`;
    }
    const conc = L.conc.filter(c => c.tot).map(c => `<tr><td>${esc(c.title)}</td><td class="num">${c.four}</td><td class="num">${c.U}</td><td class="num">${c.X}</td></tr>`).join('');
    const trade = L.trade.map(t => `<li>第${t.n}题　${esc(t.a)} ←→ ${esc(t.b)}：<b>${esc(t.w)}</b></li>`).join('');
    return `<article class="card"><h2>第一层　具体立场 <span class="layer">在各议题上支持什么、反对什么</span></h2>
      <p><b>两个主维度的组合：</b>${esc(L.position)}</p>
      <div class="tbl-wrap"><table><thead><tr><th>维度／分量表</th><th class="num">得分 T</th><th class="num">缺答范围</th><th class="num">档位</th><th>读法</th><th>备注</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${divs.length ? `<p class="small">${divs.join('、')} 维度各分项倾向不同（分量表相差40分以上），报告时写出组合，不要只用一个总分概括。</p>` : ''}
      <details data-k="ref"><summary>参考维度（题数少，只作描述）</summary><div class="tbl-wrap"><table><thead><tr><th>维度</th><th class="num">得分 T</th><th class="num">缺答范围</th><th class="num">档位</th><th>读法</th><th>备注</th></tr></thead><tbody>${ref}</tbody></table></div></details>
      <h3>明确同意与明确不同意的主张</h3>${strong || '<p class="muted small">没有选1、2、6、7的题。</p>'}
      <details data-k="trade"><summary>价值取舍（第十二部分）</summary><ul class="items small">${trade}</ul></details>
      <details data-k="conc"><summary>各部分选4、U、×的数量</summary><div class="tbl-wrap"><table><thead><tr><th>部分</th><th class="num">选4</th><th class="num">U</th><th class="num">×</th></tr></thead><tbody>${conc}</tbody></table></div></details>
    </article>`;
  }
  function condCell(c) {
    return `<td>${chip(stCls[c.s], c.s + (c.crit ? '·临界' : ''), c.crit)}<div class="small">${esc(E.condTxt(c))}</div><div class="small muted">${c.lo === c.hi ? E.sgn(c.T) : esc(E.sgn(c.lo) + '～' + E.sgn(c.hi))}</div></td>`;
  }
  function renderL2(R) {
    const r = R.trad, order = { '候选': 0, '待定': 1, '不相容': 2, '排除': 3 };
    const names = Object.keys(r).sort((a, b) => (order[r[a].cat] - order[r[b].cat]) || (r[b].pt - r[a].pt));
    const focus = new Set(R.final.who);
    const rows = names.map(n => {
      const t = r[n];
      return `<tr class="${focus.has(n) ? 'focusrow' : ''}"><td><b>${esc(n)}</b><div>${chip(catCls[t.cat], t.cat)}</div></td>${t.st.map(condCell).join('')}<td class="num">${E.fmt(t.pt, 1)}<div class="small muted">${t.lo === t.hi ? '' : E.fmt(t.lo, 1) + '～' + E.fmt(t.hi, 1)}</div></td><td class="small">${t.miss.length ? esc(t.miss.join('、')) : ''}</td></tr>`;
    }).join('');
    const basis = R.suspect ? [] : E.basisLines(R), excl = R.suspect ? [] : E.excludedLines(R);
    return `<article class="card"><h2>第二层　思想传统接近性 <span class="layer">核心目标 → 路径 → 历史判断</span></h2>
      <p style="font-size:1rem">${esc(E.conclusionText(R))}</p>
      ${basis.length ? `<div class="lines small"><p><b>依据：</b></p>${basis.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
      ${excl.length ? `<div class="lines small"><p><b>排除了什么：</b></p>${excl.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
      ${renderFollowUp(R)}
      <h3>14个传统的逐项比较</h3>
      <div class="tbl-wrap"><table><thead><tr><th>思想传统</th><th>核心条件一</th><th>核心条件二</th><th>核心条件三</th><th class="num">判别分</th><th>未答判别题</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small muted">判别分满分8：同意方向与典型主张一致记1分，选4记0.5分，未答按0.5分估计（范围按0～1分）。核心条件按缺答范围判断：整段范围成立为“支持”，整段落在冲突线外为“冲突”，跨过门槛或冲突线为“证据不足”；与门槛相差不到1.5个题目抽样误差，注明“临界”。</p>
    </article>`;
  }
  function dirText(card, d) {
    if (card.id === '卡0') return d === '+' ? '正向（同意即偏公有）' : '反向（同意即偏私有）';
    return '指向' + short(d === 'A' ? card.A : card.B);
  }
  function cardBlock(card, R, tallyHTML) {
    const vals = state.cur.cards[card.id] || [];
    const head = card.id === '卡0' ? `${card.id}　所有制目标核实` : `${card.id}　${short(card.A)}／${short(card.B)}　<span class="muted small">区分要点：${esc(card.use)}</span>`;
    return `<div class="fu-card"><p><b>${head}</b></p>
      ${card.items.map(([t, d], i) => `<div class="cq"><span class="qn">${i + 1}</span><span>${esc(t)}</span><input class="in card-in" id="c-${esc(card.id)}-${i}" data-card="${esc(card.id)}" data-i="${i}" maxlength="2" autocomplete="off" value="${esc(vals[i] || '')}" aria-label="${esc(card.id)} 第${i + 1}题"><span class="dir">${esc(dirText(card, d))}</span></div>`).join('')}
      <div class="tally">${tallyHTML}</div>
      <div class="row"><button class="btn small" data-copy="card:${esc(card.id)}">复制给作答者的题目</button></div>
    </div>`;
  }
  function pairTally(t, card) {
    if (!t) return '<span class="muted">按1～7录入作答者的回答，可填U或×。</span>';
    const v = t.verdict === '未能区分' ? '未能区分，保留原结论' : `指向${short(t.verdict === 'A' ? card.A : card.B)}`;
    return `指向${esc(short(card.A))} <b>${t.A}</b> 题，指向${esc(short(card.B))} <b>${t.B}</b> 题：<b>${esc(v)}</b>（4题中3题以上指向同一方才算区分）`;
  }
  function renderFollowUp(R) {
    if (R.suspect) return '';
    const rec = R.recs;
    const show0 = rec.card0 || R.card0Used;
    const anyOther = R.otherCards.length;
    if (!rec.reask.length && !show0 && !rec.pair && !rec.noCard && !anyOther) return '';
    let h = '<div class="fu"><h3>补问</h3>';
    if (rec.reask.length) {
      h += `<p class="small">先请作答者再考虑下面这些题。只说“这几题对结果有影响，可以再考虑一下”，不要说明它们指向哪个传统。作答者改了答案，就直接在左侧答题卡上改；仍不愿或无法回答的，保持原样。</p>
        <details data-k="reask"><summary>需要再考虑的 ${rec.reask.length} 道题</summary><ul class="items small">${rec.reask.map(n => `<li>第${n}题　${esc(ITN[n].t)}</li>`).join('')}</ul></details>
        <div class="row"><button class="btn small" data-copy="reask">复制这些题目</button></div>`;
    }
    if (show0) {
      const d = R.subs.E['所有制目标'];
      const tally = R.card0Used ? `已并入所有制目标：${d.report ? E.sgn(d.T) : '未答较多'}${d.k ? `（范围 ${E.rng(d)}）` : ''}，已据此重新判定。` : '<span class="muted">所有制目标的核心条件证据不足或临界。录入后4题并入所有制目标，重新判定。</span>';
      h += cardBlock(DATA.cards[0], R, tally);
    }
    if (rec.pair) h += cardBlock(rec.pair, R, pairTally(R.pairCard && R.pairCard.tally, rec.pair));
    if (rec.noCard) h += `<p class="small">${esc(rec.pairNames.join('与'))}之间没有对应的补问卡：保留较宽的结论，并在报告中写明二者的主要分歧。</p>`;
    const others = DATA.cards.filter(c => c.id !== '卡0' && !(rec.pair && c.id === rec.pair.id));
    h += `<details data-k="othercards"${anyOther ? ' open' : ''}><summary>其他补问卡（一般用不到）</summary>${others.map(c => { const o = R.otherCards.find(x => x.card.id === c.id); return cardBlock(c, R, o ? pairTally(o.tally, c) + '<br><span class="muted">这张卡与当前并列的传统不对应，只记录，不改变结论。</span>' : '<span class="muted">只在这两个传统并列时使用。</span>'); }).join('')}</details>`;
    return h + '</div>';
  }
  function renderL3(R) {
    const T = R.layer3;
    const mc = { '一致': 'ok', '部分一致': 'accent', '不同': 'warn' }[T.match] || 'neutral';
    const self = T.self.map(x => `<tr><td>${esc(x.nm)}（第${x.k}题）</td><td class="num">${x.v === '' ? '—' : esc(x.v)}</td><td class="num">${E.sgn(x.selfT)}</td><td class="num">${E.sgn(x.T)}</td><td>${x.big ? chip('warn', '差距较大') : x.diff === null ? '' : chip('ok', '相近')}</td></tr>`).join('');
    const notes = [];
    if (T.worry) notes.push(`作答顾虑较强（第265题选${T.worryV}）：涉及政治制度的回答可能偏向较安全的方向。`);
    if (T.saw) notes.push('作答者看过计分说明，结果仅供参考。');
    if (T.fast) notes.push(`作答过快（${T.minutes} 分钟）。`);
    return `<article class="card"><h2>第三层　自我认同 <span class="layer">单独记录，与前两层对照</span></h2>
      <p>第259题：<b>${esc(T.label)}</b>${T.letter === 'O' && T.text ? '（' + esc(T.text) + '）' : ''}${T.strength ? `，认同程度 ${esc(T.strength)}` : ''}　${chip(mc, T.match)}</p>
      ${T.match === '不同' ? '<p class="small muted">不同不等于作答者认错了自己：可能对同一名称理解不同，问卷没有覆盖其看重的内容，或观点来自几个传统。作为需要解释的信息报告，不改写前两层。</p>' : ''}
      <div class="tbl-wrap"><table><thead><tr><th>自评项目</th><th class="num">自评</th><th class="num">换算 T</th><th class="num">作答得分</th><th>对照</th></tr></thead><tbody>${self}</tbody></table></div>
      ${notes.length ? `<p class="small">${notes.map(esc).join('<br>')}</p>` : ''}
    </article>`;
  }
  function renderExtra(R) {
    const X = R.extra, L = R.layer1;
    const ctx = X.ctx.map(c => `<tr><td>第${c.n}题</td><td class="num">${c.A === null ? '—' : c.A}</td><td class="num">${c.B === null ? '—' : c.B}</td><td class="num">${c.D === null ? '—' : (c.D > 0 ? '+' : c.D < 0 ? '−' : '') + Math.abs(c.D)}</td></tr>`).join('');
    const pr = X.prio;
    return `<article class="card"><h2>补充信息</h2>
      <p><b>修饰标签：</b>${L.mods.length ? esc(L.mods.map(m => m.label + (m.ref ? '（参考）' : '')).join(' · ')) : '<span class="muted">无（E、L 以外没有维度达到 |T| ≥ 50）</span>'}</p>
      <p><b>制度条件性：</b>${X.ctxType ? esc(X.ctxType) + `；平均差异 ${E.fmt(X.ctxMean, 2)}，平均绝对差异 ${E.fmt(X.ctxAbs, 2)}` : `两国都已作答的只有 ${X.ctxN} 对（至少4对才归类）`}${X.home ? '；' + esc(X.home) : ''}</p>
      <details data-k="ctx"><summary>第十一部分逐题（按“自由度”方向计分）</summary><div class="tbl-wrap"><table><thead><tr><th>题</th><th class="num">甲国</th><th class="num">乙国</th><th class="num">D = 乙 − 甲</th></tr></thead><tbody>${ctx}</tbody></table></div></details>
      <p><b>历史题：</b>U ${X.histU} 题，× ${X.histX} 题${X.histLow ? '；社会主义各传统之间的区分主要依据原则题，确定程度较低' : ''}。</p>
      <p><b>议题优先次序：</b>最看重 ${esc([pr.first, pr.second, pr.third].filter(Boolean).map(p => p.letter + ' ' + p.label).join('、') || '未答')}；最不看重 ${esc(pr.least ? pr.least.letter + ' ' + pr.least.label : '未答')}</p>
      ${X.goalMeans.length ? `<p><b>目标—手段组合：</b>${esc(X.goalMeans.join('；'))}。这不是“不一致”，不据此修改分数。</p>` : ''}
    </article>`;
  }
  function renderReport(R) {
    return `<article class="card"><h2>报告全文 <span class="layer">按计分说明第十二节的格式</span></h2>
      <textarea class="report" id="report-text" readonly>${esc(E.reportText(R, state.cur.id))}</textarea>
      <div class="row"><button class="btn primary" data-copy="report">复制报告</button><button class="btn dl-only" data-dl="report">下载为文本文件</button></div>
      <p class="small muted">报告用语按计分说明的规定，不写成“你是某某主义者”；也不说明作答者在某一人群中的百分位。</p>
    </article>`;
  }
  function cardPlainText(id) {
    const c = DATA.cards.find(x => x.id === id);
    return '请按1～7作答：1 = 非常不同意，2 = 不同意，3 = 有点不同意，4 = 中立（两边相当），5 = 有点同意，6 = 同意，7 = 非常同意。不了解或无法判断，请填U；不愿回答，请填×。\n' + c.items.map(([t], i) => `${i + 1}. ${t}（　　）`).join('\n');
  }
  function onResultInput(e) {
    const el = e.target; if (!el.classList.contains('card-in')) return;
    const id = el.dataset.card, i = +el.dataset.i;
    const r = E.normField('1', el.value);
    if (!r.bad && r.v !== '' && el.value !== r.v) el.value = r.v;
    const arr = state.cur.cards[id] = (state.cur.cards[id] || ['', '', '', '']).slice();
    arr[i] = el.value; touched();
    el.classList.toggle('bad', r.bad);
    if (!r.bad && r.v !== '' && i < 3) { const nx = document.getElementById(`c-${id}-${i + 1}`); if (nx) { nx.focus(); nx.select(); } }
    schedule();
  }
  function onResultClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const R = state.lastR;
    if (b.dataset.copy === 'report') copyText($('report-text').value, 'report-text');
    else if (b.dataset.copy === 'reask') copyText(R.recs.reask.map(n => `第${n}题　${ITN[n].t}`).join('\n'));
    else if (b.dataset.copy && b.dataset.copy.startsWith('card:')) copyText(cardPlainText(b.dataset.copy.slice(5)));
    else if (b.dataset.dl === 'report') saveFile(`意识形态测试结果报告${state.cur.id ? '_' + state.cur.id : ''}.txt`, $('report-text').value);
  }

  // ---------------- 批量 ----------------
  const headerRow = () => ['编号', ...DATA.cols];
  function exampleBatchText() {
    const rows = EXAMPLES.batch.map((raw, i) => ['示例' + '甲乙丙'[i], ...DATA.cols.map(c => raw[c] === undefined ? '' : raw[c])].join('\t'));
    return [headerRow().join('\t'), ...rows].join('\n');
  }
  function runBatch(quiet) {
    const text = $('batch-text').value; state.batch.text = text;
    if (!text.trim()) { state.batch.rows = []; $('batch-msg').textContent = ''; renderBatch(); persist(); return; }
    const parsed = E.parseTable(text);
    state.batch.rows = parsed.rows.map(row => {
      if (row.cards && Object.keys(row.cards).length) state.batch.cards[row.id] = Object.assign(state.batch.cards[row.id] || {}, row.cards);
      return { id: row.id, raw: row.raw, cards: state.batch.cards[row.id] || (state.batch.cards[row.id] = {}) };
    });
    const msg = $('batch-msg');
    msg.className = 'msg' + (parsed.errors.length ? ' err' : '');
    msg.textContent = (state.batch.example ? '框里是3份虚构的示例数据，粘贴你的数据前请先点“清空”。' : '') + (parsed.errors.length ? parsed.errors.slice(0, 5).join('；') + (parsed.errors.length > 5 ? `；另有 ${parsed.errors.length - 5} 行有问题` : '') : (quiet ? '' : `已读入 ${parsed.rows.length} 位作答者${parsed.header ? '（按表头识别各列）' : '（未见表头，按默认列顺序读取）'}。`));
    renderBatch(); persist();
  }
  function summarize(row) {
    const R = E.compute(row.raw, row.cards);
    const f = R.final;
    const concl = R.suspect ? '质量存疑，不给结论' : f.label === '兼有' ? '兼有' + (f.lean ? `（更接近${short(f.lean)}）` : '') : f.label === '无法区分' ? '还不能区分' : f.label + (f.viaCard ? '（经补问区分）' : '');
    const who = R.suspect ? '' : f.who.join('、');
    const steps = R.suspect ? '核对作答质量' : nextSteps(R).join('；');
    return { R, concl, who, steps };
  }
  function renderBatch() {
    const rows = state.batch.rows;
    $('batch-count').textContent = rows.length ? `${rows.length} 位作答者` : '';
    if (!rows.length) { $('batch-result').innerHTML = '<p class="muted">还没有数据。粘贴后点“计分”。</p>'; $('results-tsv').value = ''; return; }
    const sums = rows.map(summarize);
    state.batch.sums = sums;
    const td = d => `<td class="num">${d.report ? E.sgn(d.T) : '—'}</td>`;
    $('batch-result').innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>编号</th><th>作答质量</th><th>第二层结论</th><th>下一步</th><th class="num">E</th><th class="num">L</th><th class="num">R</th><th class="num">V</th><th class="num">S</th><th class="num">所有制目标</th><th>自我认同</th><th></th></tr></thead><tbody>${rows.map((row, i) => {
      const s = sums[i], R = s.R, q = R.quality;
      return `<tr><td>${esc(row.id)}</td><td>${R.suspect ? chip('bad', '存疑') : q.flags.length ? chip('warn', '标记' + q.flags.length + '项') : chip('ok', '正常')}</td><td><b>${esc(s.concl)}</b><div class="small">${esc(s.who)}</div></td><td class="small">${esc(s.steps)}</td>${['E', 'L', 'R', 'V', 'S'].map(k => td(R.dims[k])).join('')}${td(R.subs.E['所有制目标'])}<td class="small">${esc(R.layer3.letter ? R.layer3.letter + ' · ' + R.layer3.match : '未答')}</td><td><button class="btn small" data-view-row="${i}">查看</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
    $('results-tsv').value = resultsTable('\t');
  }
  function resultsTable(sep) {
    const head = ['编号', '作答质量', '质量标记', '第二层结论', '相关传统', '下一步', 'E 经济', 'L 政治', 'R 路径', 'V 组织', 'S 社会', '所有制目标', '资源配置', '再分配', 'N1 民族·认同', 'N2 民族·成员资格', '两个主维度的组合', '自我认同（第259题）', '与第二层对照', '第一至十部分U', '第一至十部分×', '第一至十部分漏答', '作答分钟'];
    const v = d => d.report ? E.sgn(d.T) : '未答较多';
    const cell = x => { const s = String(x === null || x === undefined ? '' : x); return sep === ',' && /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s.replace(/[\t\n]/g, ' '); };
    const lines = [head.map(cell).join(sep)];
    state.batch.rows.forEach((row, i) => {
      const s = state.batch.sums[i], R = s.R, q = R.quality;
      lines.push([row.id, R.suspect ? '存疑' : '正常', q.flags.map(f => f.text).join('；'), s.concl, s.who, s.steps, v(R.dims.E), v(R.dims.L), v(R.dims.R), v(R.dims.V), v(R.dims.S), v(R.subs.E['所有制目标']), v(R.subs.E['资源配置']), v(R.subs.E['再分配']), v(R.dims.N1), v(R.dims.N2), R.layer1.position, R.layer3.label, R.layer3.match, q.U, q.X, q.blank, q.minutes === null ? '' : q.minutes].map(cell).join(sep));
    });
    return lines.join(sep === ',' ? '\r\n' : '\n');
  }
  function openRow(i) {
    const row = state.batch.rows[i];
    state.cur = { id: row.id, raw: row.raw, cards: row.cards, example: false };
    state.curBatchIndex = i;
    showView('single'); syncSheet(); schedule(true);
    toast(`已打开 ${row.id}；在这里补录的补问答案会带回批量结果`);
  }
  async function importFile(file) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\uFFFD')) { try { text = new TextDecoder('gb18030').decode(buf); } catch (e) { /* 保留 UTF-8 结果 */ } }
    text = text.replace(/^﻿/, '');
    $('batch-text').value = text; state.batch.example = false; runBatch();
  }

  // ---------------- 说明 ----------------
  function buildHelp() {
    const cols = DATA.cols;
    $('help').innerHTML = `
      <div class="card"><h2>四步完成一份计分</h2><ol>
        <li><b>录入：</b>在“单份计分”的答题卡上按题号填写。1～7照填；不了解填 U，不愿回答填 ×（按 x 键即可）；漏答留空。填完一格自动跳到下一格。如果你已经在 Excel 里录好，可以复制一整行，粘贴到第1格。</li>
        <li><b>看质量：</b>右侧“作答质量”七项检查中，注意力检查没通过，或标记两项以上，第二层就不给结论，只报告第一层。</li>
        <li><b>按提示补问：</b>结论为“还不能区分”“信息不足”，或核心条件证据不足、临界时，右侧会列出需要作答者再考虑的题（答题卡上用黄框标出）和应使用的补问卡。补问卡只给作答者看题目，不要告诉他题目指向哪个传统；把回答填进卡片，结论会自动重算。</li>
        <li><b>出报告：</b>“报告全文”按计分说明第十二节的格式写好，点“复制报告”粘贴到 Word 里即可。</li>
      </ol></div>
      <div class="card"><h2>批量录入的表格格式</h2>
        <p>每位作答者一行，第一行是表头，共 ${cols.length + 1} 列。顺序如下（用“批量计分”里的“复制录入表头”，粘贴到 Excel 第一行，就不用自己打）：</p>
        <div class="colfmt">编号、1、2、……、219、220甲、220乙、……、225甲、225乙、226、……、257、258第一、258第二、258第三、258最不看重、259、259写明、260、……、267</div>
        <ul>
          <li>第1～257题：填 1～7、U 或 ×；第220～225题甲、乙两国各占一列。</li>
          <li>第258题：四列各填一个字母 A～L。第259题：填字母 A～P；选O时可在“259写明”列写名称。</li>
          <li>第260、265题填1～7；第261～264题填0～10（0是有效答案）；第266题填“是”或“否”（也可以填1或0）；第267题填分钟数。</li>
          <li>有表头时按表头识别各列，列的先后可以不同；没有表头时，按上面的顺序读取，有编号列共 ${cols.length + 1} 列，没有编号列共 ${cols.length} 列。</li>
          <li>Excel 另存为 CSV 后，也可以用“从文件导入”读入（UTF-8 和 GBK 编码都可以）。</li>
          <li>问卷结果页给出的“答卷代码”是同样格式的一行（含补问卡答案），可以直接粘贴到“批量计分”的框里，或粘贴到“单份计分”的第1格；多位作答者的代码每人一行，粘贴在一起即可。</li>
        </ul>
      </div>
      <div class="card"><h2>结论怎么读</h2><ul>
        <li><b>稳定接近：</b>本问卷最强的结论。三项核心目标都成立且不临界，判别题高度一致；即使把未答题按最不利的情况计算，结论也不变。</li>
        <li><b>较接近／部分接近：</b>与某一传统明显最接近；“部分接近”表示有一项核心条件不在该传统的典型位置，报告时要写明是哪一项。</li>
        <li><b>兼有：</b>证据充分，确实介于两个传统之间，是实质性的混合立场。</li>
        <li><b>还不能区分：</b>与两个传统都接近，但未答的判别题太多，分不出来；可以补问。</li>
        <li><b>信息不足：</b>决定结论的核心问题没有回答。最常见的原因是某个核心维度有两三道题填了U；请作答者补答黄框里的题，结论通常就能确定。</li>
        <li><b>未覆盖：</b>不属于这14个传统中任何一个的典型位置。这不表示没有立场，用第一层描述即可。</li>
      </ul><p class="small muted">任何结论都不写成“你是某某主义者”，也不说明作答者在某一人群中的百分位。这些门槛和规则尚未经过真实样本检验，见计分说明第十三节。</p></div>
      <div class="card"><h2>关于这个工具</h2><ul>
        <li>计分规则与《施测者计分说明》一一对应；若以后修改了计分说明里的题目或门槛，这个工具不会自动跟着变。</li>
        <li>答案只在本页里计算，不会上传。当前录入的答卷和批量数据会作为草稿保存在这台电脑的浏览器里，换电脑或清除浏览器数据后不会保留；要长期保存，请保留你的 Excel 原始表格。</li>
        <li>带圆点的格子是判别题；红色的格子是无法识别的录入，按未答处理；黄框是建议请作答者再考虑的题。</li>
      </ul></div>`;
  }

  // ---------------- 视图与保存 ----------------
  function showView(v) {
    state.view = v;
    for (const name of ['single', 'batch', 'help']) { $('view-' + name).hidden = name !== v; $('tab-' + name).setAttribute('aria-selected', String(name === v)); }
    if (v === 'batch') renderBatch();
  }
  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => LS.set(KEY, { cur: state.cur, batchText: state.batch.text, batchCards: state.batch.cards, batchExample: state.batch.example, curBatchIndex: state.curBatchIndex }), 300);
  }

  // ---------------- 启动 ----------------
  buildSheet(); buildHelp();
  const saved = LS.get(KEY);
  if (saved && saved.cur && saved.cur.raw) {
    state.cur = saved.cur; state.batch.text = saved.batchText || ''; state.batch.cards = saved.batchCards || {}; state.batch.example = !!saved.batchExample;
  } else {
    state.cur = exampleRecord(); state.batch.text = exampleBatchText(); state.batch.example = true;
  }
  $('batch-text').value = state.batch.text;
  if (state.batch.text.trim()) runBatch(true);
  if (saved && saved.curBatchIndex !== null && saved.curBatchIndex !== undefined && state.batch.rows[saved.curBatchIndex] && state.batch.rows[saved.curBatchIndex].id === saved.cur.id) {
    const row = state.batch.rows[saved.curBatchIndex];
    Object.assign(row.raw, saved.cur.raw); state.cur = { id: row.id, raw: row.raw, cards: row.cards, example: false };
    Object.assign(row.cards, saved.cur.cards || {}); state.curBatchIndex = saved.curBatchIndex;
  }
  syncSheet(); render();

  const sheet = $('sheet');
  sheet.addEventListener('input', onSheetInput);
  sheet.addEventListener('keydown', onSheetKey);
  sheet.addEventListener('paste', onSheetPaste);
  sheet.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.col) $('focus-bar').innerHTML = describeCol(e.target.dataset.col); });
  $('result').addEventListener('input', onResultInput);
  $('result').addEventListener('click', onResultClick);
  $('btn-jump').addEventListener('click', () => $('result').scrollIntoView({ block: 'start' }));
  $('cur-id').addEventListener('input', e => { state.cur.id = e.target.value; touched(); schedule(); });
  $('btn-new').addEventListener('click', () => { state.cur = blankRecord(); state.curBatchIndex = null; syncSheet(); render(); focusIdx(0); toast('已清空，可以开始录入'); });
  $('btn-example').addEventListener('click', () => { state.cur = exampleRecord(); state.curBatchIndex = null; syncSheet(); render(); toast('已载入示例答卷（虚构）'); });
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
  $('batch-run').addEventListener('click', () => { if ($('batch-text').value !== exampleBatchText()) state.batch.example = false; runBatch(); });
  $('batch-clear').addEventListener('click', () => { $('batch-text').value = ''; state.batch.example = false; state.batch.cards = {}; runBatch(); $('batch-text').focus(); });
  $('batch-file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) importFile(f).catch(() => toast('文件读取失败')); e.target.value = ''; });
  $('copy-header').addEventListener('click', () => copyText(headerRow().join('\t')));
  $('dl-template').addEventListener('click', () => saveFile('意识形态测试调查_录入模板.csv', '﻿' + headerRow().join(',') + '\r\n'));
  $('dl-results').addEventListener('click', () => { if (!state.batch.rows.length) { toast('还没有结果'); return; } saveFile('意识形态测试调查_计分结果.csv', '﻿' + resultsTable(',')); });
  $('copy-results').addEventListener('click', () => { if (!state.batch.rows.length) { toast('还没有结果'); return; } copyText(resultsTable('\t'), 'results-tsv'); });
  $('batch-result').addEventListener('click', e => { const b = e.target.closest('[data-view-row]'); if (b) openRow(+b.dataset.viewRow); });
})();
