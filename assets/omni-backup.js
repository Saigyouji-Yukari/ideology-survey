/* Local-only backup UI. Encoded answers never leave this browser automatically. */
(function (root) {
  'use strict';
  let active = null;
  const T = () => root.OMNI_TRANSFER;
  function dialog(title, body) {
    if (active) active.close();
    const previous = document.activeElement, overflow = document.body.style.overflow;
    const overlay = document.createElement('div');
    overlay.className = 'backup-overlay no-print';
    overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-labelledby','backup-title');
    overlay.innerHTML = '<section class="backup-panel"><div class="backup-heading"><h2 id="backup-title">' + title + '</h2><button type="button" class="btn" data-backup-close>关闭</button></div>' + body + '</section>';
    function close() { overlay.remove(); document.body.style.overflow = overflow; document.removeEventListener('keydown',keys); active = null; if (previous && previous.isConnected) previous.focus(); }
    function keys(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const items = [...overlay.querySelectorAll('button,textarea,select,a[href],summary')].filter(el=>!el.disabled && el.getClientRects().length);
      const first = items[0], last = items[items.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    overlay.querySelector('[data-backup-close]').addEventListener('click',close);
    overlay.addEventListener('click',event=>{ if(event.target === overlay) close(); });
    document.addEventListener('keydown',keys); document.body.appendChild(overlay); document.body.style.overflow = 'hidden';
    active = {close}; overlay.querySelector('[data-backup-close]').focus();
    return {overlay,close,$:selector=>overlay.querySelector(selector)};
  }
  async function copy(textarea, status) {
    try {
      if (!root.navigator.clipboard || !root.navigator.clipboard.writeText) throw new Error('clipboard unavailable');
      await root.navigator.clipboard.writeText(textarea.value);
      status.textContent = '已复制。发送后请核对段号，全部片段都需要保留。'; return true;
    } catch (_) {
      textarea.focus(); textarea.select(); textarea.setSelectionRange(0,textarea.value.length);
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      status.textContent = ok ? '已复制。发送后请核对段号，全部片段都需要保留。' : '浏览器限制了自动复制。文字已选中，请长按文本选择“复制”，也可以逐段手动选择。';
      return ok;
    }
  }
  function download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text],{type})), link = document.createElement('a');
    link.href=url; link.download=name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function open(session) {
    if (!T()) throw new Error('备份组件尚未载入，请刷新页面。');
    const code = T().encode(session), parts = T().split(code);
    const ui = dialog('复制与分段备份',
      '<p>在 QQ 等内置浏览器中，建议把每一段分别发送。每段不超过 1000 个字符；接收方可在计分器中逐段加入，缺段或被修改时会明确提示。</p>' +
      '<p class="muted">只在本机处理。代码和导出文件包含完整作答，发送给他人前请确认这是你的意愿。</p>' +
      '<div class="backup-toolbar"><label for="backup-part-select">选择片段</label><select id="backup-part-select" class="input"></select><span class="backup-count"></span></div>' +
      '<label for="backup-part-text" class="help">当前片段（也可以长按选择复制）</label><textarea id="backup-part-text" class="input backup-code" readonly spellcheck="false" rows="7"></textarea>' +
      '<div class="actions"><button class="btn primary" type="button" data-part-copy>复制这一段</button><button class="btn" type="button" data-part-prev>上一段</button><button class="btn" type="button" data-part-next>下一段</button></div>' +
      '<p class="backup-status help" role="status" aria-live="polite"></p>' +
      '<details><summary>整份代码与文件备份</summary><p class="help">完整代码带有长度和校验信息。转发较长文本可能丢失末尾，聊天中优先使用上方分段方式。</p><label for="backup-full-text" class="help">整份答卷代码</label><textarea id="backup-full-text" class="input backup-code" readonly rows="6" spellcheck="false"></textarea><div class="actions"><button class="btn" type="button" data-full-copy>复制整份代码</button><button class="btn" type="button" data-json-download>下载 JSON 文件</button><button class="btn" type="button" data-parts-download>下载分段文本</button></div></details>');
    const select = ui.$('#backup-part-select'), text = ui.$('#backup-part-text'), status = ui.$('.backup-status');
    parts.forEach((_,index)=>{const option=document.createElement('option');option.value=index;option.textContent='第 '+(index+1)+' / '+parts.length+' 段';select.appendChild(option);});
    ui.$('#backup-full-text').value = code;
    function display() { const index=Number(select.value);text.value=parts[index];ui.$('.backup-count').textContent=parts[index].length+' 字符 · 共 '+parts.length+' 段';ui.$('[data-part-prev]').disabled=index===0;ui.$('[data-part-next]').disabled=index===parts.length-1;status.textContent='发送第 '+(index+1)+' 段，共 '+parts.length+' 段。请发送全部片段。'; }
    select.addEventListener('change',display);
    ui.$('[data-part-prev]').addEventListener('click',()=>{select.value=Number(select.value)-1;display();});
    ui.$('[data-part-next]').addEventListener('click',()=>{select.value=Number(select.value)+1;display();});
    ui.$('[data-part-copy]').addEventListener('click',()=>copy(text,status));
    ui.$('[data-full-copy]').addEventListener('click',()=>copy(ui.$('#backup-full-text'),status));
    ui.$('[data-json-download]').addEventListener('click',()=>{download(JSON.stringify(session,null,2),session.id+'-答卷.json','application/json;charset=utf-8');status.textContent='已请求下载。如果内置浏览器没有响应，请使用分段复制；无需重新答题。';});
    ui.$('[data-parts-download]').addEventListener('click',()=>download(parts.join('\n'),session.id+'-答卷分段.txt','text/plain;charset=utf-8'));
    display(); return ui;
  }
  function openImport(onImport) {
    if (!T()) throw new Error('备份组件尚未载入，请刷新页面。');
    const ui=dialog('粘贴与分段导入',
      '<p>可以粘贴完整答卷代码，或逐段粘贴聊天中收到的片段。顺序不限；收到全部片段并通过校验后才会导入。关闭此窗口会清空暂存片段。</p>' +
      '<label for="backup-import-text" class="help">粘贴完整代码或一个／多个片段</label><textarea id="backup-import-text" class="input backup-code" rows="8" spellcheck="false"></textarea>' +
      '<div class="actions"><button type="button" class="btn primary" data-import-add>加入片段／导入</button><button type="button" class="btn" data-import-reset>清空暂存片段</button></div><p class="backup-import-status notice" role="status" aria-live="polite">尚未加入片段。</p>');
    let pending=[];
    const text=ui.$('#backup-import-text'),status=ui.$('.backup-import-status');
    ui.$('[data-import-reset]').addEventListener('click',()=>{pending=[];text.value='';status.textContent='已清空暂存片段。';text.focus();});
    ui.$('[data-import-add]').addEventListener('click',async()=>{
      try {
        const value=text.value.trim();if(!value)throw new Error('请先粘贴代码或片段。');
        let session;
        if (/^OMNIP1\./.test(value)) {
          const candidate=pending.concat(value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean));
          const state=T().inspectParts(candidate.join('\n'));pending=candidate;
          if(!state.complete){status.textContent='已收到 '+state.received+' / '+state.total+' 段；还缺第 '+state.missing.join('、')+' 段。请粘贴其余片段。';text.value='';text.focus();return;}
          session=T().decode(candidate.join('\n'));
        } else {
          if(pending.length)throw new Error('已暂存分段，请继续加入剩余片段，或先清空暂存再导入另一份完整代码。');
          session=T().decode(value);
        }
        const accepted=await onImport(session);
        if(accepted!==false)ui.close();
      }catch(error){status.textContent='未导入：'+error.message;}
    });
    text.focus();return ui;
  }
  root.OMNI_BACKUP=Object.freeze({open,openImport});
})(window);
