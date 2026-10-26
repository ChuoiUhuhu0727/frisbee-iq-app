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

| Drill | Cách chơi | Data |
|---|---|---|
| **Where to run** | Click vùng trên sơ đồ sân (hoặc phím 1–9) | `wiki/scenarios/` |
| **Reaction** | 2–5 giây, bấm phím 1–9 (bố cục bàn phím số) | scenario `difficulty ≥ 3` |
| **Flashcards** | Space lật, 1 = chưa nhớ, 2 = nhớ rồi | `wiki/glossary.md`, `wiki/concepts/` |
| **Stats** | % đúng theo concept, concept yếu nhất | `app/progress/progress.json` |

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

## Trạng thái (theo build phases)
- [x] Phase 0 — folder + schema
- [x] Phase 1 — seed wiki (kiến thức chung; **chưa có nguồn raw thật** → cần bỏ WFDF rules vào `raw/rules/`)
- [x] Phase 2 — 28 scenario L1–5, có ratio mixed
- [x] Phase 3 — MVP: SVG field + Where to run + Flashcards
- [ ] Phase 4 — loop practice notes → observed plays (bắt đầu từ buổi tập tới)
- [~] Phase 5 — Reaction drill ✓, progress stats ✓, call recognition ✗ (chờ có plays)
