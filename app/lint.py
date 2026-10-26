"""Wiki lint — chạy 1 lần/tuần:  python app/lint.py

Kiểm tra theo CLAUDE.md: link [[...]] hỏng, orphan page, concept chưa có scenario,
scenario sai format (ratio, field JSON, 1 người "me", answer_zones / lựa chọn),
play còn status: observed quá 14 ngày.
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WIKI = ROOT / "wiki"
LINK = re.compile(r"\[\[([^\]]+)\]\]")
STALE_DAYS = 14


def frontmatter(text):
    m = re.match(r"^---\r?\n(.*?)\r?\n---", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = re.sub(r"\s+#.*$", "", v).strip()
    return meta


def main():
    pages = {p: p.read_text(encoding="utf-8") for p in WIKI.rglob("*.md")}
    # [[name]] khớp theo tên file (stem) hoặc path tương đối không đuôi (sources/x)
    names = {}
    for p in pages:
        names[p.stem] = p
        names[p.relative_to(WIKI).with_suffix("").as_posix()] = p

    problems = []
    inbound = {p: 0 for p in pages}
    for p, text in pages.items():
        for target in LINK.findall(re.sub(r"```.*?```", "", text, flags=re.S)):
            if target in names:
                if names[target] != p:
                    inbound[names[target]] += 1
            elif not target.startswith("<"):
                problems.append(f"broken link: [[{target}]] trong {p.relative_to(ROOT).as_posix()}")

    skip_orphan = {"index", "log", "overview"}
    for p, n in inbound.items():
        if n == 0 and p.stem not in skip_orphan:
            problems.append(f"orphan: {p.relative_to(ROOT).as_posix()} (không page nào link tới)")

    concepts = {p.stem for p in (WIKI / "concepts").glob("*.md")}
    covered = set()
    for p in sorted((WIKI / "scenarios").glob("*.md")):
        text, meta, rel = pages[p], frontmatter(pages[p]), p.relative_to(ROOT).as_posix()
        covered.add(meta.get("concept"))
        if meta.get("concept") not in concepts:
            problems.append(f"{rel}: concept '{meta.get('concept')}' không tồn tại")
        if not meta.get("ratio"):
            problems.append(f"{rel}: thiếu ratio")
        fld = re.search(r"```field\s*(.*?)```", text, re.S)
        if fld:
            try:
                f = json.loads(fld.group(1))
                me = sum(1 for q in f.get("offense", []) + f.get("defense", []) if len(q) > 2 and q[2] == "me")
                if me != 1:
                    problems.append(f"{rel}: cần đúng 1 người 'me' (đang có {me})")
            except ValueError as e:
                problems.append(f"{rel}: field JSON lỗi ({e})")
            zones = [int(z) for z in re.findall(r"\d", meta.get("answer_zones", ""))]
            if not zones or any(z < 1 or z > 9 for z in zones):
                problems.append(f"{rel}: answer_zones phải là list số 1–9")
        else:
            if len(re.findall(r"^- \[x\] ", text, re.M)) != 1:
                problems.append(f"{rel}: scenario chọn đáp án cần đúng 1 dòng '- [x]'")

    for c in sorted(concepts - covered):
        problems.append(f"concept chưa có scenario: [[{c}]]")

    today = dt.date.today()
    for p in (WIKI / "entities" / "plays").glob("*.md"):
        meta = frontmatter(pages[p])
        if meta.get("status") == "observed":
            try:
                since = dt.date.fromisoformat(meta.get("observed_since", ""))
            except ValueError:
                problems.append(f"{p.name}: play observed nhưng thiếu observed_since: YYYY-MM-DD")
                continue
            if (today - since).days > STALE_DAYS:
                problems.append(f"{p.name}: observed {(today - since).days} ngày → hỏi coach để confirm")

    if problems:
        print(f"{len(problems)} vấn đề:")
        for x in problems:
            print(" -", x)
    else:
        print(f"OK — {len(pages)} pages, {len(concepts)} concepts đều có scenario.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
