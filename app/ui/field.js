// Vẽ sơ đồ sân SVG từ block ```field (toạ độ 0–100, tấn công lên trên).
// Lưới 9 vùng giống bàn phím số: 7 8 9 (deep) / 4 5 6 (mid) / 1 2 3 (near).

const W = 370, H = 500, SX = W / 100, SY = H / 100;
const ROWS = [[0, 35], [35, 65], [65, 100]];          // deep, mid, near (theo y)
const ROW_KEYS = [[7, 8, 9], [4, 5, 6], [1, 2, 3]];
const NS = 'http://www.w3.org/2000/svg';

export function zoneAt(x, y) {
  const col = x < 100 / 3 ? 0 : x < 200 / 3 ? 1 : 2;
  const row = ROWS.findIndex(([a, b]) => y >= a && y < b);
  return ROW_KEYS[row < 0 ? 2 : row][col];
}

function zoneRect(z) {
  for (let r = 0; r < 3; r++) {
    const c = ROW_KEYS[r].indexOf(z);
    if (c >= 0) return { x: c * W / 3, y: ROWS[r][0] * SY, w: W / 3, h: (ROWS[r][1] - ROWS[r][0]) * SY };
  }
}

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

/**
 * @param {HTMLElement} host
 * @param {object} scenario  parsed scenario (field, force)
 * @param {object} opts { onZone(z), showNumbers }
 * @returns {{ reveal(chosen, correctZones) }}
 */
export function drawField(host, scenario, opts = {}) {
  const f = scenario.field;
  host.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'field', role: 'img', 'aria-label': 'Sơ đồ sân' }, host);
  const defs = el('defs', {}, svg);
  const mk = el('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrow-head' }, mk);

  el('rect', { x: 0, y: 0, width: W, height: H, class: 'grass' }, svg);
  el('rect', { x: 0, y: 0, width: W, height: 12 * SY, class: 'endzone' }, svg);
  el('text', { x: W / 2, y: 6 * SY + 4, class: 'ez-label' }, svg).textContent = 'ENDZONE ↑';

  // vùng (click / highlight)
  const zoneEls = {};
  for (let z = 1; z <= 9; z++) {
    const r = zoneRect(z);
    const g = el('g', { class: 'zone', 'data-zone': z }, svg);
    el('rect', { x: r.x, y: r.y, width: r.w, height: r.h }, g);
    if (opts.showNumbers !== false) el('text', { x: r.x + 10, y: r.y + 20, class: 'zone-num' }, g).textContent = z;
    zoneEls[z] = g;
  }

  // open side hint
  if (scenario.force === 'forehand' || scenario.force === 'backhand') {
    const right = scenario.force === 'forehand';
    el('text', { x: right ? W - 8 : 8, y: H - 8, class: 'force-label', 'text-anchor': right ? 'end' : 'start' }, svg)
      .textContent = `force ${scenario.force} → open ${right ? 'phải ▸' : '◂ trái'}`;
  }

  for (const [x1, y1, x2, y2] of f.arrows || []) {
    el('line', { x1: x1 * SX, y1: y1 * SY, x2: x2 * SX, y2: y2 * SY, class: 'run', 'marker-end': 'url(#arr)' }, svg);
  }

  const player = (p, team) => {
    const [x, y, label = ''] = p;
    const me = label === 'me';
    const g = el('g', { class: `p ${team}${me ? ' me' : ''}`, transform: `translate(${x * SX},${y * SY})` }, svg);
    if (me) el('circle', { r: 15, class: 'me-ring' }, g);
    el('circle', { r: 10 }, g);
    const t = me ? 'Tôi' : label;
    if (t) el('text', { y: 4 }, g).textContent = t;
  };
  (f.defense || []).forEach(p => player(p, 'def'));
  (f.offense || []).forEach(p => player(p, 'off'));
  if (f.disc) el('circle', { cx: f.disc[0] * SX + 9, cy: f.disc[1] * SY - 9, r: 5, class: 'disc' }, svg);

  if (opts.onZone) {
    svg.classList.add('clickable');
    svg.addEventListener('click', e => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      opts.onZone(zoneAt(p.x / SX, p.y / SY));
    });
  }

  return {
    reveal(chosen, correct) {
      svg.classList.remove('clickable');
      for (const z of correct) zoneEls[z].classList.add('correct');
      if (chosen && !correct.includes(chosen)) zoneEls[chosen].classList.add('wrong');
    },
  };
}
