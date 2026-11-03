/* Local, paged PNG export. html2canvas is vendored; no report or image leaves this browser. */
(function (root) {
  'use strict';
  const WIDTH = 760, BODY_HEIGHT = 1000, BATCH_SIZE = 6;
  let active = null, sequence = 0;
  const doc = root.document;
  const normal = text => String(text || '').replace(/\s+/g, '');
  const tick = () => new Promise(resolve => root.setTimeout(resolve, 0));
  function element(tag, cls, text) {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function button(label, action) {
    const el = element('button', 'btn secondary', label); el.type = 'button';
    if (action) el.addEventListener('click', action);
    return el;
  }
  function stripIds(el) {
    [el, ...el.querySelectorAll('[id]')].forEach(node => node.removeAttribute('id'));
    return el;
  }
  function snapshot(report) {
    const copy = report.cloneNode(true);
    // The copy is never scrolled into view, so lazily loaded thumbnails would wait forever.
    copy.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
    const originalSelects = report.querySelectorAll('select');
    copy.querySelectorAll('select').forEach((select, i) => {
      const source = originalSelects[i] || select;
      const value = element('span', 'image-selected-value', source.options[source.selectedIndex] ? source.options[source.selectedIndex].text : source.value);
      select.replaceWith(value);
    });
    copy.querySelectorAll('button,input,textarea,script,style,.no-print,[data-export-ignore]').forEach(el => el.remove());
    copy.querySelectorAll('details').forEach(el => { el.open = true; });
    copy.querySelectorAll('[data-viz]').forEach(el => { el.removeAttribute('data-viz'); el.dataset.ready = 'true'; });
    // Preserve computed chart colours and the current compass rotation/axis selection.
    const properties = ['fill','stroke','stroke-width','stroke-dasharray','opacity','fill-opacity','stroke-opacity','font-family','font-size','font-weight','text-anchor','dominant-baseline','paint-order','stroke-linejoin','stroke-linecap'];
    const originals = report.querySelectorAll('svg');
    copy.querySelectorAll('svg').forEach((svg, i) => {
      const origin = originals[i]; if (!origin) return;
      const src = [origin, ...origin.querySelectorAll('*')], dst = [svg, ...svg.querySelectorAll('*')];
      src.forEach((node, j) => {
        const style = root.getComputedStyle(node);
        properties.forEach(property => { const value = style.getPropertyValue(property); if (value) dst[j].style.setProperty(property, value); });
      });
      svg.removeAttribute('tabindex');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const vb = svg.viewBox.baseVal;
      if (vb && vb.width && vb.height) {
        // Normal report SVGs permit overflow for axis labels. A bitmap clips at
        // its viewport, so include the actual painted geometry in this copy.
        let left = vb.x, top = vb.y, right = vb.x + vb.width, bottom = vb.y + vb.height;
        try {
          const bounds = origin.getBBox();
          left = Math.min(left, bounds.x - 10); top = Math.min(top, bounds.y - 10);
          right = Math.max(right, bounds.x + bounds.width + 10); bottom = Math.max(bottom, bounds.y + bounds.height + 10);
        } catch (_) { /* A hidden diagram retains its original viewBox. */ }
        const widthBox = right - left, heightBox = bottom - top;
        svg.setAttribute('viewBox', [left,top,widthBox,heightBox].join(' '));
        const width = Math.min(WIDTH - 80, widthBox, (BODY_HEIGHT - 80) * widthBox / heightBox);
        svg.style.width = width + 'px'; svg.style.height = width * heightBox / widthBox + 'px';
        svg.setAttribute('width', String(width)); svg.setAttribute('height', String(width * heightBox / widthBox));
        svg.style.maxWidth = 'none'; svg.style.maxHeight = 'none';
      }
    });
    return stripIds(copy);
  }
  function unitsFrom(node, units) {
    if (node.nodeType === 3) {
      if (node.textContent.trim()) units.push(element('p', 'image-inline-line', node.textContent));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'table') {
      const header = node.querySelector('thead');
      const rows = [...node.querySelectorAll('tbody > tr')];
      if (!rows.length) { units.push(node.cloneNode(true)); return; }
      rows.forEach(row => {
        const table = node.cloneNode(false);
        if (header) table.append(header.cloneNode(true));
        const body = element('tbody'); body.append(row.cloneNode(true)); table.append(body);
        table.dataset.repeatHeader = header ? normal(header.textContent) : '';
        units.push(table);
      });
      return;
    }
    if (/^(h[1-6]|p|summary|blockquote|svg|img|meter)$/.test(tag) || node.matches('.tendency-person,.vz-track,.vz-qbar,.vz-row-head,.report-poles,.vz-legend,.vz-claim,.vz-progress')) {
      units.push(node.cloneNode(true)); return;
    }
    // List items with prose children are split naturally; simple items retain their bullet.
    if (tag === 'li' && !node.querySelector('p,ul,ol,table,figure,svg')) {
      const ul = element('ul', 'image-single-item'); ul.append(node.cloneNode(true)); units.push(ul); return;
    }
    if (!node.childNodes.length) return;
    if (!node.querySelector('h1,h2,h3,h4,h5,h6,p,summary,blockquote,svg,img,meter,table,figure,ul,ol,section,article,details,div,li')) {
      units.push(node.cloneNode(true)); return;
    }
    [...node.childNodes].forEach(child => unitsFrom(child, units));
  }
  function sourceText(node) {
    if (node.tagName === 'TABLE' && node.dataset.repeatHeader) {
      return normal(node.querySelector('tbody').textContent);
    }
    return normal(node.textContent);
  }
  function fragmentSlice(node, start, end) {
    const walker = doc.createTreeWalker(node, root.NodeFilter.SHOW_TEXT);
    const texts = []; let current, total = 0;
    while ((current = walker.nextNode())) { texts.push({ node:current, start:total, end:total + current.length }); total += current.length; }
    const range = doc.createRange();
    const first = texts.find(item => item.end > start) || texts[texts.length - 1];
    const last = texts.find(item => item.end >= end) || texts[texts.length - 1];
    if (!first || !last) return node.cloneNode(true);
    range.setStart(first.node, Math.max(0, start - first.start)); range.setEnd(last.node, Math.max(0, end - last.start));
    const shell = node.cloneNode(false); shell.append(range.cloneContents()); return shell;
  }
  function fits(body) { return body.scrollHeight <= BODY_HEIGHT + 1; }
  function wrapUnit(node) { const wrap = element('div', 'image-unit'); wrap.append(node); return wrap; }
  function measure(host, node) {
    const wrap = wrapUnit(node); host.append(wrap); const height = host.scrollHeight; wrap.remove(); return height;
  }
  async function paginate(copy, sandbox, cancelled) {
    const originalUnits = []; [...copy.childNodes].forEach(node => unitsFrom(node, originalUnits));
    const source = originalUnits.map(sourceText).join('');
    const expected = copy.cloneNode(true);
    expected.querySelectorAll('thead').forEach(header => header.remove());
    if (normal(expected.textContent) !== source) throw new Error('报告内容提取检查未通过，请刷新报告后重试。');
    const body = element('div', 'omni-image-content omni-report'); sandbox.append(body);
    const pages = []; let page = [];
    function finish() { if (page.length) { pages.push(page); page = []; body.replaceChildren(); } }
    const queue = originalUnits.slice();
    for (let i = 0; i < queue.length; i++) {
      if (cancelled()) throw new Error('EXPORT_CANCELLED');
      const unit = queue[i], previous = page[page.length - 1];
      // Keep adjacent rows together and repeat the header once per page.
      if (previous && previous.tagName === 'TABLE' && unit.tagName === 'TABLE' && previous.dataset.repeatHeader === unit.dataset.repeatHeader && previous.className === unit.className) {
        const row = unit.querySelector('tbody > tr').cloneNode(true); previous.querySelector('tbody').append(row);
        if (fits(body)) continue;
        row.remove(); finish(); i--; continue;
      }
      const wrap = wrapUnit(unit); body.append(wrap);
      if (fits(body)) page.push(unit);
      else {
        wrap.remove();
        if (page.length) { finish(); i--; continue; }
        // A very long block (e.g. the 358-name catalogue or a free-text response)
        // is divided at real DOM text offsets, never cropped by canvas height.
        const text = unit.textContent || '';
        if (text.length > 80 && !unit.matches('svg,.tendency-person') && !unit.querySelector('svg,img')) {
          let low = 1, high = text.length - 1, accepted = 0;
          while (low <= high) {
            let middle = Math.floor((low + high) / 2);
            if (middle > 0 && /[\uD800-\uDBFF]/.test(text[middle - 1])) middle--;
            if (!middle) { low++; continue; }
            if (measure(body, fragmentSlice(unit, 0, middle)) <= BODY_HEIGHT) { accepted = middle; low = middle + 1; }
            else high = middle - 1;
          }
          if (!accepted) throw new Error('这段报告无法安全分页，请缩短过长的单条补充文字后重试。');
          queue.splice(i, 1, fragmentSlice(unit, 0, accepted), fragmentSlice(unit, accepted, text.length)); i--; continue;
        }
        // Complex blocks are divided by semantic child boundaries first.
        const children = []; [...unit.childNodes].forEach(child => unitsFrom(child, children));
        if (children.length > 1) { queue.splice(i, 1, ...children); i--; continue; }
        throw new Error('报告中有无法容纳的图表或内容块，请稍后重试。');
      }
      if (i % 24 === 0) await tick();
    }
    finish(); body.remove();
    // The comparison includes table body text once; repeated headings are deliberate.
    const output = pages.flat().map(sourceText).join('');
    if (source !== output) throw new Error('分页完整性检查未通过，未生成可能缺漏的图片。');
    return { pages, sourceText:source, pageTexts:pages.map(parts => parts.map(sourceText).join('')) };
  }
  async function imagesReady(scope) {
    const images = [...scope.querySelectorAll('img')];
    await Promise.all(images.map(img => new Promise((resolve, reject) => {
      if (img.complete) return img.naturalWidth ? resolve() : reject(new Error('人物头像尚未载入，请联网刷新原报告后重试。'));
      const timer = root.setTimeout(() => reject(new Error('图像载入超时，请重试本页。')), 12000);
      img.addEventListener('load', () => { root.clearTimeout(timer); resolve(); }, { once:true });
      img.addEventListener('error', () => { root.clearTimeout(timer); reject(new Error('图像载入失败，请重试本页。')); }, { once:true });
    })));
  }
  async function rasterizeDiagrams(scope) {
    // html2canvas 1.4 can crop inline SVG when CSS and intrinsic sizing differ.
    // Rasterize a bounded, explicitly sized SVG copy first, then draw that PNG.
    for (const svg of scope.querySelectorAll('svg')) {
      const rect = svg.getBoundingClientRect(), copy = svg.cloneNode(true);
      const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
      copy.setAttribute('width', String(width)); copy.setAttribute('height', String(height));
      copy.style.width = width + 'px'; copy.style.height = height + 'px'; copy.style.maxWidth = 'none'; copy.style.maxHeight = 'none';
      const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new root.XMLSerializer().serializeToString(copy));
      const image = new root.Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('图表转换失败，请重试这一页。')); image.src = src; });
      const canvas = doc.createElement('canvas');
      try {
        canvas.width = Math.ceil(width * 1.5); canvas.height = Math.ceil(height * 1.5);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const png = element('img', 'omni-export-diagram'); png.src = canvas.toDataURL('image/png');
        png.alt = svg.getAttribute('aria-label') || '报告图表'; png.width = width; png.height = height;
        png.style.width = width + 'px'; png.style.height = height + 'px'; png.style.display = 'block'; png.style.margin = 'auto';
        svg.replaceWith(png);
      } finally { canvas.width = 1; canvas.height = 1; }
    }
  }
  function makeSheet(parts, id, number, count) {
    const sheet = element('div', 'omni-image-sheet');
    const header = element('header', 'omni-image-header');
    header.append(element('strong', '', '个人立场报告'), element('span', '', '答卷 ' + id));
    const content = element('div', 'omni-image-content omni-report');
    parts.forEach(part => content.append(wrapUnit(part.cloneNode(true))));
    const footer = element('footer', 'omni-image-footer', '第 ' + number + ' / ' + count + ' 页 · 本报告描述本次作答，未检验不表示不接近');
    sheet.append(header, content, footer); return sheet;
  }
  function open(report, options) {
    if (!report || !report.querySelector) throw new Error('未找到可导出的报告。');
    if (active) active.close();
    options = options || {};
    const id = String(options.id || '未命名').slice(0, 100), token = ++sequence;
    const previousFocus = doc.activeElement, previousOverflow = doc.body.style.overflow;
    let closed = false, running = false, stopped = false, plan = null, batchIndex = 0;
    const generated = new Set();
    const overlay = element('div', 'omni-export-overlay'), panel = element('section', 'omni-export-dialog omni-image-dialog');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'omni-image-title'); panel.tabIndex = -1;
    const title = element('h2', '', '报告分批导出为图片'); title.id = 'omni-image-title';
    const head = element('div', 'omni-export-dialog-head');
    const closeButton = button('关闭', close); head.append(title, closeButton);
    const help = element('p', 'help', '每批最多 6 页。图片在本机生成，QQ 等浏览器可逐张长按保存；也可使用每张图下方的保存按钮。原始作答、资料依据与未检验目录会展开后完整分页。图片供阅读和分享，不能作为结构化答卷导入计分器；需要导入时请使用分段答卷代码或完整答卷文件。');
    const notice = element('p', 'notice', '正在准备分页…'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
    const controls = element('div', 'actions omni-image-controls');
    const previous = button('上一批', () => switchBatch(batchIndex - 1));
    const select = element('select', 'input omni-image-batch'); select.setAttribute('aria-label', '图片批次');
    const next = button('下一批', () => switchBatch(batchIndex + 1));
    const generate = button('生成本批图片', () => renderBatch());
    const cancel = button('暂停生成', () => { stopped = true; notice.textContent = '本批已暂停。已生成图片仍可保存，点击“生成本批图片”可重试。'; });
    const preview = element('div', 'omni-image-previews');
    const warning = element('p', 'help omni-image-warning', '只保存当前批次不会包含整份报告；请依次生成并保存全部批次。切换批次会清除当前预览，请先保存。');
    controls.append(previous, select, next, generate, cancel); panel.append(head, help, notice, controls, warning, preview); overlay.append(panel);
    const sandbox = element('div', 'omni-image-sandbox'); sandbox.setAttribute('aria-hidden', 'true');
    doc.body.append(overlay, sandbox); doc.body.style.overflow = 'hidden'; panel.focus();
    function cancelled() { return closed || token !== sequence; }
    function updateControls() {
      previous.disabled = running || !plan || batchIndex <= 0; next.disabled = running || !plan || batchIndex >= Math.ceil(plan.pages.length / BATCH_SIZE) - 1;
      select.disabled = running || !plan; generate.disabled = running || !plan; cancel.disabled = !running;
    }
    function batchStatus() {
      const start = batchIndex * BATCH_SIZE, end = Math.min(start + BATCH_SIZE, plan.pages.length);
      return '共 ' + plan.pages.length + ' 页；本批第 ' + (start + 1) + '～' + end + ' 页。已成功生成 ' + generated.size + '/' + plan.pages.length + ' 页（生成不代表已保存）。';
    }
    function releasePreview() { preview.querySelectorAll('img').forEach(img => img.removeAttribute('src')); preview.replaceChildren(); }
    function switchBatch(index) {
      if (running || !plan || index < 0 || index >= Math.ceil(plan.pages.length / BATCH_SIZE)) return;
      batchIndex = index; select.value = String(index); releasePreview(); notice.textContent = batchStatus() + ' 点击“生成本批图片”。'; updateControls();
    }
    select.addEventListener('change', () => switchBatch(Number(select.value)));
    async function renderPage(index, figure) {
      if (cancelled() || stopped) return;
      figure.replaceChildren(element('p', 'help', '正在生成第 ' + (index + 1) + ' 页…'));
      let sheet, canvas;
      try {
        sheet = makeSheet(plan.pages[index], id, index + 1, plan.pages.length); sandbox.append(sheet);
        await rasterizeDiagrams(sheet); await imagesReady(sheet); if (cancelled() || stopped) return;
        if (!fits(sheet.querySelector('.omni-image-content'))) throw new Error('本页高度检查未通过，请重新打开导出窗口。');
        canvas = await root.html2canvas(sheet, { backgroundColor:'#ffffff', scale:1.5, width:WIDTH, height:1140, windowWidth:1024, windowHeight:1400, scrollX:0, scrollY:0, logging:false, useCORS:false, allowTaint:false, imageTimeout:12000, removeContainer:true });
        if (cancelled() || stopped) return;
        const data = canvas.toDataURL('image/png');
        if (!data.startsWith('data:image/png;base64,')) throw new Error('浏览器未能生成 PNG，请重试。');
        const image = element('img', 'omni-export-page-image'); image.alt = '答卷 ' + id + '，第 ' + (index + 1) + '/' + plan.pages.length + ' 页；长按图片保存'; image.src = data;
        const caption = element('figcaption', '', '第 ' + (index + 1) + ' / ' + plan.pages.length + ' 页 · 长按图片保存');
        const save = element('a', 'btn secondary', '保存这一页 PNG'); save.href = data; save.download = '立场报告-' + id.replace(/[^\w\u4e00-\u9fff-]/g, '_') + '-' + String(index + 1).padStart(3, '0') + '.png';
        figure.replaceChildren(image, caption, save); generated.add(index);
      } catch (error) {
        if (!cancelled()) figure.replaceChildren(element('p', 'notice warning', '第 ' + (index + 1) + ' 页生成失败：' + error.message), button('重试这一页', async () => {
          if (running) return; running = true; stopped = false; updateControls();
          await renderPage(index, figure); running = false; updateControls(); if (!cancelled()) notice.textContent = batchStatus();
        }));
      } finally {
        if (canvas) { canvas.width = 1; canvas.height = 1; }
        if (sheet) sheet.remove();
      }
    }
    async function renderBatch() {
      if (running || !plan || cancelled()) return;
      if (typeof root.html2canvas !== 'function') { notice.textContent = '图片组件尚未载入，请刷新网页后重试；原答卷仍保存在本机。'; return; }
      running = true; stopped = false; releasePreview(); updateControls();
      const start = batchIndex * BATCH_SIZE, end = Math.min(start + BATCH_SIZE, plan.pages.length);
      for (let i = start; i < end; i++) {
        if (cancelled() || stopped) break;
        notice.textContent = '正在生成第 ' + (i + 1) + '/' + plan.pages.length + ' 页，请保持此窗口打开…';
        const figure = element('figure', 'omni-export-image-preview'); preview.append(figure);
        await renderPage(i, figure); await tick();
      }
      running = false; updateControls();
      if (!cancelled()) notice.textContent = (stopped ? '已暂停。' : '') + batchStatus() + (generated.size < plan.pages.length ? ' 仍有页面尚未生成，请继续其他批次。' : ' 所有页面均已生成过，请确认每批图片已经保存。');
    }
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll('button,a[href],select')].filter(el => !el.disabled);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (doc.activeElement === first || doc.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    function close() {
      if (closed) return; closed = true; stopped = true;
      releasePreview(); overlay.remove(); sandbox.remove(); doc.body.style.overflow = previousOverflow; doc.removeEventListener('keydown', onKey);
      if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus();
      plan = null; if (active && active.token === token) active = null;
    }
    doc.addEventListener('keydown', onKey); updateControls();
    const api = { token, close, get pageCount() { return plan ? plan.pages.length : 0; }, inspect() { return plan ? { pageCount:plan.pages.length, sourceText:plan.sourceText, pageTexts:plan.pageTexts.slice(), pageGraphics:plan.pages.map(parts => ({svg:parts.reduce((sum,part)=>sum+(part.tagName.toLowerCase()==='svg'?1:0)+part.querySelectorAll('svg').length,0),portraits:parts.reduce((sum,part)=>sum+part.querySelectorAll('.tendency-portrait').length,0)})), generated:[...generated] } : null; } };
    active = api;
    api.ready = (async () => {
      try {
        const copy = snapshot(report);
        await imagesReady(copy); if (cancelled()) return;
        plan = await paginate(copy, sandbox, cancelled); if (cancelled()) return;
        for (let index = 0; index < Math.ceil(plan.pages.length / BATCH_SIZE); index++) {
          const option = element('option', '', '第 ' + (index + 1) + ' 批 · ' + (index * BATCH_SIZE + 1) + '～' + Math.min((index + 1) * BATCH_SIZE, plan.pages.length) + ' 页'); option.value = String(index); select.append(option);
        }
        notice.textContent = batchStatus() + ' 点击“生成本批图片”；也可以选择任意批次。'; updateControls();
      } catch (error) {
        if (!cancelled() && error.message !== 'EXPORT_CANCELLED') { notice.textContent = '图片准备失败：' + error.message; notice.classList.add('warning'); }
      }
    })();
    return api;
  }
  root.OMNI_IMAGE_EXPORT = Object.freeze({ open, get active() { return active; } });
})(typeof window !== 'undefined' ? window : globalThis);
