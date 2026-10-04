/* ============================================================
 *  校徽碰碰乐 · 进入前的免责声明弹窗
 *
 *  作者要求「每次进入都要有」，所以**不写任何 localStorage 记忆**：
 *  每次加载页面都重新弹一次，必须勾选「我阅读、理解并同意本声明」
 *  「开始游戏」按钮才会解除禁用。
 *
 *  勾选状态也不记忆 —— 刷新后回到未勾选，这是有意为之。
 *
 *  页脚的常驻免责声明是静态 HTML，不归这里管。
 * ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function bind() {
    const modal = $('gateModal');
    const check = $('gateCheck');
    const start = $('gateStart');
    if (!modal || !check || !start) return;

    const sync = () => { start.disabled = !check.checked; };
    check.addEventListener('change', sync);
    sync();

    function close() {
      // 收起之前再确认一次，避免用别的方式绕过勾选
      if (!check.checked) return;
      modal.classList.add('hide');
      modal.setAttribute('aria-hidden', 'true');
      // 完全移出可聚焦区域，保证后面的棋盘能正常收键盘/指针事件
      modal.style.display = 'none';
      /* 弹窗期间棋盘的 pointerdown 可能已经攒了状态，这里复位一下双手感相关的东西：
         交给 game.js 自己的 reset 更稳妥（它顺带画好「下一个」预览）。 */
      if (window.__DNW__ && window.__DNW__.reset) {
        try { window.__DNW__.reset(); } catch (e) { /* 忽略 */ }
      }
    }

    start.addEventListener('click', close);

    // 勾选后直接回车也能开始
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && check.checked) { e.preventDefault(); close(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.DanaiwaGate = { close: () => { const m = $('gateModal'); if (m) { m.style.display = 'none'; } } };
})();
