# Frisbee IQ — Wiki Schema (luật cho LLM)

> File này là **Layer 3 — Schema**. Mọi LLM làm việc trong repo này phải đọc và theo đúng file này.
> Kế hoạch gốc: [frisbee-iq-plan.md](frisbee-iq-plan.md).

## 1. Mục đích
Wiki giúp **một beginner nữ chơi mixed** hiểu chiến thuật ultimate, **đọc sân nhanh hơn**, biết **chạy vào đâu**,
và quen dần chiến thuật của team. App trong `app/` đọc thẳng các file `.md` trong `wiki/` để tạo drill.

## 2. Ba layer
| Layer | Folder | Ai sở hữu | Luật |
|---|---|---|---|
| Raw Sources | `raw/` | người dùng | **LLM chỉ đọc, không bao giờ sửa/xoá/đổi tên** |
| Wiki | `wiki/` | LLM | LLM viết & cập nhật; mọi thay đổi ghi vào `wiki/log.md` |
| Schema | `CLAUDE.md` | cả hai | chỉ sửa khi người dùng đồng ý |

## 3. Ngôn ngữ & giọng văn
- Giải thích bằng **tiếng Việt, plain language**, câu ngắn.
- **Thuật ngữ giữ tiếng Anh** (stack, force, mark, huck, dump, swing, cut, clear, break side, open side...).
- Mỗi concept phải trả lời được câu "**vậy mình chạy đâu / đứng đâu?**".
- **Người dùng chưa biết nhiều thuật ngữ**: lần đầu một thuật ngữ xuất hiện trong page (hoặc trong câu trả lời chat),
  ghi định nghĩa ngắn hoặc ví dụ ngay bên cạnh, vd: "cut **under** (chạy về phía đĩa)". Thuật ngữ mới → thêm vào `glossary.md`
  (app tự gạch chân + hiện định nghĩa cho mọi thuật ngữ có trong glossary).
- **Thể trạng thật**: nữ, nhỏ người, chưa chơi thể thao đồng đội → chạy chậm hơn đa số đối thủ, ít sprint mỗi point.
  Lời khuyên phải tính tới điều đó (fake, timing, vị trí, cut ngắn, tiết kiệm sprint), không giả định chạy nhanh hơn defender.
  Số đo cá nhân nằm ở `app/progress/profile.json` (gitignored — repo public, **không** chép số đo vào wiki).

## 4. Ưu tiên nguồn (khi mâu thuẫn)
`raw/team/` > `raw/team/coach-feedback/` > `raw/rules/` (luật) > `raw/articles/` > `raw/videos/` > kiến thức chung của LLM.
- Team làm khác sách → ghi rõ trong mục **"Team mình làm khác gì?"** của concept, không xoá phần "sách".
- Kiến thức chung của LLM (chưa có nguồn raw) phải gắn `sources: [[sources/llm-general-knowledge]]` để biết cần đối chiếu.
- Mâu thuẫn → ghi `⚠ contradiction:` trong `log.md` và trong page liên quan.

## 5. Page types & frontmatter
Mọi page bắt đầu bằng frontmatter `---` với các key đơn giản (`key: value`, list viết `[a, b]`).

| Type | Folder | Frontmatter bắt buộc |
|---|---|---|
| overview | `wiki/overview.md` | `type` |
| concept | `wiki/concepts/` | `type, level (1-5), related, sources` |
| entity | `wiki/entities/` | `type, sources` (+ `status: observed\|confirmed` cho play) |
| scenario | `wiki/scenarios/` | xem mục 6 |
| source | `wiki/sources/` | `type, raw` (đường dẫn file raw) |
| glossary | `wiki/glossary.md` | `type` |

### Concept page — các mục theo thứ tự
```
# <Tên concept>
## Nói ngắn gọn          ← 1–2 câu. App dùng mục này làm mặt sau flashcard.
## Mình đứng ở đâu?      ← sơ đồ ASCII
## Khi nào chạy / khi nào clear
## Lỗi beginner hay gặp
## Mixed division        ← nếu liên quan
## Team mình làm khác gì?
## Tập trên sân          ← 1 bài tập cụ thể làm được ở buổi tập tới (quiz đúng ≠ làm được trên sân). App hiện mục này sau mỗi câu.
## Drill liên quan
```

### Glossary — app parse đúng format này, mỗi dòng 1 thuật ngữ
```
- **term** — định nghĩa ngắn tiếng Việt
```

## 6. Scenario page (nguồn data cho app — format phải chính xác)
~~~markdown
---
type: scenario
id: S-001
title: Câu mô tả ngắn tình huống
concept: cutting-lanes            # slug của 1 file trong wiki/concepts/
offense: vertical-stack           # vertical-stack | horizontal-stack | vs-zone | defense
my_role: cutter                   # handler | cutter | deep | defender
level: 2                          # 1-5, theo lộ trình beginner
difficulty: 2                     # 1-5; app dùng difficulty >= 3 cho reaction drill
ratio: 4 nam - 3 nữ               # BẮT BUỘC (mixed)
force: forehand                   # forehand | backhand | none
answer_zones: [6]                 # 1 hoặc nhiều vùng đúng (xem lưới bên dưới)
---
# S-001: <title>

## Sơ đồ sân
```field
{ "disc": [50, 85],
  "offense": [[50, 85, "H"], [30, 92, "H"], [50, 60, "me"]],
  "defense": [[45, 84, "M"], [50, 56]],
  "arrows": [[50, 60, 70, 50]] }
```

## Câu hỏi
Mình chạy đâu?

## Đáp án đúng
...

## Tại sao
...

## Sai phổ biến
...
~~~

### Hệ toạ độ sân (app vẽ SVG từ đây)
- Hướng tấn công: **lên trên**. Endzone tấn công ở trên cùng (y = 0–12).
- `x`: 0 = sideline trái → 100 = sideline phải. `y`: 0 = trên (deep) → 100 = dưới (sau lưng đĩa).
- Người ném thuận tay phải. **Force forehand → open side = bên phải** (x lớn). **Force backhand → open side = bên trái**.
- `offense`: `[x, y, nhãn]` — nhãn `"H"` handler, `"C"` cutter, `""` không nhãn.
- `defense`: `[x, y]` hoặc `[x, y, "M"]` (M = marker). Person defense: **`defense[i]` guard `offense[i]`** (cùng thứ tự,
  cùng số người; marker đứng cùng index với người cầm đĩa). Zone: số người khác nhau → app tự ghép người gần nhất.
- Nhãn `"me"` = mình — **đúng 1 người**, nằm trong `offense` hoặc `defense` (scenario defense).
- `arrows` (tuỳ chọn): `[x1, y1, x2, y2]` — đường chạy của người khác (KHÔNG vẽ đường chạy đáp án).

### Scenario dạng chọn đáp án (cho tình huống không có vị trí: luật, ratio, matchup, call)
Bỏ `answer_zones` và block `field`, thay bằng mục `## Lựa chọn` dùng checkbox — đúng 1 dòng `[x]`:
```
## Lựa chọn
- [ ] Đáp án sai
- [x] Đáp án đúng
- [ ] Đáp án sai
```
App hiện các lựa chọn này thay cho sơ đồ sân. Reaction drill chỉ dùng scenario có sơ đồ sân.

### Lưới 9 vùng (giống bàn phím số — reaction drill dùng phím 1–9)
```
        trái      giữa      phải
deep  |   7   |    8    |   9   |   y 0–35
mid   |   4   |    5    |   6   |   y 35–65
near  |   1   |    2    |   3   |   y 65–100
```

## 7. Luật nội dung
1. **Mỗi concept phải có ≥ 1 scenario** (để app có drill). Lint kiểm tra.
2. **Mỗi scenario ghi `ratio`** của point đó (mixed).
3. Có scenario dạy **cut chủ động** cho cầu thủ nữ — không chỉ "clear chỗ" / "đứng cho có".
4. `me.md` có mục **"Mình trong mixed"**.
5. Play của team: tạo `entities/plays/<play>.md` khi 1 pattern xuất hiện **≥ 2 lần** trong `raw/team/`, tag `status: observed`.
   Chỉ đổi thành `status: confirmed` khi coach xác nhận (có trong `raw/team/coach-feedback/` hoặc practice note ghi rõ).

## 8. Operations

### Ingest (sau mỗi buổi tập / tài liệu mới)
1. Đọc file mới trong `raw/`.
2. Tạo `wiki/sources/<tên-file>.md` (tóm tắt + `raw:` path).
3. Cập nhật concept / entity / `me.md` liên quan (thường 5–15 pages).
4. Tạo scenario mới nếu có tình huống thật ("Lúc mình không biết chạy đâu" trong practice note → scenario).
5. Pattern lặp ≥ 2 lần → play `status: observed`.
6. Flag mâu thuẫn.
7. Cập nhật `wiki/index.md` + append `wiki/log.md`.

### Query
- Trả lời từ wiki, trích `[[page]]`. Câu trả lời tốt → lưu thành page mới (scenario hoặc concept) + log.

### Lint (1 lần / tuần)
Chạy `python app/lint.py` rồi xử lý kết quả. Kiểm tra thêm bằng mắt:
- orphan pages (không ai link tới), concept chưa có scenario, link `[[...]]` hỏng,
- scenario thiếu `ratio` / sai format field,
- play `status: observed` quá 2 tuần → nhắc người dùng hỏi coach,
- đọc `app/progress/stats.md` → concept yếu nhất → gợi ý câu hỏi cho coach / video nên xem.
Ghi kết quả vào `log.md`.

## 9. log.md (append-only)
```
## [YYYY-MM-DD] ingest | <file raw>
- updated: [[page]], ...
- new: [[page]], ...
- ⚠ contradiction: ...
```
Không bao giờ sửa entry cũ.
