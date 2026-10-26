import { loadWiki } from './wiki.js';
import { loadProgress, conceptStats, attempts } from './progress.js';
import * as whereToRun from '../drills/where-to-run/drill.js';
import * as reaction from '../drills/reaction/drill.js';
import * as flashcards from '../drills/flashcards/drill.js';

const DRILLS = { 'where-to-run': whereToRun, reaction, flashcards, stats: { mount: mountStats } };
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* không sao */ } },
};

let wiki, unmount = () => {};
const levelSel = document.getElementById('level');
const conceptSel = document.getElementById('concept');
const view = document.getElementById('view');

function ctx() {
  return { wiki, maxLevel: +levelSel.value, concept: conceptSel.value || null };
}

function open(tab) {
  unmount();
  store.set('fiq.tab', tab);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const host = document.createElement('div');
  view.replaceChildren(host);
  unmount = DRILLS[tab].mount(host, ctx()) || (() => {});
}

function mountStats(root) {
  const st = conceptStats();
  const titles = Object.fromEntries(wiki.concepts.map(c => [c.slug, c.title]));
  const counts = {};
  wiki.scenarios.forEach(s => { counts[s.concept] = (counts[s.concept] || 0) + 1; });
  const rows = wiki.concepts.map(c => {
    const s = st[c.slug];
    return { slug: c.slug, title: c.title, level: c.level, n: s?.n || 0, acc: s ? s.ok / s.n : null,
      ms: s?.ms.length ? Math.round(s.ms.reduce((a, b) => a + b) / s.ms.length) : null, scn: counts[c.slug] || 0 };
  }).sort((a, b) => (a.acc ?? -1) - (b.acc ?? -1) || a.level - b.level);
  const tried = rows.filter(r => r.acc != null);
  const weakest = tried[0];
  const allMs = attempts().filter(a => a.drill === 'reaction' && a.correct).map(a => a.ms);
  root.innerHTML = `
    <div class="stats-top">
      <div class="stat"><div class="n">${attempts().length}</div><div>lượt làm</div></div>
      <div class="stat"><div class="n">${attempts().length ? Math.round(100 * attempts().filter(a => a.correct).length / attempts().length) + '%' : '—'}</div><div>đúng</div></div>
      <div class="stat"><div class="n">${allMs.length ? Math.round(allMs.reduce((a, b) => a + b) / allMs.length) : '—'}</div><div>ms phản xạ TB</div></div>
    </div>
    ${weakest ? `<p class="weak">Concept yếu nhất: <b>${weakest.title}</b> (${Math.round(weakest.acc * 100)}%) — app đang ưu tiên drill này.
      <button class="btn" id="drill-weak">Drill ngay</button></p>` : '<p class="weak">Chưa có dữ liệu — làm vài câu "Where to run" trước nhé.</p>'}
    <table class="stats">
      <thead><tr><th>Concept</th><th>Level</th><th>Scenario</th><th>Lượt</th><th>% đúng</th><th>Reaction TB</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${titles[r.slug]}</td><td>${r.level}</td><td>${r.scn}</td><td>${r.n}</td>
        <td>${r.acc == null ? '—' : `<span class="bar"><span style="width:${Math.round(r.acc * 100)}%"></span></span> ${Math.round(r.acc * 100)}%`}</td>
        <td>${r.ms ?? '—'}${r.ms ? ' ms' : ''}</td></tr>`).join('')}</tbody>
    </table>
    <p class="hint">Progress lưu ở <code>app/progress/progress.json</code>; bản markdown để ingest: <code>app/progress/stats.md</code>.</p>`;
  root.querySelector('#drill-weak')?.addEventListener('click', () => {
    conceptSel.value = weakest.slug;
    if (+levelSel.value < weakest.level) levelSel.value = 5;
    open('where-to-run');
  });
}

async function init() {
  try {
    [wiki] = await Promise.all([loadWiki(), loadProgress()]);
  } catch (e) {
    view.innerHTML = `<p class="empty">Không đọc được wiki. Chạy app bằng <code>python app/server.py</code> (không mở file HTML trực tiếp).</p>`;
    return;
  }
  levelSel.value = store.get('fiq.level', '2');
  conceptSel.innerHTML = '<option value="">Tất cả concept</option>' +
    wiki.concepts.sort((a, b) => a.level - b.level).map(c => `<option value="${c.slug}">L${c.level} · ${c.title}</option>`).join('');
  document.getElementById('meta').textContent = `${wiki.scenarios.length} scenario · ${wiki.concepts.length} concept · ${wiki.glossary.length} thuật ngữ`;
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => open(b.dataset.tab)));
  levelSel.addEventListener('change', () => { store.set('fiq.level', levelSel.value); open(store.get('fiq.tab', 'where-to-run')); });
  conceptSel.addEventListener('change', () => open(store.get('fiq.tab', 'where-to-run')));
  open(store.get('fiq.tab', 'where-to-run'));
}

init();
