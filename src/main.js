// Entry point: build the snapshot, write the dashboard, email any changes.
//
// Environment:
//   STEAM_PROFILE    profile URL, vanity name or SteamID64 (required unless TEST_APPIDS)
//   TEST_APPIDS      comma-separated Steam app IDs to use instead of the wishlist
//   PREVIOUS_URL     URL of the last published data.json (used to detect changes)
//   SITE_URL         dashboard URL, linked from the email
//   RESEND_API_KEY, EMAIL_TO, EMAIL_FROM   email settings (email is skipped if unset)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolveSteamId } from './steam.js';
import { buildSnapshot, diffSnapshots, STATUS } from './report.js';
import { renderDashboard } from './dashboard.js';
import { buildEmail, sendEmail } from './email.js';

const env = process.env;
const OUT = new URL('../site/', import.meta.url);

async function loadPrevious() {
  try {
    if (env.PREVIOUS_URL) {
      const res = await fetch(env.PREVIOUS_URL, { cache: 'no-store' });
      return res.ok ? await res.json() : null;
    }
    return JSON.parse(await readFile(new URL('data.json', OUT), 'utf8'));
  } catch {
    return null;
  }
}

const overrides = JSON.parse(await readFile(new URL('../overrides.json', import.meta.url), 'utf8'));
const appids = env.TEST_APPIDS?.split(',').map(Number);
const steamId = appids ? null : await resolveSteamId(env.STEAM_PROFILE ?? '');
const previous = await loadPrevious();

const snapshot = await buildSnapshot({ steamId, appids, overrides, previous });
await mkdir(OUT, { recursive: true });
await writeFile(new URL('data.json', OUT), JSON.stringify(snapshot, null, 1));
await writeFile(new URL('index.html', OUT), renderDashboard(snapshot));

for (const status of Object.keys(STATUS)) {
  const games = snapshot.games.filter((g) => g.status === status);
  console.log(`\n${STATUS[status]} (${games.length})`);
  for (const g of games) {
    const extra = [g.price, g.xbox && g.xbox.title !== g.name && `matched "${g.xbox.title}"`, g.xbox?.leaving && 'LEAVING SOON']
      .filter(Boolean)
      .join(' · ');
    console.log(`  ${g.name}${extra ? `  (${extra})` : ''}`);
  }
}

const changes = diffSnapshots(previous, snapshot);
console.log(`\n${changes.length} change(s) since last run${previous ? '' : ' (first run)'}.`);

if (changes.length && env.RESEND_API_KEY && env.EMAIL_TO) {
  const email = buildEmail(changes, env.SITE_URL);
  await sendEmail({
    apiKey: env.RESEND_API_KEY,
    to: env.EMAIL_TO,
    from: env.EMAIL_FROM || 'Game Pass Watch <onboarding@resend.dev>',
    ...email,
  });
  console.log(`Emailed ${env.EMAIL_TO}.`);
}
