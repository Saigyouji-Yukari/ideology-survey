/* 教程页的“复制网址”按钮。QQ／微信可能禁止自动复制，此时选中文字并提示长按复制。 */
(function () {
  'use strict';
  document.addEventListener('click', async event => {
    const button = event.target.closest('button[data-copy]');
    if (!button) return;
    const input = document.getElementById(button.dataset.copy);
    const status = button.closest('.help-url') && button.closest('.help-url').querySelector('.help-copy-status');
    const say = text => { if (status) status.textContent = text; };
    if (!input) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(input.value);
      say('已复制网址。粘贴到电脑或手机浏览器的地址栏即可打开。');
    } catch (_) {
      input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      say(ok ? '已复制网址。粘贴到电脑或手机浏览器的地址栏即可打开。' : '无法自动复制。网址已选中，请长按选择“复制”。');
    }
  });
})();
