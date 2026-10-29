// Drill "Where to run": nhìn sân từ góc của mình → click chỗ nên chạy (hoặc phím 1–9),
// rồi xem mô phỏng pha bóng với tốc độ của mình.
// Data: wiki/scenarios/ (cả dạng sơ đồ sân lẫn dạng chọn đáp án).
import { renderScenario } from '../../ui/scenario-view.js';
import { recordAttempt, pickWeighted } from '../../ui/progress.js';

export function mount(root, { wiki, maxLevel, concept }) {
  const pool = wiki.scenarios.filter(s => s.level <= maxLevel && (!concept || s.concept === concept));
  if (!pool.length) { root.innerHTML = '<p class="empty">Không có scenario nào cho bộ lọc này.</p>'; return () => {}; }
  const concepts = Object.fromEntries(wiki.concepts.map(c => [c.slug, c]));

  let view, current;
  const next = () => {
    view?.destroy();
    current = pickWeighted(pool, undefined, current?.id);
    const t0 = performance.now();
    view = renderScenario(root, current, {
      concepts,
      onAnswer: (correct, chosen) => recordAttempt({
        scenario: current, drill: 'where-to-run', correct, chosen, ms: Math.round(performance.now() - t0),
      }),
    });
  };

  const onKey = e => {
    if (e.target.closest?.('input, select')) return;
    if (/^[1-9]$/.test(e.key) && !view.answered) view.key(+e.key);
    else if (e.key === 'Enter' && view.answered) { e.preventDefault(); next(); }
  };
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', e => { if (e.target.closest('[data-next]')) next(); });
  next();
  return () => { document.removeEventListener('keydown', onKey); view?.destroy(); };
}
