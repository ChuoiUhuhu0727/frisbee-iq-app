// Drill "Where to run": nhìn sơ đồ sân → click vùng mình nên chạy (hoặc phím 1–9).
// Data: wiki/scenarios/ (cả dạng sơ đồ sân lẫn dạng chọn đáp án).
import { renderScenario } from '../../ui/scenario-view.js';
import { recordAttempt, pickWeighted } from '../../ui/progress.js';

export function mount(root, { wiki, maxLevel, concept }) {
  const pool = wiki.scenarios.filter(s => s.level <= maxLevel && (!concept || s.concept === concept));
  if (!pool.length) { root.innerHTML = '<p class="empty">Không có scenario nào cho bộ lọc này.</p>'; return () => {}; }

  let view, current;
  const next = () => {
    current = pickWeighted(pool, undefined, current?.id);
    const t0 = performance.now();
    view = renderScenario(root, current, {
      onAnswer: (correct, chosen) => recordAttempt({
        scenario: current, drill: 'where-to-run', correct, chosen, ms: Math.round(performance.now() - t0),
      }),
    });
  };

  const onKey = e => {
    if (/^[1-9]$/.test(e.key) && !view.answered) view.key(+e.key);
    else if ((e.key === ' ' || e.key === 'Enter') && view.answered) { e.preventDefault(); next(); }
  };
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', e => { if (e.target.closest('.feedback')) next(); });
  next();
  return () => document.removeEventListener('keydown', onKey);
}
