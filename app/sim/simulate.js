// Biến 1 scenario (block ```field) thành 1 pha bóng có thời gian: ai chạy đâu, D đuổi theo,
// handler có ném không, bắt được hay bị đập. Đơn vị: mét, giây.
// Toạ độ mét: x = 0..37 (trái → phải), y = 0..50 (endzone tấn công ở y nhỏ).
import { distAt, timeToCover, fakeEffect, tired, OPPONENTS } from './physics.js';

export const SX = 0.37, SY = 0.5;                    // 1 đơn vị scenario → mét
export const toM = ([x, y]) => [x * SX, y * SY];
export const toField = ([mx, my]) => [mx / SX, my / SY];
const DT = 1 / 60;
const THROW_SPEED = 13;                               // m/s, đường ném tầm trung của người chơi phong trào
const TEAMMATE = OPPONENTS.fExp;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = a => Math.hypot(a[0], a[1]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const dist = (a, b) => len(sub(a, b));
function distToSegment(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2 || 1)));
  return dist(p, add(a, mul(ab, t)));
}

/**
 * Defender muốn đứng đâu so với người mình guard:
 * người kia chạy về phía đĩa (under) → đứng ballside (giữa họ và đĩa) để chặn đường ném ngắn;
 * người kia chạy ra xa (deep) → bám sát bên cạnh, vì huck bay qua đầu người đứng ballside.
 */
function guardOffset(scene, track, i) {
  const prey = track[i], prev = track[Math.max(0, i - 6)];
  const vel = sub(prey, prev), toDisc = sub(scene.disc, prey);
  const towardDisc = len(vel) < 0.05 || vel[0] * toDisc[0] + vel[1] * toDisc[1] > 0;
  return towardDisc ? mul(norm(toDisc), 0.8) : mul(norm(vel), -0.6);   // không thể đứng trùng người

}

/** Hai người không thể đứng trùng chỗ: giữ tối thiểu 0.6 m. */
function keepBodyGap(p, other) {
  const d = sub(p, other), l = len(d);
  return l >= 0.6 ? p : add(other, mul(l > 1e-3 ? norm(d) : [0, 1], 0.6));
}

/** Dựng cảnh tĩnh: cầu thủ, ai cầm đĩa, ai guard ai, ai đang chạy theo arrow. */
export function buildScene(s) {
  const f = s.field;
  const players = [];
  (f.offense || []).forEach(([x, y, label = ''], i) => players.push({ id: `o${i}`, team: 'off', label, pos: toM([x, y]), me: label === 'me' }));
  (f.defense || []).forEach(([x, y, label = ''], i) => players.push({ id: `d${i}`, team: 'def', label, pos: toM([x, y]), me: label === 'me' }));
  const disc = toM(f.disc || f.offense[0]);
  const off = players.filter(p => p.team === 'off');
  const def = players.filter(p => p.team === 'def');
  const nearest = (pt, list) => list.reduce((b, p) => (dist(p.pos, pt) < dist(b.pos, pt) ? p : b));
  const holder = nearest(disc, off);
  holder.holder = true;

  // ai guard ai: marker → holder; person D (số người bằng nhau) → defense[i] guard offense[i];
  // zone (số người khác nhau) → ghép người gần nhất
  const free = off.filter(p => p !== holder);
  const paired = def.length === off.length;
  def.forEach((d, i) => {
    if (d.label === 'M') { d.guards = holder.id; holder.guardedBy = d.id; return; }
    if (paired && off[i] !== holder) { d.guards = off[i].id; off[i].guardedBy = d.id; }
  });
  for (const d of def) {
    if (d.guards) continue;
    const cands = free.filter(o => !o.guardedBy);
    if (!cands.length) continue;
    const o = nearest(d.pos, cands);
    o.guardedBy = d.id; d.guards = o.id;
  }
  // arrow → người chạy (offense gần điểm đầu nhất, trừ mình)
  for (const [x1, y1, x2, y2] of f.arrows || []) {
    const from = toM([x1, y1]), to = toM([x2, y2]);
    const runner = nearest(from, off.filter(p => !p.me && !p.run && !p.holder));
    if (runner) runner.run = { from: runner.pos, to: add(runner.pos, sub(to, from)) };
  }
  const me = players.find(p => p.me);
  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  return { players, byId, disc, holder, me, force: s.force, scenario: s };
}

export function modeFor(scene, target) {
  const c = scene.scenario.concept;
  if (scene.me.team === 'def') return scene.byId[scene.me.guards] ? 'defense' : 'position';
  if (['vertical-stack', 'clearing-space', 'spacing'].includes(c)) return 'position';
  if (scene.scenario.offense === 'vs-zone') return 'position';   // zone: không có ai guard riêng mình
  if (dist(target, scene.me.pos) < 1.5) return 'position';
  return 'cut';
}

/** Điểm chạy tới hợp lý trong 1 vùng (không phải tâm vùng: cut thật thường dừng gần mép vùng). */
export function targetForZone(scene, zone) {
  const r = Math.floor((zone - 1) / 3), c = (zone - 1) % 3;   // r: 0 near,1 mid,2 deep (keypad)
  const xr = [[0, 33.3], [33.3, 66.7], [66.7, 100]][c];
  const yr = [[65, 100], [35, 65], [0, 35]][r];
  const [fx, fy] = toField(scene.me.pos);
  const inside = fx >= xr[0] && fx <= xr[1] && fy >= yr[0] && fy <= yr[1];
  if (inside) return scene.me.pos;
  const pad = 6;
  let tx = Math.min(Math.max(fx, xr[0] + pad), xr[1] - pad);
  let ty = Math.min(Math.max(fy, yr[0] + pad), yr[1] - pad);
  if (r === 2) ty = Math.min(ty, Math.max(yr[0] + 8, fy - 30));                  // deep cut: chạy thật sự ra sau
  else {                                                                          // under cut: đi về phía đĩa
    const discY = toField(scene.disc)[1];
    if (discY > fy) ty = Math.min(Math.max(fy + 5, yr[0] + 2), yr[1] - 1, discY - 8);
  }
  if (r !== 2 && c !== 1 && Math.abs(tx - fx) < 12) tx = c === 2 ? Math.max(tx, fx + 14) : Math.min(tx, fx - 14);
  return toM([Math.min(Math.max(tx, 3), 97), Math.min(Math.max(ty, 3), 97)]);
}

/** Vị trí một người chạy thẳng from → to với mô hình sprint, bắt đầu ở t0.
 *  throughRun: người nhận đĩa chạy xuyên qua điểm đích (giảm tốc, tối đa 3 m) chứ không đứng khựng lại. */
function runPos(from, to, a, t, t0 = 0, throughRun = false) {
  const L = dist(from, to);
  if (L < 0.01) return from;
  const d = distAt(t - t0, a);
  if (d <= L || !throughRun) return lerp(from, to, Math.min(1, d / L));
  return add(to, mul(norm(sub(to, from)), Math.min(3, (d - L) * 0.6)));
}
// đường ném dài bay nhanh hơn (huck), tối đa ~18 m/s
const throwSpeed = d => Math.min(18, THROW_SPEED + Math.max(0, d - 15) * 0.15);

function isBreakSide(scene, pt) {
  if (scene.force !== 'forehand' && scene.force !== 'backhand') return false;
  const dx = pt[0] - scene.disc[0];
  const upfield = pt[1] < scene.disc[1] - 1;
  return upfield && (scene.force === 'forehand' ? dx < -2 : dx > 2);
}

/**
 * Mô phỏng cả pha bóng khi mình chạy tới `target`.
 * opts: { me: athlete, opp: athlete (người đối đầu với mình), fake: bool, cuts: số sprint đã chạy trong point }
 * Trả về { T, at(t) → {pos: {id: [x,y]}, disc: [x,y,h]|null}, events, result }
 */
export function simulate(scene, target, opts) {
  const mode = modeFor(scene, target);
  const me = tired(opts.me, opts.cuts || 0);
  const opp = opts.opp;
  const T = 6;
  const N = Math.ceil(T / DT);
  const tracks = Object.fromEntries(scene.players.map(p => [p.id, new Array(N)]));

  // đồng đội đang chạy theo arrow + D của họ (theo sau 0.3 s)
  const others = scene.players.filter(p => !p.me);
  const myDef = mode === 'defense' ? scene.me : scene.byId[scene.me.guardedBy] || null;
  const myOpp = mode === 'defense' ? scene.byId[scene.me.guards] : null;

  // ----- kế hoạch chạy của mình / người mình guard -----
  const fake = opts.fake && mode !== 'position' ? fakeEffect(opp) : { cost: 0, bonus: 0 };
  const runDir = norm(sub(target, scene.me.pos));
  const fakePt = add(scene.me.pos, mul(runDir, -0.7));
  const meRunner = mode === 'position' ? { ...me, vmax: me.vmax * 0.75 } : me;

  let oppPlan = null;                               // chế độ defense: người kia cut đi đâu
  if (mode === 'defense' && myOpp) {
    const o = myOpp.pos;
    const openSign = scene.force === 'backhand' ? -1 : 1;
    if (myOpp.run) oppPlan = { to: myOpp.run.to, kind: 'arrow' };
    else {
      const under = [o[0] + openSign * 8, Math.min(o[1] + 4, scene.disc[1] - 5)];
      // mình đã đứng sẵn phía open side + ngang/dưới họ (phía đĩa) → under bị chặn, họ phải đi deep
      const rel = sub(target, o);
      const blocked = rel[0] * openSign > 0.5 && rel[1] > -1.5 && len(rel) < 10;
      oppPlan = blocked
        ? { to: [o[0] + openSign * 6, Math.max(2, o[1] - 14)], kind: 'deep' }
        : { to: under, kind: 'under' };
    }
  }
  const tCutStart = mode === 'defense' ? 0.9 : 0;   // defense: mình vào vị trí trước, rồi họ mới cut

  for (let i = 0; i < N; i++) {
    const t = i * DT;
    for (const p of others) {
      if (mode === 'defense' && p === myOpp) {
        tracks[p.id][i] = runPos(p.pos, oppPlan.to, opp, t, tCutStart, true);
      } else if (p.run) {
        tracks[p.id][i] = runPos(p.run.from, p.run.to, TEAMMATE, t, 0.2);
      } else if (p.team === 'def' && p.guards && scene.byId[p.guards]?.run && !(mode === 'cut' && p === myDef)) {
        const r = scene.byId[p.guards].run;
        tracks[p.id][i] = add(p.pos, sub(runPos(r.from, r.to, TEAMMATE, t, 0.5), r.from));
      } else tracks[p.id][i] = p.pos;
    }
    // mình
    if (mode === 'defense') {
      tracks[scene.me.id][i] = i === 0 ? scene.me.pos : null;   // tính ở vòng pursuit bên dưới
    } else if (t < fake.cost) {
      tracks[scene.me.id][i] = lerp(scene.me.pos, fakePt, Math.sin(Math.PI * t / fake.cost));
    } else {
      tracks[scene.me.id][i] = runPos(scene.me.pos, target, meRunner, t, fake.cost, mode === 'cut');
    }
  }

  // ----- pursuit: D đuổi người họ guard (cut mode: D của mình; defense mode: chính mình) -----
  const chase = (chaser, chaserA, preyTrack, reaction, bite) => {
    let p = chaser.pos, tStart = reaction, prev = p;
    for (let i = 0; i < N; i++) {
      const t = i * DT;
      if (t < reaction) {                                         // bị fake lừa: nhích theo hướng fake
        p = add(chaser.pos, mul(bite, Math.min(1, t / Math.max(reaction, 0.01))));
      } else {
        const lead = chaserA.iq * 0.3;                            // đọc trận tốt → nhắm điểm phía trước
        const j = Math.min(N - 1, i + Math.round(lead / DT));
        const prey = preyTrack[j];
        const want = add(prey, guardOffset(scene, preyTrack, i));
        const step = Math.max(distAt(t - tStart + DT, chaserA) - distAt(t - tStart, chaserA), 0.02);
        const d = sub(want, p);
        p = keepBodyGap(len(d) <= step ? want : add(p, mul(norm(d), step)), preyTrack[i]);
      }
      tracks[chaser.id][i] = p; prev = p;
    }
    return prev;
  };
  if (mode === 'cut' && myDef) {
    chase(myDef, opp, tracks[scene.me.id], opp.reaction + fake.bonus, mul(runDir, -0.5 * (1 - opp.iq) * (fake.bonus > 0 ? 1 : 0)));
  } else if (mode === 'defense' && myOpp) {
    // trước khi họ cut: mình trượt vào vị trí đã chọn; sau đó đuổi
    const meA = me;
    let p = scene.me.pos;
    for (let i = 0; i < N; i++) {
      const t = i * DT;
      if (t < tCutStart) p = lerp(scene.me.pos, target, Math.min(1, t / (tCutStart * 0.8)));
      else {
        const prey = tracks[myOpp.id][i];
        const want = add(prey, guardOffset(scene, tracks[myOpp.id], i));
        const step = Math.max(distAt(t - tCutStart - meA.reaction + DT, meA) - distAt(t - tCutStart - meA.reaction, meA), 0);
        const d = sub(want, p);
        p = keepBodyGap(len(d) <= step ? want : add(p, mul(norm(d), step)), prey);
      }
      tracks[scene.me.id][i] = p;
    }
  }

  // ----- ném đĩa -----
  const events = [];
  let disc = null, result;
  const receiver = mode === 'defense' ? myOpp : scene.me;
  const guard = mode === 'defense' ? scene.me : myDef;
  const runEnd = mode === 'defense'
    ? tCutStart + timeToCover(dist(myOpp.pos, oppPlan.to), opp)
    : fake.cost + timeToCover(dist(scene.me.pos, target), meRunner);
  const recvTarget = mode === 'defense' ? oppPlan.to : target;

  const throwTo = (rcv, fromT, toPt) => {
    const tf = dist(scene.disc, toPt) / throwSpeed(dist(scene.disc, toPt));
    return { t0: fromT, t1: fromT + tf, to: rcv };
  };

  if (mode === 'position') {
    const runner = others.find(p => p.run);
    const conflict = runner && distToSegment(target, runner.run.from, runner.run.to) < 3.5 && dist(target, scene.me.pos) > 1.5;
    if (runner && !conflict) {
      const tArr = 0.2 + timeToCover(dist(runner.run.from, runner.run.to), TEAMMATE);
      disc = throwTo(runner, Math.max(0.6, tArr - 0.6), runner.run.to);
    }
    result = conflict
      ? { status: 'blocked', text: 'Bạn chạy vào đúng lane đồng đội đang cut → lane tắc, handler không ném được.' }
      : opts.correct === false
        ? { status: 'contested', text: 'Bạn không chắn ai lúc này, nhưng đây chưa phải chỗ tốt nhất — xem "Sai phổ biến" và bấm "Xem cách đúng".' }
        : { status: 'ok', text: runner ? 'Lane trống → handler ném cho đồng đội đang cut.' : 'Bạn vào đúng vị trí, giữ lane trống cho team.' };
  } else {
    // tìm thời điểm sớm nhất mở: tách ≥ 1.5 m, D không đứng chắn đường ném, không phải break side
    const breakSide = isBreakSide(scene, recvTarget);
    let tThrow = null, sepAtThrow = 0, laneOnly = false;
    for (let t = 0.5; t <= Math.min(T - 1.2, runEnd + 1); t += 0.05) {
      const i = Math.round(t / DT);
      const rp = tracks[receiver.id][i], gp = guard ? tracks[guard.id][i] : [999, 999];
      const tf = dist(scene.disc, rp) / throwSpeed(dist(scene.disc, rp));
      const k = Math.min(N - 1, Math.round((t + tf) / DT));
      const sep = dist(rp, gp), sepCatch = dist(tracks[receiver.id][k], tracks[guard?.id]?.[k] || [999, 999]);
      // đường ném ngắn bị người đứng giữa chặn; huck (> 15 m) bay vòng qua đầu
      const laneBlocked = guard && dist(scene.disc, rp) < 15 && distToSegment(gp, scene.disc, rp) < 0.9;
      if (sep >= 1.5 && laneBlocked) laneOnly = true;
      if (sep >= 1.5 && sepCatch >= 1.0 && !laneBlocked && !breakSide && t > runEnd * 0.45) { tThrow = t; sepAtThrow = sep; break; }
    }
    if (breakSide) {
      result = { status: 'blocked', text: 'Bạn chạy về break side → marker chặn hướng ném đó, handler không ném được.' };
    } else if (tThrow == null) {
      const iEnd = Math.min(N - 1, Math.round(runEnd / DT));
      const sep = guard ? dist(tracks[receiver.id][iEnd], tracks[guard.id][iEnd]) : 9;
      result = mode === 'defense'
        ? { status: 'ok', sep, text: `Bạn bám được (cách ${sep.toFixed(1)} m) → handler không dám ném. Defense tốt!` }
        : laneOnly && sep >= 1.5
          ? { status: 'covered', sep, text: `Bạn có khoảng trống (${sep.toFixed(1)} m) nhưng defender đứng chắn ngay đường ném → handler không ném.` }
          : { status: 'covered', sep, text: `D theo kịp (chỉ cách ${sep.toFixed(1)} m khi bạn tới nơi) → handler không ném.` };
    } else {
      const dThrow = dist(scene.disc, tracks[receiver.id][Math.round(tThrow / DT)]), tf = dThrow / throwSpeed(dThrow);
      const k = Math.min(N - 1, Math.round((tThrow + tf) / DT));
      const sepC = guard ? dist(tracks[receiver.id][k], tracks[guard.id][k]) : 9;
      disc = { t0: tThrow, t1: tThrow + tf, to: receiver };
      const contested = sepC < 1.2;
      if (mode === 'defense') {
        result = contested
          ? { status: 'ok', sep: sepC, text: `Bạn cách người bắt ${sepC.toFixed(1)} m lúc đĩa tới → có cửa đập đĩa (D)!` }
          : oppPlan.kind === 'deep' || dThrow > 25
            ? { status: 'contested', sep: sepC, text: `${oppPlan.kind === 'deep' ? 'Bạn chặn được under → họ phải chạy deep' : 'Họ chạy deep nhanh hơn bạn'}, mở ${sepC.toFixed(1)} m. Handler phải ném ra deep (${Math.round(dThrow)} m) — khó hơn đường under nhiều; ném chuẩn thì họ vẫn bắt được. Đây là đổi chác đúng khi họ nhanh hơn bạn.` }
            : { status: 'covered', sep: sepC, text: `Họ mở ${sepC.toFixed(1)} m → họ bắt được.` };
      } else {
        result = contested
          ? { status: 'contested', sep: sepC, text: `Handler ném nhưng D chỉ cách ${sepC.toFixed(1)} m → dễ bị đập đĩa.` }
          : { status: 'ok', sep: sepC, text: `Tách được ${sepAtThrow.toFixed(1)} m lúc ném, ${sepC.toFixed(1)} m lúc bắt → bắt gọn!` };
      }
      events.push({ t: tThrow, text: 'Ném!' });
    }
    if (mode === 'defense' && oppPlan.kind === 'deep') events.push({ t: tCutStart, text: 'Họ bị chặn under → chạy deep' });
  }
  if (fake.cost) events.push({ t: 0, text: 'Fake' });

  return {
    T, mode, events, result, target, runEnd,
    at(t) {
      const i = Math.max(0, Math.min(N - 1, Math.round(t / DT)));
      const out = {};
      for (const id in tracks) out[id] = tracks[id][i];
      let d = null;
      if (!disc) d = [...add(tracks[scene.holder.id][i], [0.35, -0.2]), 1.0];
      else if (t < disc.t0) d = [...add(tracks[scene.holder.id][i], [0.35, -0.2]), 1.0];
      else {
        const k = Math.min(1, (t - disc.t0) / (disc.t1 - disc.t0));
        const end = tracks[disc.to.id][Math.min(N - 1, Math.round(disc.t1 / DT))];
        const p = lerp(scene.disc, end, k);
        d = [p[0], p[1], 1.0 + Math.sin(Math.PI * k) * Math.min(3, dist(scene.disc, end) / 8) + (k >= 1 ? 0.3 : 0)];
      }
      const speeds = {};
      const j = Math.max(0, i - 3);
      for (const id in tracks) speeds[id] = dist(tracks[id][i], tracks[id][j]) / ((i - j) * DT || 1);
      return { pos: out, disc: d, speeds };
    },
  };
}

/** Vòng lặp "trước khi trả lời": đồng đội chạy theo arrow, D đi theo. */
export function preview(scene) {
  const runners = scene.players.filter(p => p.run);
  const runT = runners.length ? Math.max(...runners.map(r => 0.2 + timeToCover(dist(r.run.from, r.run.to), TEAMMATE))) : 0;
  const period = Math.max(3, runT + 1.5);
  return {
    period,
    at(time) {
      const t = time % period;
      const pos = {}, speeds = {};
      for (const p of scene.players) {
        let q = p.pos;
        if (p.run) q = runPos(p.run.from, p.run.to, TEAMMATE, t, 0.2);
        else if (p.team === 'def' && p.guards && scene.byId[p.guards].run) {
          const r = scene.byId[p.guards].run;
          q = add(p.pos, sub(runPos(r.from, r.to, TEAMMATE, t, 0.5), r.from));
        }
        pos[p.id] = q;
        const q2 = p.run ? runPos(p.run.from, p.run.to, TEAMMATE, t - 0.05, 0.2) : q;
        speeds[p.id] = dist(q, q2) / 0.05;
      }
      return { pos, disc: [...add(scene.disc, [0.35, -0.2]), 1.0], speeds };
    },
  };
}

/** Phân tích cho thể trạng của mình: chạy mô phỏng đáp án đúng với/không fake, khoẻ/mệt. */
export function analyze(scene, target, me, opp) {
  const cases = [
    { key: 'fresh', fake: false, cuts: 0 }, { key: 'freshFake', fake: true, cuts: 0 },
    { key: 'tired', fake: false, cuts: me.sprints + 1 }, { key: 'tiredFake', fake: true, cuts: me.sprints + 1 },
  ];
  const out = {};
  for (const c of cases) out[c.key] = simulate(scene, target, { me, opp, fake: c.fake, cuts: c.cuts }).result;
  return out;
}
