'use strict';
/* 综合报告分析的测试答卷：按分面目标值构造共同题，并保留四份近似示例组合。仅供测试，不含真实作答者信息。 */
const assert = require('node:assert/strict');
const D = require('../assets/omni-data.js');
const S = require('../assets/omni-session.js');
const anchors = new Set(D.modules.flatMap(m => m.anchors));
const MODULE_OF = {}, GROUP_OF = {}, CORE = {};
for (const m of D.modules) for (const q of m.items) MODULE_OF[q.id] = m.id;
for (const q of D.legacySupplement.items) GROUP_OF[q.id] = q.group;
for (const q of D.core.items) CORE[q.id] = q;
const AXIS_ITEMS = Object.fromEntries(D.core.axes.map(a => [a.id, D.core.items.filter(q => q.axis === a.id)]));

// 按分面目标值填答共同题：fixed 中的题保持原答，其余题补足到目标均值。
function build({ facets = {}, fixed = {}, modules = [], supplements = [], cards = {}, context = {}, base = 'quiet', scenario = 6 } = {}) {
  const s = S.fresh(D); s.stage = 'base';
  const answers = {};
  const mods = new Set(modules), groups = new Set(supplements);
  for (const id of Object.keys(fixed)) {
    if (MODULE_OF[id] && !anchors.has(id)) mods.add(MODULE_OF[id]);
    if (GROUP_OF[id]) groups.add(GROUP_OF[id]);
  }
  const orient = (q, raw) => typeof raw === 'number' ? (q.sign === '-' ? 8 - raw : raw) : null;
  for (const a of D.core.axes) {
    const items = AXIS_ITEMS[a.id], target = facets[a.id];
    const free = items.filter(q => fixed[q.id] === undefined);
    for (const q of items) if (fixed[q.id] !== undefined) answers[q.id] = fixed[q.id];
    if (target === undefined) {
      // “安静”底色：每个分面只有一题略偏，避免全中立又不引入方向。
      free.forEach((q, i) => { const v = base === 'neutral' || i > 0 ? 4 : 5; answers[q.id] = q.sign === '-' ? 8 - v : v; });
      continue;
    }
    let need = Math.round(6 * (4 + 3 * target / 100)) - items.filter(q => fixed[q.id] !== undefined).reduce((n, q) => n + (orient(q, fixed[q.id]) || 4), 0);
    free.forEach((q, i) => {
      const left = free.length - i, v = Math.max(1, Math.min(7, Math.round(need / left)));
      need -= v; answers[q.id] = q.sign === '-' ? 8 - v : v;
    });
  }
  for (const id of anchors) answers[id] = fixed[id] !== undefined ? fixed[id] : 4;
  const moduleList = [...mods].slice(0, 2);
  for (const m of D.modules.filter(m => moduleList.includes(m.id))) for (const q of m.items) answers[q.id] = fixed[q.id] !== undefined ? fixed[q.id] : 4;
  for (const q of D.legacySupplement.items.filter(q => groups.has(q.group))) answers[q.id] = fixed[q.id] !== undefined ? fixed[q.id] : 4;
  for (const sc of D.core.scenarios) answers[sc.id] = fixed[sc.id] !== undefined ? fixed[sc.id] : scenario;
  for (const [id, v] of Object.entries(context)) answers[id] = v;
  for (const [id, v] of Object.entries(cards)) ['a', 'b', 'c', 'I', 'K'].forEach((k, i) => { if (v[i] !== undefined) answers[id + '.' + k] = v[i]; });
  Object.assign(s, { selectedModules: moduleList, selectedSupplements: [...groups], selectedCards: Object.keys(cards), answers, presented: Object.keys(answers) });
  S.finish(s, 'synthesis-test');
  return S.validate(D, s);
}
const card = name => { const c = D.cards.find(c => c.name === name); assert(c, name); return c.id; };

// 四份示例答卷：分别对应四种典型组合（先锋队社会主义、市场社会民主、民主社会主义、统一共和），只是近似构造。
const FIXTURES = {
  vanguard: () => build({
    facets: { OWN: 61, ALLOC: 0, RED: 39, LAB: 28, CIV: 11, DEM: -6, ORG: 39, DEC: 0, CHANGE: 11, MEANS: 0, COMM: 44, POP: 17, CULT: 6, GENDER: 28, REL: 78, NAT: 28, MEM: 39, INT: 22, FORCE: 22, ECO: 0, TECH: -28, EVID: 33 },
    fixed: { Q013: 3, Q020: 6, Q022: 4, Q007: 6, Q008: 6, Q010: 3, Q031: 6, Q033: 6, Q035: 6, Q032: 6, Q034: 6, Q036: 6, Q026: 5, Q028: 5, Q037: 7, Q038: 2, Q039: 6, Q041: 6, Q058: 6, Q059: 2, Q055: 6, Q056: 3, Q060: 3, Q067: 6, Q069: 6, Q072: 6, Q068: 5, Q074: 6, Q077: 6, Q076: 6, Q081: 4, Q103: 6, Q106: 5, Q109: 6, Q111: 6, Q113: 6, Q114: 5, Q110: 5, Q117: 2, Q116: 6, Q120: 5, Q119: 6, Q121: 2, Q124: 6, Q096: 5, Q093: 6,
      S01: 7, A08: 5, A03: 6, M01: 7, M02: 7, M17: 7, M03: 7, M04: 6, M05: 7, M08: 7, M09: 7, M18: 7, M12: 5, M21: 3, M16: 5, M06: 3, M07: 5, S03: 5, G17: 6, R23: 1, D22: 6 },
    modules: ['M', 'A'],
    cards: { [card('德莱昂主义')]: [6, 6, 7, 2, 2], [card('正统马克思主义')]: [6, 5, 3, 2, 2], [card('伯恩施坦修正主义')]: [5, 3, 2, 1, 2], [card('社会主义')]: [7, 7, 6, 3, 3] }
  }),
  market: () => build({
    facets: { OWN: 22, ALLOC: -56, RED: 17, LAB: 0, CIV: 39, DEM: 50, ORG: 0, DEC: 22, CHANGE: 39, MEANS: 33, COMM: 33, POP: -33, CULT: 22, GENDER: 28, REL: 83, NAT: 33, MEM: 50, INT: 33, FORCE: -28, ECO: 33, TECH: -28, EVID: 61 },
    fixed: { Q036: 5, Q030: 5, Q021: 3, Q016: 5, Q015: 6, Q019: 4, Q020: 4, Q022: 4, Q024: 4, Q049: 7, Q053: 6, Q054: 6, Q059: 3, Q055: 7, Q057: 6, Q060: 3, Q037: 4, Q039: 6, Q041: 3, Q042: 6, Q038: 3, Q040: 3, Q093: 6, Q096: 5, Q109: 3, Q113: 7, Q112: 6, Q111: 2, Q118: 4, Q116: 4, Q120: 4, Q119: 7, Q075: 5, Q076: 5,
      S01: 4, S03: 6, S08: 6, S12: 3, L01: 6, L02: 6, L13: 3, L15: 5, P05: 3, C01: 5, S07: 6, S09: 4, S10: 4, S05: 7, S04: 1, S06: 6, S20: 3, S23: 6, L04: 6, L06: 6, L07: 6, L09: 6, L11: 6, L16: 6, L24: 7, L10: 5, P19: 6 },
    modules: ['S', 'L'],
    context: { Z03: 2, Z04: '社会民主主义、新自由主义，文化议题上倾向于一定保守主义' }
  }),
  democratic: () => build({
    facets: { OWN: 83, ALLOC: 22, RED: 89, LAB: 89, CIV: 83, DEM: 89, ORG: 11, DEC: 22, CHANGE: 61, MEANS: 39, COMM: 61, POP: 11, CULT: 94, GENDER: 89, REL: 100, NAT: 94, MEM: 100, INT: 50, FORCE: 33, ECO: 44, TECH: 22, EVID: 61 },
    fixed: { Q060: 5, Q069: 5, Q072: 6, Q059: 3, Q055: 7, Q056: 2, Q058: 2, Q050: 3, Q054: 2, Q118: 6, Q117: 7, Q119: 6, Q121: 6, Q122: 5, Q108: 6, Q103: 6, Q109: 6, Q113: 6, Q111: 3, Q114: 7, Q112: 3,
      S01: 7, S03: 7, S08: 7, S12: 4, M01: 6, M03: 4, M08: 5, M12: 5, S04: 2, S05: 2, S13: 6, S22: 6, S23: 6, S07: 1, S09: 2, S10: 4, S24: 6, M16: 3, M05: 7, M06: 2, D01: 6, P05: 3, L027: 6 },
    modules: ['S', 'M'], supplements: ['POLICY', 'CULTURE'],
    context: { Z03: 2, Z04: '托洛茨基主义、马克思主义、民主社会主义' },
    cards: { [card('社会主义')]: [7, 7, 7, 3, 3], [card('卢森堡主义')]: [6, 6, 3, 2, 2], [card('社会民主主义')]: [6, 5, 2, 2, 3], [card('伯恩施坦修正主义')]: [7, 6, 2, 0, 2] }
  }),
  unitary: () => build({
    facets: { OWN: -11, RED: -28, LAB: -6, CIV: 61, DEM: 28, ORG: 40, DEC: -39, CHANGE: 0, MEANS: 28, COMM: 11, POP: 11, CULT: 22, GENDER: 6, REL: 83, NAT: -39, MEM: 17, INT: -17, FORCE: -11, ECO: 44, TECH: 56, EVID: 50 },
    fixed: { Q007: 'U', Q011: 'U', Q008: 5, Q012: 5, Q009: 5, Q010: 4, Q031: 4, Q035: 3, Q033: 6, Q034: 1, Q015: 3, Q016: 6, Q013: 6, Q005: 6, Q004: 1, Q001: 3, Q003: 3, Q069: 5, Q070: 6, Q072: 6, Q057: 3, Q059: 3, Q055: 6, Q049: 6, Q050: 6, Q061: 6, Q063: 6, Q065: 6, Q064: 6, Q066: 6, Q075: 7, Q076: 6, Q079: 6, Q080: 5, Q081: 3, Q098: 5, Q100: 5, Q097: 6, Q099: 6, Q118: 6, Q115: 7, Q116: 1, Q121: 6, Q122: 5, Q125: 7, Q043: 2, Q046: 6, Q047: 6, Q037: 6,
      S01: 5, S03: 3, S08: 7, S12: 3, M08: 1, M12: 3, D22: 6, D14: 2, C07: 6, L13: 6, L027: 3, L024: 6, L026: 6, L028: 6, L029: 3, L025: 6, L030: 6 },
    supplements: ['CULTURE'],
    context: { Z03: 0, Z04: '' }
  })
};

module.exports = { build, card, FIXTURES, anchors, MODULE_OF, GROUP_OF, CORE, AXIS_ITEMS };
