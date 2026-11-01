/* OMNI report charts.
   Every chart redraws numbers that the report already states (facet scores, missing-answer ranges,
   raw answers and counts). Nothing here adds a score, a ranking of ideologies or an identity label. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OMNI_CHARTS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MINUS = '−';
  const signed = n => n == null ? '—' : n > 0 ? '+' + n : n < 0 ? MINUS + Math.abs(n) : '0';
  const num = n => String(Math.round(n * 100) / 100);
  const pc = n => String(Math.round(n * 1000) / 1000) + '%';
  const validRating = x => Number.isInteger(x) && x >= 1 && x <= 7;
  const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", system-ui, sans-serif';
  const LEAN = 20;      // icon colouring in the closing figure: one end leads by at least 20 points
  const STRONG = 50;    // outer ring: at least 50 points
  const MARKED = 34;    // "较突出": average beyond 略同意 / 略不同意, and missing answers cannot reverse it
  const RATING_TEXT = ['', '非常不同意', '不同意', '略不同意', '中立', '略同意', '同意', '非常同意'];
  const SHORT = { OWN: '所有权', ALLOC: '资源配置', RED: '再分配', LAB: '劳动权力', CIV: '公民自由', DEM: '政治竞争', ORG: '政治组织', DEC: '央地关系', CHANGE: '变革路径', MEANS: '手段约束', COMM: '共同义务', POP: '人民与多元', CULT: '社会习俗', GENDER: '性别制度', REL: '宗教与国家', NAT: '认同义务', MEM: '成员资格', INT: '国际合作', FORCE: '对外武力', ECO: '生态目标', TECH: '技术治理', EVID: '判断修正' };
  const DEFAULT_AXES = ['OWN', 'CIV', 'CULT'];
  const short = f => SHORT[f.id] || String(f.name).slice(0, 5);
  // Approximate rendered width (CJK = 1em, ASCII about .58em) for layout decisions in SVG.
  const textWidth = (s, size) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) < 256 ? 0.58 : 1), 0) * size;
  function wrap(s, max) {
    const chars = [...String(s)], lines = [];
    if (chars.length <= max) return [s];
    const half = Math.ceil(chars.length / 2);
    lines.push(chars.slice(0, half).join(''), chars.slice(half).join(''));
    return lines;
  }
  function answerText(value) {
    if (validRating(value)) return value + ' · ' + RATING_TEXT[value];
    if (value === 'U') return 'U · 不了解或无法判断';
    if (value === '×' || value === 'X' || value === 'x') return '× · 不愿回答';
    return '漏答';
  }
  function themes(facets) {
    const out = [];
    for (const f of facets) {
      const name = f.section || '其他';
      let t = out.find(x => x.name === name);
      if (!t) out.push(t = { name, facets: [] });
      t.facets.push(f);
    }
    return out;
  }
  const lean = f => f.value == null ? null : f.value <= -LEAN ? 'neg' : f.value >= LEAN ? 'pos' : null;

  // ---------------------------------------------------------------- styling that survives without the stylesheet
  // Copies of the report (PDF converters, pasted HTML, other browsers' "save page") often drop
  // omni-charts.css. Unstyled SVG paints every shape black, so each SVG element also carries its light-theme
  // colours as presentation attributes; the stylesheet still overrides them (dark mode, print, phone sizes).
  const INK = '#17202c', MUTED = '#596678', GRID = '#e6e9ef', AXIS = '#b9c1cd', POINT = '#1f3864', NEG = '#2a78d6', POS = '#eb6834', NEU = '#cfcdc5';
  const RAMP = { r1: '#1c5cab', r2: '#2a78d6', r3: '#9ec5f4', r4: '#cfcdc5', r5: '#f6b08f', r6: '#eb6834', r7: '#b4461a' };
  const HALO = 'paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"';
  const PAINT = {
    'vz-pane': 'fill="#edf1f7" stroke="#d5dce6" stroke-width="1"', 'vz-pane-grid': 'stroke="#d5dce6" stroke-width="0.8"', 'vz-pane-grid zero': 'stroke="' + AXIS + '" stroke-width="0.8"',
    'vz-drop': 'stroke="' + POINT + '" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"', 'vz-shadow': 'fill="' + POINT + '" opacity="0.42"',
    'vz-axis': 'stroke="' + MUTED + '" stroke-width="1.4" opacity="0.75"', 'vz-box': 'stroke="' + POINT + '" stroke-width="1.3" opacity="0.55"',
    'vz-axis-label': 'font-size="11" fill="' + INK + '" ' + HALO, 'vz-axis-tag': 'font-weight="700" fill="' + MUTED + '"',
    'vz-point': 'fill="' + POINT + '" stroke="#ffffff" stroke-width="2"', 'vz-point-halo': 'fill="' + POINT + '" opacity="0.16"',
    'vz-point-label': 'font-size="12" font-weight="700" fill="' + INK + '" ' + HALO, 'vz-note': 'font-size="11" fill="' + MUTED + '"',
    'vz-sector-line': 'stroke="' + AXIS + '" stroke-width="1"', 'vz-sector-no': 'font-size="12" fill="' + MUTED + '"',
    'vz-web': 'fill="none" stroke="' + GRID + '" stroke-width="1"', 'vz-web zero': 'fill="none" stroke="' + AXIS + '" stroke-width="1.4"', 'vz-spoke': 'stroke="' + GRID + '" stroke-width="1"',
    'vz-band': 'fill="#7d8898" fill-opacity="0.2" stroke="none"', 'vz-area': 'fill="' + POINT + '" fill-opacity="0.1" stroke="' + POINT + '" stroke-width="2" stroke-linejoin="round"',
    'vz-area-line': 'stroke="' + POINT + '" stroke-width="2" stroke-linecap="round"',
    'vz-dot pos': 'fill="' + POS + '" stroke="#ffffff" stroke-width="2"', 'vz-dot neg': 'fill="' + NEG + '" stroke="#ffffff" stroke-width="2"', 'vz-dot zero': 'fill="' + MUTED + '" stroke="#ffffff" stroke-width="2"',
    'vz-hit': 'fill="#000000" fill-opacity="0"', 'vz-hitbox': 'fill="#000000" fill-opacity="0"',
    'vz-spoke-label': 'font-size="11" fill="' + INK + '"', 'vz-ring-label': 'font-size="9.5" fill="' + MUTED + '"',
    'vz-gridline': 'stroke="' + GRID + '" stroke-width="1"', 'vz-gridline base': 'stroke="' + AXIS + '" stroke-width="1"',
    'vz-tick': 'font-size="10" fill="' + MUTED + '"', 'vz-tick small': 'font-size="8.5" fill="' + MUTED + '"',
    'vz-col pos': 'fill="' + POS + '"', 'vz-col neg': 'fill="' + NEG + '"', 'vz-col zero': 'fill="' + MUTED + '"', 'vz-col other': 'fill="#ffffff" stroke="' + MUTED + '" stroke-width="1.2"',
    'vz-missing': 'fill="#ffffff" stroke="' + MUTED + '" stroke-width="1.3"', 'vz-mean': 'stroke="' + INK + '" stroke-width="2" stroke-linecap="round"',
    'vz-group-label': 'font-size="11" fill="' + INK + '"', 'vz-group-value': 'font-size="10.5" fill="' + MUTED + '"', 'vz-group-sep': 'stroke="' + GRID + '" stroke-width="1"',
    'vz-cap': 'font-size="10.5" fill="' + INK + '"', 'vz-row-label': 'font-size="11" fill="' + INK + '"',
    'vz-link': 'stroke="' + POINT + '" stroke-width="2.5" opacity="0.45" stroke-linecap="round"', 'vz-a': 'fill="' + POINT + '" stroke="#ffffff" stroke-width="2"', 'vz-b': 'fill="#ffffff" stroke="' + POINT + '" stroke-width="2"',
    'vz-diff': 'font-size="11.5" font-weight="600" fill="' + INK + '"',
    'vz-s-bg': 'fill="#f6f7f9"', 'vz-s-title': 'font-size="20" font-weight="700" fill="' + INK + '"', 'vz-s-sub': 'font-size="11.5" fill="' + MUTED + '"', 'vz-s-meta': 'font-size="10.5" fill="' + MUTED + '"',
    'vz-s-head': 'font-size="12.5" font-weight="700" fill="' + INK + '"', 'vz-s-theme': 'font-size="12" font-weight="700" fill="' + MUTED + '"', 'vz-s-rule': 'stroke="#d5dce6" stroke-width="1"',
    'vz-s-pole': 'font-size="11" fill="' + INK + '"', 'vz-s-facet': 'font-size="10" fill="' + MUTED + '"', 'vz-s-facet strong': 'font-size="11" font-weight="600" fill="' + INK + '"',
    'vz-s-seg neg': 'fill="' + NEG + '"', 'vz-s-seg pos': 'fill="' + POS + '"', 'vz-s-seg neu': 'fill="' + NEU + '"', 'vz-s-seg mis': 'fill="#f6f7f9" stroke="' + AXIS + '" stroke-width="1"',
    'vz-s-pct neg': 'font-size="10.5" font-weight="600" fill="#ffffff"', 'vz-s-pct pos': 'font-size="10.5" font-weight="600" fill="#ffffff"', 'vz-s-pct neu': 'font-size="10.5" font-weight="600" fill="#1d232c"', 'vz-s-pct mis': 'font-size="10.5" font-weight="600" fill="' + MUTED + '"',
    'vz-s-disc off': 'fill="#ffffff" stroke="' + AXIS + '" stroke-width="1"', 'vz-s-disc pos': 'fill="' + POS + '"', 'vz-s-disc neg': 'fill="' + NEG + '"', 'vz-badge-disc pos': 'fill="' + POS + '"', 'vz-badge-disc neg': 'fill="' + NEG + '"',
    'vz-s-ring pos': 'fill="none" stroke="' + POS + '" stroke-width="1.6"', 'vz-s-ring neg': 'fill="none" stroke="' + NEG + '" stroke-width="1.6"',
    'vz-icon': 'stroke="' + MUTED + '"', 'vz-icon on': 'stroke="#ffffff"', 'vz-badge-name': 'font-weight="700" fill="' + INK + '"', 'vz-badge-sub': 'font-size="10.5" fill="' + MUTED + '"', 'vz-s-note': 'font-size="10.5" fill="' + MUTED + '"'
  };
  for (const r of Object.keys(RAMP)) PAINT['vz-col ' + r] = 'fill="' + RAMP[r] + '"';
  // Add the attributes right after class="…"; skipped when they are already there, so calling twice is harmless.
  function paint(svg) {
    return svg.replace(/<(rect|circle|line|polygon|path|text|tspan|g) class="([^"]+)"/g, (m, tag, cls, offset, all) => {
      const attrs = PAINT[cls] || PAINT[cls.split(' ')[0]];
      return !attrs || all.startsWith(' ' + attrs, offset + m.length) ? m : m + ' ' + attrs;
    });
  }
  // HTML chart parts get the same treatment as inline styles; colours go through the theme variables with the
  // light values as fallbacks, so dark mode still works when the stylesheet is present.
  const v = (name, fallback) => 'var(--' + name + ',' + fallback + ')';
  const BOX = {
    'vz-track': 'position:relative;height:24px', 'vz-track compact': 'position:relative;height:24px',
    'vz-trackbg': 'position:absolute;left:0;right:0;top:3px;height:12px;border-radius:3px;background:' + v('vz-track', '#f1f3f6'),
    'vz-grid': 'position:absolute;top:0;bottom:4px;width:1px;background:' + v('vz-grid', GRID), 'vz-grid mid': 'position:absolute;top:0;bottom:4px;width:1px;background:' + v('vz-axis', AXIS),
    'vz-grid mid sup': 'position:absolute;top:-3px;bottom:-3px;width:1px;background:' + v('vz-axis', AXIS),
    'vz-bar pos': 'position:absolute;top:3px;height:12px;border-radius:0 4px 4px 0;background:' + v('vz-pos', POS), 'vz-bar neg': 'position:absolute;top:3px;height:12px;border-radius:4px 0 0 4px;background:' + v('vz-neg', NEG),
    'vz-bar-zero': 'position:absolute;left:50%;top:1px;width:3px;height:16px;margin-left:-1.5px;border-radius:2px;background:' + v('vz-ink', INK),
    'vz-range': 'position:absolute;top:19px;height:2px;border-radius:1px;opacity:.55;background:' + v('vz-ink', INK), 'vz-range only': 'position:absolute;top:8px;height:2px;border-radius:1px;opacity:.55;background:' + v('vz-ink', INK),
    'vz-sup-track': 'position:relative;height:18px;border-radius:3px;background:' + v('vz-track', '#f1f3f6'),
    'vz-scale': 'position:relative;height:18px', 'vz-scaleline': 'position:absolute;left:0;right:0;top:8px;height:2px;border-radius:1px;background:' + v('vz-grid', GRID),
    'vz-tick-i': 'position:absolute;top:5px;width:1px;height:8px;background:' + v('vz-axis', AXIS), 'vz-tick-i mid': 'position:absolute;top:3px;width:1px;height:12px;background:' + v('vz-muted', MUTED),
    'vz-dot-h pos': 'position:absolute;top:3px;width:12px;height:12px;margin-left:-6px;border-radius:50%;box-shadow:0 0 0 2px ' + v('raised', '#eef2f7') + ';background:' + v('vz-pos', POS),
    'vz-dot-h neg': 'position:absolute;top:3px;width:12px;height:12px;margin-left:-6px;border-radius:50%;box-shadow:0 0 0 2px ' + v('raised', '#eef2f7') + ';background:' + v('vz-neg', NEG),
    'vz-dot-h zero': 'position:absolute;top:3px;width:12px;height:12px;margin-left:-6px;border-radius:50%;box-shadow:0 0 0 2px ' + v('raised', '#eef2f7') + ';background:' + v('vz-muted', MUTED),
    'vz-steps': 'display:inline-flex;gap:3px', 'vz-step': 'display:inline-block;width:18px;height:8px;border-radius:2px;background:' + v('vz-grid', GRID), 'vz-step on': 'display:inline-block;width:18px;height:8px;border-radius:2px;background:' + v('vz-point', POINT),
    'vz-qbar': 'display:flex;gap:2px;height:28px', 'vz-legend': 'display:flex;flex-wrap:wrap;gap:6px 16px',
    'vz-row-head': 'display:flex;justify-content:space-between;gap:10px', 'vz-row-poles': 'display:flex;justify-content:space-between;gap:12px',
    'vz-qseg valid': 'display:flex;align-items:center;min-width:4px;padding-left:7px;border-radius:4px;background:' + v('vz-point', POINT),
    'vz-qseg neutral': 'display:flex;align-items:center;min-width:4px;padding-left:7px;border-radius:4px;background:' + v('vz-neu', NEU),
    'vz-qseg unknown': 'display:flex;align-items:center;min-width:4px;padding-left:7px;border-radius:4px;background:' + v('vz-q-unknown', '#a9b4c6'),
    'vz-qseg refused': 'display:flex;align-items:center;min-width:4px;padding-left:7px;border-radius:4px;background:' + v('vz-q-refused', '#d3d9e3'),
    'vz-qseg missing': 'display:flex;align-items:center;min-width:4px;padding-left:7px;border-radius:4px;background:transparent;box-shadow:inset 0 0 0 1px ' + v('vz-axis', AXIS),
    'vz-qlabel valid': 'font-size:.76rem;font-weight:600;white-space:nowrap;color:' + v('vz-on-point', '#ffffff'), 'vz-qlabel': 'font-size:.76rem;font-weight:600;white-space:nowrap;color:' + v('vz-on-neu', '#1d232c')
  };
  const KEY = 'display:inline-block;width:12px;height:10px;border-radius:2px;margin-right:6px;flex:none;vertical-align:middle;';
  const KEYS = { neg: v('vz-neg', NEG), pos: v('vz-pos', POS), neu: v('vz-neu', NEU), neutral: v('vz-neu', NEU), band: v('vz-band', 'rgba(125,136,152,.2)'), valid: v('vz-point', POINT), unknown: v('vz-q-unknown', '#a9b4c6'), refused: v('vz-q-refused', '#d3d9e3') };
  for (const r of Object.keys(RAMP)) { KEYS[r] = v('vz-' + r, RAMP[r]); BOX['vz-seg ' + r] = 'position:absolute;top:0;height:18px;box-shadow:inset 1px 0 0 ' + v('surface', '#ffffff') + ',inset -1px 0 0 ' + v('surface', '#ffffff') + ';background:' + v('vz-' + r, RAMP[r]); }
  for (const k of Object.keys(KEYS)) BOX['vz-key ' + k] = KEY + 'background:' + KEYS[k];
  BOX['vz-key range'] = KEY + 'width:14px;height:2px;border-radius:1px;opacity:.6;background:' + v('vz-ink', INK);
  BOX['vz-key mean'] = KEY + 'width:14px;height:2px;border-radius:1px;background:' + v('vz-ink', INK);
  BOX['vz-key missing'] = KEY + 'width:9px;height:9px;border-radius:50%;box-sizing:border-box;border:1.5px solid ' + v('vz-muted', MUTED);
  BOX['vz-key a'] = KEY + 'width:10px;height:10px;border-radius:50%;background:' + v('vz-point', POINT);
  BOX['vz-key b'] = KEY + 'width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:2px solid ' + v('vz-point', POINT);
  function box(html) {
    return html.replace(/<(span|div|i|b|p) class="([^"]+)"(?: style="([^"]*)")?/g, (m, tag, cls, style) => {
      const base = BOX[cls];
      if (!base || (style && style.includes(base))) return m;
      return '<' + tag + ' class="' + cls + '" style="' + base + (style ? ';' + style : '') + '"';
    });
  }

  // Share of the six answers leaning to each end, neutral, or missing. Each valid answer y (oriented 1–7)
  // gives (y−4)/3 to one end and 1−|y−4|/3 to neutral; missing answers count as missing.
  // Hence 100·(pos−neg−missing) and 100·(pos−neg+missing) equal the report's missing-answer bounds.
  function shares(facet) {
    const items = facet.items || [];
    const total = items.length || 6;
    let pos = 0, neg = 0, neu = 0, valid = 0;
    for (const item of items) {
      if (item.oriented == null) continue;
      valid++;
      const d = (item.oriented - 4) / 3;
      if (d > 0) pos += d; else neg -= d;
      neu += 1 - Math.abs(d);
    }
    const raw = { neg: neg / total, neu: neu / total, mis: (total - valid) / total, pos: pos / total };
    const keys = ['neg', 'neu', 'mis', 'pos'];
    const scaled = keys.map(k => raw[k] * 100), floors = scaled.map(Math.floor);
    let rest = 100 - floors.reduce((a, b) => a + b, 0);
    const order = scaled.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let i = 0; rest > 0 && i < order.length; i++, rest--) floors[order[i][1]]++;
    const pct = {}; keys.forEach((k, i) => { pct[k] = floors[i]; });
    return { raw, pct, valid, total };
  }
  function marked(facets) {
    return facets.filter(f => f.value != null && Math.abs(f.value) >= MARKED && (f.value > 0 ? f.bounds[0] > 0 : f.bounds[1] < 0))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || 0).slice(0, 6);
  }
  function facetTip(f) {
    return f.name + '：' + (f.value == null ? '有效题不足 5 项，不报告分值' : signed(f.value) + '（已答均分 ' + Number(f.mean).toFixed(1) + '）') +
      '\n有效 ' + f.valid + '/6 · 缺答范围 ' + signed(f.bounds[0]) + ' ～ ' + signed(f.bounds[1]) +
      '\n' + MINUS + '100 ' + f.negative + '  ↔  +100 ' + f.positive;
  }

  // ---------------------------------------------------------------- icons (24×24, stroked)
  const ICONS = {
    'OWN-': '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2V8M3 13.5h18M11 13.5v2h2v-2"/>',
    'OWN+': '<circle cx="12" cy="7" r="2.6"/><circle cx="5.5" cy="9.5" r="2"/><circle cx="18.5" cy="9.5" r="2"/><path d="M7 20v-3.2a5 5 0 0 1 10 0V20M2 19v-1.8a3.5 3.5 0 0 1 4.6-3.3M22 19v-1.8a3.5 3.5 0 0 0-4.6-3.3"/>',
    'ALLOC-': '<path d="M3 12.6V4.2A1.2 1.2 0 0 1 4.2 3h8.4L21 11.4a1.2 1.2 0 0 1 0 1.7l-7.9 7.9a1.2 1.2 0 0 1-1.7 0z"/><circle cx="7.8" cy="7.8" r="1.6"/>',
    'ALLOC+': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9.5 2.5h5v3h-5zM8.5 11l1.5 1.5 2.5-3M14.5 11.5h2M8.5 16.5l1.5 1.5 2.5-3M14.5 17h2"/>',
    'RED-': '<path d="M3 20.5h18"/><rect x="4.5" y="15.5" width="3" height="5"/><rect x="10.5" y="10.5" width="3" height="10"/><rect x="16.5" y="4" width="3" height="16.5"/>',
    'RED+': '<path d="M3 12a9 9 0 0 1 18 0zM12 12v6.5a2 2 0 0 1-4 0M12 3V2"/>',
    'LAB-': '<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21M18 12v3.5M15 12v2.5"/>',
    'LAB+': '<circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="3.8" r="1.8"/><circle cx="20.2" cy="12" r="1.8"/><circle cx="12" cy="20.2" r="1.8"/><circle cx="3.8" cy="12" r="1.8"/><path d="M12 5.6v2.8M18.4 12h-2.8M12 18.4v-2.8M5.6 12h2.8"/>',
    'CIV-': '<path d="M5 21V7.5M19 21V7.5"/><rect x="2.5" y="9" width="19" height="4.5" rx="1"/><path d="M7.5 9l-2.6 4.5M12.6 9 10 13.5M17.7 9l-2.6 4.5"/>',
    'CIV+': '<path d="M12 3l7.5 3v5.6c0 4.6-3.2 8.2-7.5 9.4-4.3-1.2-7.5-4.8-7.5-9.4V6z"/><path d="M8.6 12.1l2.3 2.3 4.4-4.6"/>',
    'DEM-': '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/>',
    'DEM+': '<path d="M4 11h4M16 11h4M4 11v9.5h16V11"/><rect x="8.5" y="3" width="7" height="10" rx="1"/><path d="M10.3 8l1.3 1.3 2.2-2.6M3 20.5h18"/>',
    'ORG-': '<circle cx="5.5" cy="6" r="2"/><circle cx="18.5" cy="5.5" r="2"/><circle cx="12" cy="12.5" r="2"/><circle cx="5" cy="18.5" r="2"/><circle cx="19" cy="18.5" r="2"/><path d="M7.2 7.2l3.2 3.8M16.8 6.9l-3.3 4M6.7 17.3l3.6-3.2M17.3 17.3l-3.6-3.2M7.5 6l9-.4M5.3 8v8.5M18.9 7.5v9"/>',
    'ORG+': '<path d="M3.5 20.5h17L12 9.5z"/><path d="M12 9.5V3M12 3.2h6l-1.6 1.9 1.6 1.9h-6"/><path d="M8.3 15.6h7.4"/>',
    'DEC-': '<circle cx="12" cy="12" r="2.6"/><path d="M3.5 3.5l5.3 5.3M20.5 3.5l-5.3 5.3M3.5 20.5l5.3-5.3M20.5 20.5l-5.3-5.3"/><path d="M8.8 5.3v3.5H5.3M15.2 5.3v3.5h3.5M8.8 18.7v-3.5H5.3M15.2 18.7v-3.5h3.5"/>',
    'DEC+': '<path d="M6.5 11.5S3.5 8.6 3.5 6.5a3 3 0 0 1 6 0c0 2.1-3 5-3 5zM17.5 10S14.5 7.1 14.5 5a3 3 0 0 1 6 0c0 2.1-3 5-3 5zM12 21s-3-2.9-3-5a3 3 0 0 1 6 0c0 2.1-3 5-3 5z"/><circle cx="6.5" cy="6.5" r=".9"/><circle cx="17.5" cy="5" r=".9"/><circle cx="12" cy="16" r=".9"/>',
    'CHANGE-': '<path d="M3 20.5h4v-4h4v-4h4v-4h4v-4h2"/><path d="M16.5 3.5h4.5V8"/>',
    'CHANGE+': '<path d="M13.5 2.5 5 13.5h6.2l-1.4 8 8.7-11.4h-6.3z"/>',
    'MEANS-': '<circle cx="10.5" cy="13.5" r="7.5"/><circle cx="10.5" cy="13.5" r="3.8"/><circle cx="10.5" cy="13.5" r=".9"/><path d="M10.5 13.5l9-9M16 4.5h3.5V8"/>',
    'MEANS+': '<path d="M12 3.5v16.5M8 20.5h8M5 7h14"/><path d="M5 7l-2.6 6.2a2.6 2.6 0 0 0 5.2 0zM19 7l-2.6 6.2a2.6 2.6 0 0 0 5.2 0z"/>',
    'COMM-': '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
    'COMM+': '<path d="M3 11.5 12 4l9 7.5"/><circle cx="9" cy="13.5" r="1.9"/><circle cx="15" cy="13.5" r="1.9"/><path d="M5.6 20.5a3.4 3.4 0 0 1 6.8 0M11.6 20.5a3.4 3.4 0 0 1 6.8 0"/>',
    'POP-': '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M10.8 7.1 6.2 15.9M13.2 7.1l4.6 8.8M7.4 18h9.2"/>',
    'POP+': '<path d="M3 9.8v4.4h3.2l8.3 5V4.8L6.2 9.8zM6.2 14.2l1.3 5.3h2.3l-.9-4.6"/><path d="M17.5 9.3a3.6 3.6 0 0 1 0 5.4M19.8 6.8a7.2 7.2 0 0 1 0 10.4"/>',
    'CULT-': '<path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v14.5H7a2.5 2.5 0 0 0-2.5 2.5z"/><path d="M4.5 20A2.5 2.5 0 0 0 7 22.5h12.5v-5M9 7.5h6.5M9 11h4.5"/>',
    'CULT+': '<path d="M19.6 10.2A7.8 7.8 0 0 0 5.7 6.5L4 8.4M4 3.6v4.8h4.8M4.4 13.8a7.8 7.8 0 0 0 13.9 3.7l1.7-1.9M20 20.4v-4.8h-4.8"/>',
    'GENDER-': '<circle cx="6.5" cy="6" r="2.2"/><circle cx="17.5" cy="6" r="2.2"/><path d="M4 20.5v-6.2a2.5 2.5 0 0 1 5 0v6.2M15 20.5v-6.2a2.5 2.5 0 0 1 5 0v6.2M12 2.5v19"/>',
    'GENDER+': '<circle cx="5.5" cy="6" r="2.2"/><circle cx="18.5" cy="6" r="2.2"/><path d="M3 20.5v-6.2a2.5 2.5 0 0 1 5 0v6.2M16 20.5v-6.2a2.5 2.5 0 0 1 5 0v6.2M10 11.3h4M10 14.7h4"/>',
    'REL-': '<path d="M12 8.2C10 6.8 7 6.3 3.5 6.7v11.6c3.5-.4 6.5.1 8.5 1.5 2-1.4 5-1.9 8.5-1.5V6.7C17 6.3 14 6.8 12 8.2zM12 8.2v11.6"/><path d="M12 2v2.2M7.5 3l.9 1.7M16.5 3l-.9 1.7"/>',
    'REL+': '<path d="M3 9 12 4l9 5zM3.5 20.5h17M5 18h14"/><path d="M6.5 11v7M10 11v7M14 11v7M17.5 11v7"/>',
    'NAT-': '<path d="M5 21.5V3"/><path d="M5 4h12.5l-2.6 3.6 2.6 3.6H5"/>',
    'NAT+': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9c-2.6-2.4-3.9-5.4-3.9-9S9.4 5.4 12 3zM4.6 7.5h14.8M4.6 16.5h14.8"/>',
    'MEM-': '<path d="M2.5 11h19M2.5 16.5h19"/><path d="M5 21V7.5l1.5-2 1.5 2V21M11.25 21V7l1.5-2 1.5 2v14M16 21V7.5l1.5-2 1.5 2V21"/>',
    'MEM+': '<path d="M3 21h18M5.5 21V4h10v17"/><path d="M15.5 4l3.5 1.8v16.4"/><path d="M9 12.5h3M12 12.5l-1.3-1.3M12 12.5l-1.3 1.3"/>',
    'INT-': '<path d="M6 21V9.5h12V21M4.5 21h15"/><path d="M6 9.5V5h2.5v2H11V5h2v2h2.5V5H18v4.5"/><path d="M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21"/>',
    'INT+': '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
    'FORCE-': '<path d="M14.5 3.5h6v6L10 20l-6-6z"/><path d="M8 13l3 3M4 20l2-2"/><path d="M3 3l18 18"/>',
    'FORCE+': '<path d="M12 2.5l2 3v10.5h-4V5.5z"/><path d="M7.5 16h9M12 16v4"/><circle cx="12" cy="21.2" r="1"/>',
    'ECO-': '<path d="M3.5 3.5v17h17"/><path d="M6.5 16l4-4.5 3 3 6-6.5"/><path d="M15.5 7.8h4v4"/>',
    'ECO+': '<path d="M5 19.5c0-8.6 5.4-14 15-15 0 9.6-5.4 15-14 15zM5 19.5l8.6-8.6"/>',
    'TECH-': '<path d="M9 3h6M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.3 15h9.4"/>',
    'TECH+': '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 9.5v5"/><circle cx="12" cy="17.2" r=".9"/>',
    'EVID-': '<circle cx="12" cy="5" r="2.1"/><path d="M12 7.1v14M8 11h8"/><path d="M4.5 14a7.5 7.5 0 0 0 15 0M3 15.6 4.5 14l1.8 1.3M21 15.6 19.5 14l-1.8 1.3"/>',
    'EVID+': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3 21 21"/><path d="M13.2 9.4a2.9 2.9 0 0 0-5.1-.9M7.8 11.6a2.9 2.9 0 0 0 5.1.9"/><path d="M8.1 6.9v1.7h1.7M12.9 14.1v-1.7h-1.7"/>'
  };
  const FALLBACK_ICON = { '-': '<path d="M15 6l-6 6 6 6"/>', '+': '<path d="M9 6l6 6-6 6"/>' };
  function icon(id, end, x, y, size, cls) {
    const scale = size / 24;
    return '<g class="' + (cls || 'vz-icon') + '" transform="translate(' + num(x - size / 2) + ' ' + num(y - size / 2) + ') scale(' + num(scale) + ')" fill="none" stroke-width="' + num(1.8 / Math.max(scale, 0.6)) + '" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[id + end] || FALLBACK_ICON[end]) + '</g>';
  }

  // ---------------------------------------------------------------- diverging bars (HTML)
  function track(f, compact) {
    const v = f.value, lo = f.bounds[0], hi = f.bounds[1];
    const at = x => (x + 100) / 2;
    let bar = '';
    if (v != null && v !== 0) bar = '<span class="vz-bar ' + (v > 0 ? 'pos' : 'neg') + '" style="left:' + pc(v > 0 ? 50 : at(v)) + ';width:' + pc(Math.abs(v) / 2) + '"></span>';
    else if (v === 0) bar = '<span class="vz-bar-zero"></span>';
    // No missing answers means the range collapses onto the value; draw it only when it has width.
    const range = hi > lo ? '<span class="vz-range' + (v == null ? ' only' : '') + '" style="left:' + pc(at(lo)) + ';width:' + pc((hi - lo) / 2) + '"></span>' : '';
    return box('<div class="vz-track' + (compact ? ' compact' : '') + '"><span class="vz-trackbg"></span><span class="vz-grid" style="left:25%"></span><span class="vz-grid mid" style="left:50%"></span><span class="vz-grid" style="left:75%"></span>' + bar + range + '</div>');
  }
  function divergingRow(f) {
    return box('<div class="vz-row" data-tip="' + esc(facetTip(f)) + '"><div class="vz-row-head"><span class="vz-row-name">' + esc(f.name) + '</span><span class="vz-row-val">' + (f.value == null ? '信息不足' : esc(signed(f.value))) + '</span></div>' + track(f) + '<div class="vz-row-poles"><span>' + esc(f.negative) + '</span><span>' + esc(f.positive) + '</span></div></div>');
  }
  function overview(result) {
    const groups = themes(result.facets);
    return '<figure class="vz-figure vz-overview"><figcaption><strong>各维度方向一览</strong><span class="muted">每个主题一张发散条形图：条形从中线伸向更接近的一端，长度为分值（' + MINUS + '100～+100）；下方细线是缺答可能范围，不是置信区间。</span></figcaption><div class="vz-graphic"><div class="vz-themes">' +
      groups.map(t => '<section class="vz-theme" aria-label="' + esc(t.name) + '"><h3>' + esc(t.name) + '</h3>' + t.facets.map(divergingRow).join('') + '</section>').join('') +
      '</div></div>' + legend([['neg', '偏向左端（' + MINUS + '）'], ['pos', '偏向右端（+）'], ['range', '缺答可能范围']]) + '</figure>';
  }
  function legend(items) {
    return box('<p class="vz-legend">' + items.map(([cls, text]) => '<span><i class="vz-key ' + cls + '"></i>' + esc(text) + '</span>').join('') + '</p>');
  }

  // ---------------------------------------------------------------- 3D compass (SVG)
  const VIEWS = { default: { yaw: -0.62, pitch: 0.36 }, front: { yaw: 0, pitch: 0 }, top: { yaw: 0, pitch: Math.PI / 2 - 0.0001 }, side: { yaw: -Math.PI / 2 + 0.0001, pitch: 0 } };
  const GEO = { w: 460, h: 380, cx: 230, cy: 192, R: 104, D: 5.2 };
  function compassModel(result, axes) {
    const facets = {};
    for (const f of result.facets) facets[f.id] = { n: f.name, s: short(f), neg: f.negative, pos: f.positive, v: f.value, lo: f.bounds[0], hi: f.bounds[1], sec: f.section || '', valid: f.valid };
    const pick = (axes || DEFAULT_AXES).filter(id => facets[id]);
    const ids = Object.keys(facets);
    while (pick.length < 3) pick.push(ids.find(id => !pick.includes(id)));
    return { axes: pick.slice(0, 3), facets, order: ids };
  }
  function project(p, view) {
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
    const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp;
    const s = GEO.D / (GEO.D - z2);
    return { x: GEO.cx + GEO.R * x1 * s, y: GEO.cy - GEO.R * y2 * s, z: z2, s };
  }
  const pts = list => list.map(p => num(p.x) + ',' + num(p.y)).join(' ');
  function compassSVG(model, view, small) {
    view = view || VIEWS.default;
    // On narrow screens the SVG is scaled down, so labels get a larger font and shorter lines.
    const lh = small ? 17 : 13, maxChars = small ? 5 : 7;
    const [ax, ay, az] = model.axes.map(id => model.facets[id]);
    const sy = Math.sin(view.yaw), cy = Math.cos(view.yaw), sp = Math.sin(view.pitch);
    const back = [sy >= 0 ? 1 : -1, sp >= 0 ? -1 : 1, cy >= 0 ? -1 : 1];
    const P = p => project(p, view);
    const out = [];
    // three back panes with a light grid, so the point's shadows read as three 2-D views
    for (let k = 0; k < 3; k++) {
      const s = back[k], u = (k + 1) % 3, w = (k + 2) % 3;
      const corner = (a, b) => { const p = [0, 0, 0]; p[k] = s; p[u] = a; p[w] = b; return P(p); };
      out.push('<polygon class="vz-pane" points="' + pts([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]) + '"/>');
      for (const g of [-0.5, 0, 0.5]) {
        const a1 = corner(g, -1), a2 = corner(g, 1), b1 = corner(-1, g), b2 = corner(1, g);
        out.push('<line class="vz-pane-grid' + (g === 0 ? ' zero' : '') + '" x1="' + num(a1.x) + '" y1="' + num(a1.y) + '" x2="' + num(a2.x) + '" y2="' + num(a2.y) + '"/>');
        out.push('<line class="vz-pane-grid' + (g === 0 ? ' zero' : '') + '" x1="' + num(b1.x) + '" y1="' + num(b1.y) + '" x2="' + num(b2.x) + '" y2="' + num(b2.y) + '"/>');
      }
    }
    const values = [ax.v, ay.v, az.v];
    const point = values.every(v => v != null) ? values.map(v => v / 100) : null;
    const lo = [ax.lo, ay.lo, az.lo].map(v => v / 100), hi = [ax.hi, ay.hi, az.hi].map(v => v / 100);
    if (point) {
      for (let k = 0; k < 3; k++) {
        const q = point.slice(); q[k] = back[k];
        const a = P(point), b = P(q);
        out.push('<line class="vz-drop" x1="' + num(a.x) + '" y1="' + num(a.y) + '" x2="' + num(b.x) + '" y2="' + num(b.y) + '"/><circle class="vz-shadow" cx="' + num(b.x) + '" cy="' + num(b.y) + '" r="3.2"/>');
      }
    }
    // axes through the centre, labelled with the pole names
    const letters = ['X', 'Y', 'Z'], facetsXYZ = [ax, ay, az];
    for (let k = 0; k < 3; k++) {
      const e = [0, 0, 0]; e[k] = 1; const n = [0, 0, 0]; n[k] = -1;
      const a = P(n), b = P(e);
      out.push('<line class="vz-axis" x1="' + num(a.x) + '" y1="' + num(a.y) + '" x2="' + num(b.x) + '" y2="' + num(b.y) + '"/>');
    }
    // range box: every corner the missing answers allow
    const spread = hi.some((h, i) => h - lo[i] > 0.001);
    if (spread) {
      const c = [];
      for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) c.push(P([[lo[0], hi[0]][i], [lo[1], hi[1]][j], [lo[2], hi[2]][k]]));
      const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      out.push('<g class="vz-box">' + edges.map(([i, j]) => '<line x1="' + num(c[i].x) + '" y1="' + num(c[i].y) + '" x2="' + num(c[j].x) + '" y2="' + num(c[j].y) + '"/>').join('') + '</g>');
    }
    for (let k = 0; k < 3; k++) {
      const e1 = [0, 0, 0], e2 = [0, 0, 0]; e1[k] = 1; e2[k] = -1;
      const a1 = P(e1), a2 = P(e2);
      // An axis seen end-on (preset views) would stack both labels on the centre; name it once instead.
      if (Math.hypot(a1.x - a2.x, a1.y - a2.y) < 40) { out.push('<text class="vz-note" x="' + (GEO.w - 8) + '" y="' + (GEO.h - 10) + '" text-anchor="end">' + letters[k] + ' 轴（' + esc(facetsXYZ[k].n) + '）垂直于屏幕</text>'); continue; }
      for (const end of [-1, 1]) {
        const p = [0, 0, 0]; p[k] = end * 1.13;
        const q = P(p), dx = q.x - GEO.cx, dy = q.y - GEO.cy;
        const f = facetsXYZ[k], name = end > 0 ? f.pos : f.neg;
        const lines = wrap(name, maxChars);
        let anchor = 'middle', x = q.x, y = q.y;
        if (dx > 14) { anchor = 'start'; x += 4; } else if (dx < -14) { anchor = 'end'; x -= 4; }
        if (Math.abs(dx) <= 14) y += dy > 0 ? lh - 1 : -6 - (lines.length - 1) * lh;
        else y += 4 - (lines.length - 1) * lh / 2;
        out.push('<text class="vz-axis-label" x="' + num(x) + '" y="' + num(y) + '" text-anchor="' + anchor + '"><tspan class="vz-axis-tag">' + letters[k] + (end > 0 ? '+' : MINUS) + '</tspan> ' + esc(lines[0]) + '</text>' + (lines[1] ? '<text class="vz-axis-label" x="' + num(x) + '" y="' + num(y + lh) + '" text-anchor="' + anchor + '">' + esc(lines[1]) + '</text>' : ''));
      }
    }
    if (point) {
      const q = P(point);
      out.push('<circle class="vz-point-halo" cx="' + num(q.x) + '" cy="' + num(q.y) + '" r="' + num(12 * q.s) + '"/><circle class="vz-point" cx="' + num(q.x) + '" cy="' + num(q.y) + '" r="' + num(6 * q.s) + '" data-tip="' + esc('你的位置\nX ' + ax.n + ' ' + signed(ax.v) + '\nY ' + ay.n + ' ' + signed(ay.v) + '\nZ ' + az.n + ' ' + signed(az.v)) + '"/><text class="vz-point-label" x="' + num(q.x + 9 * q.s) + '" y="' + num(q.y - 9 * q.s) + '">你</text>');
    } else {
      out.push('<text class="vz-note" x="' + GEO.cx + '" y="' + (GEO.h - 10) + '" text-anchor="middle">所选分面有效题不足 5 项，只显示缺答可能范围</text>');
    }
    return paint(out.join(''));
  }
  function compassLabel(model) {
    return '三维罗盘：' + model.axes.map((id, k) => { const f = model.facets[id]; return 'XYZ'[k] + ' 轴 ' + f.n + ' ' + (f.v == null ? '信息不足' : signed(f.v)) + '（' + MINUS + f.neg + '，+' + f.pos + '）'; }).join('；');
  }
  function compassTable(model) {
    return '<table class="vz-mini-table"><thead><tr><th scope="col">轴</th><th scope="col">分面与两端</th><th scope="col">分值</th><th scope="col">缺答范围</th></tr></thead><tbody>' + model.axes.map((id, k) => {
      const f = model.facets[id];
      return '<tr><td>' + 'XYZ'[k] + '</td><td>' + esc(f.n) + '<small>' + MINUS + ' ' + esc(f.neg) + ' ／ + ' + esc(f.pos) + '</small></td><td>' + (f.v == null ? '信息不足' : esc(signed(f.v))) + '</td><td>' + esc(signed(f.lo)) + '～' + esc(signed(f.hi)) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function compass(result) {
    const model = compassModel(result);
    const options = sel => themes(result.facets).map(t => '<optgroup label="' + esc(t.name) + '">' + t.facets.map(f => '<option value="' + esc(f.id) + '"' + (f.id === sel ? ' selected' : '') + '>' + esc(f.name) + (f.value == null ? '（信息不足）' : '') + '</option>').join('') + '</optgroup>').join('');
    return '<figure class="vz-figure vz-compass" data-viz="compass" data-model="' + esc(JSON.stringify(model)) + '"><figcaption><strong>三维罗盘</strong><span class="muted">以三个分面的分值为坐标（' + MINUS + '100～+100）。默认三轴为所有权目标、公民自由与社会习俗，可改选任意三个分面；墙面上的小点是位置在三个平面上的投影，细线方框是缺答可能范围。</span></figcaption>' +
      '<div class="vz-compass-body"><div class="vz-graphic vz-compass-stage"><svg class="vz-svg vz-compass-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + GEO.w + ' ' + GEO.h + '" role="img" tabindex="0" aria-label="' + esc(compassLabel(model)) + '" font-family="' + esc(FONT) + '">' + compassSVG(model) + '</svg></div>' +
      '<div class="vz-compass-panel"><div class="vz-controls vz-axis-pick">' + model.axes.map((id, k) => '<label><span>' + 'XYZ'[k] + ' 轴</span><select class="input" data-axis="' + k + '">' + options(id) + '</select></label>').join('') + '</div>' +
      '<div class="vz-compass-table">' + compassTable(model) + '</div>' +
      '<div class="vz-controls vz-view-buttons"><button type="button" class="btn small" data-view="default">默认视角</button><button type="button" class="btn small" data-view="front">正视 X–Y</button><button type="button" class="btn small" data-view="top">俯视 X–Z</button><button type="button" class="btn small" data-view="side">侧视 Z–Y</button><button type="button" class="btn small" data-export="compass">保存图片</button></div>' +
      '<p class="vz-controls muted vz-hint">拖动图形或聚焦后用方向键旋转；手机上左右滑动旋转。</p></div></div></figure>';
  }

  // ---------------------------------------------------------------- radar (SVG)
  function radar(facets, o) {
    const n = facets.length, R = o.R, cx = o.cx, cy = o.cy;
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
    const rad = v => R * (v + 100) / 200;
    const at = (i, v) => [cx + rad(v) * Math.cos(ang(i)), cy + rad(v) * Math.sin(ang(i))];
    const poly = list => list.map(p => num(p[0]) + ',' + num(p[1])).join(' ');
    const out = [];
    if (o.sectors) {
      // Themes are marked by boundary lines that run past the rim and by circled numbers; no fills,
      // so the only shaded areas are the answer polygon and the missing-answer band.
      let i0 = 0;
      o.sectors.forEach((t, k) => {
        const i1 = i0 + t.facets.length;
        const a0 = -Math.PI / 2 + (i0 - 0.5) * 2 * Math.PI / n, a1 = -Math.PI / 2 + (i1 - 0.5) * 2 * Math.PI / n;
        const r2 = R + 8;
        out.push('<line class="vz-sector-line" x1="' + num(cx) + '" y1="' + num(cy) + '" x2="' + num(cx + r2 * Math.cos(a0)) + '" y2="' + num(cy + r2 * Math.sin(a0)) + '"/>');
        const am = (a0 + a1) / 2, pr = R + (o.sectorLabelGap || 40);
        out.push('<text class="vz-sector-no" x="' + num(cx + pr * Math.cos(am)) + '" y="' + num(cy + pr * Math.sin(am) + 4) + '" text-anchor="middle">' + '①②③④⑤⑥⑦⑧'[k] + '</text>');
        i0 = i1;
      });
    }
    for (const v of [-50, 0, 50, 100]) out.push('<polygon class="vz-web' + (v === 0 ? ' zero' : '') + '" points="' + poly(facets.map((f, i) => at(i, v))) + '"/>');
    facets.forEach((f, i) => { const p = at(i, 100); out.push('<line class="vz-spoke" x1="' + num(cx) + '" y1="' + num(cy) + '" x2="' + num(p[0]) + '" y2="' + num(p[1]) + '"/>'); });
    const ring = list => 'M' + list.map((p, i) => (i ? 'L' : '') + num(p[0]) + ' ' + num(p[1])).join('') + 'Z';
    const hi = facets.map((f, i) => at(i, f.bounds[1])), lo = facets.map((f, i) => at(i, f.bounds[0]));
    out.push('<path class="vz-band" fill-rule="evenodd" d="' + ring(hi) + ring(lo.slice().reverse()) + '"/>');
    const pts2 = facets.map((f, i) => f.value == null ? null : at(i, f.value));
    if (pts2.every(Boolean)) out.push('<polygon class="vz-area" points="' + poly(pts2) + '"/>');
    else for (let i = 0; i < n; i++) { const a = pts2[i], b = pts2[(i + 1) % n]; if (a && b && n > 2) out.push('<line class="vz-area-line" x1="' + num(a[0]) + '" y1="' + num(a[1]) + '" x2="' + num(b[0]) + '" y2="' + num(b[1]) + '"/>'); }
    facets.forEach((f, i) => {
      const a = ang(i), c = Math.cos(a), s = Math.sin(a), lr = R + (o.labelGap || 12);
      const lx = cx + lr * c, ly = cy + lr * s + 4 + (s > 0.6 ? 6 : s < -0.6 ? -3 : 0);
      out.push('<text class="vz-spoke-label" x="' + num(lx) + '" y="' + num(ly) + '" text-anchor="' + (c > 0.25 ? 'start' : c < -0.25 ? 'end' : 'middle') + '">' + esc(o.full ? f.name : short(f)) + '</text>');
      const p = pts2[i];
      if (p) out.push('<circle class="vz-dot ' + (f.value > 0 ? 'pos' : f.value < 0 ? 'neg' : 'zero') + '" cx="' + num(p[0]) + '" cy="' + num(p[1]) + '" r="4.2"/>');
      const hit = p || at(i, (f.bounds[0] + f.bounds[1]) / 2);
      out.push('<circle class="vz-hit" cx="' + num(hit[0]) + '" cy="' + num(hit[1]) + '" r="12" data-tip="' + esc(facetTip(f)) + '"/>');
    });
    if (o.ringLabels !== false) {
      const tl = at(0, 0), tt = at(0, 100);
      out.push('<text class="vz-ring-label" x="' + num(tl[0] + 4) + '" y="' + num(tl[1] - 3) + '">0</text><text class="vz-ring-label" x="' + num(tt[0] + 4) + '" y="' + num(tt[1] + 10) + '">+100</text>');
    }
    return '<svg class="vz-svg vz-radar" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + o.w + ' ' + o.h + '" role="img" aria-label="' + esc(o.label) + '" font-family="' + esc(FONT) + '">' + paint(out.join('')) + '</svg>';
  }
  function fullRadar(result) {
    const groups = themes(result.facets);
    const svg = radar(result.facets, { w: 460, h: 440, cx: 230, cy: 222, R: 142, labelGap: 12, sectorLabelGap: 62, sectors: groups, label: '22 个分面雷达图：越靠外越接近各分面“+”端，中心为“' + MINUS + '”端，带状阴影为缺答可能范围。' });
    return '<figure class="vz-figure vz-radar-full"><figcaption><strong>22 个分面雷达图</strong><span class="muted">越靠外越接近各分面的“+”端，中心是“' + MINUS + '”端，粗线圈为 0；灰色带为缺答可能范围。“+”端只是题目设定的方向，不代表更好或更激进。</span></figcaption><div class="vz-graphic">' + svg + '</div><ul class="vz-sector-legend" aria-label="扇区与主题（自顶部顺时针）">' + groups.map((t, k) => '<li><b>' + '①②③④⑤⑥⑦⑧'[k] + '</b> ' + esc(t.name) + '<small>' + t.facets.map(f => esc(short(f))).join('、') + '</small></li>').join('') + '</ul>' + legend([['neg', '分值为负'], ['pos', '分值为正'], ['band', '缺答可能范围']]) + '</figure>';
  }
  function themeRadar(theme) {
    return radar(theme.facets, { w: 250, h: 214, cx: 125, cy: 110, R: 70, labelGap: 10, ringLabels: false, label: theme.name + '雷达图：' + theme.facets.map(f => f.name + ' ' + (f.value == null ? '信息不足' : signed(f.value))).join('，') });
  }

  // ---------------------------------------------------------------- item-level score columns (SVG)
  function roundedBar(x, base, w, h, up, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return '';
    if (up) { const t = base - h; return 'M' + num(x) + ' ' + num(base) + 'V' + num(t + r) + 'Q' + num(x) + ' ' + num(t) + ' ' + num(x + r) + ' ' + num(t) + 'H' + num(x + w - r) + 'Q' + num(x + w) + ' ' + num(t) + ' ' + num(x + w) + ' ' + num(t + r) + 'V' + num(base) + 'Z'; }
    const b = base + h; return 'M' + num(x) + ' ' + num(base) + 'V' + num(b - r) + 'Q' + num(x) + ' ' + num(b) + ' ' + num(x + r) + ' ' + num(b) + 'H' + num(x + w - r) + 'Q' + num(x + w) + ' ' + num(b) + ' ' + num(x + w) + ' ' + num(b - r) + 'V' + num(base) + 'Z';
  }
  function itemColumns(theme) {
    const W = 440, H = 214, left = 30, right = 6, top = 14, step = 21, base = top + 3 * step + 4, plotW = W - left - right;
    const k = theme.facets.length, gw = plotW / k, out = [];
    for (let s = -3; s <= 3; s++) out.push('<line class="vz-gridline' + (s === 0 ? ' base' : '') + '" x1="' + left + '" x2="' + (W - right) + '" y1="' + num(base - s * step) + '" y2="' + num(base - s * step) + '"/>');
    out.push('<text class="vz-tick" x="' + (left - 6) + '" y="' + num(base - 3 * step + 4) + '" text-anchor="end">+3</text><text class="vz-tick" x="' + (left - 6) + '" y="' + num(base + 4) + '" text-anchor="end">0</text><text class="vz-tick" x="' + (left - 6) + '" y="' + num(base + 3 * step + 4) + '" text-anchor="end">' + MINUS + '3</text>');
    theme.facets.forEach((f, g) => {
      const x0 = left + g * gw, pad = 10, inner = gw - 2 * pad, bw = Math.min(12, inner / 6 - 3), gap = (inner - 6 * bw) / 5;
      f.items.forEach((item, i) => {
        const x = x0 + pad + i * (bw + gap), d = item.oriented == null ? null : item.oriented - 4;
        const keyed = item.sign === '-' ? '反向题' : '正向题';
        const tip = item.id + '（' + keyed + '）' + item.text + '\n原答 ' + answerText(item.answer) + (d == null ? '' : '；计分 ' + (d > 0 ? '+' : d < 0 ? MINUS : '') + Math.abs(d) + '（偏向' + (d > 0 ? '“' + f.positive + '”' : d < 0 ? '“' + f.negative + '”' : '中间') + '）');
        if (d == null) out.push('<circle class="vz-missing" cx="' + num(x + bw / 2) + '" cy="' + num(base) + '" r="3.6"/>');
        else if (d === 0) out.push('<rect class="vz-col zero" x="' + num(x) + '" y="' + num(base - 1.5) + '" width="' + num(bw) + '" height="3" rx="1"/>');
        else out.push('<path class="vz-col ' + (d > 0 ? 'pos' : 'neg') + '" d="' + roundedBar(x, base, bw, Math.abs(d) * step, d > 0, 3) + '"/>');
        out.push('<rect class="vz-hitbox" x="' + num(x - gap / 2) + '" y="' + top + '" width="' + num(bw + gap) + '" height="' + (6 * step + 8) + '" data-tip="' + esc(tip) + '"/>');
      });
      if (f.mean != null) {
        const y = base - (f.rawMean - 4) * step;
        out.push('<line class="vz-mean" x1="' + num(x0 + pad - 3) + '" x2="' + num(x0 + gw - pad + 3) + '" y1="' + num(y) + '" y2="' + num(y) + '"/>');
      }
      out.push('<text class="vz-group-label" x="' + num(x0 + gw / 2) + '" y="' + (H - 22) + '" text-anchor="middle">' + esc(short(f)) + '</text><text class="vz-group-value" x="' + num(x0 + gw / 2) + '" y="' + (H - 7) + '" text-anchor="middle">' + (f.value == null ? '信息不足' : esc(signed(f.value))) + '</text>');
      if (g) out.push('<line class="vz-group-sep" x1="' + num(x0) + '" x2="' + num(x0) + '" y1="' + top + '" y2="' + num(base + 3 * step) + '"/>');
    });
    return '<svg class="vz-svg vz-columns" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(theme.name + '各分面逐题得分：每根柱是一道题，向上偏向该分面“+”端，向下偏向“' + MINUS + '”端，横线为已答均值。') + '" font-family="' + esc(FONT) + '">' + paint(out.join('')) + '</svg>';
  }
  function themeBlock(theme) {
    return '<figure class="vz-figure vz-theme-charts"><figcaption><strong>' + esc(theme.name) + '：雷达图与逐题得分</strong><span class="muted">左：本主题各分面的雷达图。右：多维度得分条形图，每组六根柱是该分面的六道题，向上偏向“+”端、向下偏向“' + MINUS + '”端（反向题已换算），横线为已答均值，空心点为未作有效回答。</span></figcaption><div class="vz-graphic vz-theme-pair"><div class="vz-theme-radar">' + themeRadar(theme) + '</div><div class="vz-theme-columns">' + itemColumns(theme) + '</div></div>' + legend([['pos', '偏向“+”端'], ['neg', '偏向“' + MINUS + '”端'], ['mean', '已答均值'], ['missing', '不了解／不愿回答／漏答']]) + '</figure>';
  }

  // ---------------------------------------------------------------- claims of a verified card (HTML)
  const FAMILIARITY = ['此前没有听说', '只知道名称', '自评能解释核心', '自评能区分近邻'];
  const IDENTITY = ['不认同', '尚不确定', '部分认同', '明确认同'];
  function claimRows(card) {
    const rows = card.claims.map(c => {
      const v = c.answer, ok = validRating(v);
      const dot = ok ? '<span class="vz-dot-h ' + (v > 4 ? 'pos' : v < 4 ? 'neg' : 'zero') + '" style="left:' + pc((v - 1) / 6 * 100) + '"></span>' : '';
      return '<div class="vz-claim" data-tip="' + esc(c.id + '：' + c.text + '\n作答 ' + answerText(v)) + '"><span class="vz-claim-key">' + esc(c.key) + '</span><div class="vz-scale"><span class="vz-scaleline"></span>' + [1, 2, 3, 4, 5, 6, 7].map(i => '<i class="vz-tick-i' + (i === 4 ? ' mid' : '') + '" style="left:' + pc((i - 1) / 6 * 100) + '"></i>').join('') + dot + '</div><span class="vz-claim-val">' + (ok ? v + ' ' + RATING_TEXT[v] : c.presented ? esc(answerText(v).replace(/^.+ · /, '')) : '未呈现') + '</span></div>';
    }).join('');
    const steps = (value, labels) => '<span class="vz-steps">' + [0, 1, 2, 3].map(i => '<i class="vz-step' + (value != null && i <= value ? ' on' : '') + '"></i>').join('') + '</span><span>' + (value == null ? '未记录' : esc(labels[value])) + '</span>';
    return box('<div class="vz-claims vz-graphic"><div class="vz-claims-scale"><span>1 非常不同意</span><span>4 中立</span><span>7 非常同意</span></div>' + rows +
      '<div class="vz-ki"><span class="vz-ki-name">此前熟悉度</span>' + steps(card.familiarity, FAMILIARITY) + '</div><div class="vz-ki"><span class="vz-ki-name">名称自我认同</span>' + steps(card.identity, IDENTITY) + '</div></div>');
  }

  // ---------------------------------------------------------------- supplements: diverging stacked bars (HTML)
  function supplementChart(groups) {
    const rows = groups.map(g => {
      const counts = [0, 0, 0, 0, 0, 0, 0, 0];
      for (const q of g.items) if (q.presented && validRating(q.answer)) counts[q.answer]++;
      const shown = g.presented;
      const other = g.counts.unknown + g.counts.refused + g.counts.missing;
      if (!shown) return '<div class="vz-sup-row muted"><span class="vz-sup-name">' + esc(g.name) + '</span><span class="vz-sup-empty">本次未呈现（' + g.total + ' 题）</span></div>';
      // Each side spans up to half the track; neutral answers straddle the centre line.
      const w = c => c / shown * 50;
      const seg = (v, c, left) => '<span class="vz-seg r' + v + '" style="left:' + pc(left) + ';width:' + pc(w(c)) + '" data-tip="' + esc(RATING_TEXT[v] + '：' + c + ' 题') + '"></span>';
      let x = 50 - w(counts[4]) / 2, segs = '';
      for (const v of [3, 2, 1]) if (counts[v]) { x -= w(counts[v]); segs += seg(v, counts[v], x); }
      if (counts[4]) segs += seg(4, counts[4], 50 - w(counts[4]) / 2);
      x = 50 + w(counts[4]) / 2;
      for (const v of [5, 6, 7]) if (counts[v]) { segs += seg(v, counts[v], x); x += w(counts[v]); }
      return '<div class="vz-sup-row"><span class="vz-sup-name">' + esc(g.name) + '<small>已呈现 ' + shown + '/' + g.total + '</small></span><div class="vz-sup-track"><span class="vz-grid mid sup" style="left:50%"></span>' + segs + '</div><span class="vz-sup-other"><span>反对 ' + g.counts.oppose + ' · 中立 ' + g.counts.neutral + ' · 支持 ' + g.counts.support + '</span>' + (other ? '<span>未作有效回答 ' + other + '</span>' : '') + '</span></div>';
    }).join('');
    return box('<figure class="vz-figure vz-sup"><figcaption><strong>补充题组作答分布</strong><span class="muted">每行一个题组，按已呈现的题计算：中线左侧为不同意，右侧为同意，颜色越深越强烈，中立跨在中线上。只统计题数，不计算题组分数。</span></figcaption><div class="vz-graphic">' + rows + '</div>' + legend([['r1', '非常不同意'], ['r2', '不同意'], ['r3', '略不同意'], ['r4', '中立'], ['r5', '略同意'], ['r6', '同意'], ['r7', '非常同意']]) + '</figure>');
  }

  // ---------------------------------------------------------------- scenarios: dumbbells (SVG)
  function scenarioChart(scenarios) {
    const rows = scenarios.pairs, W = 460, left = 12, right = 54, rowH = 44, top = 44, H = top + rows.length * rowH + 8;
    const x = v => left + (v - 1) / 6 * (W - left - right);
    const out = ['<text class="vz-tick" x="' + num(x(1) - 2) + '" y="13">非常不同意</text><text class="vz-tick" x="' + num(x(4)) + '" y="13" text-anchor="middle">中立</text><text class="vz-tick" x="' + num(x(7) + 2) + '" y="13" text-anchor="end">非常同意</text>'];
    for (let v = 1; v <= 7; v++) out.push('<line class="vz-gridline' + (v === 4 ? ' base' : '') + '" x1="' + num(x(v)) + '" x2="' + num(x(v)) + '" y1="' + (top - 6) + '" y2="' + (H - 8) + '"/><text class="vz-tick" x="' + num(x(v)) + '" y="' + (top - 12) + '" text-anchor="middle">' + v + '</text>');
    rows.forEach((p, i) => {
      const y = top + i * rowH + 26, a = validRating(p.a) ? p.a : null, b = validRating(p.b) ? p.b : null;
      out.push('<text class="vz-row-label" x="' + left + '" y="' + (y - 12) + '">' + esc(p.id + ' ' + p.policy) + '</text>');
      if (a != null && b != null && a !== b) out.push('<line class="vz-link" x1="' + num(x(a)) + '" x2="' + num(x(b)) + '" y1="' + y + '" y2="' + y + '"/>');
      if (b != null) out.push('<circle class="vz-b" cx="' + num(x(b)) + '" cy="' + y + '" r="5.5"/>');
      if (a != null) out.push('<circle class="vz-a" cx="' + num(x(a)) + '" cy="' + y + '" r="5.5"/>');
      out.push('<text class="vz-diff" x="' + (W - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + (p.difference == null ? '—' : esc(signed(p.difference))) + '</text>');
      out.push('<rect class="vz-hitbox" x="0" y="' + (y - 22) + '" width="' + W + '" height="' + rowH + '" data-tip="' + esc(p.id + ' ' + p.policy + '\n甲国 ' + answerText(p.a) + '\n乙国 ' + answerText(p.b) + '\n差值（甲−乙） ' + (p.difference == null ? '—' : signed(p.difference))) + '"/>');
    });
    return '<figure class="vz-figure vz-scenario"><figcaption><strong>甲乙两国情境对照</strong><span class="muted">每行同一项安排在两种设定下的作答；两点相距越远，回答随设定变化越大。右侧为差值（甲−乙）。</span></figcaption><div class="vz-graphic"><svg class="vz-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="甲乙两国情境哑铃图" font-family="' + esc(FONT) + '">' + paint(out.join('')) + '</svg></div>' + legend([['a', '甲国'], ['b', '乙国']]) + '</figure>';
  }

  // ---------------------------------------------------------------- answer quality: segmented bar + option histogram
  function ratingIds(data) {
    const ids = new Set(data.core.items.concat(data.core.scenarios, ...data.modules.map(m => m.items), data.legacySupplement.items).map(q => q.id));
    for (const c of data.cards) for (const k of ['a', 'b', 'c']) ids.add(c.id + '.' + k);
    return ids;
  }
  function qualityChart(result, session, data) {
    const q = result.quality, total = q.presented;
    if (!total) return '';
    const parts = [['valid', '有效（非中立）', q.valid - q.neutral], ['neutral', '中立', q.neutral], ['unknown', '不了解', q.unknown], ['refused', '不愿回答', q.refused], ['missing', '漏答', q.missing]].filter(p => p[2] > 0);
    const seg = parts.map(([cls, name, n]) => { const share = n / total * 100; return '<span class="vz-qseg ' + cls + '" style="flex:' + n + ' 1 0" data-tip="' + esc(name + '：' + n + ' 项（' + share.toFixed(1) + '%）') + '">' + (share >= 9 ? '<b class="vz-qlabel' + (cls === 'valid' ? ' valid' : '') + '">' + Math.round(share) + '%</b>' : '') + '</span>'; }).join('');
    const ids = ratingIds(data), counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, U: 0, X: 0 };
    for (const id of session.presented || []) {
      if (!ids.has(id)) continue;
      const v = session.answers[id];
      if (validRating(v)) counts[v]++; else if (v === 'U') counts.U++; else if (v === '×' || v === 'X') counts.X++;
    }
    const keys = [1, 2, 3, 4, 5, 6, 7, 'U', 'X'], max = Math.max(1, ...keys.map(k => counts[k]));
    const W = 460, H = 170, left = 8, base = 128, colW = 22, slot = (W - 2 * left) / keys.length, out = [];
    out.push('<line class="vz-gridline base" x1="' + left + '" x2="' + (W - left) + '" y1="' + base + '" y2="' + base + '"/>');
    keys.forEach((k, i) => {
      const n = counts[k], h = n / max * 100, x = left + i * slot + (slot - colW) / 2, cls = typeof k === 'number' ? 'r' + k : 'other';
      if (n) out.push('<path class="vz-col ' + cls + '" d="' + roundedBar(x, base, colW, Math.max(h, 2), true, 4) + '"/>');
      out.push('<text class="vz-cap" x="' + num(x + colW / 2) + '" y="' + num(base - h - 5) + '" text-anchor="middle">' + n + '</text><text class="vz-tick" x="' + num(x + colW / 2) + '" y="' + (base + 15) + '" text-anchor="middle">' + (k === 'X' ? '×' : k) + '</text>');
      out.push('<rect class="vz-hitbox" x="' + num(left + i * slot) + '" y="10" width="' + num(slot) + '" height="' + (base - 6) + '" data-tip="' + esc((typeof k === 'number' ? k + ' · ' + RATING_TEXT[k] : k === 'U' ? 'U · 不了解' : '× · 不愿回答') + '：' + n + ' 项') + '"/>');
    });
    out.push('<text class="vz-tick" x="' + num(left + slot * 1.5) + '" y="' + (base + 34) + '" text-anchor="middle">不同意</text><text class="vz-tick" x="' + num(left + slot * 3.5) + '" y="' + (base + 34) + '" text-anchor="middle">中立</text><text class="vz-tick" x="' + num(left + slot * 5.5) + '" y="' + (base + 34) + '" text-anchor="middle">同意</text>');
    return '<figure class="vz-figure vz-quality"><figcaption><strong>作答构成</strong><span class="muted">上：已呈现的 ' + total + ' 个立场响应项按作答状态划分。下：各选项被使用的次数，反映作答风格（是否常用两端或中立），不用于评判答卷质量。</span></figcaption><div class="vz-graphic">' + box('<div class="vz-qbar">' + seg + '</div>') + legend(parts.map(([cls, name, n]) => [cls, name + ' ' + n])) + '<svg class="vz-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="选项使用次数柱状图" font-family="' + esc(FONT) + '">' + paint(out.join('')) + '</svg></div></figure>';
  }

  // ---------------------------------------------------------------- topic modules: raw answers, one column per item
  function moduleChart(module, rows) {
    if (!rows.length) return '';
    const W = 460, H = 178, left = 26, right = 6, top = 16, step = 18, base = top + 3 * step + 4, slot = (W - left - right) / rows.length, bw = Math.min(12, slot - 4), out = [];
    for (let s = -3; s <= 3; s++) out.push('<line class="vz-gridline' + (s === 0 ? ' base' : '') + '" x1="' + left + '" x2="' + (W - right) + '" y1="' + num(base - s * step) + '" y2="' + num(base - s * step) + '"/>');
    out.push('<text class="vz-tick" x="' + (left - 5) + '" y="' + num(base - 3 * step + 4) + '" text-anchor="end">7</text><text class="vz-tick" x="' + (left - 5) + '" y="' + num(base + 4) + '" text-anchor="end">4</text><text class="vz-tick" x="' + (left - 5) + '" y="' + num(base + 3 * step + 4) + '" text-anchor="end">1</text>');
    rows.forEach((item, i) => {
      const x = left + i * slot + (slot - bw) / 2, v = item.answer, d = validRating(v) ? v - 4 : null;
      if (d == null) out.push('<circle class="vz-missing" cx="' + num(x + bw / 2) + '" cy="' + num(base) + '" r="3.4"/>');
      else if (d === 0) out.push('<rect class="vz-col zero" x="' + num(x) + '" y="' + num(base - 1.5) + '" width="' + num(bw) + '" height="3" rx="1"/>');
      else out.push('<path class="vz-col r' + v + '" d="' + roundedBar(x, base, bw, Math.abs(d) * step, d > 0, 3) + '"/>');
      if (rows.length <= 30) out.push('<text class="vz-tick small" x="' + num(x + bw / 2) + '" y="' + (H - 30) + '" text-anchor="middle">' + esc(String(item.id).replace(/^[A-Z]+0?/, '')) + '</text>');
      out.push('<rect class="vz-hitbox" x="' + num(left + i * slot) + '" y="' + top + '" width="' + num(slot) + '" height="' + (H - top - 24) + '" data-tip="' + esc(item.id + ' ' + item.text + '\n作答 ' + answerText(v)) + '"/>');
    });
    out.push('<text class="vz-tick" x="' + left + '" y="' + (H - 8) + '">题号（' + esc(module.id) + '01～' + esc(module.id) + String(module.items.length).padStart(2, '0') + '，只画已呈现的题）</text>');
    return '<figure class="vz-figure vz-module"><figcaption><strong>' + esc(module.title) + '：逐题同意程度</strong><span class="muted">每根柱是一道题的原始作答：向上为同意、向下为不同意，空心点为未作有效回答。各题政治方向不同，图中不合成专题分数。</span></figcaption><div class="vz-graphic"><svg class="vz-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(module.title + '逐题作答柱状图') + '" font-family="' + esc(FONT) + '">' + paint(out.join('')) + '</svg></div></figure>';
  }

  // ---------------------------------------------------------------- closing figure: tendencies with icons (SVG)
  // The figure is drawn from a small model so the page can redraw it in a narrow layout on phones.
  function summaryModel(result, meta) {
    return {
      id: (meta && meta.id) || '', date: (meta && meta.date) || '',
      facets: result.facets.map(f => { const sh = shares(f); return { id: f.id, name: f.name, negative: f.negative, positive: f.positive, section: f.section, value: f.value, mean: f.mean, valid: f.valid, bounds: f.bounds, raw: sh.raw, pct: sh.pct }; })
    };
  }
  // Split text into lines that fit a width (CJK-aware estimate); used only for notes.
  function lines(text, size, width) {
    const out = []; let cur = '';
    for (const ch of [...text]) { if (textWidth(cur + ch, size) > width && cur) { out.push(cur); cur = ''; } cur += ch; }
    if (cur) out.push(cur);
    return out;
  }
  function summarySVG(model, compact) {
    const W = compact ? 360 : 560, P = compact ? 14 : 20, out = [], groups = themes(model.facets), list = marked(model.facets);
    const cols = compact ? 2 : 3, cw = (W - 2 * P) / cols;
    out.push('<rect class="vz-s-bg" x="0" y="0" width="' + W + '" height="__H__" rx="14"/>');
    let y;
    if (compact) {
      out.push('<text class="vz-s-title" x="' + P + '" y="34">作答倾向总览</text>');
      out.push('<text class="vz-s-sub" x="' + P + '" y="54">依据本次 22 个分面的实际作答绘制</text><text class="vz-s-sub" x="' + P + '" y="70">只描述倾向，不是身份标签</text>');
      out.push('<text class="vz-s-meta" x="' + P + '" y="88">' + esc(['意识形态测试调查', model.id, model.date].filter(Boolean).join(' · ')) + '</text>');
      y = 116;
    } else {
      out.push('<text class="vz-s-title" x="' + P + '" y="38">作答倾向总览</text>');
      out.push('<text class="vz-s-sub" x="' + P + '" y="60">依据本次 22 个分面的实际作答绘制，只描述倾向，不是身份标签</text>');
      out.push('<text class="vz-s-meta" x="' + (W - P) + '" y="38" text-anchor="end">意识形态测试调查</text>');
      if (model.id || model.date) out.push('<text class="vz-s-meta" x="' + (W - P) + '" y="60" text-anchor="end">' + esc([model.id, model.date].filter(Boolean).join(' · ')) + '</text>');
      y = 92;
    }
    out.push('<text class="vz-s-head" x="' + P + '" y="' + y + '">作答中较突出的倾向</text>');
    y += 12;
    if (list.length) {
      list.forEach((f, i) => {
        const col = i % cols, row = Math.floor(i / cols), x = P + col * cw, top = y + row * 56;
        const end = f.value > 0 ? '+' : '-', side = f.value > 0 ? 'pos' : 'neg', name = f.value > 0 ? f.positive : f.negative;
        const size = Math.min(12.5, (cw - 52) / Math.max(1, [...name].length));
        out.push('<g class="vz-badge" data-tip="' + esc(facetTip(f)) + '"><circle class="vz-badge-disc ' + side + '" cx="' + num(x + 20) + '" cy="' + num(top + 24) + '" r="18"/>' + icon(f.id, end, x + 20, top + 24, 20, 'vz-icon on') +
          '<text class="vz-badge-name" x="' + num(x + 46) + '" y="' + num(top + 20) + '" style="font-size:' + num(size) + 'px">' + esc(name) + '</text><text class="vz-badge-sub" x="' + num(x + 46) + '" y="' + num(top + 37) + '">' + esc(short(f) + ' ' + signed(f.value)) + '</text></g>');
      });
      y += Math.ceil(list.length / cols) * 56 + 6;
    } else {
      for (const line of lines('各分面都没有达到“较突出”的程度（|分值| ≥ ' + MARKED + '，且缺答不会改变方向）。', 10.5, W - 2 * P)) { y += 16; out.push('<text class="vz-s-note" x="' + P + '" y="' + y + '">' + esc(line) + '</text>'); }
      y += 14;
    }
    const iconR = compact ? 13 : 15, inset = compact ? 32 : 38, x0 = P + inset, x1 = W - P - inset, bw = x1 - x0;
    for (const t of groups) {
      y += 14;
      out.push('<text class="vz-s-theme" x="' + P + '" y="' + y + '">' + esc(t.name) + '</text><line class="vz-s-rule" x1="' + num(P + textWidth(t.name, 12) + 10) + '" x2="' + (W - P) + '" y1="' + (y - 4) + '" y2="' + (y - 4) + '"/>');
      y += 6;
      for (const f of t.facets) {
        const sh = { raw: f.raw, pct: f.pct }, side = lean(f), strong = f.value != null && Math.abs(f.value) >= STRONG;
        const rowTip = facetTip(f) + '\n偏向' + f.negative + ' ' + sh.pct.neg + '% · 中立 ' + sh.pct.neu + '% · 缺答 ' + sh.pct.mis + '% · 偏向' + f.positive + ' ' + sh.pct.pos + '%';
        const g = ['<g class="vz-s-row" data-tip="' + esc(rowTip) + '">'];
        const head = f.name + ' · ' + (f.value == null ? '信息不足' : signed(f.value));
        let by;
        if (compact) {
          // phone layout: facet name above the bar, pole names below it
          g.push('<text class="vz-s-facet strong" x="' + (W / 2) + '" y="' + (y + 12) + '" text-anchor="middle">' + esc(head) + '</text>');
          by = y + 18;
          const poleSize = Math.min(10.5, (bw - 14) / Math.max(1, [...f.negative].length + [...f.positive].length));
          g.push('<text class="vz-s-pole" x="' + x0 + '" y="' + (by + 31) + '" style="font-size:' + num(poleSize) + 'px">' + esc(f.negative) + '</text><text class="vz-s-pole" x="' + x1 + '" y="' + (by + 31) + '" text-anchor="end" style="font-size:' + num(poleSize) + 'px">' + esc(f.positive) + '</text>');
        } else {
          g.push('<text class="vz-s-pole" x="' + x0 + '" y="' + (y + 12) + '">' + esc(f.negative) + '</text><text class="vz-s-pole" x="' + x1 + '" y="' + (y + 12) + '" text-anchor="end">' + esc(f.positive) + '</text>');
          g.push('<text class="vz-s-facet" x="' + (W / 2) + '" y="' + (y + 12) + '" text-anchor="middle">' + esc(head) + '</text>');
          by = y + 18;
        }
        const bh = 18;
        const parts = [['neg', sh.raw.neg, sh.pct.neg], ['neu', sh.raw.neu, sh.pct.neu], ['mis', sh.raw.mis, sh.pct.mis], ['pos', sh.raw.pos, sh.pct.pos]].filter(p => p[1] > 0.0005);
        const avail = bw - 2 * (parts.length - 1);
        let x = x0;
        for (const [cls, v, p] of parts) {
          const w = v * avail;
          g.push('<rect class="vz-s-seg ' + cls + '" x="' + num(x) + '" y="' + by + '" width="' + num(Math.max(w, 0.8)) + '" height="' + bh + '" rx="' + num(Math.min(3.5, w / 2)) + '"/>');
          const label = p + '%';
          if (w >= textWidth(label, 10.5) + 9) g.push('<text class="vz-s-pct ' + cls + '" x="' + num(x + 4.5) + '" y="' + (by + 12.8) + '">' + label + '</text>');
          x += w + 2;
        }
        const disc = (end, cx, on) => '<circle class="vz-s-disc ' + (on ? (end === '+' ? 'pos' : 'neg') : 'off') + '" cx="' + num(cx) + '" cy="' + (by + bh / 2) + '" r="' + iconR + '"/>' + (on && strong ? '<circle class="vz-s-ring ' + (end === '+' ? 'pos' : 'neg') + '" cx="' + num(cx) + '" cy="' + (by + bh / 2) + '" r="' + (iconR + 3) + '"/>' : '') + icon(f.id, end, cx, by + bh / 2, iconR * 1.2, 'vz-icon' + (on ? ' on' : ''));
        g.push(disc('-', P + iconR + 1, side === 'neg'), disc('+', W - P - iconR - 1, side === 'pos'));
        g.push('</g>');
        out.push(g.join(''));
        y += compact ? 60 : 48;
      }
    }
    y += 10;
    const keys = [['neg', '偏向左端'], ['neu', '中立'], ['mis', '缺答'], ['pos', '偏向右端']];
    let lx = P;
    for (const [cls, text] of keys) { out.push('<rect class="vz-s-seg ' + cls + '" x="' + lx + '" y="' + (y - 9) + '" width="16" height="11" rx="2.5"/><text class="vz-s-note" x="' + (lx + 22) + '" y="' + y + '">' + text + '</text>'); lx += 22 + textWidth(text, 10.5) + (compact ? 14 : 22); }
    y += 4;
    const notes = ['每条按该分面 6 道题计算：两端颜色＝偏向该端的作答强度，灰色＝中立，空白＝不了解、不愿回答或漏答。', '图标着色＝该端领先至少 ' + LEAN + ' 分，外圈＝领先至少 ' + STRONG + ' 分；分值按已答题计算，两端名称只是题目方向，不是评价。'];
    for (const note of notes) for (const line of lines(note, 10.5, W - 2 * P)) { y += 16; out.push('<text class="vz-s-note" x="' + P + '" y="' + y + '">' + esc(line) + '</text>'); }
    out.push('<text class="vz-s-meta" x="' + P + '" y="' + (y + 20) + '">saigyouji-yukari.github.io/ideology-survey</text>');
    const H = Math.ceil(y + 36);
    return '<svg class="vz-svg vz-summary-svg' + (compact ? ' compact' : '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('作答倾向总览：' + model.facets.map(f => f.name + ' 偏向' + f.negative + f.pct.neg + '%、中立' + f.pct.neu + '%、缺答' + f.pct.mis + '%、偏向' + f.positive + f.pct.pos + '%').join('；')) + '" font-family="' + esc(FONT) + '">' + paint(out.join('').replace('__H__', H)) + '</svg>';
  }
  function summaryTable(model) {
    return '<details class="report-details vz-data"><summary>查看总览图的数据</summary><div class="report-table-wrap"><table class="report-table"><thead><tr><th scope="col">分面</th><th scope="col">偏向左端</th><th scope="col">中立</th><th scope="col">缺答</th><th scope="col">偏向右端</th><th scope="col">分值</th></tr></thead><tbody>' + model.facets.map(f =>
      '<tr><td>' + esc(f.name) + '<small class="muted">' + esc(f.negative) + ' ／ ' + esc(f.positive) + '</small></td><td>' + f.pct.neg + '%</td><td>' + f.pct.neu + '%</td><td>' + f.pct.mis + '%</td><td>' + f.pct.pos + '%</td><td>' + (f.value == null ? '信息不足' : esc(signed(f.value))) + '</td></tr>'
    ).join('') + '</tbody></table></div></details>';
  }
  function summary(result, meta) {
    const model = summaryModel(result, meta), list = marked(model.facets);
    return '<figure class="vz-figure vz-summary" data-viz="summary" data-model="' + esc(JSON.stringify(model)) + '" data-name="' + esc((model.id ? model.id + '-' : '') + '作答倾向总览') + '"><figcaption><strong>作答倾向总览图</strong><span class="muted">' + (list.length ? '较突出的倾向：' + esc(list.map(f => f.value > 0 ? f.positive : f.negative).join('、')) + '。' : '本次没有达到“较突出”程度的倾向。') + '图中只汇总你实际的选择，不判定你属于哪种主义。</span></figcaption><div class="vz-graphic vz-summary-stage">' + summarySVG(model, false) + '</div><div class="vz-controls vz-summary-actions"><button type="button" class="btn small" data-export="summary">保存为图片</button></div>' + summaryTable(model) + '</figure>';
  }

  // ---------------------------------------------------------------- browser behaviour
  function inlineStyles(source, clone) {
    const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'paint-order', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-family', 'font-weight', 'letter-spacing', 'visibility', 'display'];
    const a = [source, ...source.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
    a.forEach((el, i) => {
      const cs = root.getComputedStyle(el), target = b[i];
      if (!target || !target.setAttribute) return;
      target.setAttribute('style', props.map(p => p + ':' + cs.getPropertyValue(p)).join(';'));
      target.removeAttribute('class'); target.removeAttribute('data-tip'); target.removeAttribute('tabindex');
    });
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = root.document.createElement('a');
    a.href = url; a.download = name; root.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function exportSvg(svg, name, done) {
    const doc = root.document, vb = svg.viewBox.baseVal, scale = 3;
    const clone = svg.cloneNode(true);
    inlineStyles(svg, clone);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height);
    const bg = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', vb.width); bg.setAttribute('height', vb.height);
    bg.setAttribute('fill', root.getComputedStyle(svg.closest('.vz-figure') || doc.body).getPropertyValue('--vz-export-bg').trim() || '#ffffff');
    clone.insertBefore(bg, clone.firstChild);
    const text = new XMLSerializer().serializeToString(clone);
    const fallback = () => { downloadBlob(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }), name + '.svg'); done && done('svg'); };
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = doc.createElement('canvas');
        canvas.width = Math.round(vb.width * scale); canvas.height = Math.round(vb.height * scale);
        const ctx = canvas.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, vb.width, vb.height);
        canvas.toBlob(blob => { if (blob) { downloadBlob(blob, name + '.png'); done && done('png'); } else fallback(); }, 'image/png');
      } catch (_) { fallback(); }
    };
    img.onerror = fallback;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
  }
  let tip = null;
  function showTip(el, x, y) {
    const doc = root.document;
    if (!tip) { tip = doc.createElement('div'); tip.className = 'vz-tip'; tip.setAttribute('aria-hidden', 'true'); doc.body.appendChild(tip); }
    tip.textContent = el.getAttribute('data-tip');
    tip.style.display = 'block';
    const r = tip.getBoundingClientRect(), vw = root.innerWidth, vh = root.innerHeight;
    let left = x + 14, top = y + 16;
    if (left + r.width > vw - 8) left = Math.max(8, x - r.width - 14);
    if (top + r.height > vh - 8) top = Math.max(8, y - r.height - 12);
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  function setupCompass(fig) {
    if (fig.dataset.ready) return;
    fig.dataset.ready = '1';
    let model;
    try { model = JSON.parse(fig.getAttribute('data-model')); } catch (_) { return; }
    const svg = fig.querySelector('.vz-compass-svg'), table = fig.querySelector('.vz-compass-table');
    let view = Object.assign({}, VIEWS.default), frame = 0;
    const draw = () => {
      frame = 0;
      const small = svg.getBoundingClientRect().width < 400;
      svg.classList.toggle('small', small);
      svg.innerHTML = compassSVG(model, view, small);
      svg.setAttribute('aria-label', compassLabel(model));
    };
    const queue = () => { if (!frame) frame = root.requestAnimationFrame(draw); };
    draw();
    if (typeof root.ResizeObserver === 'function') new root.ResizeObserver(queue).observe(svg.parentNode);
    const clampPitch = p => Math.max(-Math.PI / 2 + 0.0001, Math.min(Math.PI / 2 - 0.0001, p));
    let drag = null;
    svg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, type: e.pointerType }; if (e.pointerType !== 'touch') svg.setPointerCapture(e.pointerId); svg.classList.add('dragging'); });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      view.yaw += dx * 0.011;
      if (drag.type !== 'touch') view.pitch = clampPitch(view.pitch + dy * 0.011);
      hideTip(); queue();
    });
    const end = () => { drag = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('lostpointercapture', end);
    svg.addEventListener('keydown', e => {
      const step = 0.12;
      if (e.key === 'ArrowLeft') view.yaw -= step; else if (e.key === 'ArrowRight') view.yaw += step;
      else if (e.key === 'ArrowUp') view.pitch = clampPitch(view.pitch + step); else if (e.key === 'ArrowDown') view.pitch = clampPitch(view.pitch - step);
      else if (e.key === 'Home') view = Object.assign({}, VIEWS.default); else return;
      e.preventDefault(); queue();
    });
    fig.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.view) { view = Object.assign({}, VIEWS[b.dataset.view] || VIEWS.default); queue(); }
      if (b.dataset.export === 'compass') exportSvg(svg, '三维罗盘');
    });
    fig.addEventListener('change', e => {
      const s = e.target.closest('select[data-axis]'); if (!s) return;
      const k = Number(s.dataset.axis), id = s.value, other = model.axes.indexOf(id);
      if (other >= 0 && other !== k) { model.axes[other] = model.axes[k]; const o = fig.querySelector('select[data-axis="' + other + '"]'); if (o) o.value = model.axes[other]; }
      model.axes[k] = id;
      if (table) table.innerHTML = compassTable(model);
      queue();
    });
  }
  function setupSummary(fig) {
    if (fig.dataset.ready) return;
    fig.dataset.ready = '1';
    let model;
    try { model = JSON.parse(fig.getAttribute('data-model')); } catch (_) { return; }
    const stage = fig.querySelector('.vz-summary-stage');
    let compact = false;
    const fit = () => {
      const want = stage.clientWidth > 0 && stage.clientWidth < 500;
      if (want !== compact) { compact = want; stage.innerHTML = summarySVG(model, compact); }
    };
    fit();
    if (typeof root.ResizeObserver === 'function') new root.ResizeObserver(fit).observe(stage);
  }
  function enhance(scope) {
    const doc = root.document;
    if (!doc) return;
    (scope || doc).querySelectorAll('.vz-compass[data-viz="compass"]').forEach(setupCompass);
    (scope || doc).querySelectorAll('.vz-summary[data-viz="summary"]').forEach(setupSummary);
    if (!doc.documentElement.dataset.vzTips) {
      doc.documentElement.dataset.vzTips = '1';
      doc.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el, e.clientX, e.clientY); });
      doc.addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && tip && tip.style.display === 'block') showTip(el, e.clientX, e.clientY); });
      doc.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) hideTip(); });
      doc.addEventListener('scroll', hideTip, { passive: true, capture: true });
      doc.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('button[data-export="summary"]'); if (!b) return;
        const fig = b.closest('.vz-summary'), svg = fig && fig.querySelector('.vz-summary-svg');
        if (svg) exportSvg(svg, (fig.dataset.name || '作答倾向总览'));
      });
    }
  }
  if (root.document && typeof root.MutationObserver === 'function') {
    const start = () => {
      enhance(root.document);
      new root.MutationObserver(list => { for (const m of list) for (const node of m.addedNodes) if (node.nodeType === 1 && (node.matches('.vz-compass, .vz-summary') || node.querySelector('.vz-compass, .vz-summary'))) enhance(node.parentNode || root.document); }).observe(root.document.body, { childList: true, subtree: true });
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  }

  return Object.freeze({ shares, marked, themes, overview, compass, compassModel, compassSVG, fullRadar, themeBlock, track, claimRows, supplementChart, scenarioChart, qualityChart, moduleChart, summary, summaryModel, summarySVG, enhance, ICONS, thresholds: { LEAN, STRONG, MARKED } });
});
