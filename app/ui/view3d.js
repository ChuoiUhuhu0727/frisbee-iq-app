// Góc nhìn ngang trên sân (canvas 2D + phép chiếu phối cảnh tự viết, không cần thư viện).
// Thế giới: mét theo toạ độ sân (x: 0–37 trái→phải, y: endzone tấn công ở y nhỏ), h = độ cao.
// Camera: "eyes" = mắt mình (cao 93% chiều cao), "chase" = đứng sau lưng mình.
import { SX, SY, toField } from '../sim/simulate.js';

const FIELD_W = 37, EZ_LINE = 12 * SY, EZ_BACK = EZ_LINE - 18, OWN_EZ = EZ_LINE + 64, OWN_BACK = OWN_EZ + 18;
const ZX = [0, 100 / 3 * SX, 200 / 3 * SX, 100 * SX], ZY = [0, 35 * SY, 65 * SY, 100 * SY];
const COLORS = {
  mine: { shirt: '#ffb400', shorts: '#111', skin: '#e9b98f', tag: '#ffb400' },
  theirs: { shirt: '#f4f6fb', shorts: '#1747b8', skin: '#d9a57c', tag: '#ffffff' },
};

export function createView(host, scene, opts = {}) {
  host.innerHTML = `
    <div class="v3d">
      <canvas class="v3d-main"></canvas>
      <canvas class="v3d-mini" width="148" height="200" title="Bản đồ nhỏ (nhìn từ trên) — click để chọn vùng"></canvas>
      <div class="v3d-hud"></div>
    </div>`;
  const canvas = host.querySelector('.v3d-main');
  const mini = host.querySelector('.v3d-mini');
  const hud = host.querySelector('.v3d-hud');
  const ctx = canvas.getContext('2d');
  const mctx = mini.getContext('2d');
  const myTeam = scene.me.team;

  const cam = { mode: 'eyes', look: 'disc', yaw: 0, pitch: -0.1, fov: 80 * Math.PI / 180, x: 0, y: 0, h: 1.5 };
  let W = 0, H = 0, focal = 1, help = true, targets = [], state = null, time = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = host.clientWidth || 640;
    W = w; H = Math.round(Math.min(w * 9 / 16, 520));
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    focal = (W / 2) / Math.tan(cam.fov / 2);
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  // ---------- camera ----------
  const fwd = () => [Math.sin(cam.yaw), -Math.cos(cam.yaw)];
  const rgt = () => [Math.cos(cam.yaw), Math.sin(cam.yaw)];
  function toCam(x, y, h) {
    const rx = x - cam.x, ry = y - cam.y, f = fwd(), r = rgt();
    const F = rx * f[0] + ry * f[1], A = rx * r[0] + ry * r[1], V = h - cam.h;
    const c = Math.cos(cam.pitch), s = Math.sin(cam.pitch);
    return [A, -F * s + V * c, F * c + V * s];       // [right, up, depth]
  }
  const NEAR = 0.15;
  const proj = ([a, u, z]) => [W / 2 + a / z * focal, H / 2 - u / z * focal];
  function clipPoly(pts) {                           // Sutherland–Hodgman với mặt phẳng z = NEAR
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const pin = p[2] >= NEAR, qin = q[2] >= NEAR;
      if (pin) out.push(p);
      if (pin !== qin) { const k = (NEAR - p[2]) / (q[2] - p[2]); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, NEAR]); }
    }
    return out;
  }
  function groundPoly(corners, fill) {
    const c = clipPoly(corners.map(([x, y]) => toCam(x, y, 0)));
    if (c.length < 3) return;
    ctx.beginPath();
    c.map(proj).forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function groundLine(x1, y1, x2, y2, style, width = 2, dash = null) {
    let p = toCam(x1, y1, 0), q = toCam(x2, y2, 0);
    if (p[2] < NEAR && q[2] < NEAR) return;
    if (p[2] < NEAR) { const k = (NEAR - p[2]) / (q[2] - p[2]); p = p.map((v, i) => v + (q[i] - v) * k); }
    if (q[2] < NEAR) { const k = (NEAR - q[2]) / (p[2] - q[2]); q = q.map((v, i) => v + (p[i] - v) * k); }
    const [a, b] = [proj(p), proj(q)];
    ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.restore();
  }
  function groundText(x, y, text, size, style) {
    const c = toCam(x, y, 0);
    if (c[2] < 1) return;
    const [sx, sy] = proj(c);
    const px = Math.min(64, size * focal / c[2]);
    if (px < 7) return;
    ctx.save(); ctx.font = `700 ${px}px Anton, Impact, sans-serif`; ctx.fillStyle = style; ctx.textAlign = 'center';
    ctx.transform(1, 0, 0, Math.max(0.25, Math.min(1, cam.h / c[2] * 2.2)), 0, sy * (1 - Math.max(0.25, Math.min(1, cam.h / c[2] * 2.2))));
    ctx.fillText(text, sx, sy); ctx.restore();
  }

  // ---------- vẽ người ----------
  function drawPlayer(p, pos, speed, depth) {
    const side = p.team === myTeam ? COLORS.mine : COLORS.theirs;
    const Hm = p.me ? opts.myHeight || 1.6 : p.hgt;
    const base = toCam(pos[0], pos[1], 0);
    if (base[2] < 0.6) return;
    const [sx, sy] = proj(base);
    const s = focal / base[2];                      // pixel / mét
    const h = Hm * s;
    const run = Math.min(1, speed / 4);
    const ph = time * (4 + speed * 1.4) + p.seed;
    const swing = Math.sin(ph) * 0.22 * run;
    const bob = Math.abs(Math.sin(ph)) * 0.02 * h * run;
    ctx.save();
    const near = cam.mode === 'eyes' ? 2 : 4.5;                       // sát camera → mờ đi để không che sân
    if (base[2] < near && !p.me) ctx.globalAlpha = Math.max(0.25, (base[2] - 0.6) / (near - 0.6));
    ctx.translate(sx, sy);
    // bóng
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, h * 0.2, h * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    if (p.me) {
      ctx.strokeStyle = '#ffb400'; ctx.lineWidth = Math.max(2, h * 0.025);
      ctx.beginPath(); ctx.ellipse(0, 0, h * 0.3, h * 0.08, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const hip = -h * 0.5 - bob, sh = -h * 0.82 - bob;
    ctx.lineCap = 'round';
    // chân
    ctx.strokeStyle = side.skin; ctx.lineWidth = Math.max(1.5, h * 0.07);
    for (const k of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(k * h * 0.05, hip);
      ctx.lineTo(k * h * 0.05 + swing * k * h, -h * 0.02); ctx.stroke();
    }
    // quần
    ctx.fillStyle = side.shorts;
    ctx.fillRect(-h * 0.11, hip - h * 0.02, h * 0.22, h * 0.13);
    // tay
    ctx.strokeStyle = side.skin; ctx.lineWidth = Math.max(1.2, h * 0.05);
    for (const k of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(k * h * 0.13, sh + h * 0.03);
      ctx.lineTo(k * h * 0.17 - swing * k * h * 0.8, sh + h * 0.3); ctx.stroke();
    }
    // áo
    ctx.fillStyle = side.shirt;
    ctx.beginPath(); ctx.roundRect(-h * 0.14, sh, h * 0.28, hip - sh + h * 0.02, h * 0.04); ctx.fill();
    // đầu
    ctx.fillStyle = side.skin;
    ctx.beginPath(); ctx.arc(0, sh - h * 0.09, h * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath(); ctx.arc(0, sh - h * 0.11, h * 0.075, Math.PI, Math.PI * 2); ctx.fill();
    // nhãn
    const tag = p.me ? 'Bạn' : p.label === 'M' ? 'Mark' : p.label === 'H' ? 'Handler' : p.label === 'C' ? '' : p.label;
    if (tag && h > 26) {
      const fs = Math.max(10, Math.min(15, h * 0.12));
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      const tw = ctx.measureText(tag).width + 10;
      const ty = sh - h * 0.26;
      ctx.fillStyle = p.me ? '#ffb400' : 'rgba(10,14,30,.75)';
      ctx.beginPath(); ctx.roundRect(-tw / 2, ty - fs, tw, fs + 6, 4); ctx.fill();
      ctx.fillStyle = p.me ? '#111' : side.tag; ctx.textAlign = 'center';
      ctx.fillText(tag, 0, ty + 1);
    }
    ctx.restore();
  }

  function drawDisc(d) {
    const c = toCam(d[0], d[1], d[2]);
    if (c[2] < 0.3) return;
    const [sx, sy] = proj(c);
    const r = Math.max(3, 0.135 * focal / c[2]);
    const g = toCam(d[0], d[1], 0);
    if (g[2] > 0.3 && d[2] > 1.2) { const [gx, gy] = proj(g); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(gx, gy, r, r * 0.3, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ffb400'; ctx.lineWidth = Math.max(1, r * 0.25);
    ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // ---------- frame ----------
  function draw() {
    if (!state) return;
    const me = state.pos[scene.me.id];
    const discP = state.disc || [...scene.disc, 1];
    if (cam.look === 'disc') {
      const dx = discP[0] - me[0], dy = discP[1] - me[1];
      if (Math.hypot(dx, dy) > 0.5) cam.yaw = Math.atan2(dx, -dy);
    } else if (cam.look === 'up') cam.yaw = 0;
    const meSpeed = state.speeds?.[scene.me.id] || 0;
    if (cam.mode === 'eyes') {
      cam.x = me[0]; cam.y = me[1];
      cam.h = (opts.eyeHeight || 1.45) + Math.sin(time * 9) * 0.03 * Math.min(1, meSpeed / 3);
      cam.pitch = -0.1;
    } else {
      const f = fwd();
      cam.x = me[0] - f[0] * 5; cam.y = me[1] - f[1] * 5; cam.h = 2.6; cam.pitch = -0.2;
    }

    // trời + khán đài xa
    const hz = H / 2 + Math.tan(-cam.pitch) * focal;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#0b3fbf'); sky.addColorStop(0.7, '#5f8fe8'); sky.addColorStop(1, '#cfe0ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2c5b2f'; ctx.fillRect(0, hz - 10, W, H);

    // cỏ ngoài sân + sọc cỏ trong sân (giúp cảm nhận khoảng cách)
    groundPoly([[-60, -80], [97, -80], [97, 170], [-60, 170]], '#3b7a3f');
    for (let y = EZ_BACK, i = 0; y < OWN_BACK; y += 5, i++) {
      groundPoly([[0, y], [FIELD_W, y], [FIELD_W, Math.min(y + 5, OWN_BACK)], [0, Math.min(y + 5, OWN_BACK)]], i % 2 ? '#4a9a4f' : '#43904a');
    }
    groundPoly([[0, EZ_BACK], [FIELD_W, EZ_BACK], [FIELD_W, EZ_LINE], [0, EZ_LINE]], 'rgba(255,180,0,.16)');
    for (const y of [EZ_BACK, EZ_LINE, OWN_EZ, OWN_BACK]) groundLine(0, y, FIELD_W, y, '#fff', 2.5);
    groundLine(0, EZ_BACK, 0, OWN_BACK, '#fff', 2.5);
    groundLine(FIELD_W, EZ_BACK, FIELD_W, OWN_BACK, '#fff', 2.5);
    groundText(FIELD_W / 2, EZ_LINE - 7, 'ENDZONE', 3.2, 'rgba(255,255,255,.55)');

    if (help) {
      for (const x of ZX.slice(1, 3)) groundLine(x, ZY[0], x, ZY[3], 'rgba(255,255,255,.45)', 1.5, [8, 8]);
      for (const y of ZY.slice(1, 3)) groundLine(ZX[0], y, ZX[3], y, 'rgba(255,255,255,.45)', 1.5, [8, 8]);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        groundText((ZX[c] + ZX[c + 1]) / 2, (ZY[r] + ZY[r + 1]) / 2, String([7, 8, 9, 4, 5, 6, 1, 2, 3][r * 3 + c]), 2.4, 'rgba(255,255,255,.6)');
      }
      if (scene.force === 'forehand' || scene.force === 'backhand') {
        const ox = scene.force === 'forehand' ? FIELD_W * 0.8 : FIELD_W * 0.2;
        groundText(ox, (ZY[1] + ZY[2]) / 2 + 3, 'OPEN SIDE', 1.6, 'rgba(255,214,90,.85)');
      }
    }
    for (const t of targets) {
      const c = toCam(t.pt[0], t.pt[1], 0);
      if (c[2] > 0.5) {
        const [sx, sy] = proj(c), r = 0.9 * focal / c[2];
        ctx.strokeStyle = t.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(sx, sy, r, r * Math.max(0.2, cam.h / c[2]), 0, 0, 7); ctx.stroke();
      }
    }

    // sắp xếp xa → gần
    const items = scene.players
      .filter(p => !(p.me && cam.mode === 'eyes'))
      .map(p => ({ p, pos: state.pos[p.id], z: toCam(...state.pos[p.id], 0)[2] }));
    items.push({ disc: true, z: toCam(discP[0], discP[1], discP[2])[2] - 0.2 });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.disc ? drawDisc(discP) : drawPlayer(it.p, it.pos, state.speeds?.[it.p.id] || 0, it.z);

    drawMini(me);
  }

  // ---------- minimap ----------
  const MW = 148, MH = 200, MY0 = EZ_BACK, MY1 = 60;
  const mx = x => 6 + x / FIELD_W * (MW - 12), my = y => (y - MY0) / (MY1 - MY0) * MH;
  function drawMini(me) {
    const c = mctx;
    c.clearRect(0, 0, MW, MH);
    c.fillStyle = 'rgba(10,20,50,.78)'; c.fillRect(0, 0, MW, MH);
    c.fillStyle = '#3f8f4f'; c.fillRect(mx(0), my(MY0), mx(FIELD_W) - mx(0), MH);
    c.fillStyle = 'rgba(255,180,0,.25)'; c.fillRect(mx(0), my(EZ_BACK), mx(FIELD_W) - mx(0), my(EZ_LINE) - my(EZ_BACK));
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([3, 3]);
    for (const x of ZX.slice(1, 3)) { c.beginPath(); c.moveTo(mx(x), my(0)); c.lineTo(mx(x), my(ZY[3])); c.stroke(); }
    for (const y of ZY.slice(1, 3)) { c.beginPath(); c.moveTo(mx(0), my(y)); c.lineTo(mx(FIELD_W), my(y)); c.stroke(); }
    c.setLineDash([]);
    // tầm nhìn
    const half = cam.fov / 2, L = 40;
    const dir = a => [Math.sin(cam.yaw + a), -Math.cos(cam.yaw + a)];
    c.fillStyle = 'rgba(255,255,255,.14)';
    c.beginPath(); c.moveTo(mx(cam.x), my(cam.y));
    c.lineTo(mx(cam.x + dir(-half)[0] * L), my(cam.y + dir(-half)[1] * L));
    c.lineTo(mx(cam.x + dir(half)[0] * L), my(cam.y + dir(half)[1] * L)); c.closePath(); c.fill();
    for (const t of targets) { c.strokeStyle = t.color; c.lineWidth = 2; c.beginPath(); c.arc(mx(t.pt[0]), my(t.pt[1]), 5, 0, 7); c.stroke(); }
    for (const p of scene.players) {
      const q = state.pos[p.id];
      c.fillStyle = p.me ? '#ffb400' : p.team === myTeam ? '#e0a000' : '#f4f6fb';
      c.beginPath(); c.arc(mx(q[0]), my(q[1]), p.me ? 4.5 : 3.2, 0, 7); c.fill();
      if (p.me) { c.strokeStyle = '#111'; c.lineWidth = 1.5; c.stroke(); }
    }
    const d = state.disc || [...scene.disc, 1];
    c.fillStyle = '#fff'; c.beginPath(); c.arc(mx(d[0]), my(d[1]), 2, 0, 7); c.fill();
  }

  // ---------- input ----------
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw: cam.yaw, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) { drag.moved = true; cam.look = 'free'; cam.yaw = drag.yaw - dx / focal; opts.onLook?.('free'); }
  });
  canvas.addEventListener('pointerup', e => {
    const wasDrag = drag?.moved; drag = null;
    if (wasDrag || !opts.onPick) return;
    const r = canvas.getBoundingClientRect();
    const a = (e.clientX - r.left - W / 2) / focal, u = -(e.clientY - r.top - H / 2) / focal;
    const c = Math.cos(cam.pitch), s = Math.sin(cam.pitch);
    const F = c - u * s, V = s + u * c;
    if (V >= -1e-3) return;                                // click lên trời
    const t = -cam.h / V, f = fwd(), rg = rgt();
    const gx = cam.x + t * (F * f[0] + a * rg[0]), gy = cam.y + t * (F * f[1] + a * rg[1]);
    opts.onPick(toField([gx, gy]));
  });
  mini.addEventListener('click', e => {
    if (!opts.onPick) return;
    const r = mini.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * MW, y = (e.clientY - r.top) / r.height * MH;
    opts.onPick(toField([(x - 6) / (MW - 12) * FIELD_W, MY0 + y / MH * (MY1 - MY0)]));
  });

  scene.players.forEach((p, i) => { p.seed = i * 1.7; p.hgt = p.hgt || 1.62 + ((i * 37) % 17) / 100; });

  return {
    frame(st, t) { state = st; time = t; draw(); },
    setHelp(v) { help = v; },
    setCamera(mode) { cam.mode = mode; },
    setLook(look) { cam.look = look; },
    setTargets(list) { targets = list; },
    hud(html) { hud.innerHTML = html; },
    destroy() { ro.disconnect(); },
  };
}
