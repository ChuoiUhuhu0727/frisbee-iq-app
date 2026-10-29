# Frisbee IQ Trainer

Luyện **đọc sân** cho ultimate frisbee (mixed, beginner): biết **chạy vào đâu**, phản xạ nhanh hơn, quen chiến thuật team.
Xây theo phương pháp **LLM Wiki** — kế hoạch đầy đủ: [frisbee-iq-plan.md](frisbee-iq-plan.md).

```
raw/ (mình bỏ vào)  →  wiki/ (LLM viết)  →  app/ (mình luyện tập)
                           ↑
                  CLAUDE.md (schema — luật cho LLM)
```

## Chạy app
Cần Python 3 (không cần cài thêm gì):
```bash
python app/server.py
```
Mở http://127.0.0.1:8000. App đọc thẳng `wiki/*.md` → sửa wiki, reload là drill cập nhật.

| Tab | Cách chơi | Data |
|---|---|---|
| **Where to run** | Nhìn sân **từ mắt mình** (hoặc sau lưng), người chạy thật; click chỗ chạy / phím 1–9 → xem **mô phỏng pha bóng** với tốc độ của bạn | `wiki/scenarios/` |
| **Reaction** | Như trên nhưng chỉ 2–5 giây, phím 1–9 (bố cục bàn phím số) | scenario `difficulty ≥ 3` |
| **Flashcards** | Space lật, 1 = chưa nhớ, 2 = nhớ rồi | `wiki/glossary.md`, `wiki/concepts/` |
| **Stats** | % đúng theo concept, concept yếu nhất | `app/progress/progress.json` |
| **Thể lực** | Hồ sơ cơ thể → ước lượng tốc độ, tăng tốc, số sprint/point; so với người guard bạn | `app/progress/profile.json` |

- Sau mỗi câu: kết quả mô phỏng (tách được bao nhiêu mét, có bị đập đĩa không), bảng **khoẻ/mệt × fake/không fake**
  cho đúng thể trạng của bạn, và **bài tập trên sân** cho buổi tập tới.
- Thuật ngữ được gạch chân (hover xem nghĩa) + liệt kê định nghĩa ngay dưới phần giải thích.
- Mô hình thể lực là **ước lượng thô** (`app/sim/physics.js`). Đo thật 20 m sprint ở tab Thể lực để mô phỏng sát hơn.
- `progress.json`, `stats.md`, `profile.json` là dữ liệu cá nhân → **gitignored** (repo public).

App ưu tiên scenario thuộc **concept yếu nhất**. Kết quả được ghi ra `app/progress/stats.md` để ingest ngược vào `wiki/entities/me.md`.

## Vòng lặp hằng tuần
1. **Trước buổi tập (10')** — drill concept yếu nhất.
2. **Sau buổi tập (5')** — copy `raw/team/practice-notes/TEMPLATE.md` thành `YYYY-MM-DD.md`, ghi nhanh → bảo Claude: *"ingest practice note hôm nay"*.
3. **Cuối tuần** — `python app/lint.py`, rồi bảo Claude: *"lint wiki"*.

## Cấu trúc
| Folder | Nội dung |
|---|---|
| `raw/` | Nguồn gốc — LLM chỉ đọc (practice notes, coach feedback, rules, articles, videos) |
| `wiki/concepts/` | 14 concept (stack, cutting lanes, force, zone, mixed...) |
| `wiki/entities/` | roles, team, me, plays (tự xây từ practice notes) |
| `wiki/scenarios/` | 28 tình huống → nguồn cho drill |
| `app/` | web app local (Python stdlib server + JS modules, không build step) |
| `app/sim/` | mô hình thể lực + mô phỏng pha bóng (ai chạy đâu, D đuổi, ném/bắt) |
| `app/ui/view3d.js` | góc nhìn ngang trên sân (canvas, phối cảnh tự viết, không thư viện) |

## Trạng thái (theo build phases)
- [x] Phase 0 — folder + schema
- [x] Phase 1 — seed wiki (kiến thức chung; **chưa có nguồn raw thật** → cần bỏ WFDF rules vào `raw/rules/`)
- [x] Phase 2 — 28 scenario L1–5, có ratio mixed
- [x] Phase 3 — MVP: Where to run + Flashcards (nay: góc nhìn ngang + mô phỏng động theo thể lực)
- [ ] Phase 4 — loop practice notes → observed plays (bắt đầu từ buổi tập tới)
- [~] Phase 5 — Reaction drill ✓, progress stats ✓, call recognition ✗ (chờ có plays)
