"""Frisbee IQ — local server.

Serves the repo folder and a tiny JSON API so the browser app can read wiki/*.md
and save progress to app/progress/ (no database, no dependencies).

    python app/server.py          → http://127.0.0.1:8000
"""
import json
import sys
import time
import webbrowser
from collections import defaultdict
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WIKI = ROOT / "wiki"
PROGRESS_DIR = ROOT / "app" / "progress"
PROGRESS_JSON = PROGRESS_DIR / "progress.json"
STATS_MD = PROGRESS_DIR / "stats.md"
PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8000)
MAX_BODY = 5 * 1024 * 1024


def read_md_dir(folder):
    if not folder.exists():
        return []
    return [{"name": p.stem, "text": p.read_text(encoding="utf-8")} for p in sorted(folder.glob("*.md"))]


def load_wiki():
    glossary = WIKI / "glossary.md"
    return {
        "scenarios": read_md_dir(WIKI / "scenarios"),
        "concepts": read_md_dir(WIKI / "concepts"),
        "plays": read_md_dir(WIKI / "entities" / "plays"),
        "glossary": glossary.read_text(encoding="utf-8") if glossary.exists() else "",
    }


def load_progress():
    if PROGRESS_JSON.exists():
        return json.loads(PROGRESS_JSON.read_text(encoding="utf-8"))
    return {"attempts": [], "cards": {}}


def write_stats(progress):
    """Render progress.json as markdown so the LLM can ingest it into wiki/entities/me.md."""
    by_concept = defaultdict(lambda: {"n": 0, "ok": 0, "ms": []})
    for a in progress.get("attempts", []):
        c = by_concept[a.get("concept", "?")]
        c["n"] += 1
        c["ok"] += 1 if a.get("correct") else 0
        if a.get("drill") == "reaction" and a.get("correct") and a.get("ms"):
            c["ms"].append(a["ms"])

    rows = sorted(by_concept.items(), key=lambda kv: kv[1]["ok"] / kv[1]["n"])
    lines = [
        "# Progress stats",
        "",
        f"> Tự sinh bởi `app/server.py` lúc {time.strftime('%Y-%m-%d %H:%M')}. Đừng sửa tay — ingest vào [[me]].",
        "",
        f"Tổng lượt làm: **{len(progress.get('attempts', []))}**",
        "",
        "| Concept | Lượt | % đúng | Reaction TB (ms, câu đúng) |",
        "|---|---|---|---|",
    ]
    for name, c in rows:
        avg = f"{sum(c['ms']) / len(c['ms']):.0f}" if c["ms"] else "—"
        lines.append(f"| [[{name}]] | {c['n']} | {100 * c['ok'] / c['n']:.0f}% | {avg} |")
    if rows:
        lines += ["", f"**Concept yếu nhất:** [[{rows[0][0]}]] → app ưu tiên drill concept này."]

    cards = {k: v for k, v in progress.get("cards", {}).items() if v.get("known", 0) < v.get("seen", 0)}
    if cards:
        weak = sorted(cards.items(), key=lambda kv: kv[1]["known"] / kv[1]["seen"])[:10]
        lines += ["", "## Flashcards còn yếu", ""]
        lines += [f"- {k} ({v.get('known', 0)}/{v.get('seen', 0)} biết)" for k, v in weak]
    STATS_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


class Handler(SimpleHTTPRequestHandler):
    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/app/ui/index.html")
            self.end_headers()
        elif self.path == "/api/wiki":
            self._json(load_wiki())
        elif self.path == "/api/progress":
            self._json(load_progress())
        else:
            super().do_GET()

    def do_POST(self):
        if self.path != "/api/progress":
            return self._json({"error": "not found"}, 404)
        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_BODY:
            return self._json({"error": "too large"}, 413)
        try:
            progress = json.loads(self.rfile.read(length))
            assert isinstance(progress.get("attempts"), list)
        except (ValueError, AssertionError, AttributeError):
            return self._json({"error": "bad progress json"}, 400)
        PROGRESS_DIR.mkdir(parents=True, exist_ok=True)
        PROGRESS_JSON.write_text(json.dumps(progress, ensure_ascii=False, indent=1), encoding="utf-8")
        write_stats(progress)
        self._json({"ok": True})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # wiki edits show up on reload
        super().end_headers()

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # Windows console mặc định cp1252
    server = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=str(ROOT)))
    url = f"http://127.0.0.1:{PORT}/"
    print(f"Frisbee IQ chạy ở {url}  (Ctrl+C để tắt)")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
