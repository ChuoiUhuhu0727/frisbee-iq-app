// Đọc wiki/*.md (qua /api/wiki) và parse theo format trong CLAUDE.md.

export async function loadWiki() {
  const raw = await (await fetch('/api/wiki')).json();
  const scenarios = raw.scenarios.map(f => parseScenario(f.name, f.text)).filter(Boolean);
  const concepts = raw.concepts.map(f => parseConcept(f.name, f.text));
  const glossary = parseGlossary(raw.glossary);
  return { scenarios, concepts, glossary, plays: raw.plays };
}

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).replace(/\s+#.*$/, '').trim();
    meta[key] = val;
  }
  return { meta, body: text.slice(m[0].length) };
}

export function sections(body) {
  const out = {};
  const parts = body.split(/^## /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    out[p.slice(0, nl).trim()] = p.slice(nl + 1).trim();
  }
  return out;
}

const numList = s => (s || '').replace(/[[\]]/g, '').split(',').map(x => parseInt(x, 10)).filter(n => n >= 1 && n <= 9);

function parseScenario(name, text) {
  const { meta, body } = parseFrontmatter(text);
  if (meta.type !== 'scenario') return null;
  const sec = sections(body);
  let field = null;
  const fm = body.match(/```field\s*([\s\S]*?)```/);
  if (fm) {
    try { field = JSON.parse(fm[1]); } catch (e) { console.warn(`${name}: field JSON lỗi`, e); return null; }
  }
  const choices = (sec['Lựa chọn'] || '').split('\n')
    .map(l => l.match(/^- \[( |x)\] (.*)$/)).filter(Boolean)
    .map(m => ({ correct: m[1] === 'x', text: m[2] }));
  const s = {
    id: meta.id || name,
    title: meta.title || name,
    concept: meta.concept || '?',
    offense: meta.offense,
    role: meta.my_role,
    level: parseInt(meta.level, 10) || 1,
    difficulty: parseInt(meta.difficulty, 10) || 1,
    ratio: meta.ratio || '',
    force: meta.force || 'none',
    zones: numList(meta.answer_zones),
    field,
    choices,
    question: sec['Câu hỏi'] || '',
    answer: sec['Đáp án đúng'] || '',
    why: sec['Tại sao'] || '',
    wrong: sec['Sai phổ biến'] || '',
  };
  if (field && !s.zones.length) { console.warn(`${name}: thiếu answer_zones`); return null; }
  if (!field && !choices.length) { console.warn(`${name}: không có field lẫn lựa chọn`); return null; }
  return s;
}

function parseConcept(name, text) {
  const { meta, body } = parseFrontmatter(text);
  const title = (body.match(/^# (.*)$/m) || [, name])[1];
  const sec = sections(body);
  return { slug: name, title, level: parseInt(meta.level, 10) || 1, short: sec['Nói ngắn gọn'] || '', field: sec['Tập trên sân'] || '' };
}

function parseGlossary(text) {
  return text.split('\n')
    .map(l => l.match(/^- \*\*(.+?)\*\* — (.+)$/)).filter(Boolean)
    .map(m => ({ term: m[1], def: m[2] }));
}

// Markdown tối giản: đoạn văn, bullet, **bold**, `code`, [[link]].
export function md(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[\[(.+?)\]\]/g, '<span class="wl">$1</span>');
  const out = [];
  let list = false;
  for (const line of (text || '').split('\n')) {
    if (/^\s*- /.test(line)) {
      if (!list) { out.push('<ul>'); list = true; }
      out.push(`<li>${inline(line.replace(/^\s*- /, ''))}</li>`);
    } else {
      if (list) { out.push('</ul>'); list = false; }
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (list) out.push('</ul>');
  return out.join('');
}
