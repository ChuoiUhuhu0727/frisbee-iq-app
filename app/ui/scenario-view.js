// 1 scenario: góc nhìn ngang có chuyển động + mô phỏng sau khi trả lời + phân tích theo thể trạng.
import { md } from './wiki.js';
import { createView } from './view3d.js';
import { annotate, termList } from './terms.js';
import { myAthlete, getProfile } from './profile.js';
import { buildScene, simulate, preview, targetForZone, analyze, modeFor } from '../sim/simulate.js';
import { OPPONENTS, timeToCover } from '../sim/physics.js';

const ROLE = { cutter: 'cutter', handler: 'handler', deep: 'deep', defender: 'defense' };
const store = {
  get() { try { return JSON.parse(localStorage.getItem('fiq.sim')) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem('fiq.sim', JSON.stringify(v)); } catch { /* không sao */ } },
};
const settings = { cam: 'eyes', look: 'disc', help: true, opp: 'fExp', fake: false, cuts: 0, ...store.get() };
const saveSettings = () => store.set(settings);

export function zoneAt(x, y) {
  const col = x < 100 / 3 ? 0 : x < 200 / 3 ? 1 : 2;
  const row = y < 35 ? 0 : y < 65 ? 1 : 2;
  return [[7, 8, 9], [4, 5, 6], [1, 2, 3]][row][col];
}

const STATUS = { ok: ['ok', '✓'], contested: ['warn', '≈'], covered: ['bad', '✗'], blocked: ['bad', '✗'] };

export function renderScenario(root, s, { onAnswer, compact = false, concepts = {} }) {
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
    ${compact ? '' : `<div class="scn-q">${md(s.question)}${s.field ? '<p class="hint">Click lên mặt sân, bản đồ nhỏ, hoặc bấm phím 1–9. Kéo ngang để quay đầu.</p>' : ''}</div>`}
    <div class="scn-body"></div>
    <div class="feedback" hidden></div>`;
  annotate(root.querySelector('.scn-title'));
  if (!compact) annotate(root.querySelector('.scn-q'));
  const body = root.querySelector('.scn-body');
  const fb = root.querySelector('.feedback');
  let answered = false, stop = () => {};

  const finish = (correct, chosen, extra = '') => {
    if (answered) return;
    answered = true;
    root.querySelectorAll('.choice').forEach((b, i) => {
      b.disabled = true;
      if (s.choices[i].correct) b.classList.add('correct');
      else if (i === chosen) b.classList.add('wrong');
    });
    const concept = concepts[s.concept];
    fb.hidden = false;
    fb.className = `feedback ${correct ? 'ok' : 'bad'}`;
    fb.innerHTML = `
      <div class="verdict">${correct ? '✓ Đúng' : chosen == null ? '⏱ Hết giờ' : '✗ Chưa đúng'}</div>
      ${extra}
      <div class="fb-text">
        <h3>Đáp án</h3>${md(s.answer)}
        <h3>Tại sao</h3>${md(s.why)}
        <h3>Sai phổ biến</h3>${md(s.wrong)}
        ${concept?.field ? `<h3>Tập trên sân</h3>${md(concept.field)}` : ''}
      </div>
      <p class="concept-link">Concept: <span class="wl">${s.concept}</span> · đọc thêm <code>wiki/concepts/${s.concept}.md</code></p>
      <p class="next-row"><button class="btn primary" data-next>Câu tiếp ▶</button> <span class="hint">hoặc bấm <kbd>Enter</kbd></span></p>`;
    const found = annotate(fb.querySelector('.fb-text'));
    fb.querySelector('.concept-link').insertAdjacentHTML('beforebegin', termList(found));
    onAnswer?.(correct, chosen);
  };

  if (!s.field) {
    body.innerHTML = `<div class="choices">${s.choices.map((c, i) =>
      `<button class="choice" data-i="${i}"><kbd>${i + 1}</kbd> ${md(c.text).replace(/<\/?p>/g, '')}</button>`).join('')}</div>`;
    body.querySelectorAll('.choice').forEach(b =>
      b.addEventListener('click', () => { const i = +b.dataset.i; finish(s.choices[i].correct, i); }));
    return {
      key(n) { if (n <= s.choices.length) finish(s.choices[n - 1].correct, n - 1); },
      timeout() { finish(false, null); },
      get answered() { return answered; },
      destroy() {},
    };
  }

  // ---------- sân có chuyển động ----------
  const scene = buildScene(s);
  const me = myAthlete();
  body.innerHTML = `
    <div class="stage"></div>
    <div class="cam-bar">
      <div class="seg">
        <button data-cam="eyes" title="Nhìn bằng mắt bạn (cao ${Math.round(getProfile().height * 0.93)} cm)">👁 Mắt mình</button>
        <button data-cam="chase" title="Camera đứng sau lưng bạn">🎥 Sau lưng</button>
      </div>
      <div class="seg">
        <button data-look="disc">Nhìn đĩa</button>
        <button data-look="up">Nhìn endzone</button>
      </div>
      <label class="tog"><input type="checkbox" data-help> Lưới vùng + gợi ý</label>
    </div>`;
  const view = createView(body.querySelector('.stage'), scene, {
    eyeHeight: me.eyeHeight, myHeight: me.height,
    onPick: ([x, y]) => { if (!answered && x >= 0 && x <= 100 && y >= 0 && y <= 100) pick(zoneAt(x, y)); },
    onLook: () => syncBar(),
  });
  const bar = body.querySelector('.cam-bar');
  const syncBar = () => {
    bar.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('active', b.dataset.cam === settings.cam));
    bar.querySelectorAll('[data-look]').forEach(b => b.classList.toggle('active', b.dataset.look === settings.look));
    bar.querySelector('[data-help]').checked = settings.help;
  };
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b?.dataset.cam) { settings.cam = b.dataset.cam; view.setCamera(settings.cam); }
    if (b?.dataset.look) { settings.look = b.dataset.look; view.setLook(settings.look); }
    saveSettings(); syncBar();
  });
  bar.querySelector('[data-help]').addEventListener('change', e => { settings.help = e.target.checked; view.setHelp(settings.help); saveSettings(); });
  view.setCamera(settings.cam); view.setLook(settings.look); view.setHelp(settings.help); syncBar();

  // vòng lặp hình
  const pre = preview(scene);
  let player = { kind: 'pre' }, t0 = performance.now(), raf;
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    if (player.kind === 'pre') {
      view.frame(pre.at(t), t);
      const stall = Math.min(9, 2 + Math.floor((t % pre.period) / 1.0));
      view.hud(`<span class="hud-stall">stalling ${stall}…</span>`);
    } else {
      const sim = player.sim, st = Math.min(t, sim.T);
      const state = sim.at(st);
      view.frame(state, t);
      const ev = sim.events.filter(e => st >= e.t && st < e.t + 0.9).map(e => `<span class="hud-ev">${e.text}</span>`).join('');
      const guard = sim.mode === 'defense' ? scene.byId[scene.me.guards] : scene.byId[scene.me.guardedBy];
      const sep = guard ? Math.hypot(...[0, 1].map(k => state.pos[scene.me.id][k] - state.pos[guard.id][k])) : null;
      view.hud(`<span class="hud-time">${st.toFixed(1)} s</span>${sep != null && sim.mode !== 'position'
        ? `<span class="hud-sep">${sim.mode === 'defense' ? 'Bạn ↔ người bạn guard' : 'Bạn ↔ D'}: ${sep.toFixed(1)} m</span>` : ''}${ev}
        ${st >= sim.T - 0.01 ? `<span class="hud-res ${STATUS[sim.result.status][0]}">${sim.result.text}</span>` : ''}`);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  stop = () => { cancelAnimationFrame(raf); view.destroy(); };

  const correctTarget = targetForZone(scene, s.zones[0]);
  const play = target => {
    const sim = simulate(scene, target, { me, opp: OPPONENTS[settings.opp], fake: settings.fake, cuts: settings.cuts, correct: target === correctTarget || s.zones.includes(pickedZone) });
    player = { kind: 'sim', sim }; t0 = performance.now();
    return sim;
  };

  let pickedZone = null;
  function pick(zone) {
    if (answered) return;
    pickedZone = zone;
    const correct = s.zones.includes(zone);
    const myTarget = targetForZone(scene, zone);
    view.setTargets([
      ...(correct ? [] : [{ pt: myTarget, color: '#ff5a4a' }]),
      { pt: correctTarget, color: '#3dff8a' },
    ]);
    const sim = play(myTarget);
    finish(correct, zone, simPanel(scene, correctTarget, me, sim, correct));
    wireSimPanel(myTarget);
  }

  function wireSimPanel(myTarget) {
    const panel = fb.querySelector('.sim-panel');
    if (!panel) return;
    panel.querySelector('[data-opp]').value = settings.opp;
    panel.querySelector('[data-fake]').checked = settings.fake;
    panel.querySelector('[data-cuts]').value = settings.cuts;
    const refresh = () => {
      panel.querySelector('.cuts-val').textContent = settings.cuts;
      panel.querySelector('.analysis').innerHTML = analysisHtml(scene, correctTarget, me, OPPONENTS[settings.opp]);
      annotate(panel.querySelector('.analysis'));
    };
    panel.addEventListener('change', e => {
      if (e.target.dataset.opp !== undefined) settings.opp = e.target.value;
      if (e.target.dataset.fake !== undefined) settings.fake = e.target.checked;
      if (e.target.dataset.cuts !== undefined) settings.cuts = +e.target.value;
      saveSettings(); refresh();
    });
    panel.querySelector('[data-cuts]').addEventListener('input', e => { panel.querySelector('.cuts-val').textContent = e.target.value; });
    panel.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.play === 'mine') play(myTarget);
      if (b.dataset.play === 'right') play(correctTarget);
    });
    refresh();
  }

  return {
    key(n) { if (!answered) pick(n); },
    timeout() { if (!answered) { view.setTargets([{ pt: correctTarget, color: '#3dff8a' }]); play(correctTarget); finish(false, null); } },
    get answered() { return answered; },
    destroy() { stop(); },
  };
}

function simPanel(scene, correctTarget, me, sim, correct) {
  return `
    <div class="sim-panel">
      <div class="sim-res ${STATUS[sim.result.status][0]}">▶ ${sim.result.text}</div>
      ${!correct && sim.result.status === 'ok' && sim.mode !== 'position' ?'<p class="hint">Pha này vẫn thành công trong mô phỏng (defender phản ứng chậm), nhưng chưa phải lựa chọn tốt nhất — xem "Sai phổ biến" bên dưới.</p>' : ''}
      <div class="sim-btns">
        ${correct ? '' : '<button class="btn" data-play="mine">↻ Xem lại cách bạn chạy</button>'}
        <button class="btn primary" data-play="right">▶ Xem cách đúng</button>
      </div>
      <div class="sim-opts">
        <label>Người guard bạn <select data-opp>${Object.entries(OPPONENTS).map(([k, o]) => `<option value="${k}">${o.label}</option>`).join('')}</select></label>
        <label class="tog"><input type="checkbox" data-fake> Fake trước khi cut</label>
        <label>Đã chạy <b class="cuts-val">0</b> cut trong point <input type="range" min="0" max="8" data-cuts></label>
      </div>
      <div class="analysis"></div>
    </div>`;
}

function analysisHtml(scene, target, me, opp) {
  const mode = modeFor(scene, target);
  if (mode === 'position') {
    return `<h3>Với thể trạng của bạn</h3><p>Tình huống này là về <b>vị trí</b>, không phải tốc độ — đúng chỗ thì không tốn sprint nào. Đây là cách tốt nhất để bạn giữ sức cho cut thật sự.</p>`;
  }
  const r = analyze(scene, target, me, opp);
  const cell = x => `<td class="${STATUS[x.status][0]}">${STATUS[x.status][1]} ${x.sep != null ? `${x.sep.toFixed(1)} m` : ''}</td>`;
  const m10 = timeToCover(10, me), o10 = timeToCover(10, opp);
  const lines = [];
  if (mode === 'cut') {
    if (r.fresh.status === 'ok') lines.push('Còn khoẻ thì bạn đủ nhanh cho cut này, kể cả không fake — cut quyết đoán.');
    else if (r.freshFake.status === 'ok') lines.push(`D này nhanh hơn bạn → <b>phải fake</b> trước khi cut. Fake 1–2 bước làm D trễ ~${(0.4 - 0.25 * opp.iq).toFixed(2)} s, đủ để bạn tách ra.`);
    else lines.push('Dù fake, chạy đua tốc độ với D này là thua. Cách của bạn: cut <b>đúng lúc</b> D quay đầu nhìn đĩa, chọn cut <b>ngắn hơn</b> (dừng sớm, quay lại nhận), hoặc clear để đồng đội nhanh hơn dùng lane.');
    if (r.fresh.status === 'ok' && r.tired.status !== 'ok') lines.push(`Sau ${me.sprints + 1} cut bạn chậm đi rõ → cuối point cut này không còn mở. Để dành sprint: những lúc không có cửa thì clear nhẹ nhàng.`);
  } else {
    if (r.fresh.status === 'ok') lines.push('Đứng đúng chỗ giúp bạn bám được người nhanh hơn — vị trí thắng tốc độ.');
    else lines.push('Người này nhanh hơn bạn → đừng đuổi. Đứng sẵn chặn đường ngắn (under), chấp nhận cho họ đi deep (ném dài khó hơn), lao vào khi đĩa còn đang bay.');
  }
  return `
    <h3>Với thể trạng của bạn</h3>
    <p class="hint">Bạn: 10 m mất ${m10.toFixed(2)} s · ${opp.label}: ${o10.toFixed(2)} s, phản ứng ${opp.reaction} s.</p>
    <table class="matrix">
      <thead><tr><th></th><th>Không fake</th><th>Có fake</th></tr></thead>
      <tbody>
        <tr><th>Đầu point (khoẻ)</th>${cell(r.fresh)}${cell(r.freshFake)}</tr>
        <tr><th>Sau ${me.sprints + 1} cut (mệt)</th>${cell(r.tired)}${cell(r.tiredFake)}</tr>
      </tbody>
    </table>
    <p class="hint">Số = khoảng cách giữa bạn và người kia lúc đĩa tới (≥ 1,2 m: bắt an toàn).</p>
    <ul class="advice">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
}
