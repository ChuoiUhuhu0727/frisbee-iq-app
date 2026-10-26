# Frisbee IQ Trainer — Plan (theo LLM Wiki)

> Mục tiêu: giúp mình (beginner, nữ) **đọc sân nhanh hơn**, biết **chạy vào đâu**, và **quen dần chiến thuật của team**.
> Phương pháp: LLM Wiki — 3 layers (Raw Sources → Wiki → Schema) + 3 operations (Ingest → Query → Lint).
> App = lớp "luyện tập" chạy **trên** wiki.

---

## 1. Ý tưởng cốt lõi

- Mình **không tự viết wiki**. Mình chỉ bỏ tài liệu vào `raw/`. LLM đọc, tóm tắt, và cập nhật wiki.
- Kiến thức **tích lũy dần (compounding)**: mỗi buổi tập, mỗi video, mỗi lời coach nói → thêm vào wiki.
- App lấy nội dung từ wiki để tạo **drill**: quiz tình huống, bài phản xạ, flashcard.

```
raw/ (mình bỏ vào)  →  wiki/ (LLM viết)  →  app/ (mình luyện tập)
                           ↑
                     schema (luật chơi cho LLM)
```

---

## 2. Folder structure (hierarchy)

```
frisbee-iq/
├── CLAUDE.md                  # SCHEMA — luật cho LLM (xem mục 5)
│
├── raw/                       # LAYER 1 — Raw Sources (immutable, LLM chỉ đọc)
│   ├── team/
│   │   ├── observed-plays/    # pattern team lặp lại (tự ghi, xem mục 11)
│   │   ├── practice-notes/    # ghi chú sau mỗi buổi tập: 2026-10-26.md ...
│   │   └── coach-feedback/    # feedback coach dành riêng cho mình
│   ├── videos/                # transcript / ghi chú khi xem video
│   ├── articles/              # bài viết về ultimate (rules, tactics)
│   └── rules/                 # WFDF rules / luật giải đấu
│
├── wiki/                      # LAYER 2 — The Wiki (LLM sở hữu)
│   ├── index.md               # mục lục toàn bộ wiki, 1 dòng mô tả / page
│   ├── log.md                 # append-only: mọi lần ingest / query / lint
│   ├── overview.md            # bức tranh tổng: ultimate là gì, mình đang ở đâu
│   │
│   ├── concepts/              # khái niệm chiến thuật
│   │   ├── vertical-stack.md
│   │   ├── horizontal-stack.md
│   │   ├── cutting-lanes.md       # "chỗ nào cần chạy vào"
│   │   ├── under-vs-deep-cut.md
│   │   ├── clearing-space.md      # cut xong thì clear ra đâu
│   │   ├── the-force.md           # force forehand / backhand
│   │   ├── zone-defense.md
│   │   ├── person-defense.md
│   │   ├── dump-swing.md
│   │   └── spacing.md
│   │
│   ├── entities/              # thứ cụ thể: vị trí, team, play
│   │   ├── roles/
│   │   │   ├── handler.md
│   │   │   ├── cutter.md
│   │   │   └── deep.md
│   │   ├── plays/             # các play riêng của TEAM MÌNH
│   │   │   └── <play-name>.md
│   │   ├── team.md            # team mình: style, đội hình hay dùng, call names
│   │   └── me.md              # vị trí mình hay chơi, điểm mạnh/yếu, mục tiêu
│   │
│   ├── scenarios/             # tình huống sân → đáp án (nguồn cho drill)
│   │   └── <scenario-id>.md
│   │
│   ├── glossary.md            # thuật ngữ: stack, force, pull, huck, mark...
│   └── sources/               # 1 page tóm tắt cho mỗi file trong raw/
│       └── <source-name>.md
│
└── app/                       # LỚP LUYỆN TẬP (đọc từ wiki/)
    ├── drills/
    │   ├── where-to-run/      # quiz: nhìn sơ đồ sân → chọn chỗ chạy
    │   ├── reaction/          # phản xạ: hiện tình huống, đếm giờ 2–3s
    │   ├── call-recognition/  # nghe call team → biết làm gì
    │   └── flashcards/        # glossary + concept
    ├── progress/
    │   └── stats.md           # điểm, tốc độ phản xạ, concept còn yếu
    └── ui/                    # sơ đồ sân, nút chọn, timer
```

---

## 3. Layer 1 — Raw Sources (`raw/`)

**Luật:** mình bỏ vào, LLM **không bao giờ sửa**.

| Loại | Ví dụ | Khi nào thêm |
|---|---|---|
| Practice notes | "Hôm nay bị mark mất 2 lần vì đứng sai side" | Sau mỗi buổi tập (5 phút) |
| Coach feedback | "Cut sớm quá, chờ handler nhìn mình" | Khi coach góp ý |
| Playbook | Đội hình, tên play, call | Khi team dạy play mới |
| Video notes | Transcript / ghi chú clip | Khi xem video tactic |
| Rules | WFDF rules | Một lần, cập nhật khi đổi |

---

## 4. Layer 2 — The Wiki (`wiki/`)

### 4.1 Page types

| Type | Folder | Chứa gì |
|---|---|---|
| **Overview** | `overview.md` | Big picture + lộ trình học của mình |
| **Concept** | `concepts/` | Khái niệm chiến thuật, giải thích plain language + sơ đồ |
| **Entity** | `entities/` | Role, play, team, bản thân mình |
| **Scenario** | `scenarios/` | Tình huống sân cụ thể + đáp án đúng + lý do |
| **Source** | `sources/` | Tóm tắt từng file raw |
| **Glossary** | `glossary.md` | Thuật ngữ, giữ nguyên tiếng Anh |

### 4.2 Template — Concept page

```markdown
---
type: concept
level: beginner | intermediate | advanced
related: [[cutting-lanes]], [[vertical-stack]]
sources: [[sources/playbook]]
---
# Vertical Stack

## Nói ngắn gọn (1–2 câu)
## Mình đứng ở đâu? (sơ đồ ASCII)
## Khi nào chạy / khi nào clear
## Lỗi beginner hay gặp
## Team mình làm khác gì?   ← lấy từ raw/team/
## Drill liên quan → app/drills/...
```

### 4.3 Template — Scenario page (quan trọng nhất cho app)

```markdown
---
type: scenario
concept: [[cutting-lanes]]
offense: vertical-stack
my_role: cutter
difficulty: 1-5
---
# S-012: Handler bị mark force forehand, mình ở vị trí thứ 3 trong stack

## Sơ đồ sân
## Câu hỏi: Mình chạy đâu?
## Đáp án đúng: Under cut về phía open side
## Tại sao
## Sai phổ biến: chạy break side → bị D chặn
```

### 4.4 `index.md` format

```markdown
# Index
## Concepts
- [[vertical-stack]] — đội hình xếp hàng dọc giữa sân
## Entities
- [[handler]] — người cầm đĩa, phân phối bóng
## Scenarios
- [[S-012]] — force forehand, cutter vị trí 3
```

### 4.5 `log.md` format (append-only)

```markdown
## [2026-10-26] ingest | practice-notes/2026-10-26.md
- updated: [[clearing-space]], [[me]]
- new: [[S-013]]
- ⚠ contradiction: playbook nói clear ra trái, coach nói clear ra phải

## [2026-10-27] lint
- orphan: [[dump-swing]] chưa có link từ đâu
```

---

## 5. Layer 3 — The Schema (`CLAUDE.md`)

Nội dung chính của file schema:

1. **Mục đích:** wiki giúp một beginner nữ hiểu chiến thuật ultimate và chạy đúng chỗ.
2. **Ngôn ngữ:** giải thích bằng tiếng Việt, plain language; thuật ngữ giữ tiếng Anh.
3. **Ưu tiên nguồn:** `raw/team/` > coach feedback > articles > video. Team mình làm khác sách → ghi rõ trong mục "Team mình làm khác gì?".
4. **Mỗi concept phải có ≥ 1 scenario** (để app có drill).
5. **Division:** ghi chú riêng cho mixed / women's division khi liên quan (gender ratio, matchup).
6. **Workflow** cho Ingest / Query / Lint (mục 6).
7. **Không sửa `raw/`**. Mọi thay đổi ghi vào `log.md`.

---

## 6. Operations

### 6.1 Ingest — sau mỗi buổi tập / tài liệu mới
1. Bỏ file vào `raw/`.
2. LLM đọc → tạo `sources/<name>.md`.
3. Cập nhật concept / entity / `me.md` liên quan (thường 5–15 pages).
4. Tạo scenario mới nếu có tình huống thật.
5. Flag mâu thuẫn.
6. Cập nhật `index.md` + ghi `log.md`.

### 6.2 Query — hỏi wiki
- Ví dụ: "Khi team chạy zone, mình là popper thì đứng đâu?"
- Câu trả lời tốt → **lưu lại thành page mới** (scenario hoặc concept).

### 6.3 Lint — 1 lần / tuần
- Tìm: orphan pages, concept chưa có scenario, thông tin cũ, link thiếu.
- LLM gợi ý: câu hỏi nên hỏi coach, video nên xem.

---

## 7. App layer (`app/`)

### 7.1 Drill types

| Drill | Cách chơi | Luyện gì | Lấy data từ |
|---|---|---|---|
| **Where to run** | Hiện sơ đồ sân → tap chỗ mình nên chạy | Field IQ | `scenarios/` |
| **Reaction** | Như trên nhưng chỉ 2–3 giây | Phản xạ | `scenarios/` (difficulty cao) |
| **Call recognition** | Hiện/nghe call của team → chọn hành động | Quen chiến thuật team | `entities/plays/` |
| **Flashcards** | Thuật ngữ, concept | Nền tảng | `glossary.md`, `concepts/` |

### 7.2 Progress (`progress/stats.md`)
- % đúng theo từng concept
- Thời gian phản ứng trung bình
- Concept yếu nhất → app ưu tiên drill đó
- Kết quả ghi lại → có thể ingest ngược vào `me.md`

### 7.3 Lộ trình beginner (levels)

| Level | Focus | Concepts |
|---|---|---|
| 1 | Biết luật + vị trí | rules, glossary, roles |
| 2 | Offense cơ bản | vertical-stack, under-vs-deep-cut, clearing-space |
| 3 | Defense cơ bản | the-force, person-defense |
| 4 | Chiến thuật team | team.md, plays/ |
| 5 | Nâng cao | horizontal-stack, zone-defense, dump-swing |

---

## 8. Build phases

| Phase | Việc | Output |
|---|---|---|
| **0. Setup** | Tạo folder + `CLAUDE.md` | Repo rỗng có schema |
| **1. Seed wiki** | Ingest rules + 2–3 bài cơ bản + playbook team | ~10 concept, glossary |
| **2. Scenarios** | Viết 20–30 scenario Level 1–2 | Data cho drill |
| **3. MVP app** | Drill "Where to run" + flashcards | Web app đơn giản |
| **4. Loop** | Ingest practice notes mỗi buổi + lint mỗi tuần | Wiki lớn dần |
| **5. Mở rộng** | Reaction drill, call recognition, progress stats | App đầy đủ |

---

## 9. Quyết định đã chốt (2026-10-26)
- **Division:** mixed → thêm concept mixed (mục 10).
- **Playbook:** team chưa có → mình tự xây playbook dần từ practice notes (mục 11).
- **Platform:** laptop → web app chạy local, luyện **trước/sau** buổi tập, không dùng trên sân (mục 12).

---

## 10. Mixed division — thêm vào wiki

```
wiki/concepts/
├── gender-ratio.md        # 4-3 / 3-4, ABBA rule, ai quyết định ratio
├── matchups.md            # mình thường bị ai mark, mình mark ai
└── mixed-offense.md       # cách team dùng cả 2 line trong 1 point
```

- Schema thêm luật: mỗi scenario ghi rõ **ratio** của point đó (vd: 4 nam – 3 nữ).
- `me.md` có mục **"Mình trong mixed"**: vị trí hay được giao, lúc nào nên đòi đĩa.
- Lưu ý thẳng: trong mixed, cầu thủ nữ beginner hay bị "đứng cho có". Wiki nên có scenario dạy **cut chủ động**, không chỉ clear chỗ.

---

## 11. Playbook — tự xây từ con số 0

Vì team chưa có playbook, `raw/team/playbook.md` bỏ đi, thay bằng:

```
raw/team/
├── practice-notes/        # vẫn như cũ, ghi sau mỗi buổi
└── observed-plays/        # mỗi lần thấy team làm 1 pattern lặp lại → ghi 1 file
    └── 2026-10-26-vert-stack-pull.md
```

- **Ingest workflow mới:** khi 1 pattern xuất hiện ≥ 2 lần trong practice notes → LLM tạo `entities/plays/<play>.md` với tag `status: observed` (chưa được coach xác nhận).
- Khi coach xác nhận → đổi thành `status: confirmed`.
- **Lint** thêm check: play nào còn `observed` > 2 tuần → nhắc mình hỏi coach.
- Bonus: playbook này có thể **share lại cho team** sau vài tháng.

**Template ghi practice note (5 phút):**
```markdown
# 2026-10-26
- Offense team dùng: (vert / ho / không rõ)
- Defense team dùng: (person / zone / không rõ)
- Call mới nghe: ...
- Lúc mình không biết chạy đâu: ...
- Coach nói gì với mình: ...
```

---

## 12. Platform — laptop web app

| Quyết định | Lý do |
|---|---|
| Web app chạy local (HTML + JS, hoặc React) | Đơn giản, không cần deploy |
| Đọc thẳng file `.md` trong `wiki/` | Wiki cập nhật → drill cập nhật luôn |
| Sơ đồ sân = SVG, click để chọn chỗ chạy | Dễ vẽ, dễ tương tác bằng chuột |
| Reaction drill dùng **phím** (vd: 1–9 = 9 vùng sân) | Bấm phím nhanh hơn click → đo phản xạ chuẩn hơn |
| Progress lưu file JSON local | Không cần database |

**Cách dùng:**
- **Trước buổi tập (10 phút):** drill concept yếu nhất.
- **Sau buổi tập (5 phút):** ghi practice note → ingest.

**Cập nhật Build phases:**
- Phase 1: seed wiki bằng rules + articles (chưa có playbook).
- Phase 2: scenarios Level 1–2, mỗi scenario có ratio mixed.
- Phase 3: MVP = SVG field + "Where to run" + flashcards.
- Phase 4: loop practice notes → observed plays.
- Phase 5: reaction drill bằng phím + call recognition (khi đã có plays).
