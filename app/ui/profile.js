// Hồ sơ thể lực: lưu ở app/progress/profile.json (gitignored — repo public).
import { DEFAULT_PROFILE, EXPERIENCE, OPPONENTS, athleteFromProfile, timeToCover, fatigueFactor, distAt } from '../sim/physics.js';

let profile = { ...DEFAULT_PROFILE };
let saved = false;

export async function loadProfile() {
  try {
    const p = await (await fetch('/api/profile')).json();
    if (p) { profile = { ...DEFAULT_PROFILE, ...p }; saved = true; }
  } catch { /* dùng mặc định */ }
  return profile;
}
export const getProfile = () => profile;
export const hasProfile = () => saved;
export const myAthlete = () => athleteFromProfile(profile);

async function save(p) {
  profile = p; saved = true;
  await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
}

const fmt = (x, d = 1) => x.toFixed(d).replace('.', ',');

export function mountProfile(root, { annotate }) {
  const render = () => {
    const p = profile, a = myAthlete();
    const rows = [['Bạn', a], ...Object.values(OPPONENTS).map(o => [o.label, o])];
    const maxV = Math.max(...rows.map(([, r]) => r.vmax));
    root.innerHTML = `
      <section class="panel">
        <h2>Hồ sơ thể lực</h2>
        <p class="hint">Dùng để mô phỏng: bạn chạy nhanh cỡ nào, bao nhiêu cut thì đuối, so với người guard bạn.
          Lưu ở <code>app/progress/profile.json</code> trên máy bạn — <b>không</b> đưa lên GitHub.</p>
        <form class="profile-form">
          <label>Giới tính <select name="sex"><option value="F">Nữ</option><option value="M">Nam</option></select></label>
          <label>Chiều cao (cm) <input name="height" type="number" min="120" max="220" required></label>
          <label>Cân nặng (kg) <input name="weight" type="number" min="30" max="150" required></label>
          <label class="wide">Kinh nghiệm thể thao
            <select name="experience">${EXPERIENCE.map(e => `<option value="${e.id}">${e.label}</option>`).join('')}</select></label>
          <fieldset class="wide"><legend>Số đo thật (không bắt buộc — có thì mô phỏng chính xác hơn nhiều)</legend>
            <label>Chạy 20 m từ đứng yên mất (giây) <input name="sprint20" type="number" step="0.01" min="2.5" max="8" placeholder="vd 4.3"></label>
            <label>Chạy 20 m hết sức được mấy lần liên tiếp (nghỉ 15 s) trước khi chậm rõ <input name="repeatSprints" type="number" min="1" max="20" placeholder="vd 3"></label>
            <p class="hint">Cách đo: nhờ bạn bấm đồng hồ điện thoại; đo 2 lần lấy lần nhanh hơn.</p>
          </fieldset>
          <button class="btn primary wide">Lưu hồ sơ</button>
        </form>
      </section>
      <section class="panel">
        <h2>Ước lượng của bạn <small>(${a.source})</small></h2>
        <div class="stats-top">
          <div class="stat"><div class="n">${fmt(a.vmax)}</div><div>m/s tốc độ tối đa</div></div>
          <div class="stat"><div class="n">${fmt(timeToCover(10, a), 2)} s</div><div>chạy 10 m (1 under cut)</div></div>
          <div class="stat"><div class="n">${fmt(timeToCover(20, a), 2)} s</div><div>chạy 20 m (1 deep cut)</div></div>
          <div class="stat"><div class="n">${a.sprints}</div><div>cut hết sức / point trước khi đuối</div></div>
        </div>
        <h3>So với người guard bạn</h3>
        <table class="stats cmp">
          <thead><tr><th></th><th>Tốc độ tối đa</th><th>10 m</th><th>20 m</th><th>Lúc bạn chạy xong 10 m, họ hơn bạn</th></tr></thead>
          <tbody>${rows.map(([label, r]) => {
            const gap = distGap(a, r, timeToCover(10, a));
            return `<tr class="${label === 'Bạn' ? 'me-row' : ''}"><td>${label}</td>
              <td><span class="bar"><span style="width:${r.vmax / maxV * 100}%"></span></span> ${fmt(r.vmax)} m/s</td>
              <td>${fmt(timeToCover(10, r), 2)} s</td><td>${fmt(timeToCover(20, r), 2)} s</td>
              <td>${label === 'Bạn' ? '—' : gap >= 0 ? `${fmt(gap)} m` : `bạn hơn ${fmt(-gap)} m`}</td></tr>`;
          }).join('')}</tbody>
        </table>
        <h3>Điều này nghĩa là gì trên sân</h3>
        <ul class="advice">${advice(a).map(x => `<li>${x}</li>`).join('')}</ul>
        ${a.notes.length ? `<ul class="advice notes">${a.notes.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
        <p class="hint">Mô hình: v(t) = vmax·(1 − e<sup>−t/τ</sup>) — ước lượng thô từ số liệu trung bình theo giới tính & kinh nghiệm, không phải đo thật.
          Mệt: tới cut thứ ${a.sprints + 1} tốc độ còn ~${Math.round(fatigueFactor(a, a.sprints + 1) * 100)}%, cut thứ ${a.sprints + 3} còn ~${Math.round(fatigueFactor(a, a.sprints + 3) * 100)}%.</p>
      </section>`;
    const form = root.querySelector('form');
    for (const [k, v] of Object.entries(p)) if (form.elements[k] && v != null) form.elements[k].value = v;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const num = k => (fd.get(k) === '' ? null : +fd.get(k));
      await save({ sex: fd.get('sex'), height: num('height'), weight: num('weight'), experience: num('experience'), sprint20: num('sprint20'), repeatSprints: num('repeatSprints') });
      render();
    });
    annotate(root.querySelector('.advice'));
  };
  render();
  return () => {};
}

/** Lúc a chạy xong 10 m (cùng xuất phát), b đã chạy hơn a bao nhiêu mét. */
const distGap = (a, b, t) => distAt(t, b) - distAt(t, a);

function advice(a) {
  const exp = OPPONENTS.fExp;
  const gap10 = distGap(a, exp, timeToCover(10, a));
  const out = [];
  if (gap10 > 0.5) out.push(`Cùng xuất phát, khi bạn chạy xong 10 m thì một nữ có kinh nghiệm đã hơn bạn ~${fmt(gap10)} m → <b>đừng đua tốc độ thẳng</b>. Bạn tạo khoảng cách bằng <b>fake</b> (giả vờ chạy 1 hướng), <b>timing</b> (cut đúng lúc handler nhìn bạn, lúc D quay đầu nhìn đĩa) và <b>góc chạy</b> (đổi hướng gắt).`);
  else out.push('Bạn theo kịp nữ có kinh nghiệm trên quãng ngắn → under cut 8–10 m là vũ khí chính.');
  out.push('Ưu tiên <b>under cut ngắn</b> (5–10 m): quãng ngắn thì tăng tốc 2–3 bước đầu quan trọng hơn tốc độ tối đa — người nhẹ, thấp như bạn tăng tốc và dừng nhanh. Deep cut 20 m+ là sân chơi của người có vmax cao.');
  out.push(`Chỉ có ~${a.sprints} cut hết sức mỗi point → <b>đừng phí sprint</b>: cut nào cũng phải có lý do (lane trống + handler đang nhìn). Không có cửa thì <b>clear</b> bằng chạy nhẹ để giữ sức.`);
  out.push('Defense với người nhanh hơn: <b>vị trí trước, tốc độ sau</b>. Đứng sẵn chỗ họ muốn tới (open side, phía under), giữ khoảng cách 1–2 m (cushion) để không bị vượt ngay, chấp nhận cho họ chạy deep (đường ném dài khó hơn) và lao vào lúc đĩa bay — đĩa ~13 m/s nhưng bay vòng, bạn có thêm thời gian.');
  return out;
}
