// Renders the snapshot as a single static HTML page (published to GitHub Pages).

import { STATUS } from './report.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Only allow http(s) links, so a bad URL from a feed can never become a javascript: link.
const safeUrl = (u) => (/^https?:\/\//i.test(String(u ?? "")) ? u : "#");

const SECTIONS = [
  { status: 'coming', blurb: 'Wait. These are on their way to Game Pass.' },
  { status: 'onGamePass', blurb: 'Already included with your Ultimate subscription.' },
  { status: 'mentioned', blurb: 'Named in a recent Xbox Wire Game Pass post. Check the link before buying.' },
  { status: 'none', blurb: 'No sign of these on Game Pass, so buying on Steam is fair game.' },
];

function card(g) {
  const tags = [];
  if (g.xbox?.leaving) tags.push('<span class="tag warn">Leaving soon</span>');
  if (g.discountPct) tags.push(`<span class="tag sale">-${g.discountPct}%</span>`);
  if (g.comingSoon) tags.push('<span class="tag">Unreleased</span>');
  if (g.confidence === 'fuzzy') tags.push(`<span class="tag" title="Matched to “${esc(g.xbox.title)}”">Likely match</span>`);
  if (g.xbox && !g.xbox.onPc && g.status === 'onGamePass') tags.push('<span class="tag">Console / cloud</span>');

  const links = [`<a href="${esc(safeUrl(g.url))}">Steam</a>`];
  if (g.xbox) links.push(`<a href="${esc(safeUrl(g.xbox.url))}">Xbox store</a>`);
  for (const m of g.mentions.slice(0, 2)) links.push(`<a href="${esc(safeUrl(m.link))}" title="${esc(m.title)}">Xbox Wire, ${esc(m.date)}</a>`);

  const date = g.status === 'coming' && g.xbox?.releaseDate > new Date().toISOString().slice(0, 10)
    ? `Launches ${esc(g.xbox.releaseDate)}`
    : g.releaseDate ? `Released ${esc(g.releaseDate)}` : '';

  return `<article class="card" data-name="${esc(g.name.toLowerCase())}">
  ${g.image ? `<img src="${esc(safeUrl(g.image))}" alt="" loading="lazy">` : '<div class="noimg"></div>'}
  <div class="body">
    <h3>${esc(g.name)}</h3>
    <p class="meta"><span class="price">${esc(g.price ?? 'No price yet')}</span>${date ? ` · ${date}` : ''}</p>
    ${tags.length ? `<p class="tags">${tags.join('')}</p>` : ''}
    <p class="links">${links.join('')}</p>
  </div>
</article>`;
}

export function renderDashboard(snapshot) {
  const by = (s) => snapshot.games.filter((g) => g.status === s).sort((a, b) => a.name.localeCompare(b.name));
  const counts = Object.fromEntries(SECTIONS.map(({ status }) => [status, by(status).length]));
  const updated = new Date(snapshot.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Game Pass Watch</title>
<style>
:root{--bg:#f6f7f5;--panel:#fff;--ink:#16181a;--muted:#5d6468;--line:#e3e6e3;--accent:#107c10;
--coming:#0b6bcb;--on:#107c10;--mention:#9a5b00;--none:#5d6468;--warn:#b42318;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#111314;--panel:#1b1e20;--ink:#eceeed;--muted:#9aa3a7;--line:#2c3134;
--coming:#5aa9f5;--on:#4cc24c;--mention:#e0a341;--none:#9aa3a7;--warn:#f0716a;color-scheme:dark}}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:32px 16px 64px}
header h1{margin:0;font-size:28px;letter-spacing:-.02em}
header p{margin:4px 0 0;color:var(--muted)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:24px 0}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:inherit;border-top:4px solid var(--c)}
.tile b{display:block;font-size:30px;line-height:1.1;font-variant-numeric:tabular-nums}
.tile span{color:var(--muted);font-size:13px}
input[type=search]{width:100%;padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit}
section{margin-top:36px}
section h2{margin:0;font-size:19px;display:flex;align-items:center;gap:10px}
section h2::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--c)}
section>p{margin:4px 0 14px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.card img,.noimg{width:100%;aspect-ratio:460/215;object-fit:cover;display:block;background:var(--line)}
.body{padding:12px 14px 14px}
.card h3{margin:0;font-size:15px}
.meta{margin:4px 0 0;color:var(--muted);font-size:13px}
.price{color:var(--ink);font-weight:600}
.tags{margin:8px 0 0;display:flex;flex-wrap:wrap;gap:6px}
.tag{font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--line);color:var(--muted)}
.tag.warn{color:var(--warn);border-color:currentColor}.tag.sale{color:var(--on);border-color:currentColor}
.links{margin:10px 0 0;display:flex;flex-wrap:wrap;gap:12px;font-size:13px}
.links a{color:var(--coming)}
.empty{color:var(--muted);font-style:italic}
footer{margin-top:48px;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>Game Pass Watch</h1>
  <p>${snapshot.games.length} wishlisted games checked against ${snapshot.catalogSize} Game Pass titles · Updated <time datetime="${esc(snapshot.generatedAt)}">${esc(updated)} UTC</time></p>
</header>
<nav class="tiles">
${SECTIONS.map(({ status }) => `<a class="tile" href="#${status}" style="--c:var(--${cssVar(status)})"><b>${counts[status]}</b><span>${STATUS[status]}</span></a>`).join('\n')}
</nav>
<input type="search" id="q" placeholder="Filter games…" aria-label="Filter games">
${SECTIONS.map(({ status, blurb }) => `<section id="${status}" style="--c:var(--${cssVar(status)})">
  <h2>${STATUS[status]} (${counts[status]})</h2>
  <p>${blurb}</p>
  ${counts[status] ? `<div class="grid">${by(status).map(card).join('\n')}</div>` : '<p class="empty">Nothing here right now.</p>'}
</section>`).join('\n')}
<footer>Data: Steam store, Microsoft Game Pass catalog, Xbox Wire. Title matching is automatic. If a game is mismatched, add it to overrides.json.</footer>
</div>
<script>
const t = document.querySelector('time');
t.textContent = new Date(t.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
document.getElementById('q').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  for (const c of document.querySelectorAll('.card')) c.hidden = q && !c.dataset.name.includes(q);
});
</script>
</body>
</html>`;
}

function cssVar(status) {
  return { coming: 'coming', onGamePass: 'on', mentioned: 'mention', none: 'none' }[status];
}
