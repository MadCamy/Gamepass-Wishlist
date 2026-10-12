// Title matching between Steam and Xbox. The stores share no IDs, so we compare
// normalized names; overrides.json fixes the odd cases normalization can't.

const EDITION_WORDS =
  'standard|deluxe|digital deluxe|ultimate|gold|premium|complete|definitive|enhanced|' +
  'anniversary|game of the year|goty|director\'?s cut|remastered|special|launch|collector\'?s';

export function normalize(title) {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\((pc|windows|game preview|early access|xbox series x\|s)\)/g, ' ')
    .replace(/\b(for )?(windows( 10)?|xbox series x\|s|xbox one|pc)( edition)?\s*$/g, ' ')
    .replace(new RegExp(`[-–—:]?\\s*\\b(${EDITION_WORDS}) edition\\s*$`), ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function similarity(a, b) {
  // Levenshtein ratio; only used as a fallback for near-identical titles.
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

// overrides: { "<steam appid>": "<xbox productId>" | null }  (null = never match)
export function buildMatcher(catalog, overrides = {}) {
  const byNorm = new Map();
  const byId = new Map(catalog.map((p) => [p.productId, p]));
  for (const p of catalog) {
    const key = normalize(p.title);
    if (key && !byNorm.has(key)) byNorm.set(key, p);
  }
  const keys = [...byNorm.keys()];

  return function match(appid, steamName) {
    if (String(appid) in overrides) {
      const id = overrides[appid];
      return id && byId.has(id) ? { product: byId.get(id), confidence: 'override' } : null;
    }
    const key = normalize(steamName);
    if (byNorm.has(key)) return { product: byNorm.get(key), confidence: 'exact' };
    if (key.length < 8) return null;
    const digits = (s) => s.match(/\d+/g)?.join(' ') ?? '';
    let best = null;
    for (const k of keys) {
      // Sequels ("Forza Horizon 4" vs "5") must never fuzzy-match.
      if (Math.abs(k.length - key.length) > 3 || digits(k) !== digits(key)) continue;
      const s = similarity(k, key);
      if (s >= 0.9 && (!best || s > best.s)) best = { k, s };
    }
    return best ? { product: byNorm.get(best.k), confidence: 'fuzzy' } : null;
  };
}
