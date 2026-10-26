// Drill "Reaction": như Where to run nhưng chỉ có 2–3 giây, trả lời bằng phím 1–9
// (bố cục bàn phím số: 7 8 9 = deep, 4 5 6 = mid, 1 2 3 = gần đĩa).
// Data: wiki/scenarios/ có sơ đồ sân và difficulty >= 3 (tuỳ chọn: tất cả).
import { renderScenario } from '../../ui/scenario-view.js';
import { recordAttempt, pickWeighted } from '../../ui/progress.js';

export function mount(root, { wiki, maxLevel, concept }) {
  root.innerHTML = `
    <div class="reaction-bar">
      <label>Thời gian <select id="rx-sec"><option value="2">2s</option><option value="3" selected>3s</option><option value="5">5s</option></select></label>
      <label><input type="checkbox" id="rx-all"> Gồm cả scenario dễ (difficulty &lt; 3)</label>
      <span id="rx-score"></span>
    </div>
    <div class="timer"><div class="timer-fill"></div></div>
    <div id="rx-stage"></div>`;
  const stage = root.querySelector('#rx-stage');
  const fill = root.querySelector('.timer-fill');
  const secSel = root.querySelector('#rx-sec');
  const allBox = root.querySelector('#rx-all');
  const scoreEl = root.querySelector('#rx-score');

  let view, current, timer, raf, state = 'ready';
  let streak = { n: 0, ok: 0, ms: [] };

  const pool = () => wiki.scenarios.filter(s => s.field && s.level <= maxLevel
    && (!concept || s.concept === concept) && (allBox.checked || s.difficulty >= 3));

  const showReady = () => {
    state = 'ready';
    cancelAnimationFrame(raf); clearTimeout(timer);
    fill.style.width = '0';
    const n = pool().length;
    stage.innerHTML = n
      ? `<div class="ready"><p>Tình huống hiện ra → bấm phím <b>1–9</b> thật nhanh.</p>
           <pre class="keypad">7 8 9   ← deep\n4 5 6   ← mid\n1 2 3   ← gần đĩa</pre>
           <p><kbd>Space</kbd> để bắt đầu (${n} scenario)</p></div>`
      : '<p class="empty">Không có scenario phù hợp — tick "Gồm cả scenario dễ" hoặc tăng level.</p>';
  };

  const start = () => {
    const p = pool();
    if (!p.length) return;
    state = 'running';
    current = pickWeighted(p, undefined, current?.id);
    const limit = +secSel.value * 1000;
    const t0 = performance.now();
    view = renderScenario(stage, current, {
      compact: true,
      onAnswer: (correct, chosen) => {
        state = 'answered';
        cancelAnimationFrame(raf); clearTimeout(timer);
        const ms = chosen == null ? limit : Math.round(performance.now() - t0);
        if (chosen == null) fill.style.width = '100%';
        recordAttempt({ scenario: current, drill: 'reaction', correct, chosen, ms });
        streak.n++; if (correct) { streak.ok++; streak.ms.push(ms); }
        const avg = streak.ms.length ? Math.round(streak.ms.reduce((a, b) => a + b) / streak.ms.length) : '—';
        scoreEl.textContent = `Phiên này: ${streak.ok}/${streak.n} đúng · TB ${avg} ms`;
        stage.querySelector('.verdict').insertAdjacentHTML('beforeend', ` <small>${ms} ms</small>`);
      },
    });
    timer = setTimeout(() => view.timeout(), limit);
    const tick = () => {
      fill.style.width = `${Math.min(100, (performance.now() - t0) / limit * 100)}%`;
      if (state === 'running') raf = requestAnimationFrame(tick);
    };
    tick();
  };

  const onKey = e => {
    const digit = e.code?.startsWith('Numpad') ? e.code.slice(6) : e.key;
    if (state === 'running' && /^[1-9]$/.test(digit)) view.key(+digit);
    else if ((e.key === ' ' || e.key === 'Enter') && state !== 'running') { e.preventDefault(); start(); }
  };
  document.addEventListener('keydown', onKey);
  allBox.addEventListener('change', showReady);
  showReady();
  return () => { document.removeEventListener('keydown', onKey); clearTimeout(timer); cancelAnimationFrame(raf); };
}
