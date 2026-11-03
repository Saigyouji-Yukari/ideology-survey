/* 综合报告分析：由公开规则把整份答卷组合成一段带依据的综合描述。
   五层：单题信号 → 分面描述 → 栏目组合 → 交叉检测 → 总体定位。
   只概括本次作答，不是人工评语、身份鉴定或归属概率。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./omni-data.js'));
  else root.OMNI_SYNTHESIS = factory(root.OMNI_DATA);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';
  if (!D) throw new Error('请先载入问卷题库。');
  const VERSION = 'SYN-2026-11-03';
  // Bold markers never occur in item text; they are stripped from free text before use.
  const B0 = '\u0001', B1 = '\u0002';
  const bold = text => B0 + text + B1;
  const plain = text => String(text == null ? '' : text).replace(/[\u0001\u0002]/g, '');

  /* ---------- 题目与栏目 ---------- */
  const ITEMS = {};
  for (const q of D.core.items) ITEMS[q.id] = { id: q.id, text: q.text, axis: q.axis, sign: q.sign, core: true };
  for (const m of D.modules) for (const q of m.items) ITEMS[q.id] = { id: q.id, text: q.text, module: m.id };
  for (const q of D.legacySupplement.items) ITEMS[q.id] = { id: q.id, text: q.text, group: q.group, kind: q.kind };
  for (const q of D.core.scenarios) ITEMS[q.id] = { id: q.id, text: q.text, scenario: true };
  const AXES = Object.fromEntries(D.core.axes.map(a => [a.id, a]));
  const MODULES = Object.fromEntries(D.modules.map(m => [m.id, m]));

  const SECTIONS = [
    { id: 'economic', number: '一', title: '经济制度', lead: '经济上', facets: ['OWN', 'ALLOC', 'RED', 'LAB'], profile: '经济制度' },
    { id: 'political', number: '二', title: '政治制度', lead: '政治制度上', facets: ['CIV', 'DEM', 'ORG', 'DEC'], profile: '政治制度' },
    { id: 'change', number: '三', title: '变革道路与政治手段', lead: '变革与手段上', facets: ['CHANGE', 'MEANS'], profile: '变革与公共责任' },
    { id: 'people', number: '四', title: '人民观与共同责任', lead: '人民观上', facets: ['POP', 'COMM'], profile: '变革与公共责任' },
    { id: 'culture', number: '五', title: '文化与社会', lead: '社会文化上', facets: ['CULT', 'GENDER', 'REL'], profile: '文化与社会平等' },
    { id: 'international', number: '六', title: '认同与国际事务', lead: '国际上', facets: ['NAT', 'MEM', 'INT', 'FORCE'], profile: '认同与国际事务' },
    { id: 'ecology', number: '七', title: '生态与技术', lead: '生态技术上', facets: ['ECO', 'TECH'], profile: '生态技术与判断' },
    { id: 'theory', number: '八', title: '理论框架、历史判断与证据态度', lead: '判断方式上', facets: ['EVID'], profile: null }
  ];
  // 专题题与补充题按主题归入栏目；共同题按所属分面归入。每题只归一个栏目。
  const SECTION_ITEMS = {
    economic: 'S01 S02 S04 S05 S06 S07 S08 S12 S13 S14 S18 S19 S20 S22 S23 S24 M12 M14 M23 A02 A04 A05 A06 A07 A09 L02 L04 L10 L11 L12 L13 L15 L16 L18 L20 L23 L24 C04 C13 C21 P11 P12 P13 P14 P16 P17 P18 P19 P20 P22 G22 R09 R22 D03 D05 L001 L002 L003 L004 L005 L006 L008 L013 L014 L015',
    political: 'S03 S11 S21 M03 M04 M07 M08 M09 M13 A01 A03 A08 A16 A19 A20 A21 A22 A23 L03 L14 L19 C05 C06 C17 C18 C23 P01 P21 P23 R07 D04 D06 D07 D08 D09 D10 D11 D12 D13 D14 D15 L009 L016 L017 L018 L019 L020 L021 L022 L023 L039 L040 L042',
    change: 'S09 S10 S15 M10 M11 M18 A10 L08 C02 R13 R14 R23 D17 D18',
    people: 'A18 P02 P03 P04 P15 P24 R24 D22',
    culture: 'M21 A11 A14 A15 A17 L01 L05 L06 L07 L09 L17 L21 C01 C03 C14 C15 P06 G01 G02 G03 G04 G05 G06 G07 G08 R01 R02 R03 R04 R05 R06 R08 R12 R15 R16 R17 D16 L024 L025 L026 L027 L028 L029 L030',
    international: 'M05 M06 M24 L22 C07 C08 C09 C10 C11 C12 C16 C19 C20 C22 C24 P05 P07 P08 P09 P10 G16 R10 R18 R19 R20 R21 D01 D02 D19 D20 D21 D23 D24 L007 L010 L011 L012',
    ecology: 'M22 A12 A13 G09 G10 G11 G12 G13 G14 G15 G17 G18 G19 G20 G21 G23 G24 L031 L032 L033 L034 L035 L036 L037',
    theory: 'S16 S17 M01 M02 M15 M16 M17 M19 M20 A24 R11 L038 L041 L043 L044 L045 L046 L047 L048 L049 L050 L051 L052 L053 L054 L055 L056 L057'
  };
  const ITEM_SECTION = {};
  for (const [section, ids] of Object.entries(SECTION_ITEMS)) for (const id of ids.split(' ')) ITEM_SECTION[id] = section;
  for (const q of D.core.items) ITEM_SECTION[q.id] = SECTIONS.find(s => s.facets.includes(q.axis)).id;

  /* ---------- 第一层：单题信号 ---------- */
  const VERBS = ['', '强烈不同意', '不同意', '略不同意', '中立', '略同意', '同意', '强烈同意'];
  const PRED = {
    agree: x => x >= 5, strongAgree: x => x >= 6, disagree: x => x <= 3, strongDisagree: x => x <= 2,
    neutral: x => x === 4, notAgree: x => x <= 4, notDisagree: x => x >= 4
  };
  const rating = x => Number.isInteger(x) && x >= 1 && x <= 7;
  const quote = id => '“' + plain(ITEMS[id] ? ITEMS[id].text : id).replace(/[。！？；\s]+$/u, '') + '”';
  const phrase = (id, raw) => raw === 4 ? '对' + quote(id) + '持中立' : VERBS[raw] + quote(id);

  /* ---------- 第二层：分面描述 ---------- */
  const FACET_TEXT = {
    OWN: [{ verb: '支持', obj: '公共与劳动者所有' }, { verb: '支持', obj: '私人资本所有' }, '公共与劳动者所有和私人资本所有'],
    ALLOC: [{ verb: '支持', obj: '公共计划协调' }, { verb: '偏向', obj: '市场价格与竞争' }, '公共计划与市场价格'],
    RED: [{ verb: '支持', obj: '再分配与普遍保障' }, { verb: '倾向', obj: '有限再分配与个人责任' }, '再分配与个人责任'],
    LAB: [{ verb: '支持', obj: '劳动者共同决定' }, { verb: '支持', obj: '所有者最终决定' }, '劳动者共同决定与所有者决定'],
    CIV: [{ verb: '重视', obj: '公民权利保护' }, { verb: '接受', obj: '对公民权利的行政限制' }, '权利保护与行政限制'],
    DEM: [{ verb: '支持', obj: '可竞争、可替换的执政权' }, { verb: '接受', obj: '受限制的政治竞争' }, '竞争性执政与受限制的竞争'],
    ORG: [{ verb: '偏向', obj: '组织集中与纪律' }, { verb: '偏向', obj: '成员自治与组织多元' }, '组织集中与成员自治'],
    DEC: [{ verb: '支持', obj: '地方自治' }, { verb: '偏向', obj: '中央统一权限' }, '中央统一与地方自治'],
    CHANGE: [{ verb: '倾向', obj: '根本性的制度变革' }, { verb: '倾向', obj: '渐进、连续的改革' }, '根本变革与渐进改革'],
    MEANS: [{ verb: '坚持', obj: '不以目的解除手段限制' }, { verb: '接受', obj: '目的优先的手段例外' }, '手段约束与目的优先'],
    COMM: [{ verb: '重视', obj: '共同责任' }, { verb: '重视', obj: '个人选择优先' }, '共同责任与个人选择'],
    POP: [{ verb: '偏向', obj: '单一人民意志与“人民对精英”的理解' }, { verb: '重视', obj: '利益多元与权力制衡' }, '人民整体意志与多元制衡'],
    CULT: [{ verb: '接受', obj: '改变传统规范' }, { verb: '重视', obj: '维持传统规范' }, '改变习俗与维持传统'],
    GENDER: [{ verb: '支持', obj: '性别平等与自我决定' }, { verb: '倾向', obj: '固定的性别角色' }, '性别平等与传统角色'],
    REL: [{ verb: '支持', obj: '世俗公共权力' }, { verb: '支持', obj: '宗教规范优先' }, '世俗公共权力与宗教规范'],
    NAT: [{ verb: '重视', obj: '对全人类的义务' }, { verb: '偏向', obj: '本国共同体优先' }, '普遍义务与本国优先'],
    MEM: [{ verb: '支持', obj: '包容、平等的成员资格' }, { verb: '倾向', obj: '以血缘或主体文化限制成员资格' }, '平等公民资格与血缘文化归属'],
    INT: [{ verb: '支持', obj: '国际共同规则与合作' }, { verb: '偏向', obj: '国家主权自主' }, '国际合作与主权自主'],
    FORCE: [{ verb: '接受', obj: '对外武力与威慑' }, { verb: '主张', obj: '限制对外武力' }, '使用与限制对外武力'],
    ECO: [{ verb: '偏向', obj: '生态约束优先' }, { verb: '偏向', obj: '经济增长优先' }, '生态约束与经济增长'],
    TECH: [{ verb: '主张', obj: '审慎控制不可逆的技术风险' }, { verb: '鼓励', obj: '技术试验与采用' }, '技术审慎与技术试验'],
    EVID: [{ pre: '自报', verb: '愿意', obj: '依据反证修正经验判断' }, { pre: '自报', verb: '倾向', obj: '保持既有经验判断' }, '修正判断与保持判断']
  };
  const BANDS = [['strong', 70], ['clear', 45], ['mild', 20]];
  const band = x => x == null ? 'none' : (BANDS.find(([, min]) => Math.abs(x) >= min) || ['center'])[0];
  const ADVERB = {
    default: { strong: '强烈', clear: '明显', mild: '温和' },
    '重视': { strong: '高度', clear: '明显', mild: '较为' },
    '愿意': { strong: '非常', clear: '明显', mild: '较' },
    '接受': { strong: '明确', clear: '明显', mild: '有限度地' },
    '坚持': { strong: '坚定', clear: '明显', mild: '较为' },
    '倾向': { strong: '强烈', clear: '明显', mild: '较为' },
    '偏向': { strong: '强烈', clear: '明显', mild: '较为' },
    '主张': { strong: '坚定', clear: '明显', mild: '较为' },
    '鼓励': { strong: '积极', clear: '明显', mild: '较为' }
  };
  const signed = x => x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x);
  function lean(id, value, forceBand) {
    const t = FACET_TEXT[id][value > 0 ? 0 : 1], b = forceBand || band(value);
    const adv = b === 'center' ? '略' : (ADVERB[t.verb] || ADVERB.default)[b];
    return (t.pre || '') + adv + t.verb + t.obj;
  }
  function describeFacet(f) {
    const answered = f.items.filter(q => q.oriented !== null);
    const d = f.value == null ? 0 : Math.sign(f.value);
    const strength = q => Math.abs(q.oriented - 4);
    const order = (a, b) => strength(b) - strength(a) || a.id.localeCompare(b.id);
    const side = s => answered.filter(q => Math.sign(q.oriented - 4) === s).sort(order);
    const out = { id: f.id, name: f.name, value: f.value, valid: f.valid, pattern: f.pattern, band: band(f.value), positive: side(1), negative: side(-1), neutralCount: answered.filter(q => q.oriented === 4).length, unknown: f.items.filter(q => q.answer === 'U').length, refused: f.items.filter(q => q.answer === 'X' || q.answer === '×').length };
    out.consistent = d ? (d > 0 ? out.positive : out.negative) : [];
    out.exceptions = d ? (d > 0 ? out.negative : out.positive) : [];
    out.center = f.value == null ? null : out.band !== 'center' ? null : f.pattern === 'neutral' ? 'neutral' : out.positive.length && out.negative.length ? 'mixed' : 'weak';
    out.lean = f.value == null || f.value === 0 ? '' : lean(f.id, f.value);
    out.between = FACET_TEXT[f.id][2];
    return out;
  }
  function facetClause(fd) {
    if (fd.value == null) return fd.name + '信息不足';
    if (fd.band !== 'center') return fd.lean;
    if (fd.center === 'neutral') return '对' + fd.between + '均持中立';
    if (fd.center === 'mixed') return '在' + fd.between + '之间存在相反回答';
    return fd.value === 0 ? '在' + fd.between + '之间居中' : '在' + fd.between + '之间接近中间、' + fd.lean;
  }

  /* ---------- 第四层：交叉检测规则 ---------- */
  // when 中：i=题号，a=立场；f=分面，min/max/absMax=分值界限；any/all/not/atLeast 组合。
  // kind：tension 相互拉扯的组合；exception 与总体方向相反、需单独说明的回答；pattern 具有特征的组合。
  // severity：1 说明性，2 需要澄清，3 涉及强制、程序权利或竞争性选举的保留，排在最前。
  // suppress：本条命中时不再单列的较弱或重复规则；key：可进入“总体定位”的整体性组合，2 表示优先列出的框架或制度构想。
  const ag = (...ids) => ({ any: ids.map(i => ({ i, a: 'agree' })) });
  const dg = (...ids) => ({ any: ids.map(i => ({ i, a: 'disagree' })) });
  const CULTURE_INTEGRATION = { atLeast: 2, of: [{ i: 'L026', a: 'agree' }, { i: 'L028', a: 'agree' }, { i: 'L024', a: 'agree' }, { i: 'L029', a: 'disagree' }] };
  const CULTURE_PLURALISM = { atLeast: 2, of: [{ i: 'L029', a: 'agree' }, { i: 'L026', a: 'disagree' }, { i: 'L024', a: 'disagree' }, { i: 'L025', a: 'agree' }, { i: 'L030', a: 'agree' }] };
  const RULES = [
    // 经济
    { id: 'E1', section: 'economic', kind: 'tension', severity: 2, when: { all: [ag('Q001', 'Q003', 'Q005', 'S01', 'P20'), ag('Q002', 'Q004', 'S02', 'P22', 'C13')] },
      short: '既支持扩大公共或劳动者对生产资料的控制，又接受私人资本或私人产权居主导', text: '既支持扩大公共或劳动者对主要生产资料的控制，又接受私人资本或私人产权在经济中居主导地位。', reading: '这可能表示主张公私并存的混合所有制，也可能是对不同题目情境的区别看待，需要结合具体比例和适用范围澄清。' },
    { id: 'E2', section: 'economic', kind: 'tension', severity: 2, when: { all: [{ any: [{ i: 'Q005', a: 'agree' }, { i: 'S20', a: 'agree' }, { i: 'A02', a: 'agree' }, { i: 'Q002', a: 'disagree' }, { i: 'Q004', a: 'disagree' }] }, dg('Q001', 'Q003'), dg('S12', 'S19', 'S06', 'M08')] },
      short: '反对私人资本支配，却不接受公共所有、合作社或劳动者自治等常见替代方案', text: '反对私人资本对主要生产资料的支配，却不接受国家、集体或劳动者共同所有，也不支持合作社、行业自治或劳动者选举管理者等常见替代方案。', reading: '对以何种所有制和组织方式取而代之，答卷尚未给出答案。' },
    { id: 'E3', section: 'economic', kind: 'pattern', severity: 1, key: true, when: { all: [{ f: 'OWN', min: 20 }, ag('Q007', 'Q009', 'Q011', 'S24', 'M23'), ag('Q008', 'Q012', 'M12', 'S05')] },
      short: '社会所有方向下计划与市场并存', text: '在支持社会所有的同时，既接受公共机构协调主要产业或重大投资，也接受市场价格和企业竞争发挥作用。', reading: '其经济构想更像“社会所有制基础上，由公共计划协调关键领域，同时保留市场价格和部分企业自主”。' },
    { id: 'E4', section: 'economic', kind: 'pattern', severity: 1, key: 2, suppress: ['E13'], when: { all: [{ f: 'OWN', min: 45 }, { f: 'ALLOC', max: -20 }] },
      short: '社会所有与市场机制结合', text: '在支持公共与劳动者所有的同时明显偏向市场价格与竞争，接近“公有制与市场机制结合”的思路。' },
    { id: 'E5', section: 'economic', kind: 'pattern', severity: 1, when: { all: [ag('S13', 'S24'), { i: 'S04', a: 'disagree' }] },
      short: '民主协商的计划而非统一指令计划', text: '支持由劳动者与消费者代表协商，或由公共民主决策决定重大经济事项，但反对由统一的指令性计划确定全国主要产品产量。' },
    { id: 'E6', section: 'economic', kind: 'pattern', severity: 1, key: 2, when: { all: [ag('L015', 'A05'), dg('L014', 'S05')] },
      short: '长期目标指向按需分配', text: '长期经济目标超出一般意义上的混合经济：同意以按需分配取代货币和商品交换，或在生产资料共有后主要按需要分配生活资料。' },
    { id: 'E7', section: 'economic', kind: 'tension', severity: 2, when: { all: [ag('Q015', 'Q017', 'L02'), { i: 'Q016', a: 'agree' }] },
      short: '支持缩小收入差距，又认为保障主要是个人家庭责任', text: '既支持通过税收缩小收入或机会差距，又同意保障生活主要是个人和家庭的责任、政府只应提供最低限度救助。', reading: '这两类回答如何协调，需要结合适用条件澄清。' },
    { id: 'E8', section: 'economic', kind: 'exception', severity: 1, when: { all: [{ f: 'RED', min: 20 }, { i: 'Q013', a: 'disagree' }] },
      short: '总体支持再分配，但对普遍基本医疗有所保留', text: '总体支持再分配，但不同意“基本医疗应当向所有人提供，不因个人支付能力不同而拒绝服务”，其平等主义在普遍公共服务方面并非没有例外。' },
    { id: 'E9', section: 'economic', kind: 'exception', severity: 1, when: { all: [{ f: 'LAB', min: 20 }, ag('Q020', 'Q022')] },
      short: '支持劳动者参与，又保留部分所有者决定权', text: '支持劳动者参与企业决策，但仍同意重大投资或企业搬迁可以由出资者、所有者决定，形成较强参与权与部分所有者决定权并存的组合。' },
    { id: 'E10', section: 'economic', kind: 'tension', severity: 2, when: { all: [ag('L13', 'L12'), ag('S08', 'Q013', 'L04')] },
      short: '既主张最小国家，又支持基本生活保障成为社会权利', text: '既同意国家正当职能应仅限于保护人身、财产和契约（或认为强制征税提供福利侵犯财产权），又支持基本生活需要成为社会权利、普遍基本医疗或使贫困者实际能够选择的公共服务。' },
    { id: 'E11', section: 'economic', kind: 'pattern', severity: 1, when: { all: [{ i: 'S23', a: 'agree' }, { i: 'L013', a: 'agree' }] },
      short: '就业导向的福利观，但自动化失业时支持基本收入', text: '一般福利改革中更重视提高就业能力，但在自动化导致大规模失业的特定条件下支持无条件基本收入。' },
    { id: 'E12', section: 'economic', kind: 'pattern', severity: 1, when: { all: [{ i: 'S23', a: 'agree' }, { not: { i: 'L013', a: 'agree' } }] },
      short: '就业导向的福利观', text: '福利观带有就业导向：主张福利改革优先提高就业能力，而不是扩大无条件现金给付。' },
    { id: 'E13', section: 'economic', kind: 'pattern', severity: 1, key: 2, when: { all: [{ f: 'ALLOC', max: -20 }, { f: 'RED', min: 10 }, ag('L11', 'L02', 'L04')] },
      short: '市场竞争为基础，辅以公共规则与保障', text: '以市场竞争为基础，同时支持累进税、使贫困者实际能够选择的公共服务或限制垄断性私人权力等公共规则。', reading: '其经济基础更接近受公共规则和社会保障约束的市场经济，而不是最小国家路线。' },
    { id: 'E14', section: 'economic', kind: 'tension', severity: 2, when: { all: [{ f: 'OWN', min: 20 }, { i: 'S07', a: 'agree' }] },
      short: '支持社会所有，又接受“保留资本主义并充分福利”作为改革终点', text: '支持公共与劳动者所有，却也同意“保留资本主义并建立充分的福利保障，可以成为社会改革的最终目标”。' },
    { id: 'E15', section: 'economic', kind: 'pattern', severity: 1, when: { all: [{ f: 'OWN', min: 20 }, { i: 'S22', a: 'agree' }] },
      short: '社会所有下仍保留按劳动贡献的收入差异', text: '并非主张无差别的收入均等：在社会所有制下仍接受与劳动贡献相关的收入差异。' },
    { id: 'E16', section: 'economic', kind: 'pattern', severity: 1, when: { all: [ag('S06', 'P19', 'Q003'), { i: 'S12', a: 'disagree' }] },
      short: '企业内参与而非以合作社为主', text: '支持劳动者持股、选举管理者或参与重大事务等企业内部参与，但不主张把合作社作为主要企业形式。' },
    // 政治
    { id: 'P1', section: 'political', kind: 'tension', severity: 3, when: { all: [ag('Q031', 'Q033', 'Q035', 'S03', 'M07', 'D07', 'C17'), ag('Q032', 'Q036', 'S11', 'Q034')] },
      short: '既支持竞争性选举和执政更替，又接受一个组织长期独占执政权或以绩效替代选举', text: '既支持反对党通过选举执政、落选交权或新政治团体参与竞争，又接受一个政治组织长期独占执政权、单独提名执政者，或以治理绩效代替竞争性选举。', reading: '这意味着竞争性选举在其制度设想中可能是可以权衡的工具，而不是不可让渡的底线；也可能对不同制度条件有不同判断。' },
    { id: 'P2', section: 'political', kind: 'tension', severity: 3, suppress: ['P1'], when: { all: [{ f: 'DEM', min: 20 }, { i: 'Q036', a: 'agree' }] },
      short: '支持竞争和执政更替，但竞争入口可接受政治方向筛选', text: '总体支持选举竞争与权力更替，但同意“为了保证政治方向正确，可以只允许一个政治组织提名实际掌握行政权的执政者”。', reading: '其民主观更接近“允许竞争和更替，但竞争入口可以接受某种政治方向上的筛选”，而不是完全开放的程序民主。' },
    { id: 'P3', section: 'political', kind: 'tension', severity: 3, when: { all: [ag('Q025', 'Q027', 'Q029', 'S21', 'D08', 'L03'), ag('Q026', 'Q028', 'C06')] },
      short: '支持公民权利保护，又同意限制非暴力反对意见或无审查长期扣押', text: '支持和平批评、法律依据与独立审查或少数人的基本权利，却又同意为了秩序禁止非暴力的反对意见、在没有独立审查时长期扣押嫌疑人，或长期限制合法反对派的活动。', reading: '这些保护在其设想中可能是可以与秩序需要相权衡的制度工具，而不是不可让渡的底线。' },
    { id: 'P4', section: 'political', kind: 'exception', severity: 2, when: { i: 'Q030', a: 'agree' },
      short: '同意禁止不合主流道德但无直接伤害的生活方式', text: '同意政府可以因某种生活方式不符合主流道德而禁止它，即使它没有直接伤害他人，个人自由在公共道德上保留了限制。' },
    { id: 'P5', section: 'political', kind: 'pattern', severity: 1, when: { all: [ag('Q037', 'Q039', 'Q041', 'M03', 'M04'), ag('Q042', 'Q038', 'A08', 'M08', 'M18')] },
      short: '组织纪律与基层授权并存', text: '既接受组织纪律与集中领导，又要求领导权限来自基层授权，或希望工人委员会、群众行动对领导层形成制约。', reading: '这一组合的关键问题是：集中领导与基层权力如何同时制度化。' },
    { id: 'P6', section: 'political', kind: 'tension', severity: 2, suppress: ['P5'], when: { all: [ag('Q037', 'M03'), ag('M08', 'A08', 'M09')] },
      short: '接受先锋队集中，又希望工人委员会掌权、防止党凌驾社会', text: '在革命组织上接受纪律严密的先锋党，同时同意工人委员会应直接掌握政权、革命组织不应成为凌驾社会的执政集团，或革命后仍须依靠群众斗争防止新的支配阶层。', reading: '不能简单概括为自上而下的集权：更准确地说，是在组织中接受先锋队和纪律集中，同时希望工人委员会和群众斗争实际制约政党。' },
    { id: 'P7', section: 'political', kind: 'pattern', severity: 1, key: true, when: { all: [{ f: 'DEC', max: -20 }, { i: 'Q047', a: 'agree' }] },
      short: '中央统一，只接受执行方式上的地区差异', text: '总体偏向中央统一，只是允许不同地区采用不同的公共服务安排——接受的是执行方式上的地方差异，而不是稳定的政治分权。' },
    { id: 'P8', section: 'political', kind: 'pattern', severity: 1, key: 2, when: { all: [{ f: 'OWN', min: 45 }, { f: 'DEM', min: 20 }, ag('S03', 'M07', 'S21')] },
      short: '社会所有与竞争性、可批评的政治秩序结合', text: '把社会所有与可竞争、可批评的政治秩序结合起来：同意社会主义制度下反对党可以通过选举执政、多个政党竞争或公开批评执政者。' },
    { id: 'P9', section: 'political', kind: 'exception', severity: 3, when: ag('D14', 'C18'),
      short: '同意把最终政治权力集中于一位领导者', text: '同意最终政治裁决权可以集中于一位领导者，或为了民族复兴把政治权力集中于一个领袖及其统一运动。' },
    { id: 'P10', section: 'political', kind: 'tension', severity: 2, when: { all: [ag('Q033', 'L039', 'L042'), { i: 'L040', a: 'agree' }] },
      short: '支持权力更替和修改根本制度，又同意某种根本制度不可被任何多数废除', text: '既支持执政者按程序交出权力，或人民可以通过合法程序改变根本制度，又同意“社会主义根本制度一旦建立，就不应允许任何多数通过任何程序将其废除”。' },
    // 变革与手段
    { id: 'C1', section: 'change', kind: 'pattern', severity: 1, key: true, when: { all: [ag('Q049', 'Q051', 'D17'), ag('Q050', 'Q054', 'D18', 'C02')] },
      short: '常态渐进、严重失灵时不排除根本替换', text: '既同意在制度持续造成不公时考虑整体替换，也同意优先在现有框架内逐步、可撤回地改变。', reading: '这更像“常态下渐进改革、严重制度失灵时不排除根本替换”的条件性思路，而不是确定的改良主义或革命主义。' },
    { id: 'C2', section: 'change', kind: 'pattern', severity: 1, key: true, when: { all: [{ f: 'CHANGE', min: 20 }, { i: 'S09', a: 'undecided' }, { i: 'S10', a: 'undecided' }] },
      short: '对根本变革开放，但道路尚未确定', text: '对根本改变不公正结构持开放态度，但对社会主义应主要通过选举和逐步改革实现、还是必须打破原有国家机器，尚未表态。', reading: '其激进性主要针对“不公正结构是否应被根本改变”，而不是已经选定一套革命战略。' },
    { id: 'C3', section: 'change', kind: 'tension', severity: 2, when: { all: [{ i: 'S09', a: 'agree' }, { i: 'S10', a: 'agree' }] },
      short: '既同意通过选举渐进实现社会主义，又同意必须打破原有国家机器', text: '既同意“社会主义应主要通过选举和逐步改革来实现”，又同意“即使存在和平改革渠道，实现社会主义仍须打破原有国家机器”。', reading: '较合理的理解是：改革可以作为主要实践方式，但不被当作唯一方式。' },
    { id: 'C4', section: 'change', kind: 'tension', severity: 3, when: { all: [{ i: 'Q060', a: 'agree' }, { any: [{ f: 'DEM', min: 20 }, { f: 'CIV', min: 20 }] }] },
      short: '同意为巩固理想制度长期压制和平反对者，与其支持竞争和公民权利的回答直接冲突', text: '同意“如果能巩固理想制度，长期压制和平反对者是可以接受的”，这与其支持政治竞争和公民权利的回答直接冲突。', reading: '这是整份答卷中需要优先澄清的强制性保留，不能被其他民主回答抵消或略去。' },
    { id: 'C5', section: 'change', kind: 'exception', severity: 3, when: { all: [{ i: 'Q060', a: 'agree' }, { not: { any: [{ f: 'DEM', min: 20 }, { f: 'CIV', min: 20 }] } }] },
      short: '同意为巩固理想制度长期压制和平反对者', text: '同意“如果能巩固理想制度，长期压制和平反对者是可以接受的”，对和平反对者的权利保留了明显的强制空间。' },
    { id: 'C6', section: 'change', kind: 'pattern', severity: 1, when: { all: [{ any: [{ i: 'Q055', a: 'agree' }, { i: 'Q056', a: 'disagree' }] }, dg('Q059', 'R23', 'A10')] },
      short: '反对攻击平民或集体惩罚，但不承诺非暴力优先', text: '反对攻击无关平民或集体惩罚，但不认为面对严重不公仍应一律优先非暴力。', reading: '这不是绝对和平主义，也没有接受“目的可以解除一切手段约束”。' },
    { id: 'C7', section: 'change', kind: 'exception', severity: 2, when: { i: 'Q058', a: 'agree' },
      short: '同意紧急政治斗争中领导者可不受既定程序约束', text: '同意在紧急政治斗争中领导者可以不受既定程序约束，为紧急状态下的集中权力保留了空间。' },
    { id: 'C8', section: 'change', kind: 'exception', severity: 3, when: { i: 'Q056', a: 'agree' },
      short: '同意为重大目标惩罚没有具体违法行为的群体成员', text: '同意为了实现重大政治目标，有时可以惩罚没有实施具体违法行为的群体成员。' },
    { id: 'C9', section: 'change', kind: 'exception', severity: 2, when: { i: 'Q057', a: 'disagree' },
      short: '不同意政治运动都应允许被指控者申辩', text: '不同意“任何政治运动都应当允许被指控者申辩”，这是其程序权利观中的一处明显例外。' },
    { id: 'C10', section: 'change', kind: 'pattern', severity: 1, when: { all: [{ f: 'MEANS', min: 45 }, ag('Q059', 'R23', 'A10')] },
      short: '坚持非暴力与程序约束', text: '坚持非暴力与程序约束：面对严重不公也优先采用非暴力行动，且不以政治目标解除手段限制。' },
    { id: 'C11', section: 'change', kind: 'pattern', severity: 1, key: true, when: { all: [{ f: 'CHANGE', min: 20 }, { i: 'S09', a: 'disagree' }, { i: 'S10', a: 'undecided' }] },
      short: '不以选举渐进为主要道路，但未表明是否须打破国家机器', text: '不同意社会主义应主要通过选举和逐步改革来实现，但对“即使存在和平改革渠道，实现社会主义仍须打破原有国家机器”持中立。', reading: '它否定了以选举渐进为主要道路，却尚未表明替代路线；改革可能仍被视为实践方式之一，但不是唯一方式。' },
    { id: 'C12', section: 'change', kind: 'pattern', severity: 1, key: true, when: { all: [{ f: 'CHANGE', min: 20 }, { i: 'S09', a: 'agree' }, { not: { i: 'S10', a: 'agree' } }] },
      short: '目标上接受根本变革，道路上主张选举与逐步改革', text: '对根本改变不公正结构持开放态度，同时同意社会主义应主要通过选举和逐步改革来实现。', reading: '其根本性主要体现在变革目标上，实现道路则偏向制度内的渐进方式。' },
    { id: 'C13', section: 'change', kind: 'pattern', severity: 1, key: 2, when: { all: [{ i: 'S09', a: 'disagree' }, { i: 'S10', a: 'agree' }] },
      short: '选择打破原有国家机器的革命道路', text: '不同意社会主义应主要通过选举和逐步改革来实现，并同意即使存在和平改革渠道，实现社会主义仍须打破原有国家机器。', reading: '这是明确的革命道路选择；是否接受非和平手段，需要结合“政治手段约束”的回答判断，不能直接推出。' },
    // 人民观与共同责任
    { id: 'N1', section: 'people', kind: 'tension', severity: 2, suppress: ['N5'], when: { all: [ag('Q069', 'Q071', 'D22'), ag('Q072', 'Q070', 'D08', 'C23')] },
      short: '在统一人民意志与制度制衡之间摇摆', text: '同意真正代表人民的领袖不应被非民选机构阻止，或人民具有统一的真实意志，同时又认为政府不能因自称代表人民就取消制衡、任何政党都不能独占人民代表权。', reading: '可以理解为：正当性语言偏向人民主权，制度上仍保留部分制衡与反个人集权的原则。' },
    { id: 'N2', section: 'people', kind: 'pattern', severity: 1, when: { all: [{ i: 'Q067', a: 'agree' }, { i: 'Q068', a: 'agree' }] },
      short: '接受“人民对精英”叙事，同时承认人民内部利益多元', text: '接受“普通人民与腐败精英”的冲突叙事，同时承认人民内部存在无法合并成一种共同意志的正当利益。' },
    { id: 'N3', section: 'people', kind: 'tension', severity: 1, when: { all: [ag('Q061', 'Q063', 'Q065'), ag('Q064', 'Q066', 'Q062')] },
      short: '支持特定的公共义务，而非普遍化的集体义务', text: '支持维持公共服务、为下一代承担成本或顾及共同体延续，却又认为对无契约关系者或不直接受益的公共事务通常不负义务。', reading: '其支持的是与公共服务、代际责任相关的特定义务，而不是普遍化的集体义务伦理。' },
    { id: 'N4', section: 'people', kind: 'pattern', severity: 1, when: { all: [{ f: 'COMM', min: 45 }, { f: 'POP', min: 20 }] },
      short: '共同责任与人民政治主体地位都较强', text: '共同责任与人民政治主体地位都较强，带有一定“人民对精英”的叙事。' },
    { id: 'N5', section: 'people', kind: 'pattern', severity: 1, when: { i: 'D22', a: 'agree' },
      short: '认同人民具有统一的真实意志', text: '同意“人民具有统一的真实意志，背离它的政治精英不应被视为正当代表”，带有一定“公意”色彩：政治正当性主要来自统一的人民，而不是长期并立的利益集团。' },
    // 文化与社会
    { id: 'K1', section: 'culture', kind: 'pattern', severity: 1, when: { all: [ag('Q077', 'Q073', 'L01'), ag('Q074', 'Q078')] },
      short: '法律上宽容不同生活方式，公共教育上保留传统引导', text: '支持不同生活方式获得同等法律尊重，同时支持公共教育或公共规范引导人们遵循传统家庭规范。', reading: '属于“法律上宽容、公共教育上保留传统引导”的组合。' },
    { id: 'K2', section: 'culture', kind: 'pattern', severity: 1, when: { all: [{ i: 'Q075', a: 'agree' }, { i: 'Q076', a: 'agree' }] },
      short: '习俗不自动正当，但变革须承担更重举证责任', text: '认为一种习俗存在很久并不使它天然拥有优先地位，但又认为改变长期规范应承担更重的举证责任，对习俗变革持审慎而非否定的态度。' },
    { id: 'K3', section: 'culture', kind: 'tension', severity: 2, when: { all: [ag('Q079', 'G01'), ag('Q080', 'Q082', 'Q084')] },
      short: '支持政治权利上的性别平等，同时保留传统家庭分工或性别角色差异', text: '支持各性别平等参与政治，同时同意家庭照护与公共事务应按性别分工、传统男女分工是理想安排，或角色差异应成为分配职责的依据。' },
    { id: 'K4', section: 'culture', kind: 'pattern', severity: 1, when: { all: [{ f: 'GENDER', min: 20 }, { i: 'Q081', a: 'notAgree' }] },
      short: '支持制度与机会平等，对性别表达自主较保留', text: '支持政治与就业上的性别平等，但对“法律应当保障成年人自主决定性别表达”没有表示同意，对更广泛的自主议题较为保留。' },
    { id: 'K5', section: 'culture', kind: 'tension', severity: 2, when: { all: [{ f: 'REL', min: 40 }, { i: 'L027', a: 'disagree' }] },
      short: '强世俗主义，但不同意宗教团体享有同等结社表达自由', text: '强烈支持世俗公共权力，但不同意宗教团体享有与其他社会组织同等的结社和表达自由。', reading: '其重点更像公共权力去宗教化，而不是充分保障宗教组织的自主性。' },
    { id: 'K6', section: 'culture', kind: 'pattern', severity: 1, when: { all: [{ f: 'REL', min: 40 }, ag('L027', 'R17')] },
      short: '世俗主义不等于压制宗教', text: '世俗主义并不意味着国家压制宗教：同时支持宗教团体的结社与表达自由，或个人改变、放弃宗教信仰的自由。' },
    { id: 'K7', section: 'culture', kind: 'pattern', severity: 1, when: CULTURE_INTEGRATION,
      short: '文化教育上偏向公共价值整合', text: '文化教育上偏向以公共价值和共同体整合为主导：支持统一的公共价值观教育、文艺服务公共利益或优先资助主流价值文艺，或不赞成学校鼓励质疑权威。' },
    { id: 'K8', section: 'culture', kind: 'pattern', severity: 1, when: CULTURE_PLURALISM,
      short: '文化教育上重视自主与表达多元', text: '文化教育上重视个人自主与表达多元：支持学生质疑权威、媒体所有制多元或反思本民族历史错误，而不赞成统一的价值灌输。' },
    { id: 'K9', section: 'culture', kind: 'pattern', severity: 1, key: true, when: { all: [ag('L06', 'Q078', 'L09'), ag('L07', 'Q077', 'L01')] },
      short: '承认生活方式多元，又支持公共权力维护有价值的生活方式或共同文化', text: '承认不同生活方式应当共存，同时支持政府主动促进其认为有价值的生活方式、以公共规范鼓励传统生活方式，或维护共同的民族文化。', reading: '这接近世俗框架内的共同体文化维护与一定的道德家长主义，而不是传统宗教保守主义。' },
    { id: 'K10', section: 'culture', kind: 'pattern', severity: 1, when: { all: [{ f: 'GENDER', min: 20 }, { i: 'M21', a: 'disagree' }] },
      short: '支持性别平等，但不把无偿家务劳动置于资本主义批判中心', text: '支持性别平等，但不赞同把无偿家务劳动置于资本主义批判的中心议题。' },
    { id: 'K11', section: 'culture', kind: 'pattern', severity: 1, key: true, suppress: ['K7', 'K8'], when: { all: [CULTURE_INTEGRATION, CULTURE_PLURALISM] },
      short: '文化教育上公共价值整合与表达多元并存', text: '文化教育上既支持统一的公共价值观教育、文艺服务公共利益或优先资助主流价值文艺，也支持学生质疑权威、媒体所有制多元或反思本民族历史错误。', reading: '这不是单纯的文化自由多元主义，也不是单一的价值灌输，而是公共价值整合与表达多元在不同议题上并存。' },
    // 认同与国际
    { id: 'I1', section: 'international', kind: 'tension', severity: 2, when: { all: [ag('Q093', 'Q091', 'Q095', 'P07'), ag('Q096', 'Q092', 'Q094', 'P10')] },
      short: '承认普遍道德义务，同时在政策上保留本国优先', text: '承认人的共同地位、外国人的基本利益或对外国人的人道责任，但在具体公共政策上仍支持本国利益或本国人优先。', reading: '这不是完全无差别的人类义务论，而是承认普遍道德义务、同时保留国家政策上的本国优先。' },
    { id: 'I2', section: 'international', kind: 'tension', severity: 2, when: { all: [ag('Q097', 'Q099', 'Q101', 'C07'), ag('Q098', 'Q100', 'Q102', 'C08', 'C19')] },
      short: '平等公民原则与血缘、主体文化归属要求并存', text: '支持不同族裔平等的政治权利、长期守法居民入籍或以平等公民身份确定成员资格，同时又同意完整成员资格与主要族群血缘、接受主体民族文化相联系。', reading: '其成员资格观既不是纯粹的公民民族主义，也不是彻底的族裔排他，而是两种原则并存。' },
    { id: 'I3', section: 'international', kind: 'pattern', severity: 1, key: true, when: { all: [ag('Q103', 'Q105', 'Q107', 'P08', 'D21'), ag('Q106', 'Q108', 'Q104')] },
      short: '支持国际合作，但保留单方面退出或最终自行决定的权利', text: '支持国际裁决、共同限制或共同机构，同时保留随时单方面退出、或签署后仍由本国完全自行决定是否遵守的权利。', reading: '属于“支持合作、同时保留最终决定权”的有条件国际制度主义。' },
    { id: 'I4', section: 'international', kind: 'pattern', severity: 1, when: { all: [{ f: 'MEM', min: 20 }, { i: 'P05', a: 'disagree' }] },
      short: '平等观偏向统一的个人公民权而非群体文化权利', text: '反对以血缘或主体文化限制成员资格，但也不赞成为少数文化赋予特定文化权利，平等观更偏向统一的个人公民权。' },
    { id: 'I5', section: 'international', kind: 'tension', severity: 1, when: { all: [{ i: 'M05', a: 'agree' }, ag('Q096', 'Q092')] },
      short: '支持各国劳动者解放相互配合，同时保留本国优先', text: '支持社会主义建设与其他国家劳动者的解放相互配合，同时在具体政策上保留本国优先。' },
    { id: 'I6', section: 'international', kind: 'pattern', severity: 1, key: true, when: { all: [ag('D01', 'M24', 'C11'), { f: 'NAT', min: 20 }] },
      short: '以反支配为条件的民族自决', text: '支持受外部支配的社会自主决定发展道路，同时持普遍主义的道德义务观。', reading: '这是以反支配为条件的民族自决，而不是以民族忠诚为基础的民族主义。' },
    // 生态与技术
    { id: 'G1', section: 'ecology', kind: 'pattern', severity: 1, when: { all: [ag('Q115', 'Q119', 'Q117', 'G10'), { i: 'Q118', a: 'agree' }] },
      short: '重视生态底线，但不接受明显限制大众消费增长', text: '重视生态底线，但同意环境保护不应使多数人的物质消费增长受到明显限制。', reading: '这不是去增长或全面消费节制的立场，而是试图在生态边界与大众物质生活之间保留平衡。' },
    { id: 'G2', section: 'ecology', kind: 'pattern', severity: 1, key: true, suppress: ['G6'], when: { all: [{ f: 'ECO', absMax: 19 }, ag('Q116', 'Q120', 'Q118'), { i: 'Q117', a: 'disagree' }] },
      short: '人类中心的生态观，在发展与环境之间权衡', text: '不认为非人类生命具有独立于人类用途的保护价值，并在就业、增长与生态约束之间作权衡。', reading: '其生态观偏向人类中心，而非生态优先。' },
    { id: 'G3', section: 'ecology', kind: 'pattern', severity: 1, key: true, when: { all: [ag('Q121', 'Q123', 'Q125', 'G14'), ag('Q122', 'Q126', 'Q124')] },
      short: '区分风险类型的技术审慎', text: '对不可逆、难以撤回或资料不足的大规模应用要求先设条件，但对没有明确危害证据的技术仍倾向允许使用。', reading: '这是区分风险类型的审慎态度，而不是全面反对技术。' },
    { id: 'G4', section: 'ecology', kind: 'pattern', severity: 1, key: true, when: { all: [{ f: 'TECH', max: -20 }, ag('G17', 'G23', 'L035')] },
      short: '技术乐观与试验主义', text: '技术乐观和试验主义较明显：愿意为技术进步承担较大的试验风险，并支持人体能力增强、加速技术变革或大规模推广转基因等具体做法。' },
    { id: 'G5', section: 'ecology', kind: 'pattern', severity: 1, when: { all: [{ f: 'TECH', min: 20 }, ag('G17', 'G20', 'G13')] },
      short: '风险审慎不等于反技术', text: '风险审慎并不等于反技术：仍支持知情同意下的人体能力增强、数字权利，或认可经证据支持的先进技术可以减少环境损害。' },
    { id: 'G6', section: 'ecology', kind: 'tension', severity: 1, when: { all: [ag('Q119', 'G10'), ag('Q120', 'Q116')] },
      short: '既同意资源使用受生态承载力约束，又同意增长优先', text: '既同意资源使用应受生态承载能力约束，又同意经济增长应优先于减少资源消耗，或为增加就业可以牺牲重要自然栖息地。' },
    // 理论框架与证据态度
    { id: 'T1', section: 'theory', kind: 'tension', severity: 2, when: { all: [{ f: 'EVID', min: 20 }, { any: [{ i: 'M16', a: 'disagree' }, { i: 'L038', a: 'agree' }] }] },
      short: '一般判断愿意依据反证修正，但对特定理论命题保留', text: '在一般政策判断上自报愿意依据反证修正，但不同意马克思主义的每个具体解释都应接受证据检验和修正，或认为符合“历史规律”比得到当代人的同意更重要。', reading: '可能愿意修正政策和部分理论，却不愿把特定理论的所有命题置于同等可检验、可放弃的地位。' },
    { id: 'T2', section: 'theory', kind: 'pattern', severity: 1, key: 2, when: { atLeast: 2, of: [{ i: 'M01', a: 'agree' }, { i: 'M02', a: 'agree' }, { i: 'M17', a: 'agree' }] },
      short: '采用历史唯物主义与结构分析的框架', text: '分析框架上明显采用历史唯物主义和结构分析：以生产资料占有关系、生产方式变化和制度结构解释社会冲突与历史变迁。' },
    { id: 'T3', section: 'theory', kind: 'pattern', severity: 1, key: 2, when: { all: [{ i: 'L041', a: 'agree' }, { i: 'L038', a: 'disagree' }] },
      short: '评价理论与历史时不预设历史必然', text: '评价理论与历史时重视具体行动者的选择和意外后果，并认为一种政治理论能否得到当代人的同意，比是否符合所谓历史规律更重要。' }
  ];
  const RULE_BY_ID = Object.fromEntries(RULES.map(r => [r.id, r]));

  function evaluate(cond, ctx) {
    if (cond.all) {
      let cites = [];
      for (const c of cond.all) { const r = evaluate(c, ctx); if (!r.ok) return { ok: false, cites: [] }; cites = cites.concat(r.cites); }
      return { ok: true, cites };
    }
    if (cond.any) {
      const hits = cond.any.map(c => evaluate(c, ctx)).filter(r => r.ok);
      return hits.length ? { ok: true, cites: hits.flatMap(r => r.cites).slice(0, 3) } : { ok: false, cites: [] };
    }
    if (cond.atLeast) {
      const hits = cond.of.map(c => evaluate(c, ctx)).filter(r => r.ok);
      return hits.length >= cond.atLeast ? { ok: true, cites: hits.flatMap(r => r.cites).slice(0, 4) } : { ok: false, cites: [] };
    }
    if (cond.not) return { ok: !evaluate(cond.not, ctx).ok, cites: [] };
    if (cond.i) {
      const raw = ctx.raw(cond.i);
      const ok = cond.a === 'undecided' ? raw === 4 || ctx.answer(cond.i) === 'U' : raw !== null && PRED[cond.a](raw);
      return ok ? { ok: true, cites: [cond.i] } : { ok: false, cites: [] };
    }
    if (cond.f) {
      const x = ctx.facet(cond.f);
      if (x == null) return { ok: false, cites: [] };
      const ok = (cond.min === undefined || x >= cond.min) && (cond.max === undefined || x <= cond.max) && (cond.absMax === undefined || Math.abs(x) <= cond.absMax);
      return { ok, cites: [] };
    }
    throw new Error('未知检测条件。');
  }

  /* ---------- 作答方式检测 ---------- */
  function responseStyle(facets, coreRaw, presentedCore) {
    const values = coreRaw.filter(rating), n = values.length, flags = [];
    if (!n) return { flags, counts: { valid: 0 } };
    const share = f => values.filter(f).length / n;
    const agreeRate = share(x => x >= 5), disagreeRate = share(x => x <= 3), extremeRate = share(x => x === 1 || x === 7), neutralRate = share(x => x === 4);
    const scored = facets.filter(f => f.valid >= 5);
    const bothSides = test => scored.filter(f => f.items.some(q => q.sign === '+' && rating(q.answer) && test(q.answer)) && f.items.some(q => q.sign === '-' && rating(q.answer) && test(q.answer))).length;
    const agreeBoth = bothSides(x => x >= 5), disagreeBoth = bothSides(x => x <= 3);
    const unknown = presentedCore ? coreRaw.filter(x => x === 'U' || x === 'X' || x === '×').length / presentedCore : 0;
    if (n >= 20 && new Set(values).size === 1) flags.push({ id: 'straight', value: values[0] });
    else {
      if (scored.length && agreeBoth / scored.length >= 0.5 && agreeRate >= 0.7) flags.push({ id: 'acquiescence' });
      if (scored.length && disagreeBoth / scored.length >= 0.5 && disagreeRate >= 0.7) flags.push({ id: 'disacquiescence' });
      if (n >= 20 && extremeRate >= 0.7) flags.push({ id: 'extreme' });
      if (n >= 20 && neutralRate >= 0.6 && neutralRate < 1) flags.push({ id: 'neutralHeavy' });
    }
    if (presentedCore >= 20 && unknown >= 0.3) flags.push({ id: 'unknownHeavy' });
    return { flags, counts: { valid: n, agreeRate, disagreeRate, extremeRate, neutralRate, agreeBoth, disagreeBoth, scored: scored.length, unknown } };
  }

  /* ---------- 第三层：栏目组合 ---------- */
  function bullets(list) { return { type: 'list', items: list }; }
  function para(text) { return { type: 'p', text }; }
  function itemLine(id, raw) { return phrase(id, raw) + '（' + id + '）'; }
  function facetBlocks(fd, opts = {}) {
    const skip = opts.skip || new Set();
    const head = bold(fd.name + ' ' + signed(fd.value));
    if (fd.value == null) {
      const answered = fd.positive.concat(fd.negative);
      const extra = fd.unknown || fd.refused ? '，另有' + [fd.unknown ? fd.unknown + ' 题选择“不了解”' : '', fd.refused ? fd.refused + ' 题不愿回答' : ''].filter(Boolean).join('、') : '';
      return [para(bold(fd.name) + '：有效回答 ' + fd.valid + '/6' + extra + '，信息不足，不报告点值，也不据此推断方向。' + (answered.length ? '已表达的回答包括：' : ''))].concat(answered.length ? [bullets(answered.slice(0, 2).map(q => itemLine(q.id, q.answer)))] : []);
    }
    if (fd.center === 'neutral') return [para(head + '：这组 ' + fd.valid + ' 题均选择中立。')];
    if (fd.center === 'mixed') {
      const pos = fd.positive.slice(0, 2), neg = fd.negative.slice(0, 2);
      return [para(head + '，接近中间，但并非没有立场——不同回答相互抵消：'), bullets([
        '偏向“' + AXES[fd.id].positive + '”：' + pos.map(q => itemLine(q.id, q.answer)).join('；'),
        '偏向“' + AXES[fd.id].negative + '”：' + neg.map(q => itemLine(q.id, q.answer)).join('；')
      ])];
    }
    if (fd.center === 'weak') return [para(head + '，接近中间' + (fd.lean ? '、' + fd.lean : '') + '；多数回答为中立或轻微倾向。')];
    const blocks = [para(head + '，' + fd.lean + '：'), bullets(fd.consistent.slice(0, 2).map(q => itemLine(q.id, q.answer)))];
    // 已由交叉检测解释的例外不再重复；对外武力另按目的分开说明。
    const exceptions = opts.noExceptions ? [] : fd.exceptions.filter(q => !skip.has(q.id));
    if (exceptions.length) blocks.push(para('但' + exceptions.slice(0, 2).map(q => phrase(q.id, q.answer) + '（' + q.id + '）').join('，也') + '，说明这一方向并非没有例外。'));
    return blocks;
  }
  function forceReading(raw) {
    const yes = id => raw(id) !== null && raw(id) >= 5, no = id => raw(id) !== null && raw(id) <= 3;
    const accept = [], reject = [];
    if (yes('Q109')) accept.push('为阻止大规模屠杀的人道干预'); else if (no('Q109')) reject.push('非自卫的人道干预');
    if (yes('Q113')) accept.push('军事威慑'); else if (no('Q113')) reject.push('把军事威慑作为外交工具');
    if (yes('Q111')) accept.push('为海外利益有限用武'); else if (no('Q111')) reject.push('为海外利益在非自卫情形下用武');
    if (yes('Q114')) reject.push('为扩张影响而发动战争'); else if (no('Q114')) accept.push('为扩大影响范围发动战争');
    if (yes('Q112')) reject.push('在面对不公政权时首先诉诸军事手段');
    if (!accept.length && !reject.length) return '';
    let text = '对外武力需要按目的分开看：' + (accept.length ? '接受' + accept.join('、') : '') + (accept.length && reject.length ? '；' : '') + (reject.length ? '反对' + reject.join('、') : '') + '。';
    if (yes('Q109') && yes('Q114')) text += '这是“接受干预与威慑、反对扩张战争”的组合，不能据此推断支持侵略战争。';
    else if (yes('Q113') && (yes('Q112') || yes('Q110')) && !yes('Q111')) text += '整体是非干预为主、保留防御性威慑的立场。';
    else if (!accept.length) text += '整体明显限制对外武力。';
    return text;
  }
  function scenarioReading(scenarios) {
    if (!scenarios || scenarios.complete < 4) return '';
    const pairs = scenarios.pairs.filter(p => p.difference !== null);
    const differ = pairs.filter(p => Math.abs(p.difference) >= 2);
    if (pairs.every(p => p.difference === 0)) return '甲国（社会主义政党执政、主要生产资料公有）与乙国（资本主义政党执政、主要生产资料私有）情境中，' + pairs.length + ' 项自由与民主安排的回答完全相同，说明这些原则较少随所有制和执政目标改变。';
    if (!differ.length) return '在甲乙两国情境中，' + pairs.length + ' 项自由与民主安排的回答只有一档以内的差别，这些原则大体不随所有制和执政目标改变。';
    const a = differ.filter(p => p.difference > 0).map(p => '“' + p.policy.replace(/。$/, '') + '”'), b = differ.filter(p => p.difference < 0).map(p => '“' + p.policy.replace(/。$/, '') + '”');
    return '在甲乙两国情境中，部分安排随制度条件变化：' + (a.length ? '在甲国（社会主义政党执政、生产资料公有）设定下更支持' + a.join('、') : '') + (a.length && b.length ? '；' : '') + (b.length ? '在乙国（资本主义政党执政、生产资料私有）设定下更支持' + b.join('、') : '') + '。这说明相关原则在其看法中与制度条件有关，情境设计不能分别识别是所有制还是执政目标造成了差异。';
  }
  function moduleEvidence(sectionId, ctx, used) {
    const ids = (SECTION_ITEMS[sectionId] || '').split(' ').filter(id => !used.has(id));
    const answered = ids.map(id => ({ id, raw: ctx.raw(id) })).filter(x => x.raw !== null && x.raw !== 4);
    const strongOnes = answered.filter(x => Math.abs(x.raw - 4) >= 2).sort((a, b) => Math.abs(b.raw - 4) - Math.abs(a.raw - 4) || a.id.localeCompare(b.id));
    const chosen = strongOnes.length ? strongOnes.slice(0, 4) : answered.slice(0, 2);
    if (!chosen.length) return [];
    return [para('专题与补充题中的相关回答：'), bullets(chosen.map(x => itemLine(x.id, x.raw)))];
  }
  function citeText(cites, ctx) {
    const seen = [...new Set(cites)];
    return seen.length ? '（依据：' + seen.map(id => id + ' ' + (VERBS[ctx.raw(id)] || '')).join('；') + '）' : '';
  }

  /* ---------- 第五层：总体定位 ---------- */
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八'];
  const RULE_ORDER = Object.fromEntries(RULES.map((r, i) => [r.id, i]));
  const SECTION_ORDER = Object.fromEntries(SECTIONS.map((s, i) => [s.id, i]));
  const byAbs = (a, b) => Math.abs(b.value) - Math.abs(a.value) || a.id.localeCompare(b.id);
  const keyLevel = f => Number(RULE_BY_ID[f.id].key || 0);
  const byWeight = (a, b) => b.severity - a.severity || keyLevel(b) - keyLevel(a) || RULE_ORDER[a.id] - RULE_ORDER[b.id];
  const quoteNames = list => list.map(x => '“' + x + '”').join('、');

  function analyze(result, session, options = {}) {
    const answers = session && session.answers ? session.answers : {};
    const presented = new Set(session && Array.isArray(session.presented) ? session.presented : []);
    const answer = id => Object.prototype.hasOwnProperty.call(answers, id) && (ITEMS[id] && ITEMS[id].core || presented.has(id)) ? answers[id] : undefined;
    const raw = id => { const x = answer(id); return rating(x) ? x : null; };
    const facets = result && Array.isArray(result.facets) ? result.facets : [];
    const facetsById = Object.fromEntries(facets.map(f => [f.id, f]));
    const ctx = { raw, answer, facet: id => facetsById[id] ? facetsById[id].value : null };
    const described = Object.fromEntries(facets.map(f => [f.id, describeFacet(f)]));
    const coreRaw = D.core.items.map(q => answers[q.id]).filter(x => x !== undefined && x !== null && x !== '');
    const style = responseStyle(facets, coreRaw, coreRaw.length);
    const straight = style.flags.find(f => f.id === 'straight');
    const reportable = facets.filter(f => f.value != null);
    const validCore = coreRaw.filter(rating);
    const out = { version: VERSION, status: 'ok', intro: '本节由公开规则根据你的全部回答自动生成：先给出总体定位，再逐部分列出分面、关键单题和相互拉扯的回答组合。它只概括本次作答，不是人工评语，也不是思想身份鉴定。', overall: { paragraphs: [], quote: '' }, sections: [], skipped: [], findings: [], references: [], tensions: [], summary: [], summaryNote: '', caveats: [], style };

    if (!reportable.length) {
      out.status = 'insufficient';
      out.overall.paragraphs.push('目前还没有任何分面达到可报告的有效回答数（每个分面至少 5/6 题），综合分析暂不生成，以免把少量回答推断成完整立场。完成更多共同题后，这里会给出逐项依据和总体定位。');
      out.caveats.push('已作答的共同题有效回答 ' + validCore.length + '/' + D.core.items.length + '。');
      return finish(out);
    }
    const otherAnswers = Object.keys(ITEM_SECTION).filter(id => !ITEMS[id].core && raw(id) !== null && raw(id) !== 4).length;
    const otherNote = otherAnswers ? '专题与补充题中另有 ' + otherAnswers + ' 项非中立回答，可在下方逐题记录中查看。' : '';
    if (validCore.length && validCore.every(x => x === 4)) {
      out.status = 'neutral';
      out.overall.paragraphs.push('本次已答的 ' + validCore.length + ' 道共同题全部选择中立。综合分析只记录这一作答状态，不把中立推断为温和、中间派或任何具体立场，各部分也不给出方向判断。' + otherNote);
    } else if (straight && straight.value !== 4) {
      out.status = 'uniform';
      out.overall.paragraphs.push('本次已答的 ' + validCore.length + ' 道共同题全部选择“' + VERBS[straight.value] + '”。由于各分面同时包含正反两种表述，同一选项会使分面均值相互抵消；这种模式更可能反映作答方式，而不是中间立场。报告保留原答、不作校正，也不逐项推断方向或检测组合。' + otherNote);
    }

    if (out.status === 'ok') {
      // 第四层：交叉检测
      const fired = RULES.map(rule => ({ rule, r: evaluate(rule.when, ctx) })).filter(x => x.r.ok);
      const suppressed = new Set(fired.flatMap(x => x.rule.suppress || []));
      const findings = fired.filter(x => !suppressed.has(x.rule.id)).map(({ rule, r }) => ({ id: rule.id, section: rule.section, kind: rule.kind, severity: rule.severity, key: !!rule.key, short: rule.short, text: rule.text, reading: rule.reading || '', cites: [...new Set(r.cites)] }));
      out.findings = findings.map(f => ({ id: f.id, section: f.section, kind: f.kind, severity: f.severity, cites: f.cites }));
      out.tensions = findings.filter(f => f.kind === 'tension' || (f.kind === 'exception' && f.severity >= 2)).sort((a, b) => b.severity - a.severity || SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || RULE_ORDER[a.id] - RULE_ORDER[b.id]).slice(0, 5).map(f => ({ id: f.id, section: f.section, severity: f.severity, text: f.short }));
      const inTensions = new Set(out.tensions.slice(0, 3).map(t => t.id));

      // 第三层：栏目组合
      for (const def of SECTIONS) {
        const fds = def.facets.map(id => described[id]).filter(Boolean);
        const valid = fds.filter(fd => fd.value != null).sort(byAbs);
        if (!valid.length) { out.skipped.push(def.title); continue; }
        const missing = fds.filter(fd => fd.value == null);
        const abs = valid.map(fd => Math.abs(fd.value));
        const strength = Math.round((abs.reduce((n, x) => n + x, 0) / abs.length + Math.max(...abs)) / 2);
        const directional = valid.filter(fd => fd.band !== 'center'), centered = valid.filter(fd => fd.band === 'center');
        const clauses = directional.concat(centered).map(facetClause);
        const clause = clauses.join('，') + (missing.length ? '（' + missing.map(fd => fd.name).join('、') + '信息不足）' : '');
        const firm = directional.filter(fd => Math.abs(fd.value) >= 45).slice(0, 2).map(facetClause);
        const own = findings.filter(f => f.section === def.id);
        const top = own.slice().sort(byWeight)[0];
        const note = own.filter(f => !inTensions.has(f.id) && (f.kind === 'pattern' || f.severity < 2)).sort((a, b) => (b.key ? 1 : 0) - (a.key ? 1 : 0) || RULE_ORDER[a.id] - RULE_ORDER[b.id])[0];
        const section = { id: def.id, number: CN[out.sections.length], title: def.title, lead: def.lead, facets: fds.map(fd => ({ id: fd.id, name: fd.name, value: fd.value, valid: fd.valid, band: fd.band, pattern: fd.pattern, center: fd.center })), strength, clause, headline: clauses.slice(0, 2).join('，'), brief: (firm.length ? firm : clauses.slice(0, 1)).join('，'), note: note ? note.short : '', blocks: [], findings: own.map(f => f.id) };
        if (fds.length > 1) section.blocks.push(bullets(fds.map(fd => bold(fd.name + ' ' + signed(fd.value)) + '：' + facetClause(fd))));
        const used = new Set(own.flatMap(f => f.cites));
        const force = def.id === 'international' ? forceReading(raw) : '';
        for (const fd of valid.concat(missing)) section.blocks.push(...facetBlocks(fd, { skip: used, noExceptions: fd.id === 'FORCE' && !!force }));
        if (force) section.blocks.push(para(force));
        if (def.id === 'political') { const t = scenarioReading(result.scenarios); if (t) section.blocks.push(para(t)); }
        for (const f of own) section.blocks.push(para(f.text + f.reading + citeText(f.cites, ctx)));
        section.blocks.push(...moduleEvidence(def.id, ctx, used));
        if (fds.length > 1 || top) section.blocks.push({ type: 'quote', text: '因此，' + def.lead + clause + (top ? '；' + top.short : '') + '。' });
        out.sections.push(section);
      }

      // 总体定位
      const ranked = out.sections.filter(s => s.id !== 'theory').sort((a, b) => b.strength - a.strength || SECTION_ORDER[a.id] - SECTION_ORDER[b.id]);
      const leaders = ranked.filter(s => s.strength >= 35).slice(0, 3);
      const leaderIds = new Set(leaders.map(s => s.id));
      const mixed = Object.values(described).filter(fd => fd.center === 'mixed');
      const styleNote = styleText(style);
      if (styleNote) out.overall.paragraphs.push(styleNote);
      const keys = findings.filter(f => f.kind === 'pattern' && f.key).sort((a, b) => keyLevel(b) - keyLevel(a) || (leaderIds.has(b.section) ? 1 : 0) - (leaderIds.has(a.section) ? 1 : 0) || SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || RULE_ORDER[a.id] - RULE_ORDER[b.id]).slice(0, 3);
      out.overall.paragraphs.push((leaders.length
        ? '从整份答卷看，表达最鲜明的是' + leaders.map(s => bold(s.title) + '（' + s.headline + '）').join('、') + '。'
        : ranked.length ? '从整份答卷看，各部分的平均倾向都不算强烈，不宜用某一个流派名称概括：' + ranked.map(s => s.title + '（' + s.headline + '）').join('；') + '。'
        : '目前可以报告的只有自报的判断方式，还不能形成政治立场上的总体定位。')
        + (keys.length ? '在具体组合上，答卷显示出：' + keys.map(f => f.short).join('；') + '。' : ''));
      const tested = (result.cards || []).filter(c => c.statusCode !== 'untested');
      const cardText = tested.length ? '实际核验的 ' + tested.length + ' 张思想卡中，' + [['supported', '三项主张均支持的是'], ['partial', '部分支持或存在分歧的是'], ['insufficient', '信息不足的是']].map(([code, label]) => { const list = tested.filter(c => c.statusCode === code).map(c => c.name); return list.length ? label + quoteNames(list) : ''; }).filter(Boolean).join('；') + '；这只表示与所选主张是否相符，不等于完整认同该流派。' : '';
      const certainty = answers.Z03 === 0 && (mixed.length >= 3 || out.tensions.length >= 3) ? '本人自述政治立场“尚未形成”，这与答卷中多处相反回答和内部张力一致。'
        : answers.Z03 === 3 && out.tensions.length >= 2 ? '本人自述对政治立场“很确定”，但答卷中仍有 ' + out.tensions.length + ' 处内部张力，值得进一步澄清。' : '';
      if (cardText || certainty) out.overall.paragraphs.push(cardText + certainty);
      const perSection = SECTIONS.map(def => ({ def, n: findings.filter(f => f.section === def.id && f.kind === 'tension').length })).filter(x => x.n >= 2).sort((a, b) => b.n - a.n || SECTION_ORDER[a.def.id] - SECTION_ORDER[b.def.id]);
      const tail = [];
      if (mixed.length) tail.push(mixed.length === 1
        ? '此外，“' + mixed[0].name + '”分面均值接近中间，但内部存在相反回答，不宜理解为中立或没有立场。'
        : '此外，有 ' + mixed.length + ' 个分面均值接近中间、但内部存在相反回答（' + mixed.map(fd => fd.name).join('、') + '），这些分面不宜理解为中立或没有立场。');
      if (perSection.length) tail.push('各部分中，' + bold(perSection[0].def.title) + '的相互拉扯最集中（' + perSection[0].n + ' 处），这一部分的方向尚未整合成单一取向。');
      if (out.tensions.length) tail.push('整份答卷最需要澄清的是：' + bold(out.tensions[0].text) + (out.tensions.length > 1 ? '；另有 ' + (out.tensions.length - 1) + ' 处内部张力，见下文“最主要的内部张力”' : '') + '。');
      if (tail.length) out.overall.paragraphs.push(tail.join(''));
      if (reportable.length < 12 || out.skipped.length) out.overall.paragraphs.push((reportable.length < 12 ? '目前只有 ' + reportable.length + '/' + facets.length + ' 个分面可以报告，总体定位仅限这些方面' : '') + (reportable.length < 12 && out.skipped.length ? '；' : '') + (out.skipped.length ? quoteNames(out.skipped) + '部分的共同题有效回答不足，未作概括' : '') + '。');
      out.overall.quote = out.sections.map(s => s.lead + s.brief).join('；') + '。';

      // 综合概括
      out.summary = out.sections.map(s => bold(s.lead) + '：' + s.clause + (s.note ? '；' + s.note : '') + '。');
      out.summaryNote = out.tensions.length
        ? '其最核心的内部张力是：' + bold(out.tensions.slice(0, 3).map(t => t.text).join('；')) + '。这些张力不宜用平均分抹平，而应视为其立场组合本身的一部分。'
        : '各部分之间没有检测到明显相互冲突的组合；' + (mixed.length ? '但仍有分面内部存在相反回答，需要结合逐题回答理解。' : '各部分方向可以分别理解。');
    }

    // 参照：自我认同、思想卡、专题与画像
    out.references = references(result, session, options, ctx);

    // 注意事项
    const coverage = result.coverage || {};
    const modulesTaken = (coverage.modules || []).filter(m => m.selected).map(m => '“' + m.title + '”');
    const insufficient = facets.filter(f => f.value == null).map(f => f.name);
    out.caveats.push('本次实际核验 ' + (coverage.testedCardCount || 0) + '/' + (coverage.totalCards || D.cards.length) + ' 张思想卡；' + (modulesTaken.length ? '进入了' + modulesTaken.join('、') + '专题' : '没有进入深入专题') + '；补充题有效回答 ' + ((coverage.supplements && coverage.supplements.valid) || 0) + ' 项。' + (insufficient.length ? '信息不足的分面：' + insufficient.join('、') + '。' : ''));
    out.caveats.push('因此，上述定位只能作为对这份答卷的概括，不能视为已经完成的思想流派鉴定；未检验的思想不作排除。');
    if (Number(answers.Z01) >= 2) out.caveats.push('本人报告了较多表达顾虑，解读时应考虑回答可能有所保留；报告不作分数校正。');
    return finish(out);
  }
  function styleText(style) {
    const ids = new Set(style.flags.map(f => f.id)), notes = [];
    if (ids.has('acquiescence')) notes.push('不少分面同时出现对正反两种表述都表示同意的情况，分面均值因此容易接近中间；这可能来自条件性看法、对题意的不同理解或作答习惯，不一定代表中间立场');
    if (ids.has('disacquiescence')) notes.push('不少分面同时出现对正反两种表述都表示不同意的情况，可能表示对两种表述的前提都不接受');
    if (ids.has('extreme')) notes.push('大多数回答选择了最强烈的选项，分值因此容易落在两端');
    if (ids.has('neutralHeavy')) notes.push('六成以上回答选择中立，以下方向判断依据的题数较少');
    if (ids.has('unknownHeavy')) notes.push('较多题目选择了“不了解”或不愿回答，这些题不计入方向');
    return notes.length ? '作答方式提示：' + notes.join('；') + '。报告保留原答，不作校正。' : '';
  }
  function moduleOverview(ctx, session) {
    const parts = [];
    for (const id of (session && session.selectedModules) || []) {
      const m = MODULES[id];
      if (!m) continue;
      const vals = m.items.map(q => ctx.raw(q.id)).filter(x => x !== null);
      if (!vals.length) continue;
      const agree = vals.filter(x => x >= 5).length, disagree = vals.filter(x => x <= 3).length;
      parts.push('“' + m.title + '”已答 ' + vals.length + '/' + m.items.length + ' 题（同意 ' + agree + '、不同意 ' + disagree + '、中立 ' + (vals.length - agree - disagree) + '）');
    }
    return parts.length ? [para('深入专题：' + parts.join('；') + '。各题已按主题归入上文相关部分，不合成为专题总分。')] : [];
  }
  function references(result, session, options, ctx) {
    const blocks = [];
    const answers = session && session.answers ? session.answers : {};
    // 自我认同
    const stated = typeof answers.Z04 === 'string' ? plain(answers.Z04).trim().slice(0, 200) : '';
    const certainty = Number.isInteger(answers.Z03) ? ['尚未形成', '部分确定', '比较确定', '很确定'][answers.Z03] : null;
    const tested = (result.cards || []).filter(c => c.statusCode !== 'untested');
    if (stated && !['U', 'X', '×'].includes(stated)) {
      const names = D.cards.filter(c => [c.name, ...(c.aliases || [])].some(n => n && n.length > 1 && stated.includes(n)));
      const status = names.map(c => { const card = tested.find(x => x.id === c.id); return c.name + (card ? '（已核验：' + card.status + '）' : '（本次未核验）'); });
      blocks.push(para('作答前主动列出的思想名称是“' + stated + '”' + (status.length ? '；对应的思想卡：' + [...new Set(status)].join('、') : '') + '。名称认同与政策主张分开报告，本节不依据名称推断立场。'));
    }
    if (certainty) blocks.push(para('本人对自己政治立场的确定程度：' + certainty + '。'));
    // 思想卡
    if (tested.length) {
      blocks.push(para('实际核验的思想卡（只表示与所选三项主张是否相符，不等于完整认同该流派）：'));
      blocks.push(bullets(tested.map(c => c.name + '：' + c.status + ((c.conflicts || []).length ? '；不同意' + c.conflicts.map(q => '“' + plain(q.text).replace(/[。]$/, '') + '”').join('、') : '') + (c.identity != null ? '；名称认同：' + ['不认同', '尚不确定', '部分认同', '明确认同'][c.identity] : '') + '。')));
    }
    // 深入专题
    blocks.push(...moduleOverview(ctx, session));
    // 画像参照
    const groups = Array.isArray(options.profile) ? options.profile : [];
    const people = options.people || {};
    const matched = groups.filter(g => g.candidates && g.candidates.length);
    if (matched.length) {
      blocks.push(para('基本倾向性画像在以下维度给出了较接近的参照（只比较该维度，不能直接扩展为完整的政治路线）：'));
      blocks.push(bullets(matched.map(g => {
        const c = g.candidates[0], person = people[c.personId];
        return g.section + '：' + (g.status === 'tentative' ? '有条件地接近' : '较接近') + '“' + c.label + '”' + (g.candidates[1] ? '，并与“' + g.candidates[1].label + '”接近并列' : '') + (person ? '，代表人物' + person.name : '') + '。';
      })));
    }
    // 专题参考题与思想卡方向一致（未核验）
    const testedIds = new Set(tested.map(c => c.id));
    const leads = D.cards.filter(c => !testedIds.has(c.id) && c.keys && c.keys.length >= 3).map(c => {
      const vals = c.keys.map(key => { const x = ctx.raw(key.slice(0, -1)); return x === null ? null : key.slice(-1) === '-' ? 8 - x : x; }).filter(x => x !== null);
      return { c, n: vals.length, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
    }).filter(x => x.n >= 3 && x.n === x.c.keys.length && x.mean >= 6).sort((a, b) => b.mean - a.mean || a.c.id.localeCompare(b.c.id)).slice(0, 4);
    if (leads.length) blocks.push(para('按专题参考题，你的回答与' + leads.map(x => '“' + x.c.name + '”').join('、') + '等思想卡的参考题方向较一致，可作为进一步核验的方向；这些卡本次未核验，不代表归属。'));
    return blocks;
  }
  function finish(out) { return out; }
  // 供测试使用：收集结构中的全部文本。
  function texts(value, list = []) {
    if (typeof value === 'string') list.push(value);
    else if (Array.isArray(value)) value.forEach(v => texts(v, list));
    else if (value && typeof value === 'object') Object.values(value).forEach(v => texts(v, list));
    return list;
  }

  return Object.freeze({ VERSION, SECTIONS, SECTION_ITEMS, ITEM_SECTION, RULES, RULE_BY_ID, FACET_TEXT, BANDS, analyze, evaluate, describeFacet, responseStyle, texts, markers: { B0, B1 }, plain });
});
