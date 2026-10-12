// Sends the "what changed" email through Resend (free tier: 100 emails/day).

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const HEADINGS = {
  coming: 'Coming to Game Pass. Hold off on buying.',
  onGamePass: 'Now on Game Pass',
  mentioned: 'Mentioned in Game Pass news',
  leaving: 'Leaving Game Pass soon',
};

export function buildEmail(changes, siteUrl) {
  const groups = Object.keys(HEADINGS)
    .map((kind) => [kind, changes.filter((c) => c.kind === kind).map((c) => c.game)])
    .filter(([, games]) => games.length);

  const subject = `Game Pass Watch: ${changes.length} wishlist update${changes.length === 1 ? '' : 's'}`;
  const html = `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:15px;color:#16181a;max-width:560px">
${groups
  .map(
    ([kind, games]) => `<h2 style="font-size:17px;margin:20px 0 8px">${HEADINGS[kind]}</h2><ul style="padding-left:18px;margin:0">
${games
  .map((g) => {
    const detail = [g.price && `Steam ${g.price}`, kind === 'coming' && g.xbox?.releaseDate && `GP date ${g.xbox.releaseDate}`]
      .filter(Boolean)
      .join(' · ');
    const link = kind === 'mentioned' ? g.mentions[0]?.link : g.xbox?.url ?? g.url;
    return `<li style="margin:4px 0"><a href="${esc(link)}">${esc(g.name)}</a>${detail ? ` <span style="color:#5d6468">(${esc(detail)})</span>` : ''}</li>`;
  })
  .join('\n')}</ul>`
  )
  .join('\n')}
${siteUrl ? `<p style="margin-top:24px"><a href="${esc(siteUrl)}">Open the dashboard</a></p>` : ''}
</div>`;
  const text = groups
    .map(([kind, games]) => `${HEADINGS[kind]}\n${games.map((g) => `- ${g.name}`).join('\n')}`)
    .join('\n\n');
  return { subject, html, text: siteUrl ? `${text}\n\nDashboard: ${siteUrl}` : text };
}

export async function sendEmail({ apiKey, to, from, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend failed: HTTP ${res.status} ${await res.text()}`);
}

