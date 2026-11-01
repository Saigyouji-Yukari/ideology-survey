/* Local-only importer. Uses the same validated data and report as the survey. */
(function (root) {
  'use strict';
  const MAX_RECORDS = 200;
  const MAX_BYTES = 10 * 1024 * 1024;
  const D = root.OMNI_DATA, E = root.OMNI_ENGINE, S = root.OMNI_SESSION, R = root.OMNI_REPORT;
  const $ = id => document.getElementById(id);
  let sessions = [];
  let selectedIndex = 0;

  function status(message) { $('import-status').textContent = message; }

  function showErrors(errors) {
    const box = $('import-errors');
    box.hidden = !errors.length;
    box.innerHTML = errors.length ? '<strong>以下条目没有导入</strong><ul>' + errors.map(error => '<li>' + R.escape(error) + '</li>').join('') + '</ul>' : '';
  }

  function validate(value) {
    // Both entry points share the session schema, including original blind answers.
    return S.validate(D, typeof value === 'string' ? E.decodeSession(value) : value);
  }

  function extract(text) {
    const value = text.trim();
    if (!value) throw new Error('文本为空。');
    if (value[0] === '[' || value[0] === '{') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        // JSON Lines falls through to the per-line reader; formatted malformed
        // JSON is retained as one item so the error is not multiplied.
        if (value[0] === '[' || !value.split(/\r?\n/).filter(line => line.trim()).every(line => line.trim().startsWith('{'))) throw new Error('JSON 格式不完整，请重新复制或导入原文件。');
      }
    }
    return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  function parseSources(sources) {
    let size = 0;
    let count = 0;
    const records = [], errors = [];
    for (const source of sources) {
      size += new TextEncoder().encode(source.text).length;
      if (size > MAX_BYTES) throw new Error('总文本超过 10 MB，请分批导入。');
      let entries;
      try { entries = extract(source.text); }
      catch (error) { errors.push(source.name + '：' + error.message); continue; }
      if (count + entries.length > MAX_RECORDS) throw new Error('一次最多导入 200 份答卷，请分批处理。');
      entries.forEach((entry, i) => {
        count += 1;
        try { records.push(validate(entry)); }
        catch (error) { errors.push(source.name + '，第 ' + (i + 1) + ' 份：' + error.message); }
      });
    }
    return {records, errors};
  }

  function displaySelected() {
    const session = sessions[selectedIndex];
    $('admin-report').innerHTML = session ? R.render(session) : '';
  }

  function setSessions(records) {
    sessions = records;
    selectedIndex = 0;
    $('session-select').replaceChildren();
    sessions.forEach((session, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = (i + 1) + '. ' + (session.id || '未命名答卷') + (session.finished ? '' : '（阶段报告）');
      $('session-select').appendChild(option);
    });
    $('admin-controls').hidden = !sessions.length;
    $('batch-summary').textContent = sessions.length ? '共 ' + sessions.length + ' 份有效导入。下方显示一份答卷；批量导出包含所有已导入答卷。' : '';
    displaySelected();
  }

  function importSources(sources) {
    try {
      const {records, errors} = parseSources(sources);
      setSessions(records);
      showErrors(errors);
      status('已导入 ' + records.length + ' 份答卷' + (errors.length ? '，' + errors.length + ' 项未成功。' : '。'));
    } catch (error) {
      showErrors([error.message]);
      status('本次导入未完成；此前已导入的列表保持原状。');
    }
  }

  function download(filename, text, type) {
    const blob = new Blob([text], {type});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeFilename(value) { return String(value || '答卷').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0,80); }

  function csvCell(value) {
    let text = value == null ? '' : String(value);
    // A downloaded spreadsheet must treat user-supplied labels as text.
    if (typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function csv(surveySessions) {
    const header = ['答卷编号','版本','是否提交','经过时间分钟_含离开','共同题有效','筛查有效','所选专题','所选补充组','补充题有效','补充题已呈现','已核验卡数','未检验卡数','U数','拒答数','已呈现漏答数'];
    D.core.axes.forEach(axis => header.push(axis.name + '_T',axis.name + '_有效',axis.name + '_缺答下界',axis.name + '_缺答上界'));
    header.push('核验状态与自我认同','原有自我认同','未盲核验记录','结束原因');
    const rows = surveySessions.map(session => {
      const result = E.analyze(session);
      const row = [session.id,D.version,session.finished ? '已提交' : '阶段报告',Math.round(session.elapsedMs / 6000) / 10,result.coverage.core.valid,result.coverage.screening.valid,session.selectedModules.join('；'),session.selectedSupplements.join('；'),result.coverage.supplements.valid,result.coverage.supplements.presented,result.coverage.testedCardCount,result.coverage.untestedCards.length,result.quality.unknown,result.quality.refused,result.quality.missing];
      result.facets.forEach(facet => row.push(facet.value,facet.valid,facet.bounds[0],facet.bounds[1]));
      row.push(result.cards.map(card => card.id + ' ' + card.name + '：' + card.status + '；I=' + (card.identity == null ? '未答' : card.identity) + '；K=' + (card.familiarity == null ? '未答' : card.familiarity)).join(' | '), session.answers.Z04 || '',session.catalogSeen ? '浏览过名称目录' : (session.unblindedEdits || []).join('；'),session.stopReason || '');
      return row;
    });
    return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  $('import-run').addEventListener('click', () => importSources([{name:'粘贴内容',text:$('import-text').value}]));
  $('import-files').addEventListener('change', async event => {
    const files = [...event.target.files];
    if (!files.length) return;
    if (files.length > MAX_RECORDS || files.reduce((sum,file) => sum + file.size,0) > MAX_BYTES) {
      showErrors(['一次最多 200 份，总文件大小不超过 10 MB。']);
      event.target.value = '';
      return;
    }
    $('import-run').disabled = true;
    status('正在读取本地文件……');
    try { importSources(await Promise.all(files.map(async file => ({name:file.name,text:await file.text()})))); }
    catch (error) { showErrors(['文件读取失败：' + error.message]); status('未能读取文件。'); }
    finally { $('import-run').disabled = false; event.target.value = ''; }
  });
  $('import-clear').addEventListener('click', () => {
    $('import-text').value = '';
    setSessions([]); showErrors([]); status('已清空本页答卷。');
  });
  $('session-select').addEventListener('change', event => { selectedIndex = Number(event.target.value); displaySelected(); });
  $('export-csv').addEventListener('click', () => {
    if (sessions.length) download('OMNI-批量分析汇总.csv', csv(sessions), 'text/csv;charset=utf-8');
  });
  $('export-json').addEventListener('click', () => {
    if (sessions[selectedIndex]) download('OMNI-' + safeFilename(sessions[selectedIndex].id) + '.json', JSON.stringify(sessions[selectedIndex],null,2), 'application/json;charset=utf-8');
  });
  $('print-report').addEventListener('click', () => {
    if (!sessions[selectedIndex]) return;
    const details = [...$('admin-report').querySelectorAll('details')];
    const open = details.map(detail => detail.open);
    details.forEach(detail => { detail.open = true; });
    const restore = () => details.forEach((detail,i) => { detail.open = open[i]; });
    root.addEventListener('afterprint',restore,{once:true});
    root.print();
  });

  root.OMNI_ADMIN = Object.freeze({parseSources,csv});
})(window);
