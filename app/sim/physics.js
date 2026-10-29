// Mô hình thể lực đơn giản — ƯỚC LƯỢNG THÔ, không phải đo thật.
//
// Sprint từ đứng yên: v(t) = vmax · (1 − e^(−t/τ))
//   vmax = tốc độ tối đa (m/s), τ = hằng số tăng tốc (s, càng nhỏ càng bùng nổ).
// Mốc tham khảo (20 m từ đứng yên): nữ chưa tập ~4.2 s, nữ thi đấu ~3.5 s, nam thi đấu ~3.1 s.
// Độ bền = số sprint hết sức trong 1 point trước khi tốc độ tụt rõ.

export const EXPERIENCE = [
  { id: 0, label: 'Chưa chơi thể thao đồng đội / thi đấu', vMul: 1.0, tau: 1.0, sprints: 3 },
  { id: 1, label: 'Thỉnh thoảng vận động (chạy, đạp xe...)', vMul: 1.05, tau: 0.93, sprints: 4 },
  { id: 2, label: 'Tập đều 2–3 buổi/tuần', vMul: 1.11, tau: 0.86, sprints: 6 },
  { id: 3, label: 'Đã thi đấu môn chạy nhiều', vMul: 1.18, tau: 0.8, sprints: 8 },
];

export const DEFAULT_PROFILE = { sex: 'F', height: 160, weight: 52, experience: 0, sprint20: null, repeatSprints: null };

const SEX_BASE = { F: 6.2, M: 7.2 };   // vmax (m/s) người chưa tập
const SEX_REF_HEIGHT = { F: 160, M: 172 };

/** Hồ sơ cá nhân → thông số chạy. Có số đo thật (sprint20 / repeatSprints) thì dùng số đo. */
export function athleteFromProfile(p) {
  const exp = EXPERIENCE[p.experience] || EXPERIENCE[0];
  const notes = [];
  let vmax = SEX_BASE[p.sex] * exp.vMul;
  const hAdj = Math.max(-0.05, Math.min(0.05, (p.height - SEX_REF_HEIGHT[p.sex]) / 10 * 0.015));
  vmax *= 1 + hAdj;
  if (hAdj < -0.01) notes.push('Sải chân ngắn hơn trung bình → tốc độ tối đa thấp hơn một chút, nhưng đổi hướng nhanh hơn.');
  const bmi = p.weight / (p.height / 100) ** 2;
  if (bmi < 18.5) { vmax *= 0.98; notes.push(`BMI ${bmi.toFixed(1)} (nhẹ cân) → ít khối cơ, dễ đuối hơn; bù lại nhẹ người nên dừng/đổi hướng gọn.`); }
  else if (bmi > 27) vmax *= 0.96;
  let tau = exp.tau;
  let sprints = exp.sprints - (bmi < 18.5 ? 1 : 0);
  let source = 'ước lượng từ hồ sơ';

  if (p.sprint20 > 2.5 && p.sprint20 < 8) {          // hiệu chỉnh vmax bằng số đo 20 m
    let lo = 3, hi = 11;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; timeToCover(20, { vmax: mid, tau }) > p.sprint20 ? lo = mid : hi = mid; }
    vmax = (lo + hi) / 2;
    source = 'hiệu chỉnh bằng số đo 20 m của bạn';
  }
  if (p.repeatSprints >= 1 && p.repeatSprints <= 20) sprints = Math.round(p.repeatSprints);
  return { vmax, tau, sprints: Math.max(2, sprints), reaction: 0.3, iq: 0, eyeHeight: p.height / 100 * 0.93, height: p.height / 100, notes, source };
}

// Đối thủ / đồng đội mẫu. reaction = thời gian phản ứng (s); iq: 0 = hay bị lừa bởi fake, 1 = đọc trận tốt.
export const OPPONENTS = {
  fNew: { label: 'Nữ mới chơi', vmax: 6.2, tau: 1.0, reaction: 0.35, iq: 0, sprints: 3, height: 1.58 },
  fExp: { label: 'Nữ có kinh nghiệm', vmax: 6.8, tau: 0.88, reaction: 0.28, iq: 0.5, sprints: 6, height: 1.62 },
  fTop: { label: 'Nữ thi đấu, đọc trận tốt', vmax: 7.3, tau: 0.8, reaction: 0.22, iq: 1, sprints: 8, height: 1.65 },
  mExp: { label: 'Nam phong trào', vmax: 7.6, tau: 0.85, reaction: 0.28, iq: 0.5, sprints: 6, height: 1.72 },
  mTop: { label: 'Nam thi đấu, đọc trận tốt', vmax: 8.5, tau: 0.75, reaction: 0.2, iq: 1, sprints: 8, height: 1.78 },
};

/** Tốc độ còn lại sau khi đã chạy `cuts` sprint trong point này. */
export function fatigueFactor(a, cuts) {
  const over = Math.max(0, cuts - a.sprints);
  return Math.max(0.72, 1 - 0.015 * Math.min(cuts, a.sprints) - 0.07 * over);
}

export const speedAt = (t, a) => t <= 0 ? 0 : a.vmax * (1 - Math.exp(-t / a.tau));
export const distAt = (t, a) => t <= 0 ? 0 : a.vmax * (t - a.tau * (1 - Math.exp(-t / a.tau)));

export function timeToCover(d, a) {
  let lo = 0, hi = 30;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; distAt(mid, a) < d ? lo = mid : hi = mid; }
  return (lo + hi) / 2;
}

export const tired = (a, cuts) => ({ ...a, vmax: a.vmax * fatigueFactor(a, cuts) });

/** Fake: mình tốn `cost` giây; defender bị trễ thêm `bonus` giây (đối thủ đọc trận tốt thì ít bị lừa). */
export function fakeEffect(defender) {
  return { cost: 0.35, bonus: 0.4 - 0.25 * defender.iq };
}
