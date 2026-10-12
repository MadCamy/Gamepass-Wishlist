// Combines wishlist + Game Pass + Xbox Wire into a snapshot, and diffs snapshots
// so the email only reports what changed.

import { getWishlist, getStoreItems } from './steam.js';
import { getGamePassCatalog } from './gamepass.js';
import { getGamePassPosts, findMentions } from './xboxwire.js';
import { buildMatcher } from './match.js';

const MENTION_MAX_AGE_DAYS = 180;

export const STATUS = {
  onGamePass: 'On Game Pass now',
  coming: 'Coming to Game Pass',
  mentioned: 'Mentioned in Game Pass news',
  none: 'Not on Game Pass',
};

export async function buildSnapshot({ steamId, appids, overrides = {}, previous = null }) {
  const wishlist = appids ? appids.map((appid) => ({ appid })) : await getWishlist(steamId);
  const [store, catalog, posts] = await Promise.all([
    getStoreItems(wishlist.map((w) => w.appid)),
    getGamePassCatalog(),
    getGamePassPosts().catch(() => []),
  ]);
  const match = buildMatcher(catalog, overrides);
  const prevById = new Map((previous?.games ?? []).map((g) => [g.appid, g]));
  const cutoff = new Date(Date.now() - MENTION_MAX_AGE_DAYS * 864e5).toISOString().slice(0, 10);

  const games = wishlist
    .filter((w) => store.has(w.appid))
    .map((w) => {
      const s = store.get(w.appid);
      const m = match(w.appid, s.name);
      const p = m?.product;

      // Keep mentions from earlier runs: the RSS feeds only hold the latest few posts.
      const mentions = [...(prevById.get(w.appid)?.mentions ?? []), ...findMentions(posts, s.name)]
        .filter((x, i, all) => x.date >= cutoff && all.findIndex((y) => y.link === x.link) === i)
        .sort((a, b) => b.date.localeCompare(a.date));

      let status = 'none';
      if (p && (p.onPc || p.onConsole)) status = 'onGamePass';
      else if (p?.coming) status = 'coming';
      else if (mentions.length) status = 'mentioned';

      return {
        appid: w.appid,
        ...s,
        status,
        confidence: m?.confidence ?? null,
        xbox: p
          ? { title: p.title, url: p.url, releaseDate: p.releaseDate, onPc: p.onPc, onConsole: p.onConsole, leaving: p.leaving }
          : null,
        mentions,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    catalogSize: catalog.length,
    games,
  };
}

// What's worth an email: anything that moved into a Game Pass status, or started leaving.
export function diffSnapshots(previous, current) {
  const prevById = new Map((previous?.games ?? []).map((g) => [g.appid, g]));
  const changes = [];
  for (const g of current.games) {
    const before = prevById.get(g.appid);
    if (g.status !== 'none' && g.status !== before?.status) {
      changes.push({ game: g, kind: g.status });
    }
    if (g.xbox?.leaving && !before?.xbox?.leaving) changes.push({ game: g, kind: 'leaving' });
  }
  return changes;
}
