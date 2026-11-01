/* OMNI personal reports. Descriptive evidence, never a ranking of untested identities. */
(function (root) {
  'use strict';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid = value => Number.isInteger(value) && value >= 1 && value <= 7;
  const signed = value => value == null ? '—' : (value > 0 ? '+' : '') + value;
  const percentage = (count, total) => total ? (100 * count / total).toFixed(1) + '%' : '—';
  const ratingLabels = ['','强烈不同意','不同意','略不同意','中立','略同意','同意','强烈同意'];
  const familiarityLabels = ['此前没有听说','此前只知道名称','自评此前能解释核心主张','自评此前能说明与近邻的区别'];
  const identityLabels = ['不认同此名称','尚不确定','部分自我认同','明确自我认同'];

  function answer(value, presented) {
    if (presented === false) return '未呈现';
    if (valid(value)) return value + ' · ' + ratingLabels[value];
    if (value === 'U') return 'U · 不了解或无法判断';
    if (value === '×' || value === 'X' || value === 'x') return '× · 不愿回答';
    return '漏答';
  }

  function safeUrl(value) {
    try {
      const u = new URL(value);
      return /^https?:$/.test(u.protocol) ? esc(u.href) : null;
    } catch (_) { return null; }
  }

  function evidenceTable(items, presented) {
    return '<div class="report-table-wrap"><table class="report-table"><thead><tr><th scope="col">题号与主张</th><th scope="col">原始作答</th></tr></thead><tbody>' + items.map(item =>
      '<tr><td><span class="report-id">' + esc(item.id) + '</span> ' + esc(item.text) + '</td><td>' + esc(answer(item.answer, presented ? presented.has(item.id) : undefined)) + '</td></tr>'
    ).join('') + '</tbody></table></div>';
  }

  function facetMeaning(facet) {
    if (facet.value == null) return '有效答案不足 5 项，本分面不报告点值。';
    if (facet.pattern === 'neutral') return '这组已答题全部选择中立。';
    const direction = facet.value > 0 ? facet.positive : facet.value < 0 ? facet.negative : '两端的中间位置';
    let text = '本组均分更靠近' + (facet.value === 0 ? direction : '“' + direction + '”') + '。';
    if (facet.pattern === 'mixed') text += '单题包含不同方向的立场，应结合下列具体主张理解。';
    return text;
  }

  function renderFacets(result, presented) {
    return '<section class="report-section" aria-labelledby="report-facets"><h2 id="report-facets">22 个议题分面</h2><p>正负值对应各分面标出的两端，不能跨分面相加为“经济左右”或“威权”总分。缺答范围是假设缺答可以取任意 1～7 得到的边界，<strong>不是统计置信区间</strong>。</p><div class="report-grid">' + result.facets.map(facet => {
      const value = facet.value;
      let special = '';
      if (facet.id === 'EVID') special = '<p class="notice">这里只描述自报的经验判断可修正性，不评判道德、智力或作答质量。</p>';
      if (facet.id === 'FORCE') special = '<p class="notice">人道干预、利益用武与威慑属于不同目的，请分别看 Q109、Q111、Q113；不能用这个均分直接认定军国主义或和平主义。</p>';
      const sensitive = facet.sensitive ? '<p class="muted">这项描述对单题向中立移动一档的变化敏感；这不是误差概率。</p>' : '';
      return '<section class="report-axis"><div class="report-axis-heading"><h3>' + esc(facet.name) + '</h3><span class="report-score">' + (value == null ? '信息不足' : esc(signed(value))) + '</span></div><p class="report-poles"><span>−100 ' + esc(facet.negative) + '</span><span>+100 ' + esc(facet.positive) + '</span></p>' + (value == null ? '' : '<meter class="report-meter" min="-100" max="100" value="' + value + '" aria-label="' + esc(facet.name) + '：' + signed(value) + '">' + signed(value) + '</meter>') + '<p>' + esc(facetMeaning(facet)) + '</p><p class="muted">有效 ' + facet.valid + '/6 · 已答均分 ' + (facet.mean == null ? '—' : Number(facet.mean).toFixed(1)) + ' · 缺答范围 [' + facet.bounds.map(signed).join(', ') + ']</p>' + special + sensitive + '<details class="report-details"><summary>查看这 6 题的原始作答</summary>' + evidenceTable(facet.items, presented) + '</details></section>';
    }).join('') + '</div></section>';
  }

  function renderCard(card, session, data, presented) {
    const originals = session.originalBlindAnswers || {};
    const originalClaimRows = card.claims.filter(claim => Object.prototype.hasOwnProperty.call(originals, claim.id) && originals[claim.id] !== claim.answer).map(claim => '<li>' + esc(claim.id) + '：名称揭示前 ' + esc(answer(originals[claim.id])) + '；当前 ' + esc(answer(claim.answer)) + '。</li>').join('');
    const referenceRows = (card.referenceEvidence || []).filter(item => presented.has(item.id));
    const opposition = card.conflicts.length ? '反对 ' + card.conflicts.map(claim => claim.key).join('、') : '';
    const neutral = card.neutral.length ? '中立 ' + card.neutral.map(claim => claim.key).join('、') : '';
    const supported = card.support.length ? '支持 ' + card.support.map(claim => claim.key).join('、') : '';
    const parts = [supported, neutral, opposition].filter(Boolean).join('；') || '尚无有效的主张作答';
    const sourceMap = new Map(data.sources.map(source => [source.id, source]));
    const sourceLinks = (card.sources || []).map(id => {
      const source = sourceMap.get(id);
      if (!source) return '';
      const url = safeUrl(source.url);
      return '<li>' + (url ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + esc(source.title) + '</a>' : esc(source.title)) + ' <span class="muted">' + esc(id) + '</span></li>';
    }).join('');
    const nearTested = (card.nearCards || []).filter(near => near.statusCode !== 'untested');
    const nearUntested = (card.nearCards || []).filter(near => near.statusCode === 'untested');
    const nearText = nearTested.length ? '实际核验的近邻：' + nearTested.map(near => near.id + ' ' + near.name).join('、') + '。' : '本次没有核验目录中对应的近邻卡，不能据此排除其他解释。';
    const identityText = card.identity == null ? answer(session.answers[card.id + '.I'], presented.has(card.id + '.I')) : identityLabels[card.identity];
    const familiarityText = card.familiarity == null ? answer(session.answers[card.id + '.K'], presented.has(card.id + '.K')) : familiarityLabels[card.familiarity];
    const explanation = card.explanation ? '<blockquote class="report-quote">' + esc(card.explanation) + '</blockquote>' : '<p class="muted">未提供解释。</p>';
    let conflictText = '';
    if ((card.crossQuestionConflicts || []).length) {
      conflictText = '<div class="notice"><strong>跨题分歧待澄清</strong><ul>' + card.crossQuestionConflicts.map(item => '<li>' + esc(typeof item === 'string' ? item : [item.id, item.text, item.reason, item.note].filter(Boolean).join(' · ')) + (item && typeof item === 'object' && item.answer !== undefined ? '；原答 ' + esc(answer(item.answer)) : '') + '</li>').join('') + '</ul><p>请补充适用条件。这些参考题可能与主张题重复，不作为额外独立证据，也不机械否决本卡。</p></div>';
    }
    return '<section class="report-card" id="report-' + esc(card.id) + '"><div class="report-card-heading"><div><span class="report-id">' + esc(card.id) + '</span><h3>' + esc(card.name) + '</h3></div><span class="pill">' + esc(card.status) + '</span></div><p class="muted">' + esc(card.kind) + ' · ' + esc(card.parent) + '</p><p>' + esc(card.summary) + '</p><p><strong>' + esc(parts) + '。</strong>' + (card.strongSupport ? '两项核心主张支持较明确。' : '') + (card.statusCode === 'supported' ? '这表示与本卡所选的三项主张相符，不等于完整或唯一的思想归属。' : card.statusCode === 'insufficient' ? '缺少的主张不能按中立或半个赞同补入；已答反对项仍然保留。' : '应保留具体分歧，不能用平均分抵消反对。') + '</p>' + evidenceTable(card.claims, presented) + conflictText + '<div class="report-identity"><h4>名称认同与原有理解</h4><p>此前熟悉度：' + esc(familiarityText) + '。<br>获知名称后的自我认同：' + esc(identityText) + '。</p>' + explanation + '<p class="muted">' + esc(card.identityNote || '熟悉度属于自评；解释尚待人工核对，自动报告不据此认证流派身份。') + '</p>' + (card.kind === '历史路线' || card.kind === '理论学派' ? '<p class="muted">历史路线与理论学派还需要核对概念理解及近邻区别，三道立场题不能代替专门访谈。</p>' : '') + '</div>' + (card.unblinded || session.catalogSeen ? '<p class="muted">本卡有名称已知或目录已浏览的记录，按未盲核验理解。</p>' : '') + (originalClaimRows ? '<details class="report-details"><summary>名称揭示后的更正记录</summary><ul>' + originalClaimRows + '</ul><p class="muted">当前描述采用更正后的作答，保留原答以供复核。</p></details>' : '') + '<p>' + esc(nearText) + '</p>' + (nearUntested.length ? '<p class="muted">尚未核验的近邻：' + esc(nearUntested.map(near => near.id + ' ' + near.name).join('、')) + '。</p>' : '') + '<p class="muted">本卡范围：' + esc(card.note || '只核对本卡列出的主张。') + '</p>' + (card.sensitive ? '<p class="muted">本卡状态对单题向中立移动一档的变化敏感；这不是误判概率。</p>' : '') + '<details class="report-details"><summary>参考题与编制来源</summary><p>参考题仅用于选择核验方向；不计算思想相似度或概率。来源帮助理解思想背景，不代表这些三条主张已获得量表效度验证。</p>' + (referenceRows.length ? evidenceTable(referenceRows, presented) : '<p class="muted">参考题尚未实际呈现。</p>') + '<ul class="report-sources">' + sourceLinks + '</ul></details></section>';
  }

  function renderComparisons(cards, data) {
    const tested = new Map(cards.filter(card => card.statusCode !== 'untested').map(card => [card.id, card]));
    const seen = new Set();
    const rows = [];
    cards.forEach(card => (data.nearCardMap[card.id] || []).forEach(id => {
      const near = tested.get(id);
      if (!tested.has(card.id) || !near) return;
      const key = [card.id, id].sort().join(':');
      if (seen.has(key)) return;
      seen.add(key);
      const ac = card.claims.find(claim => claim.key === 'c');
      const bc = near.claims.find(claim => claim.key === 'c');
      rows.push('<li><strong>' + esc(card.name) + ' ↔ ' + esc(near.name) + '</strong><p>' + esc(card.id) + '.c：' + esc(ac.text) + '<br>作答：' + esc(answer(ac.answer)) + '</p><p>' + esc(near.id) + '.c：' + esc(bc.text) + '<br>作答：' + esc(answer(bc.answer)) + '</p><p class="muted">两张卡已经呈现，以上是本次实际回答的差别。c 题是编制者选取的区别，仍须结合各自 a、b 及范围理解；上位家族与子流派可以同时成立。</p></li>');
    }));
    return rows.length ? '<details class="report-details"><summary>查看本次实际核验的近邻比较</summary><ul class="report-comparisons">' + rows.join('') + '</ul></details>' : '';
  }

  function renderCards(result, session, data, presented) {
    const cards = result.cards.filter(card => card.statusCode !== 'untested' || session.selectedCards.includes(card.id));
    return '<section class="report-section" aria-labelledby="report-ideologies"><h2 id="report-ideologies">思想核验与自我认同</h2><p>主张支持、名称认同和原有理解分别记录。上位家族、子流派与横向标签允许并存，本报告不在 358 张卡中选择唯一赢家。</p>' + (cards.length ? cards.map(card => renderCard(card, session, data, presented)).join('') + renderComparisons(cards, data) : '<p class="notice">本次没有实际核验思想卡。以下议题分面可以描述已经表达的立场，不能据此直接认定某个流派。</p>') + '</section>';
  }

  function renderScenarios(result, presented) {
    const scenarios = result.scenarios;
    return '<section class="report-section"><h2>制度条件情境</h2><p>完整配对 ' + scenarios.complete + '/6。差值为甲国答案减乙国答案；正值表示在甲国设定下更支持相应安排。</p>' + (scenarios.complete >= 4 ? '<p>平均差值 <strong>' + signed(scenarios.meanDifference) + '</strong>；平均绝对差值 <strong>' + scenarios.meanAbsoluteDifference + '</strong>。正负差异可能抵消，须同时看逐项结果。</p>' : '<p>完整配对不足 4 对，只描述逐对结果。</p>') + '<div class="report-table-wrap"><table class="report-table"><thead><tr><th>安排</th><th>甲国</th><th>乙国</th><th>差值</th></tr></thead><tbody>' + scenarios.pairs.map(pair => '<tr><td>' + esc(pair.id) + ' ' + esc(pair.policy) + '</td><td>' + esc(answer(pair.a, presented.has(pair.id + 'A'))) + '</td><td>' + esc(answer(pair.b, presented.has(pair.id + 'B'))) + '</td><td>' + esc(signed(pair.difference)) + '</td></tr>').join('') + '</tbody></table></div><p class="muted">' + esc(scenarios.note || '情境同时改变所有制与执政目标，且未随机化顺序，不能分别识别因果作用。它用于追问条件差异，不评价人格。') + '若不能接受题设，应将这组情境标为未成立。</p></section>';
  }

  function renderCoverage(result, session) {
    const coverage = result.coverage;
    return '<section class="report-section"><h2>本次覆盖了什么</h2><p>共同题有效 ' + coverage.core.valid + '/132；九主题筛查有效 ' + coverage.screening.valid + '/36；实际核验 ' + coverage.testedCardCount + '/' + coverage.totalCards + ' 张思想卡；其余 <strong>' + coverage.untestedCards.length + ' 张未检验</strong>，不能解释为“不接近”。</p><div class="report-table-wrap"><table class="report-table"><thead><tr><th>专题</th><th>筛查有效</th><th>专题全部有效</th><th>本次范围</th></tr></thead><tbody>' + coverage.modules.map(module => '<tr><td>' + esc(module.title) + '</td><td>' + module.screeningValid + '/' + module.screeningTotal + '</td><td>' + module.valid + '/' + module.total + '</td><td>' + (module.selected ? '选为深入专题' : '未选为深入专题') + '</td></tr>').join('') + '</tbody></table></div><p class="muted">不同专题分支的单次结果，实际覆盖的内容不同。目录覆盖表示这些名称有核验入口，不表示本次全部鉴别，也不表示穷尽未来出现的政治思想。</p>' + (session.selectionReason ? '<p>分支选择说明：' + esc(session.selectionReason) + '</p>' : '') + '<details class="report-details"><summary>未检验的思想卡（' + coverage.untestedCards.length + '）</summary><p class="report-catalogue-list">' + coverage.untestedCards.map(card => esc(card.id + ' ' + card.name)).join('；') + '</p></details></section>';
  }

  function renderQuality(result, session) {
    const quality = result.quality;
    const counts = [['有效立场答案', quality.valid], ['不了解／无法判断 U', quality.unknown], ['不愿回答 ×', quality.refused], ['已呈现但漏答', quality.missing], ['其中选择中立', quality.neutral]];
    const contextLabels = {
      Z01:['完全不担心','有一点','比较担心','非常担心'],
      Z02:['未看过','看过部分','看过较多或全部'],
      Z03:['尚未形成','部分确定','比较确定','很确定']
    };
    return '<section class="report-section"><h2>作答条件与完整性</h2><p>本轮经过时间（含休息与离开页面） ' + Math.floor(quality.elapsedMs / 60000) + ' 分 ' + Math.floor(quality.elapsedMs % 60000 / 1000) + ' 秒。结束记录：' + esc(result.stopReason || (result.finished ? '已完成提交' : '尚未完成')) + '。</p><div class="report-table-wrap"><table class="report-table"><thead><tr><th>记录</th><th>数量</th><th>占已呈现立场题</th></tr></thead><tbody>' + counts.map(row => '<tr><td>' + row[0] + '</td><td>' + row[1] + '</td><td>' + percentage(row[1], quality.presented) + '</td></tr>').join('') + '</tbody></table></div><p class="muted">分母为已呈现的 ' + quality.presented + ' 个立场响应项；未呈现分支不记为漏答。K／I 和背景信息单独记录，不进入立场均分。拒答、不了解、速度与重复选项都不自动判为无效。</p>' + (quality.notes.length ? '<ul>' + quality.notes.map(note => '<li>' + esc(note) + '</li>').join('') + '</ul>' : '') + '<details class="report-details"><summary>背景、原有自我认同与补充</summary>' + result.context.map(item => {
      let value = item.answer;
      if (contextLabels[item.id] && Number.isInteger(value) && contextLabels[item.id][value]) value = value + ' · ' + contextLabels[item.id][value];
      else if (value === 'U') value = '不了解或无法判断';
      else if (value === '×' || value === 'X') value = '不愿回答';
      else if (value == null || value === '') value = session.presented.includes(item.id) ? '未填写' : '未呈现';
      return '<h4>' + esc(item.id) + ' ' + esc(item.text) + '</h4><p class="report-free-text">' + esc(value) + '</p>';
    }).join('') + '</details>' + (session.catalogSeen ? '<p class="notice">作答过程中曾浏览按名称排列的目录，相关核验按未盲条件理解。</p>' : '') + '<p class="muted">本报告保留当前作答的范围和分歧。它是个人立场记录，不是已经验证的意识形态身份鉴定，也不预测未来行为。</p></section>';
  }

  function renderRawModules(result, session, data, presented) {
    const sections = data.modules.map(module => {
      const rows = module.items.filter(item => presented.has(item.id)).map(item => ({...item, answer:session.answers[item.id]}));
      return rows.length ? '<details class="report-details"><summary>' + esc(module.title) + ' · 已呈现 ' + rows.length + ' 题</summary>' + evidenceTable(rows, presented) + '</details>' : '';
    }).join('');
    return sections ? '<section class="report-section"><h2>专题逐题记录</h2><p>这些题的政治方向不同，不合成为专题总分。</p>' + sections + '</section>' : '';
  }

  function renderSupplements(result, presented) {
    const kinds = {value:'价值主张',prediction:'事实或预测判断',historical:'历史经验评价'};
    return '<section class="report-section"><h2>旧版题目补充画像</h2><p>以下题目由旧版筛选并按七点选项重编。每项分别描述，不计算跨题政治总分，不改变 22 个共同分面或思想卡状态。价值主张、预测与历史评价按题型分别理解；未作答不表示反对。</p>' + result.supplements.map(g => {
      const count = g.counts;
      const heading = '<h3>' + esc(g.name) + '</h3><p>' + esc(g.description) + '</p><p>本次' + (g.selected ? '选择本组' : '未选择本组') + '；已呈现 ' + g.presented + '/' + g.total + ' 题。支持 ' + count.support + '，反对 ' + count.oppose + '，中立 ' + count.neutral + '，不了解 ' + count.unknown + '，拒答 ' + count.refused + '，已呈现漏答 ' + count.missing + '，未呈现 ' + count.unpresented + '。</p>';
      const rows = g.items.map(q => '<tr><td><span class="report-id">' + esc(q.id) + '</span> ' + esc(q.text) + '<small class="muted">' + esc(kinds[q.kind] || q.kind) + ' · 旧版第 ' + esc(q.sourceQuestion) + ' 题</small></td><td>' + esc(answer(q.answer,q.presented)) + '</td></tr>').join('');
      return '<section class="report-supplement">' + heading + '<details class="report-details"><summary>补充题原答与来源（' + g.total + ' 题）</summary><div class="report-table-wrap"><table class="report-table"><thead><tr><th>主张、题型与来源</th><th>原始作答</th></tr></thead><tbody>' + rows + '</tbody></table></div></details></section>';
    }).join('') + '</section>';
  }
  function render(session) {
    const data = root.OMNI_DATA;
    const result = root.OMNI_ENGINE.analyze(session);
    const presented = new Set(session.presented || []);
    const supported = result.cards.filter(card => card.statusCode === 'supported');
    const partial = result.cards.filter(card => card.statusCode === 'partial');
    const insufficient = result.cards.filter(card => card.statusCode === 'insufficient');
    const scoredFacets = result.facets.filter(facet => facet.value != null);
    const directional = scoredFacets.filter(facet => facet.value !== 0).sort((a,b) => Math.abs(b.value) - Math.abs(a.value)).slice(0,4);
    const intro = directional.length ? '在有效作答较完整的分面中，本次表达得较突出的方向包括：' + directional.map(facet => facet.name + '偏向“' + (facet.value > 0 ? facet.positive : facet.negative) + '”').join('；') + '。' : scoredFacets.length ? '已可描述的分面均分位于中间位置，具体含义需结合单题中立与交叉立场理解。' : '目前完整作答不足以形成分面点值，报告保留已表达的主张和缺答范围。';
    const cardSummary = supported.length ? '在实际核验的卡片中，' + supported.map(card => card.name).join('、') + '的三项主张均获支持。' : '本次没有达到“三项主张均支持”的完整卡片；这不排除未检验的思想。';
    return '<article class="omni-report"><header class="report-summary"><p class="eyebrow">个人立场报告 · ' + esc(result.version) + '</p><h1>你的政治立场与思想倾向</h1><p class="muted">答卷编号 ' + esc(result.id || '未命名') + ' · ' + (result.finished ? '已提交答卷' : '当前进度的阶段报告') + '</p><p>' + esc(intro) + '</p><p>' + esc(cardSummary) + (partial.length ? '另有 ' + partial.length + ' 张卡出现部分支持或分歧。' : '') + (insufficient.length ? '有 ' + insufficient.length + ' 张卡信息不足。' : '') + '</p><p>以下结论描述本次作答；名称认同、原有理解、具体保留意见和未检验范围分别列出。</p></header>' + (result.sourceVersion ? '<p class="notice">本答卷来自 ' + esc(result.sourceVersion) + '，共同题与卡片保留原记录；新增补充题未自动填答，原有提交状态和历史结束原因保持记录。</p>' : '') + renderCoverage(result, session) + renderFacets(result, presented) + renderCards(result, session, data, presented) + renderSupplements(result, presented) + renderScenarios(result, presented) + renderQuality(result, session) + renderRawModules(result, session, data, presented) + '</article>';
  }

  root.OMNI_REPORT = Object.freeze({render, escape:esc, answer});
})(typeof window !== 'undefined' ? window : globalThis);
