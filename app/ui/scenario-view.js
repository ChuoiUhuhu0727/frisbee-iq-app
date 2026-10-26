// Phần hiển thị chung cho 1 scenario: header, sơ đồ sân / lựa chọn, feedback.
import { md } from './wiki.js';
import { drawField } from './field.js';

const ROLE = { cutter: 'cutter', handler: 'handler', deep: 'deep', defender: 'defense' };

export function renderScenario(root, s, { onAnswer, showNumbers = true, compact = false }) {
  root.classList.add('scn');
  root.innerHTML = `
    <div class="scn-head">
      <span class="chip">${s.id}</span>
      <span class="chip">L${s.level}</span>
      <span class="chip">${ROLE[s.role] || s.role || ''}</span>
      ${s.ratio ? `<span class="chip ratio">${s.ratio}</span>` : ''}
      ${s.force && s.force !== 'none' ? `<span class="chip force">force ${s.force}</span>` : ''}
    </div>
    <h2 class="scn-title">${s.title}</h2>
    ${compact ? '' : `<div class="scn-q">${md(s.question)}</div>`}
    <div class="scn-body"></div>
    <div class="feedback" hidden></div>`;
  const body = root.querySelector('.scn-body');
  const fb = root.querySelector('.feedback');
  let answered = false;
  let board = null;

  const finish = (correct, chosen) => {
    if (answered) return;
    answered = true;
    if (board) board.reveal(chosen, s.zones);
    root.querySelectorAll('.choice').forEach((b, i) => {
      b.disabled = true;
      if (s.choices[i].correct) b.classList.add('correct');
      else if (i === chosen) b.classList.add('wrong');
    });
    fb.hidden = false;
    fb.className = `feedback ${correct ? 'ok' : 'bad'}`;
    fb.innerHTML = `
      <div class="verdict">${correct ? '✓ Đúng' : chosen == null ? '⏱ Hết giờ' : '✗ Chưa đúng'}</div>
      <h3>Đáp án</h3>${md(s.answer)}
      <h3>Tại sao</h3>${md(s.why)}
      <h3>Sai phổ biến</h3>${md(s.wrong)}
      <p class="concept-link">Concept: <span class="wl">${s.concept}</span> · đọc thêm <code>wiki/concepts/${s.concept}.md</code></p>
      <p class="hint">Bấm <kbd>Space</kbd> / <kbd>Enter</kbd> để sang câu tiếp</p>`;
    onAnswer?.(correct, chosen);
  };

  if (s.field) {
    board = drawField(body, s, { showNumbers, onZone: z => finish(s.zones.includes(z), z) });
  } else {
    body.innerHTML = `<div class="choices">${s.choices.map((c, i) =>
      `<button class="choice" data-i="${i}"><kbd>${i + 1}</kbd> ${md(c.text).replace(/<\/?p>/g, '')}</button>`).join('')}</div>`;
    body.querySelectorAll('.choice').forEach(b =>
      b.addEventListener('click', () => { const i = +b.dataset.i; finish(s.choices[i].correct, i); }));
  }

  return {
    // phím 1–9: chọn vùng (sân) hoặc lựa chọn thứ n
    key(n) {
      if (s.field) finish(s.zones.includes(n), n);
      else if (n <= s.choices.length) finish(s.choices[n - 1].correct, n - 1);
    },
    timeout() { finish(false, null); },
    get answered() { return answered; },
  };
}
