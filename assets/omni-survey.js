/* OMNI web questionnaire: one response per screen, with local-only persistence. */
(function () {
  'use strict';
  const D = window.OMNI_DATA, E = window.OMNI_ENGINE, M = window.OMNI_SESSION;
  const KEY = 'ideology-survey-omni-2026-11-01';
  const app = document.getElementById('app');
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = ['非常不同意','不同意','有点不同意','中立（两边相当）','有点同意','同意','非常同意'];
  const instructionsText = [
    '本卷采用共同题与分支题库，供个人梳理当前政治立场。没有标准立场，也不据此评价人的好坏。结果包括议题画像、已核验思想的接近情况和本人认同，允许组合、分歧与暂未形成。',
    `本题库有132道共同立场题、216道专题题、${D.legacySupplement.items.length}道补充题和358张思想核验卡。题库不是整本全答；本次按分支最多${D.limits.maxResponses}个响应项。不限答题时间，可以分次完成，未完成部分保留为未检验。`,
    '顺序为：共同题 → 九个主题的36道筛查题 → 情境题和背景记录 → 最多两个专题的剩余题 → 自选补充题组 → 最多四张核验卡。网页按所选分支呈现题目，补充题组可以全选或跳过；不要从头做到题库末尾。',
    '支持度题使用1～7：1 非常不同意，2 不同意，3 有点不同意，4 中立（两边相当），5 有点同意，6 同意，7 非常同意。点击与你的看法最接近的选项。',
    '理解问题且认为两边相当时选4；不了解或无法判断选U；不愿回答选×。漏答与这两项分开记录。背景题与核验卡的0～3有单独含义，0不是漏答。',
    '先按你本人希望或认可的安排作答。明确写有假设情境的题，只评价该情境，不表示赞成其前提；不能接受前提到无法判断时选U，并可在Z06说明。',
    '本测试不要求姓名、单位、账号等身份资料。答案仅保存在当前浏览器；导出的答卷包含作答内容，请自行决定是否向他人提供，并确认对方的保管方式。宗教、国籍和族裔身份不等于政治立场。',
    '请按当前真实看法作答，不必追求一致。核验卡默认先回答三条主张，再显示思想名称，随后选择熟悉度和自我认同；如果主动按名称选卡，报告会注明。不要为获得某个标签反改答案。',
    '未做的专题或卡片不能被解释为不接近。对历史路线和理论学派，问卷只能核对有限主张及自我认同；不能仅凭政策赞同证明学术或组织归属。',
    '本版尚待真实样本校准。它可生成有依据的个人描述，但不提供已验证的分类准确率、身份鉴定或全世界政治光谱中的精确坐标。'
  ];
  const instructionsHTML = () => '<ol class="instr-list">' + instructionsText.map(text => '<li>' + esc(text) + '</li>').join('') + '</ol>';
  const webInstructions = '<p class="notice"><b>网页版操作：</b>本页由程序按上述规则呈现分支；点击选项即可作答，选择后自动进入下一题。可以返回修改，每答一题自动保存。不限答题时间，可随时离开并回来继续；不会因用时较长而跳题或自动交卷。</p>';
  const contexts = {Z01:['完全不担心','有一点','比较担心','非常担心'],Z02:['没有','看过一部分','较完整地看过'],Z03:['尚未形成','部分确定','比较确定','很确定']};
  const stageNames = {instructions:'作答说明',base:'共同立场与全主题筛查',moduleSelect:'选择深入专题',modules:'专题作答',supplementSelect:'选择补充题组',supplements:'补充题',cardSelect:'选择思想核验卡',cards:'思想核验',review:'交卷前检查',result:'个人立场报告'};
  const moduleFor = id => D.modules.find(m => m.items.some(q => q.id === id));
  const cardBy = id => D.cards.find(c => c.id === id);
  let catalogueSeenBeforeStart = false;
  let S = null, view = 'home', advanceTimer = null, toastTimer, loadError = '', selectedModules = [], selectedCards = [], cardCandidates = [], namedCards = false;
  try { const raw = localStorage.getItem(KEY); if (raw) S = M.validate(D, JSON.parse(raw)); } catch (error) { loadError = '本机记录暂时无法读取，未覆盖它。你可以导入此前保存的答卷，或清除记录后重做。'; }
  function toast(message) {
    const el = document.getElementById('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
  }
  function save() {
    if (!S) return;
    S.elapsedMs = M.elapsed(S);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { toast('浏览器未能保存记录。请导出答卷备份，避免关闭页面后丢失。'); }
  }
  function timer() { return `<div class="timer-row"><span>${esc(stageNames[S.stage])}</span><span class="pill">不限时 · 进度自动保存</span></div>`; }
  function action(name, text, cls='btn') { return `<button class="${cls}" data-action="${name}">${text}</button>`; }
  function home() {
    const saved = S ? (S.finished ? action('result','查看我的报告','btn primary big') : action('resume','继续作答','btn primary big')) : action('start','开始测试','btn primary big');
    app.innerHTML = `<section class="intro-hero"><p class="kicker">政治立场与思想倾向问卷</p><h1 class="hero-heading"><span class="home-icon" aria-hidden="true">⚖️</span><span>让观点先于标签</span></h1><p class="hero-copy">从具体主张出发，梳理你如何看待经济、权利、国家与社会。既看支持什么，也看保留什么；让一份详细报告呈现你自己的立场组合。</p><div class="stat-grid"><div><strong><span class="home-icon" aria-hidden="true">📊</span><span>22<span class="stat-unit">个</span></span></strong>独立立场分面</div><div><strong><span class="home-icon" aria-hidden="true">🧭</span><span>9<span class="stat-unit">个</span></span></strong>专题方向</div><div><strong><span class="home-icon" aria-hidden="true">🗂️</span><span>358<span class="stat-unit">个</span></span></strong>思想核验卡</div><div><strong><span class="home-icon" aria-hidden="true">♾️</span><span>不限时</span></strong>可分次继续作答</div></div><div class="actions center">${saved}${action('catalog','浏览覆盖目录','btn')}${S ? action('export','导出答卷备份','btn') : ''}</div>${S && !S.finished ? '<p class="help">答卷已自动保存在本机。可随时回来继续作答，没有交卷截止时间。</p>' : ''}<p class="privacy-note"><b>你的答案留在本机。</b>无需注册，不要求姓名、单位或账号。没有统计服务，不加载外部字体，不上传答案。只有你主动导出的文件或答卷代码会包含作答内容。</p></section>
+      ${loadError ? `<p class="notice warning">${esc(loadError)}</p>` : ''}
+      <section class="section"><h2>这份测试能给你什么</h2><div class="feature-grid"><article class="feature"><h3><span class="home-icon" aria-hidden="true">🧩</span><span>拆开不同问题，看见立场组合</span></h3><p>所有制、资源配置、再分配与劳动关系分别呈现；公民权利、政治竞争、组织、文化、生态和技术也分别分析。支持某项制度，不必被推成一整套立场。</p></article><article class="feature"><h3><span class="home-icon" aria-hidden="true">🔎</span><span>把结论追溯到你的回答</span></h3><p>结果展示各分面的方向、具体主张、保留意见和信息缺口。中立、不了解、不愿回答、未呈现与漏答分开记录，避免把沉默当作反对。</p></article><article class="feature"><h3><span class="home-icon" aria-hidden="true">🌐</span><span>广泛覆盖，按需深入</span></h3><p>358 张规范卡，另收录 196 个别名，附有 82 项资料来源；还可选择 ${D.legacySupplement.items.length} 道涵盖具体政策、治理与历史经验的补充题。目录涉及社会主义、自由主义、保守主义、无政府主义，以及宗教、地域、性别、生态与技术等思想。</p></article><article class="feature"><h3><span class="home-icon" aria-hidden="true">🔀</span><span>保留相邻流派之间的差别</span></h3><p>共同题与全主题筛查后，最多深入两个专题、核对四张卡。建议同时核对相邻解释；先回答三项主张，再记录对名称的熟悉度和自我认同。</p></article></div></section>
+      <section class="section"><h2>一次作答，四个步骤</h2><ol class="steps"><li><span class="step-title"><span class="home-icon" aria-hidden="true">📋</span><span>共同立场</span></span><small>132 道题，建立 22 个分面画像</small></li><li><span class="step-title"><span class="home-icon" aria-hidden="true">🌐</span><span>全主题筛查</span></span><small>36 道筛查，另有情境与背景记录</small></li><li><span class="step-title"><span class="home-icon" aria-hidden="true">🧭</span><span>选择深入方向</span></span><small>最多 2 个专题，并可另选补充题组</small></li><li><span class="step-title"><span class="home-icon" aria-hidden="true">📑</span><span>核验与报告</span></span><small>最多 4 张卡，自动生成详细分析</small></li></ol><p class="notice">题库覆盖的广度与单次测量的范围不同。每次按分支最多 ${D.limits.maxResponses} 个响应项，包含最多 ${D.legacySupplement.items.length} 道补充题。不限答题时间，支持分次完成，也可自行结束并根据已答内容生成报告。未做的卡会写明“未检验”，不会被判成与你不相符。</p></section>
+      <section class="section panel"><h2>关于完备性</h2><p>本版为目录中每个思想名称提供核验入口，支持跨专题选择、别名检索和多重认同。它能给出有作答依据的个人描述，但政治思想没有公认且封闭的“全部名单”，目录仍可补充。</p><p class="muted">题目和分界尚待真实样本检验；358 张卡的覆盖不等于已验证的分类准确率，也不表示一次测试逐一排除了所有思想。报告不会把单一得分当作身份鉴定、概率或人群排名。</p></section>
+      <section class="section panel" aria-labelledby="instructions-title"><h2 id="instructions-title">测评说明</h2>${instructionsHTML()}${webInstructions}</section>
+      <section class="section"><details><summary>本机记录与答卷导入</summary><p class="help">答卷自动保存在当前浏览器，可导出备份，也可导入本测试生成的答卷。公共设备用完后请清除本机记录。</p><div class="actions"><label class="btn">导入答卷<input type="file" id="import-file" accept=".json,.txt" hidden></label>${action('reset','清除本机记录','btn')}</div></details></section>`.replace(/^\+/gm,'');
  }
  function instructions() {
    app.innerHTML = `${timer()}<section class="panel"><h1>测评说明</h1>${instructionsHTML()}${webInstructions}<p class="help">没有倒计时或自动交卷。你可以先保存进度，再回来继续。</p><div class="actions">${action('begin','我已了解，开始作答','btn primary')}</div></section>`;
  }
  function questionOptions(q) {
    if (contexts[q.id]) return contexts[q.id].map((label, value) => ({value,label}));
    if (q.part === 'K') return ['从未听过','只知道名称','此前能解释核心主张','此前能解释与相邻思想的差别'].map((label,value) => ({value,label}));
    if (q.part === 'I') return ['不认同这个名称','不确定','部分认同','明确认同'].map((label,value) => ({value,label}));
    return labels.map((label,i) => ({value:i+1,label}));
  }
  function isText(q) { return ['Z04','Z05','Z06'].includes(q.id) || q.part === 'explanation'; }
  // Approximate width of a title in em (CJK and full-width punctuation = 1, Latin and digits ≈ .56), so CSS can
  // shrink a long question just enough to keep it on one line on wide screens instead of breaking the sentence.
  function titleEm(text) { let n = 0; for (const ch of String(text)) n += ch.charCodeAt(0) < 256 ? (ch === ' ' ? 0.3 : 0.56) : 1; return Math.ceil(n * 1.02 + 0.6); }
  function current() { return S ? M.plan(D,S)[S.pos] : null; }
  function question() {
    const list = M.plan(D,S), q = list[S.pos];
    if (!q) { M.advance(D,S); save(); render(); return; }
    M.present(S,q); save();
    const card = q.cardId ? cardBy(q.cardId) : null;
    const revealed = card && ['K','I','explanation'].includes(q.part);
    let title = q.text, intro = '', topic = '';
    if (q.id.startsWith('J')) intro = '<div class="notice"><b>共同情境：</b>甲、乙两国在经济发展、治安、公共服务、外部威胁和既有权利保障上相同。甲国由承诺社会主义目标的政党执政，主要生产资料公有；乙国由承诺资本主义目标的政党执政，主要生产资料私有。除此以外不假定差别。请不要补充未给出的条件。</div>';
    if (card) {
      topic = `核验卡 ${card.id} · 第 ${['a','b','c','K','I','explanation'].indexOf(q.part)+1} / 6 项`;
      if (q.part === 'K') title = '在本次介绍以前，你对这个思想有多熟悉？';
      if (q.part === 'I') title = '你是否认同这个思想名称？';
      if (q.part === 'explanation') title = '用一两句话说明你的立场与保留意见';
      if (revealed) intro = `<div class="notice"><b>${esc(card.name)}</b> <span class="pill">${esc(card.kind)}</span><p>${q.part === 'K' ? '现在揭示思想名称。请回忆此次测评之前的了解程度；详细解释将在下一项显示。' : esc(card.summary)}</p>${q.part === 'K' ? '' : `<p class="help">与相邻思想的区分：${esc(card.near)}。${esc(card.note)}</p>`}</div>`;
      else intro = '<p class="help">先只评价这项主张。三项回答完成后显示思想名称。</p>';
      if (S.cardRevealed.includes(card.id) && !revealed) intro += '<p class="notice warning">你已经看过这张卡的名称。修改时会同时保留原回答与更正记录。</p>';
    } else if (/^L\d{3}$/.test(q.id)) topic = '补充议题 · ' + D.legacySupplement.groups.find(g => g.id === q.group).name;
    else if (q.axis) topic = D.core.axes.find(a => a.id === q.axis).section;
    else if (moduleFor(q.id)) topic = moduleFor(q.id).title + (S.stage === 'base' ? ' · 筛查' : '');
    else topic = q.id.startsWith('J') ? '条件情境' : '作答记录';
    const value = S.answers[q.id], answered = list.filter(q => Object.hasOwn(S.answers,q.id) && S.answers[q.id] !== '').length;
    let inputs;
    if (isText(q)) {
      const hint = q.part === 'explanation' ? '可写：我支持什么安排、在哪些条件下保留意见，以及与相邻思想有什么不同。解释将保留供本人或施测者核对，不自动判定理解正确。' : q.options;
      inputs = `<p class="help">${esc(hint)}</p><label class="help" for="free-answer">你的说明</label><textarea id="free-answer" class="input" maxlength="2000" placeholder="可以留空；请勿填写姓名、单位等身份信息">${esc(value === 'X' || value === 'U' ? '' : value)}</textarea><div class="actions">${action('text-next','保存并继续','btn primary')}<button class="btn" data-value="X">不愿回答（×）</button></div>`;
    } else inputs = `<div class="answer-list">${questionOptions(q).map(o => `<button class="answer" data-value="${o.value}" aria-pressed="${value === o.value}"><b>${o.value}</b><span>${esc(o.label)}</span></button>`).join('')}</div><div class="alt"><button class="btn" data-value="U" aria-pressed="${value === 'U'}">不了解或无法判断（U）</button><button class="btn" data-value="X" aria-pressed="${value === 'X'}">不愿回答（×）</button></div>`;
    app.innerHTML = `<div class="q-top">${timer()}<div class="q-meta"><span>${esc(topic)}</span><span>${esc(q.id)} · 本阶段 ${S.pos+1} / ${list.length}</span></div><div class="progress"><div class="bar" style="width:${100*answered/list.length}%"></div></div></div><article class="q-card" data-question="${q.id}" aria-labelledby="question-title">${intro}<h1 class="question-title" id="question-title" tabindex="-1" style="--qlen:${titleEm(title)}">${esc(title)}</h1>${inputs}</article><nav class="q-nav" aria-label="题目切换">${action('prev','← 上一题','btn ghost')}<span class="spacer"></span>${action('review','检查已答','btn ghost')}${action('next',value !== undefined && value !== '' ? '下一题 →' : '跳过 →','btn ghost')}</nav><p class="help">选择后自动前进。键盘数字键作答，U 不了解，X 不愿回答，← 返回。背景题的 0 是有效选项。</p><div class="actions">${action('export','导出备份','linkbtn')}${action('finish-early','提前结束并分析','linkbtn')}</div>`;
    const prev = app.querySelector('[data-action=prev]'); if (prev) prev.disabled = S.pos === 0;
  }
  function modules() {
    const recommendations = E.recommendModules(S.answers);
    if (!selectedModules.length && S.selectedModules.length) selectedModules = [...S.selectedModules];
    app.innerHTML = `${timer()}<section class="panel"><h1>选择你想深入的方向</h1><p>最多两个专题，每个补答 20 题。先前四道筛查题会直接沿用。推荐仅帮助导航，你可以选择任何方向，或不补答直接选择补充题组。</p><div class="choice-grid">${recommendations.map(m => `<label class="choice"><input type="checkbox" data-module="${m.id}" ${selectedModules.includes(m.id)?'checked':''}><strong>${esc(m.title)}</strong>${m.recommended?'<span class="pill">建议了解</span>':''}<small>${esc(m.reason || '可按你的兴趣选择')}</small></label>`).join('')}</div><div class="selection-bar"><span id="module-count">已选 ${selectedModules.length} / 2</span><div class="actions">${action('modules-confirm','确认方向并继续','btn primary')}${action('skip-modules','跳过专题，选择补充题组','btn')}</div></div></section>`;
  }
  function supplements() {
    const bank = D.legacySupplement;
    app.innerHTML = `${timer()}<section class="panel"><h1>选择补充题组</h1><p>这里有 ${bank.items.length} 道补充题，涵盖具体政策、治理与历史经验。可选任意题组、全选或跳过，不限时。补充结果单独报告，不改变 22 个共同分面及思想卡判定。</p><div class="choice-grid">${bank.groups.map(g => `<label class="choice"><input type="checkbox" data-supplement="${g.id}" ${S.selectedSupplements.includes(g.id)?'checked':''}><strong>${esc(g.name)}</strong><small>${bank.items.filter(q=>q.group===g.id).length} 题 · ${esc(g.description)}${g.scored ? '（单独计算内容分项）' : '（逐题描述）'}</small></label>`).join('')}</div><p class="help">补充题同样使用 1～7 选项，请按当前看法作答。<a href="https://github.com/Saigyouji-Yukari/ideology-survey/blob/main/SCORING.md" target="_blank" rel="noopener">查看计分说明</a></p><div class="actions">${action('supplements-confirm','作答所选补充题组','btn primary')}${action('skip-supplements','跳过补充题，选择核验卡','btn')}</div></section>`;
  }
  function prepareCards() {
    const ranked = E.recommendCards(S.answers,S.selectedModules.length ? S.selectedModules : D.modules.map(m=>m.id));
    const groups = S.selectedModules.length ? S.selectedModules : D.modules.map(m=>m.id);
    const choices = [];
    for (const group of groups) {
      const top = ranked.find(c => c.module === group && c.referenceMean != null);
      if (!top) continue;
      if (!choices.includes(top.id)) choices.push(top.id);
      const near = (D.nearCardMap[top.id] || []).find(id => !choices.includes(id));
      if (near) choices.push(near);
      if (choices.length >= 4) break;
    }
    cardCandidates = [...new Set([...choices, ...ranked.filter(c=>c.referenceMean!=null).slice(0,12).map(c=>c.id)])];
    if (!cardCandidates.length) cardCandidates = D.modules.flatMap(m=>D.cards.filter(c=>c.module===m.id).slice(0,1).map(c=>c.id));
    if (!selectedCards.length) selectedCards = S.selectedCards.length ? [...S.selectedCards] : choices.slice(0,4);
  }
  function cards() {
    prepareCards();
    app.innerHTML = `${timer()}<section class="panel"><h1>核对候选思想与相邻解释</h1><p>最多选四张卡。建议为相邻思想留一个位置。推荐依据只用于选题，不是最终归属；没有被推荐的卡也可以选择。</p><p class="notice">默认按编号显示候选，先答主张再揭示名称。你也可以展开全部名称，自主寻找思想；报告会保留这项提示。</p><div class="actions">${action('toggle-names',namedCards?'收起名称，只显示编号':'按名称或别名选择全部 358 张卡','btn')}</div><div class="search-row" ${namedCards?'':'hidden'}><input class="input" type="search" id="card-search" placeholder="搜索名称、别名、编号或模块" aria-label="搜索核验卡"></div><div id="card-options" class="card-list"></div><div class="selection-bar"><span id="card-count">已选 ${selectedCards.length} / 4</span><p class="help" id="near-note"></p><div class="actions">${action('cards-confirm','开始核验所选卡片','btn primary')}${action('skip-cards','暂不核验，查看已答','btn')}</div></div></section>`;
    cardList('');
  }
  function cardList(query) {
    const match = query.trim().toLocaleLowerCase();
    let list = namedCards ? D.cards : cardCandidates.map(cardBy).filter(Boolean);
    if (match) list = list.filter(c => [c.id,c.name,c.module,...c.aliases].join(' ').toLocaleLowerCase().includes(match));
    document.getElementById('card-options').innerHTML = list.map(c => `<label class="card-choice"><input type="checkbox" data-card="${c.id}" ${selectedCards.includes(c.id)?'checked':''}><span><b>${esc(c.id)} · ${namedCards ? esc(c.name) : esc(D.modules.find(m=>m.id===c.module).title)}</b><small>${esc(c.kind)}${namedCards&&c.aliases.length ? ' · '+esc(c.aliases.join('、')):''}${selectedCards.some(id => (D.nearCardMap[id]||[]).includes(c.id))?' · 已选卡的相邻解释':''}</small></span></label>`).join('') || '<p class="help">没有匹配项。可换一个别名或查看全部目录。</p>';
    updateSelection();
  }
  function updateSelection() {
    const node = document.getElementById('card-count'); if (node) node.textContent = `已选 ${selectedCards.length} / 4：${selectedCards.join('、') || '尚未选择'}`;
    const near = document.getElementById('near-note'); if (near) near.textContent = selectedCards.some(id => (D.nearCardMap[id]||[]).some(n => selectedCards.includes(n))) ? '已包含至少一组相邻思想，可在报告中比较各自主张。' : '尚未形成相邻卡配对。可从候选中加入一个相邻解释；也允许按个人需要继续。';
  }
  function review() {
    const all = [...M.base(D),...M.plan(D,S,'modules'),...M.plan(D,S,'supplements'),...M.plan(D,S,'cards')];
    const seen = all.filter(q=>S.presented.includes(q.id));
    const answered = seen.filter(q=>S.answers[q.id]!==undefined&&S.answers[q.id]!=='').length;
    app.innerHTML = `${timer()}<section class="panel"><h1>检查后生成报告</h1><p>已呈现 ${seen.length} 项，其中 ${answered} 项有记录。未呈现和跳过的项目不会补成中立或反对。</p>${S.stopReason?`<p class="notice">${esc(S.stopReason)}</p>`:''}<p class="help">点击已呈现题号复核。不限复核时间；提交前可以修改已答题或返回继续。</p><div class="review-grid">${seen.map(q=>`<button data-jump="${q.id}" class="${S.answers[q.id]==='U'?'unknown':S.answers[q.id]==='X'?'refused':S.answers[q.id]!==undefined&&S.answers[q.id]!==''?'done':''}">${q.id}</button>`).join('')}</div><div class="actions">${action('finish','生成详细分析报告','btn primary')}${S.reviewReturn && S.reviewReturn.stage !== 'review' ? action('return','返回作答','btn') : ''}${action('export','导出答卷备份','btn')}</div></section>`;
  }
  function result() {
    app.innerHTML = `<div class="actions no-print">${action('export','导出完整答卷','btn')}${action('copy','复制答卷代码','btn')}${action('print','打印 / 保存为 PDF','btn')}${action('report-text','下载文字报告','btn')}${action('catalog','查看覆盖与未检验目录','btn')}</div><div id="report-content">${window.OMNI_REPORT.render(S)}</div><div class="actions no-print">${action('reset','清除本机记录','btn')}</div>`;
  }
  function catalogue() {
    app.innerHTML = `<section class="panel"><h1>思想覆盖目录</h1><p>358 张规范卡与别名均有独立核验入口。目录浏览本身不构成测试；一次答卷只分析实际呈现的卡片。</p><p class="help">分类名称可能交叉，上位家族与分支并不互斥。历史路线、理论学派和横向标签也不是同一层级。</p><label for="catalog-search" class="help">搜索名称、别名、类型或模块</label><input id="catalog-search" type="search" class="input" placeholder="例如：社会民主主义、生态、T001"><div id="catalog-rows"></div><div class="actions">${action(S&&S.finished?'result':'home','返回','btn')}</div></section>`;
    catalogueRows('');
  }
  function catalogueRows(query) {
    const words = query.trim().toLowerCase(), list = D.cards.filter(c=>[c.id,c.name,c.module,c.kind,...c.aliases].join(' ').toLowerCase().includes(words));
    document.getElementById('catalog-rows').innerHTML = `<p class="help">找到 ${list.length} 张卡</p><div class="table-scroll"><table class="report-table catalog-table"><thead><tr><th>名称与别名</th><th>范围</th><th>本次状态</th></tr></thead><tbody>${list.map(c=>`<tr><td>${esc(c.id)} ${esc(c.name)}${c.aliases.length?`<small>${esc(c.aliases.join('、'))}</small>`:''}</td><td>${esc(c.kind)}<small>${esc(D.modules.find(m=>m.id===c.module).title)}</small></td><td>${S&&S.presented.some(id=>id.startsWith(c.id+'.'))?'已呈现部分或全部项目':'未检验'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function render(focus=false) {
    clearTimeout(advanceTimer); advanceTimer = null;
    if (S && !S.finished && M.enforce(D,S)) save();
    if (S && S.finished && view === 'test') view = 'result';
    if (view === 'home') home(); else if (view === 'catalog') catalogue(); else if (view === 'result') result();
    else ({instructions,base:question,moduleSelect:modules,modules:question,supplementSelect:supplements,supplements:question,cardSelect:cards,cards:question,review,result}[S.stage] || home)();
    if (focus) { const target = document.getElementById('question-title') || app; target.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); }
  }
  function next(delta=1) {
    if (!S || S.finished) return;
    if (S.reviewReturn && delta===1) { S.stage='review'; S.pos=0; }
    else M.advance(D,S,delta);
    save(); render(true);
  }
  function storeAnswer(value) {
    if (!S || advanceTimer || S.finished) return;
    if (M.enforce(D,S)) { save(); render(true); return; }
    const q = current(); if (!q) return;
    M.answer(S,q,value); save();
    app.querySelectorAll('[data-value]').forEach(el => {el.disabled = true;el.setAttribute('aria-pressed',String(el.dataset.value===String(value)));});
    advanceTimer = setTimeout(()=>{advanceTimer=null;next();},180);
  }
  function download(text,name,type='application/json') {
    const url = URL.createObjectURL(new Blob([text],{type})), a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function jump(id) {
    for (const stage of ['base','modules','supplements','cards']) {
      const pos=M.plan(D,S,stage).findIndex(q=>q.id===id);
      if (pos<0) continue;
      S.reviewReturn ||= {stage:S.stage,pos:S.pos};S.stage=stage;S.pos=pos;view='test';save();render(true);return;
    }
  }
  document.addEventListener('click', async event => {
    const button=event.target.closest('button'); if (!button) return;
    if (button.dataset.value!==undefined) {storeAnswer(/^\d+$/.test(button.dataset.value)?Number(button.dataset.value):button.dataset.value);return;}
    if (button.dataset.jump) {jump(button.dataset.jump);return;}
    const name=button.dataset.action; if (!name) return;
    if (name==='start') {S=M.fresh(D);S.catalogSeen=catalogueSeenBeforeStart;view='test';save();render(true);return;}
    if (name==='home') {view='home';render(true);return;}
    if (name==='catalog') {catalogueSeenBeforeStart=true;if(S&&!S.finished){S.catalogSeen=true;save();}view='catalog';render(true);return;}
    if (name==='resume') {view='test';render(true);return;}
    if (name==='result') {view='result';render(true);return;}
    if (name==='reset') {
      if (!confirm('清除本浏览器中的本测试答案？需要保留时，请先导出备份。')) return;
      try{localStorage.removeItem(KEY);}catch(_){}S=null;selectedCards=[];selectedModules=[];namedCards=false;loadError='';view='home';render();return;
    }
    if (name==='export') {if(S){save();download(JSON.stringify(S,null,2),S.id+'-答卷.json');}return;}
    if (name==='copy') {try{await navigator.clipboard.writeText(E.encodeSession(S));toast('已复制完整答卷代码。仅在你愿意分享答案时发送给他人。');}catch(_){toast('无法访问剪贴板，请使用导出答卷。');}return;}
    if (name==='print') {app.querySelectorAll('#report-content details').forEach(el=>el.open=true);window.print();return;}
    if (name==='report-text') {const details=[...app.querySelectorAll('#report-content details')], previous=details.map(d=>d.open);details.forEach(d=>d.open=true);document.body.classList.add('vz-text-export');const text=document.getElementById('report-content').innerText;document.body.classList.remove('vz-text-export');download(text,S.id+'-报告.txt','text/plain;charset=utf-8');details.forEach((d,i)=>d.open=previous[i]);return;}
    if (!S||S.finished) return;
    if (M.enforce(D,S)) {save();render(true);return;}
    if (name==='begin') {S.stage='base';S.pos=0;}
    else if (name==='prev') {next(-1);return;}
    else if (name==='next') {next();return;}
    else if (name==='text-next') {storeAnswer(document.getElementById('free-answer').value.trim());return;}
    else if (name==='review') {S.reviewReturn={stage:S.stage,pos:S.pos};S.stage='review';S.pos=0;}
    else if (name==='return') {const back=S.reviewReturn;delete S.reviewReturn;if(back){S.stage=back.stage;S.pos=back.pos;}}
    else if (name==='modules-confirm') {M.selectModules(D,S,selectedModules);}
    else if (name==='skip-modules') {M.selectModules(D,S,[]);}
    else if (name==='supplements-confirm') {M.selectSupplements(D,S,[...app.querySelectorAll('[data-supplement]:checked')].map(el=>el.dataset.supplement));}
    else if (name==='skip-supplements') {M.selectSupplements(D,S,[]);}
    else if (name==='toggle-names') {namedCards=!namedCards;if(namedCards){S.catalogSeen=true;}cards();save();return;}
    else if (name==='cards-confirm') {M.selectCards(D,S,selectedCards);}
    else if (name==='skip-cards') {M.selectCards(D,S,[]);}
    else if (name==='finish'||name==='finish-early') {
      if(name==='finish-early'&&!confirm('现在结束并根据已有答案生成报告？未完成部分将标明信息不足或未检验。'))return;
      M.finish(S,name==='finish-early'?'本人提前结束':'本人完成作答');view='result';
    }
    save();render(true);
  });
  document.addEventListener('change', async event => {
    const el=event.target;
    if(el.dataset.module){if(el.checked&&selectedModules.length>=2){el.checked=false;toast('最多选择两个专题。');return;}selectedModules=el.checked?[...selectedModules,el.dataset.module]:selectedModules.filter(id=>id!==el.dataset.module);document.getElementById('module-count').textContent=`已选 ${selectedModules.length} / 2`;}
    if(el.dataset.card){if(el.checked&&selectedCards.length>=4){el.checked=false;toast('最多核验四张卡。可先取消一个候选。');return;}selectedCards=el.checked?[...selectedCards,el.dataset.card]:selectedCards.filter(id=>id!==el.dataset.card);updateSelection();}
    if(el.id==='import-file'&&el.files[0]){try{if(el.files[0].size>2000000)throw new Error('文件过大');const text=await el.files[0].text();const imported=M.validate(D,text.trim().startsWith('{')?JSON.parse(text):E.decodeSession(text.trim()));if(S&&!confirm('用导入的答卷替换本机记录？'))return;S=imported;selectedCards=[];selectedModules=[];save();view=S.finished?'result':'test';render(true);}catch(error){toast('导入失败：'+error.message);}}
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='card-search')cardList(event.target.value);
    if(event.target.id==='catalog-search')catalogueRows(event.target.value);
    if(event.target.id==='free-answer'&&S&&!S.finished){if(M.enforce(D,S)){save();render();return;}M.answer(S,current(),event.target.value);save();}
  });
  document.addEventListener('keydown',event=>{
    if(view!=='test'||!S||S.finished||event.ctrlKey||event.metaKey||event.altKey||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
    const q=current();if(!q)return;
    if(event.key==='ArrowLeft'){event.preventDefault();next(-1);return;}
    if(event.key==='ArrowRight'){event.preventDefault();next();return;}
    if(isText(q))return;
    const k=event.key.toUpperCase(),v=/^[0-7]$/.test(k)?Number(k):k;
    if(['U','X'].includes(v)||questionOptions(q).some(o=>o.value===v)){event.preventDefault();storeAnswer(v);}
  });
  window.addEventListener('pagehide',save);
  window.addEventListener('pageshow',()=>{if(S&&!S.finished&&M.enforce(D,S)){save();render();}});
  render();
})();
