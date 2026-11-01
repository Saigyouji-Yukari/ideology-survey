/* Six issue-level reference types. The authored vectors are not historical people’s answers. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../data/tendency_profiles.json'));
  else root.OMNI_PROFILE = factory(/* PROFILE_DATA_START */ {"version":"TP-2026-11-01","method":{"name":"六类议题的参考型比较","minimumValidPerFacet":5,"maximumMeanDistance":35,"maximumSingleFacetDistance":85,"nearTieMargin":6,"quietZone":20,"note":"数值是编制者用于说明政策组合的参考向量，不是历史人物的测验分数，不是经过样本估计的分类模型。距离单位为分面分值，不能解释为身份概率或赞同百分比。"},"sections":[{"id":"economic","section":"经济制度","axes":["OWN","ALLOC","RED","LAB"],"matchingAxes":["OWN","ALLOC","RED","LAB"]},{"id":"political","section":"政治制度","axes":["CIV","DEM","ORG","DEC"],"matchingAxes":["CIV","DEM","ORG","DEC"]},{"id":"change","section":"变革与公共责任","axes":["CHANGE","MEANS","COMM","POP"],"matchingAxes":["CHANGE","MEANS","COMM","POP"]},{"id":"culture","section":"文化与社会平等","axes":["CULT","GENDER","REL"],"matchingAxes":["CULT","GENDER","REL"]},{"id":"international","section":"认同与国际事务","axes":["NAT","MEM","INT","FORCE"],"matchingAxes":["NAT","MEM","INT","FORCE"]},{"id":"ecology","section":"生态技术与判断","axes":["ECO","TECH","EVID"],"matchingAxes":["ECO","TECH"]}],"profiles":[{"id":"economic-public-coordination","label":"公有协调型社会主义","section":"经济制度","description":"希望主要生产资料转向公共或劳动者所有，以公共协调和劳动者参与服务平等目标。","personId":"marx","targets":{"OWN":85,"ALLOC":75,"RED":85,"LAB":75},"anchors":{"OWN":{"min":25},"ALLOC":{"min":20},"LAB":{"min":10}},"sourceUrls":["https://www.marxists.org/archive/marx/works/1848/communist-manifesto/"]},{"id":"economic-democratic-socialism","label":"民主社会主义的经济取向","section":"经济制度","description":"兼顾社会所有权、普遍保障和劳动者共同决定，对公共计划和市场的具体组合保留弹性。这里只比较其经济主张。","personId":"bernstein","targets":{"OWN":65,"ALLOC":-10,"RED":85,"LAB":80},"anchors":{"OWN":{"min":25},"RED":{"min":25},"LAB":{"min":20}},"sourceUrls":["https://www.marxists.org/reference/archive/bernstein/works/1899/evsoc/index.htm"]},{"id":"economic-mutualism","label":"互助合作经济取向","section":"经济制度","description":"偏好劳动者占有和企业自治，同时保留交换、分散协调及合作机制；不把国家再分配当作唯一手段。","personId":"proudhon","targets":{"OWN":50,"ALLOC":-75,"RED":10,"LAB":85},"anchors":{"OWN":{"min":15},"ALLOC":{"max":-25},"LAB":{"min":30}},"sourceUrls":["https://www.gutenberg.org/files/360/360-h/360-h.htm"]},{"id":"economic-social-democracy","label":"社会民主主义的经济取向","section":"经济制度","description":"接受市场和私人企业，同时强调高水平公共保障、再分配以及有组织的劳动者参与。","personId":"bernstein","targets":{"OWN":-45,"ALLOC":-65,"RED":85,"LAB":65},"anchors":{"OWN":{"max":10},"ALLOC":{"max":-15},"RED":{"min":30},"LAB":{"min":10}},"sourceUrls":["https://www.marxists.org/reference/archive/bernstein/works/1899/evsoc/index.htm"]},{"id":"economic-mixed-liberalism","label":"干预型混合经济取向","section":"经济制度","description":"以私人企业和市场为基础，接受公共干预与一定保障；不要求生产资料普遍公有或劳动者取得最终控制。","personId":"keynes","targets":{"OWN":-65,"ALLOC":-30,"RED":40,"LAB":15},"anchors":{"OWN":{"max":-15},"RED":{"min":10}},"sourceUrls":["https://www.marxists.org/reference/subject/economics/keynes/general-theory/ch24.htm"]},{"id":"economic-classical-liberalism","label":"古典经济自由主义取向","section":"经济制度","description":"重视私人所有、市场竞争和价格协调，公共再分配与劳动者共同决定的范围相对有限。","personId":"smith","targets":{"OWN":-80,"ALLOC":-85,"RED":-20,"LAB":-30},"anchors":{"OWN":{"max":-25},"ALLOC":{"max":-25}},"sourceUrls":["https://www.gutenberg.org/ebooks/3300"]},{"id":"economic-market-libertarianism","label":"市场自由意志主义取向","section":"经济制度","description":"偏好广泛私人产权、自由交换与个人契约，对强制再分配和集体介入企业决定持明显保留。","personId":"spencer","targets":{"OWN":-95,"ALLOC":-95,"RED":-85,"LAB":-75},"anchors":{"OWN":{"max":-35},"ALLOC":{"max":-35},"RED":{"max":-25}},"sourceUrls":["https://oll.libertyfund.org/titles/mack-the-man-versus-the-state-with-six-essays-on-government-society-and-freedom-lf-ed"]},{"id":"political-constitutional-liberalism","label":"宪政自由主义取向","section":"政治制度","description":"重视公民权利、可替换的执政权与组织多元，以制度约束保护个人自由。","personId":"mill","targets":{"CIV":85,"DEM":85,"ORG":-55,"DEC":25},"anchors":{"CIV":{"min":25},"DEM":{"min":25},"ORG":{"max":10}},"sourceUrls":["https://www.gutenberg.org/ebooks/34901"]},{"id":"political-federal-republicanism","label":"联邦共和与地方自治取向","section":"政治制度","description":"支持权利与竞争民主，并特别重视地方自治、分散权限和不同层级之间的制衡。","personId":"montesquieu","targets":{"CIV":65,"DEM":65,"ORG":-45,"DEC":85},"anchors":{"CIV":{"min":15},"DEM":{"min":20},"DEC":{"min":35}},"sourceUrls":["https://en.wikisource.org/wiki/Page:Montesquieu_-_The_spirit_of_laws.djvu/235","https://en.wikisource.org/wiki/Page:Montesquieu_-_The_spirit_of_laws.djvu/239"]},{"id":"political-associational-autonomy","label":"自治民主与自由联合取向","section":"政治制度","description":"偏好基层授权、组织多元和广泛地方自治，反对由单一政治中心替代成员自主决定。","personId":"proudhon","targets":{"CIV":85,"DEM":80,"ORG":-95,"DEC":95},"anchors":{"CIV":{"min":25},"DEM":{"min":20},"ORG":{"max":-35},"DEC":{"min":35}},"sourceUrls":["https://www.gutenberg.org/files/360/360-h/360-h.htm"]},{"id":"political-vanguard-centralism","label":"先锋党集中制取向","section":"政治制度","description":"强调统一先锋组织、纪律和集中权限，允许对政治竞争及部分自由施加较强限制。","personId":"lenin","targets":{"CIV":-50,"DEM":-70,"ORG":90,"DEC":-80},"anchors":{"DEM":{"max":-20},"ORG":{"min":35},"DEC":{"max":-20}},"sourceUrls":["https://www.marxists.org/archive/lenin/works/1901/witbd/"]},{"id":"political-sovereign-authority","label":"集中国家权威取向","section":"政治制度","description":"把统一主权和公共秩序置于较优先位置，接受受限制的竞争及较强中央决定权；不以先锋党为必要条件。","personId":"hobbes","targets":{"CIV":-75,"DEM":-85,"ORG":10,"DEC":-90},"anchors":{"CIV":{"max":-15},"DEM":{"max":-25},"DEC":{"max":-35}},"sourceUrls":["https://www.gutenberg.org/ebooks/3207"]},{"id":"change-conservative-gradualism","label":"保守渐进主义取向","section":"变革与公共责任","description":"看重制度连续性和共同体责任，主张谨慎改革，保留手段限制及对单一人民意志的制衡。","personId":"burke","targets":{"CHANGE":-85,"MEANS":35,"COMM":60,"POP":-50},"anchors":{"CHANGE":{"max":-30},"COMM":{"min":10},"POP":{"max":15}},"sourceUrls":["https://www.gutenberg.org/ebooks/15679"]},{"id":"change-democratic-reformism","label":"民主改革与公共责任取向","section":"变革与公共责任","description":"倾向可逐步修正的改革、程序和手段约束，以公共合作回应共同问题，承认利益多元。","personId":"dewey","targets":{"CHANGE":-55,"MEANS":80,"COMM":70,"POP":-75},"anchors":{"CHANGE":{"max":-15},"MEANS":{"min":30},"COMM":{"min":20},"POP":{"max":-15}},"sourceUrls":["https://www.gutenberg.org/ebooks/852"]},{"id":"change-nonviolent-radicalism","label":"非暴力根本变革取向","section":"变革与公共责任","description":"支持改变造成不公的基本结构，同时强调非暴力、申辩权及不可用目标取消的手段限制。","personId":"gandhi","targets":{"CHANGE":70,"MEANS":95,"COMM":80,"POP":-35},"anchors":{"CHANGE":{"min":25},"MEANS":{"min":45},"COMM":{"min":20}},"sourceUrls":["https://www.mkgandhi.org/voiceoftruth/swaraj.php"]},{"id":"change-revolutionary-socialism","label":"革命社会主义的变革取向","section":"变革与公共责任","description":"倾向根本改变不公结构，重视集体责任，也对政治手段和单一代表权保留约束。经济目标须另看经济维度。","personId":"luxemburg","targets":{"CHANGE":95,"MEANS":25,"COMM":80,"POP":-40},"anchors":{"CHANGE":{"min":35},"COMM":{"min":25},"POP":{"max":15}},"sourceUrls":["https://www.marxists.org/archive/luxemburg/1900/reform-revolution/"]},{"id":"change-individualist-liberalism","label":"个人自由与有限公共义务取向","section":"变革与公共责任","description":"较优先保护个人选择，支持手段约束与利益多元，对超出不侵害他人原则的共同义务较谨慎。","personId":"mill","targets":{"CHANGE":-30,"MEANS":85,"COMM":-65,"POP":-75},"anchors":{"MEANS":{"min":30},"COMM":{"max":-20},"POP":{"max":-20}},"sourceUrls":["https://www.gutenberg.org/ebooks/34901"]},{"id":"change-instrumental-realism","label":"目的优先的政治现实主义取向","section":"变革与公共责任","description":"更愿意根据政治目标和实际效果容许手段例外，而不是让固定规则完全约束行动；这不等于预测具体违法或暴力行为。","personId":"machiavelli","targets":{"CHANGE":20,"MEANS":-70,"COMM":40,"POP":-30},"anchors":{"MEANS":{"max":-25}},"sourceUrls":["https://www.gutenberg.org/ebooks/1232"]},{"id":"culture-egalitarian-liberalism","label":"平等自由主义取向","section":"文化与社会平等","description":"认可生活方式多样、性别平等和世俗公共权力，以平等公民身份保护自主选择。","personId":"mill","targets":{"CULT":75,"GENDER":70,"REL":70},"anchors":{"CULT":{"min":25},"GENDER":{"min":25},"REL":{"min":20}},"sourceUrls":["https://www.gutenberg.org/ebooks/34901"]},{"id":"culture-feminist-equality","label":"女性主义的平等与自主取向","section":"文化与社会平等","description":"尤其强调摆脱固定性别分工、平等参与和自主决定，容许对习俗与宗教公共角色持不同程度的意见。","personId":"wollstonecraft","targets":{"CULT":45,"GENDER":95,"REL":0},"anchors":{"CULT":{"min":10},"GENDER":{"min":40}},"sourceUrls":["https://www.gutenberg.org/ebooks/3420"]},{"id":"culture-secular-humanism","label":"世俗人文主义取向","section":"文化与社会平等","description":"特别重视公共权力与宗教权威分离、信仰平等及自主判断，对习俗变迁持温和开放态度。","personId":"dewey","targets":{"CULT":20,"GENDER":40,"REL":95},"anchors":{"REL":{"min":40},"GENDER":{"min":10}},"sourceUrls":["https://www.harvardsquarelibrary.org/theology-philosophy/john-dewey-a-common-faith/"]},{"id":"culture-social-conservatism","label":"社会文化保守主义取向","section":"文化与社会平等","description":"优先看重传统家庭规范、既有社会角色和继承的公共道德，对快速改变持保留。","personId":"burke","targets":{"CULT":-85,"GENDER":-50,"REL":-25},"anchors":{"CULT":{"max":-30},"GENDER":{"max":5}},"sourceUrls":["https://www.gutenberg.org/ebooks/15679"]},{"id":"culture-religious-traditionalism","label":"宗教传统主义的公共秩序取向","section":"文化与社会平等","description":"赞成宗教规范在公共法律中具有较高地位，并较倾向传统生活规范和性别角色。它描述政治安排，不推断本人信教与否。","personId":"aquinas","targets":{"CULT":-75,"GENDER":-75,"REL":-90},"anchors":{"CULT":{"max":-25},"GENDER":{"max":-20},"REL":{"max":-35}},"sourceUrls":["https://www.newadvent.org/summa/2091.htm"]},{"id":"international-cosmopolitanism","label":"世界主义与规则合作取向","section":"认同与国际事务","description":"强调人的共同道德地位、平等成员资格和有约束力的国际合作，并偏好限制对外武力。","personId":"kant","targets":{"NAT":85,"MEM":85,"INT":85,"FORCE":-65},"anchors":{"NAT":{"min":25},"MEM":{"min":25},"INT":{"min":25}},"sourceUrls":["https://www.gutenberg.org/ebooks/50922"]},{"id":"international-civic-nationalism","label":"公民民族认同与国际合作取向","section":"认同与国际事务","description":"看重本国共同体的政治义务，同时接受平等公民资格和国家间合作；不以血缘作为成员资格的必要条件。","personId":"mazzini","targets":{"NAT":-45,"MEM":75,"INT":45,"FORCE":-15},"anchors":{"NAT":{"max":-10},"MEM":{"min":25}},"sourceUrls":["https://history.hanover.edu/texts/mazzini/mazzini5.html"]},{"id":"international-sovereignty-first","label":"国家主权优先取向","section":"认同与国际事务","description":"强调本国义务和政府的主权自主，对超国家约束较谨慎；对外武力未表现为特别优先的工具。","personId":"hobbes","targets":{"NAT":-65,"MEM":10,"INT":-85,"FORCE":0},"anchors":{"NAT":{"max":-20},"INT":{"max":-30}},"sourceUrls":["https://www.gutenberg.org/ebooks/3207"]},{"id":"international-power-realism","label":"权力现实主义的对外政策取向","section":"认同与国际事务","description":"以本国利益、主权自主和威慑能力为重，更接受一定条件下的对外强制；不能据此推断支持侵略战争。","personId":"machiavelli","targets":{"NAT":-75,"MEM":0,"INT":-70,"FORCE":75},"anchors":{"NAT":{"max":-20},"INT":{"max":-20},"FORCE":{"min":30}},"sourceUrls":["https://www.gutenberg.org/ebooks/1232"]},{"id":"international-pacifism","label":"普遍关怀的和平主义取向","section":"认同与国际事务","description":"倾向平等看待跨国个体并严格限制对外武力，不把超国家制度建设作为唯一的和平途径。","personId":"tolstoy","targets":{"NAT":65,"MEM":80,"INT":15,"FORCE":-95},"anchors":{"NAT":{"min":15},"MEM":{"min":20},"FORCE":{"max":-45}},"sourceUrls":["https://www.gutenberg.org/ebooks/43302"]},{"id":"ecology-preservationism","label":"自然保全与生态优先取向","section":"生态技术与判断","description":"把生态承载和非人类生命的保护放在突出位置，对技术风险持适度审慎态度。","personId":"muir","targets":{"ECO":90,"TECH":25},"anchors":{"ECO":{"min":40}},"sourceUrls":["https://www.gutenberg.org/ebooks/60929"]},{"id":"ecology-precautionary-environmentalism","label":"审慎型环境主义取向","section":"生态技术与判断","description":"重视生态保护，也特别强调在广泛采用技术前限制不可逆风险和资料不足的应用。","personId":"carson","targets":{"ECO":75,"TECH":90},"anchors":{"ECO":{"min":25},"TECH":{"min":40}},"sourceUrls":["https://www.fws.gov/staff-profile/rachel-carson-1907-1964-author-modern-environmental-movement"]},{"id":"ecology-resource-conservation","label":"资源保育与技术管理取向","section":"生态技术与判断","description":"接受生态约束和长期资源保育，同时愿意运用技术、试验及有计划的管理改善人类生活。","personId":"pinchot","targets":{"ECO":50,"TECH":-35},"anchors":{"ECO":{"min":15},"TECH":{"max":10}},"sourceUrls":["https://www.gutenberg.org/files/11238/11238-h/11238-h.htm"]},{"id":"ecology-technical-progress","label":"技术进步与增长优先取向","section":"生态技术与判断","description":"较看重物质增长和技术试验的收益，愿意接受较大的开发及应用风险；不由此推断反对所有环境保护。","personId":"bacon","targets":{"ECO":-65,"TECH":-80},"anchors":{"ECO":{"max":-20},"TECH":{"max":-25}},"sourceUrls":["https://www.gutenberg.org/ebooks/45988"]}]} /* PROFILE_DATA_END */);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (config) {
  'use strict';
  if (!config || !Array.isArray(config.profiles)) throw new Error('请先载入基本倾向性画像规则。');
  const method = config.method, EPS = 1e-7;
  const number = x => typeof x === 'number' && Number.isFinite(x);
  const round = x => Math.round((x + Number.EPSILON) * 10) / 10;
  const clamp = x => Math.max(-100, Math.min(100, x));
  const signed = x => (x > 0 ? '+' : '') + round(x);
  function value(f) {
    if (!f || f.valid < method.minimumValidPerFacet) return null;
    const x = number(f.rawValue) ? f.rawValue : number(f.value) ? f.value : null;
    return x !== null && x >= -100 - EPS && x <= 100 + EPS ? clamp(x) : null;
  }
  function interval(f) {
    const x = value(f), b = Array.isArray(f.rawBounds) ? f.rawBounds : f.bounds;
    return b && b.length === 2 && b.every(number) && b[0] <= b[1] ? [clamp(b[0]), clamp(b[1])] : [x, x];
  }
  function within(x, rule) {
    return (!number(rule.min) || x + EPS >= rule.min) && (!number(rule.max) || x - EPS <= rule.max);
  }
  function eligible(profile, vector) {
    return Object.entries(profile.anchors).every(([id, rule]) => within(vector[id], rule)) && Object.keys(profile.targets).every(id => Math.abs(vector[id] - profile.targets[id]) <= method.maximumSingleFacetDistance + EPS);
  }
  function distance(profile, vector) {
    const ids = Object.keys(profile.targets);
    return ids.reduce((n, id) => n + Math.abs(vector[id] - profile.targets[id]), 0) / ids.length;
  }
  function ranking(profiles, vector) {
    return profiles.filter(p => eligible(p, vector)).map(profile => ({ profile, distance: distance(profile, vector) })).filter(p => p.distance <= method.maximumMeanDistance + EPS).sort((a, b) => a.distance - b.distance || a.profile.id.localeCompare(b.profile.id));
  }
  // The maximum advantage of another type over the winner is attained at a
  // piecewise-linear breakpoint. This checks all missing-answer completions,
  // not just one arbitrary imputation or a statistical confidence interval.
  function differenceBounds(winner, other, axes, bounds) {
    let low = 0, high = 0;
    for (const id of axes) {
      const [lo, hi] = bounds[id], a = winner.targets[id], b = other.targets[id];
      const points = [lo, hi, a, b].filter(x => x >= lo - EPS && x <= hi + EPS);
      const differences = points.map(x => Math.abs(x - a) - Math.abs(x - b));
      low += Math.min(...differences); high += Math.max(...differences);
    }
    return [low / axes.length, high / axes.length];
  }
  function possiblyEligible(profile, bounds) {
    return Object.keys(profile.targets).every(id => {
      const [lo, hi] = bounds[id], rule = profile.anchors[id] || {}, target = profile.targets[id];
      return Math.max(lo, number(rule.min) ? rule.min : -100, target - method.maximumSingleFacetDistance) <= Math.min(hi, number(rule.max) ? rule.max : 100, target + method.maximumSingleFacetDistance) + EPS;
    });
  }
  function alwaysEligible(profile, axes, bounds) {
    return axes.every(id => bounds[id].every(x => within(x, profile.anchors[id] || {}) && Math.abs(x - profile.targets[id]) <= method.maximumSingleFacetDistance + EPS));
  }
  function evidence(profile, facets) {
    return Object.keys(profile.targets).map(id => {
      const f = facets[id], x = value(f), t = profile.targets[id];
      const direction = x > 0 ? f.positive : x < 0 ? f.negative : '均值居中';
      return { id, name: f.name, value: x, target: t, bounds: interval(f), valid: f.valid, description: f.name + '：' + signed(x) + '（' + direction + '），参考型为 ' + signed(t) + '；有效回答 ' + f.valid + '/6。' };
    });
  }
  function analyzeDimension(section, resultFacets) {
    const facets = Object.fromEntries(resultFacets.filter(f => section.axes.includes(f.id)).map(f => [f.id, f]));
    const matching = section.matchingAxes.map(id => facets[id]), profiles = config.profiles.filter(p => p.section === section.section);
    const usable = matching.filter(f => value(f) !== null);
    const allFacets = section.axes.map(id => facets[id]).filter(Boolean);
    const group = {
      id: section.id, section: section.section, status: 'insufficient', title: '信息不足，暂不比较派别', candidates: [],
      facets: allFacets, coverage: { valid: allFacets.reduce((n, f) => n + (number(f.valid) ? f.valid : 0), 0), total: section.axes.length * 6, reportable: usable.length, required: section.matchingAxes.length },
      basis: matching.map((f, i) => f ? f.name + '：' + (value(f) === null ? '信息不足' : signed(value(f))) + '，有效回答 ' + f.valid + '/6。' : section.matchingAxes[i] + '：尚未记录。'),
      limitations: ['仅比较本维度的 ' + profiles.length + ' 个预设参考型，未涵盖或未匹配不等于排除其他思想。', '参考向量及分界为编制规则，尚待真实样本校准；人物用于介绍相关传统，不代表你赞同其全部主张，也不是人物的模拟答卷。'],
      sensitivity: { oneStep: false, missing: false, nearTie: false, alternatives: [] }, mixedFacets: []
    };
    if (section.id === 'ecology') {
      const f = facets.EVID;
      group.basis.push('经验判断可修正性：' + (value(f) === null ? '信息不足' : signed(value(f))) + '；仅作自述，不参与派别比较或作答质量判断。');
    }
    if (section.id === 'international') group.limitations.push('对外强制手段包含人道干预、威慑和海外利益等不同情境；均值不能证明支持侵略战争，成员资格也不等于民族或宗教身份。');
    if (usable.length !== section.matchingAxes.length) {
      group.limitations.push('参与比较的每个分面都须至少有 5/6 项有效立场回答；U、×和漏答不当作中立或反对。');
      return group;
    }
    const vector = Object.fromEntries(section.matchingAxes.map(id => [id, value(facets[id])]));
    const bounds = Object.fromEntries(section.matchingAxes.map(id => [id, interval(facets[id])]));
    group.mixedFacets = matching.filter(f => f.pattern === 'mixed').map(f => f.id);
    const neutral = matching.every(f => f.pattern === 'neutral' || (Array.isArray(f.items) && f.items.filter(q => number(q.oriented)).length >= 5 && f.items.filter(q => number(q.oriented)).every(q => q.oriented === 4)));
    if (neutral) { group.status = 'neutral'; group.title = '本维度所答立场均为中立'; return group; }
    if (Math.max(...Object.values(vector).map(Math.abs)) < method.quietZone) {
      group.status = 'mixed'; group.title = '均值居中，尚无清晰的派别接近方向';
      group.limitations.push(group.mixedFacets.length ? '存在同一分面内的支持与反对，均值居中不等于每道题都中立。请结合逐题依据理解。' : '轻微倾向可能同时落在多个传统附近，本栏目暂不强行给出流派。');
      return group;
    }
    const ranked = ranking(profiles, vector), first = ranked[0];
    if (!first) {
      group.status = 'unmatched'; group.title = '交叉组合，未匹配现有参考型';
      group.limitations.push('保留各分面的实际组合；不会仅因必须给出一个名称而选择距离很远或核心方向冲突的派别。');
      return group;
    }
    const winner = first.profile, alternatives = new Set();
    group.sensitivity.nearTie = !!ranked[1] && ranked[1].distance - first.distance <= method.nearTieMargin + EPS;
    if (group.sensitivity.nearTie) alternatives.add(ranked[1].profile.id);
    const missing = matching.some(f => f.valid < 6);
    if (missing) {
      if (!alwaysEligible(winner, section.matchingAxes, bounds)) group.sensitivity.missing = true;
      const greatestWinnerDistance = section.matchingAxes.reduce((n, id) => n + Math.max(...bounds[id].map(x => Math.abs(x - winner.targets[id]))), 0) / section.matchingAxes.length;
      if (greatestWinnerDistance > method.maximumMeanDistance + EPS) group.sensitivity.missing = true;
      for (const p of profiles) if (p.id !== winner.id && possiblyEligible(p, bounds) && differenceBounds(winner, p, section.matchingAxes, bounds)[1] >= -method.nearTieMargin - EPS) { group.sensitivity.missing = true; alternatives.add(p.id); }
    }
    // Move exactly one valid oriented response by one response category. Axis
    // means retain the current denominator; unavailable answers are not moved.
    for (const f of matching) {
      const oriented = (f.items || []).map(q => q.oriented).filter(x => number(x) && x >= 1 && x <= 7);
      const movements = new Set();
      if (oriented.some(x => x < 7)) movements.add(1);
      if (oriented.some(x => x > 1)) movements.add(-1);
      for (const move of movements) {
        const shifted = { ...vector, [f.id]: clamp(vector[f.id] + move * 100 / (3 * f.valid)) };
        const next = ranking(profiles, shifted);
        if (!next[0] || next[0].profile.id !== winner.id || next[1] && next[1].distance - next[0].distance <= method.nearTieMargin + EPS) {
          group.sensitivity.oneStep = true;
          if (next[0] && next[0].profile.id !== winner.id) alternatives.add(next[0].profile.id);
          if (next[1] && next[1].profile.id !== winner.id && next[1].distance - next[0].distance <= method.nearTieMargin + EPS) alternatives.add(next[1].profile.id);
        }
      }
    }
    group.sensitivity.alternatives = [...alternatives];
    const uncertain = group.sensitivity.oneStep || group.sensitivity.missing || group.sensitivity.nearTie;
    group.status = uncertain ? 'tentative' : 'closest';
    const selected = [first];
    if (uncertain && alternatives.size) {
      const other = profiles.filter(p => alternatives.has(p.id)).map(profile => ({ profile, distance: distance(profile, vector) })).sort((a, b) => a.distance - b.distance || a.profile.id.localeCompare(b.profile.id))[0];
      if (other) selected.push(other);
    }
    group.candidates = selected.map(({ profile, distance: d }, index) => {
      const current = index === 0 || eligible(profile, vector) && d <= method.maximumMeanDistance + EPS && d - first.distance <= method.nearTieMargin + EPS;
      return { ...profile, relation: current ? 'current' : 'conditional', condition: current ? index === 0 ? '当前均值组合下较接近' : '当前均值组合下并列接近' : '补齐缺答或小幅改答后才可能接近，当前不作为同等结论', distance: round(d), evidence: evidence(profile, facets) };
    });
    group.title = uncertain ? selected.length > 1 ? '接近方向存在并列或边界' : '暂时较接近，结论对小幅变化敏感' : '本维度较接近：' + winner.label;
    if (group.sensitivity.nearTie) group.limitations.push('最前两项的距离差不超过 6 分，不能稳妥地只选一个派别。');
    if (group.sensitivity.missing) group.limitations.push('把尚缺的回答在允许范围内补齐，可能改变最接近方向或是否达到比较条件；此范围不是统计置信区间。');
    if (group.sensitivity.oneStep) group.limitations.push('任一已答立场改变一个选项等级，可能改变排序、进入并列或越过比较条件，因此保留边界提示。');
    if (group.mixedFacets.length) group.limitations.push('部分分面同时存在支持和反对；接近方向只概括均值组合，不抹去逐题分歧。');
    if (alternatives.size > 1) group.limitations.push('可能接近的参考型不止两个，此处展示当前距离较小的两个，宜继续核验具体主张。');
    return group;
  }
  function analyze(result) {
    const facets = result && Array.isArray(result.facets) ? result.facets : [];
    return config.sections.map(section => analyzeDimension(section, facets));
  }
  return Object.freeze({ config, profiles: config.profiles, sections: config.sections, analyze });
});
