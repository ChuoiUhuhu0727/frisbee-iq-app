// Drill "Flashcards": thuật ngữ (wiki/glossary.md) + concept (mục "Nói ngắn gọn" trong wiki/concepts/).
import { md } from '../../ui/wiki.js';
import { recordCard, cards } from '../../ui/progress.js';

export function mount(root, { wiki, maxLevel }) {
  const deck = [
    ...wiki.glossary.map(g => ({ key: `term:${g.term}`, kind: 'Thuật ngữ', front: g.term, back: g.def })),
    ...wiki.concepts.filter(c => c.level <= maxLevel && c.short)
      .map(c => ({ key: `concept:${c.slug}`, kind: 'Concept', front: c.title, back: c.short })),
  ];
  if (!deck.length) { root.innerHTML = '<p class="empty">Chưa có thẻ nào.</p>'; return () => {}; }

  // Thẻ chưa thấy hoặc hay quên → trọng số cao hơn.
  const pick = avoid => {
    const st = cards();
    const pool = deck.filter(c => c.key !== avoid);
    const w = pool.map(c => { const s = st[c.key]; return s ? 1 + 4 * (1 - s.known / s.seen) : 3; });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    return pool.find((_, i) => (r -= w[i]) <= 0) || pool[0];
  };

  let card, flipped;
  const show = () => {
    card = pick(card?.key);
    flipped = false;
    const s = cards()[card.key];
    root.innerHTML = `
      <div class="card" tabindex="0">
        <div class="card-kind">${card.kind}${s ? ` · biết ${s.known}/${s.seen}` : ' · mới'}</div>
        <div class="card-front">${card.front}</div>
        <div class="card-back" hidden>${md(card.back)}</div>
        <div class="card-hint">Click / <kbd>Space</kbd> để lật</div>
      </div>
      <div class="card-actions" hidden>
        <button class="btn bad" data-k="0"><kbd>1</kbd> Chưa nhớ</button>
        <button class="btn ok" data-k="1"><kbd>2</kbd> Nhớ rồi</button>
      </div>`;
    root.querySelector('.card').addEventListener('click', flip);
    root.querySelectorAll('.card-actions .btn').forEach(b => b.addEventListener('click', () => answer(b.dataset.k === '1')));
  };
  const flip = () => {
    if (flipped) return;
    flipped = true;
    root.querySelector('.card-back').hidden = false;
    root.querySelector('.card-hint').hidden = true;
    root.querySelector('.card-actions').hidden = false;
  };
  const answer = known => { recordCard(card.key, known); show(); };

  const onKey = e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (flipped && (e.key === '1' || e.key === '2')) answer(e.key === '2');
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => document.removeEventListener('keydown', onKey);
}
