// Progress: lưu file JSON local qua server (app/progress/progress.json + stats.md).

let data = { attempts: [], cards: {} };

export async function loadProgress() {
  try { data = await (await fetch('/api/progress')).json(); } catch { /* chạy tiếp với progress rỗng */ }
  data.attempts ||= []; data.cards ||= {};
  return data;
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fetch('/api/progress', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }).catch(err => console.warn('Không lưu được progress', err)), 300);
}

export function recordAttempt({ scenario, drill, correct, ms, chosen }) {
  data.attempts.push({ t: new Date().toISOString(), id: scenario.id, concept: scenario.concept, drill, correct, ms, chosen });
  save();
}

export function recordCard(key, known) {
  const c = data.cards[key] ||= { seen: 0, known: 0 };
  c.seen++; if (known) c.known++;
  save();
}

export function conceptStats() {
  const m = {};
  for (const a of data.attempts) {
    const c = m[a.concept] ||= { n: 0, ok: 0, ms: [] };
    c.n++; if (a.correct) c.ok++;
    if (a.drill === 'reaction' && a.correct && a.ms) c.ms.push(a.ms);
  }
  return m;
}

export const attempts = () => data.attempts;
export const cards = () => data.cards;

// Concept yếu nhất được ưu tiên: concept chưa làm hoặc % đúng thấp → trọng số cao.
export function pickWeighted(items, keyFn = s => s.concept, avoidId) {
  const st = conceptStats();
  const pool = items.length > 1 ? items.filter(s => s.id !== avoidId) : items;
  const w = pool.map(s => {
    const c = st[keyFn(s)];
    return c ? 1 + 3 * (1 - c.ok / c.n) : 3;
  });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
