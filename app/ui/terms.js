// Tự gạch chân thuật ngữ (lấy từ wiki/glossary.md) + tooltip định nghĩa,
// và liệt kê "Thuật ngữ trong phần này" ngay bên dưới để không phải hover.

let entries = [];   // [{ term, def, re }]

export function setGlossary(glossary) {
  entries = glossary
    .map(g => {
      const esc = g.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const short = g.term.length <= 2;              // "D" chỉ khớp đúng chữ hoa
      return { ...g, re: new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, short ? 'u' : 'iu') };
    })
    .sort((a, b) => b.term.length - a.term.length);  // "under cut" trước "under"
}

const SKIP = new Set(['CODE', 'KBD', 'ABBR', 'SCRIPT', 'STYLE', 'BUTTON']);

/** Bọc thuật ngữ trong `root` bằng <abbr class="term">. Trả về danh sách thuật ngữ đã gặp. */
export function annotate(root) {
  const found = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      for (let p = n.parentElement; p && p !== root.parentElement; p = p.parentElement) if (SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) wrap(node, found);
  return [...found.values()];
}

function wrap(node, found) {
  const text = node.nodeValue;
  let best = null;
  for (const e of entries) {
    const m = e.re.exec(text);
    if (m && (!best || m.index < best.m.index)) best = { e, m };
  }
  if (!best) return;
  const { e, m } = best;
  const after = node.splitText(m.index);
  const rest = after.splitText(m[0].length);
  const abbr = document.createElement('abbr');
  abbr.className = 'term';
  abbr.dataset.def = e.def;
  abbr.tabIndex = 0;
  abbr.textContent = m[0];
  after.replaceWith(abbr);
  found.set(e.term, e);
  wrap(rest, found);
}

export function termList(found) {
  if (!found.length) return '';
  return `<details class="term-list" open><summary>Thuật ngữ trong phần này</summary><dl>${
    found.map(e => `<dt>${e.term}</dt><dd>${e.def}</dd>`).join('')}</dl></details>`;
}
