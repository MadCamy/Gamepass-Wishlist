// Steam: resolve a profile, read its wishlist, and look up store details in batches.
// None of these endpoints need an API key, but the wishlist must be public
// (Steam -> Edit Profile -> Privacy Settings -> "Game details" = Public).

const API = 'https://api.steampowered.com';
const ASSET_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/';

export async function resolveSteamId(profile) {
  if (/^\d{17}$/.test(profile)) return profile;
  const numeric = profile.match(/steamcommunity\.com\/profiles\/(\d{17})/)?.[1];
  if (numeric) return numeric;
  const vanity = profile.match(/steamcommunity\.com\/id\/([^/]+)/)?.[1] ?? profile;
  // steamcommunity.com sometimes throttles cloud IPs, so retry with a growing delay.
  let lastStatus;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, attempt * 10_000));
    const res = await fetch(`https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`);
    lastStatus = res.status;
    const id = (await res.text()).match(/<steamID64>(\d{17})<\/steamID64>/)?.[1];
    if (id) return id;
  }
  throw new Error(
    `Could not resolve Steam profile (last HTTP ${lastStatus}). ` +
    'Setting the STEAM secret to your 17-digit SteamID64 skips this lookup entirely.'
  );
}

export async function getWishlist(steamId) {
  const res = await fetch(`${API}/IWishlistService/GetWishlist/v1/?steamid=${steamId}`);
  if (!res.ok) throw new Error(`Steam wishlist request failed: HTTP ${res.status}`);
  const items = (await res.json()).response?.items;
  if (!items?.length) {
    throw new Error(
      'Steam returned an empty wishlist. Either it is empty, or your profile\'s "Game details" ' +
      'privacy setting is not Public (Steam -> Edit Profile -> Privacy Settings).'
    );
  }
  return items.map((i) => ({ appid: i.appid, priority: i.priority, dateAdded: i.date_added }));
}

export async function getStoreItems(appids) {
  const out = new Map();
  for (let i = 0; i < appids.length; i += 100) {
    const input = {
      ids: appids.slice(i, i + 100).map((appid) => ({ appid })),
      context: { language: 'english', country_code: 'US' },
      data_request: { include_release: true, include_assets: true },
    };
    const url = `${API}/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Steam store lookup failed: HTTP ${res.status}`);
    for (const item of (await res.json()).response?.store_items ?? []) {
      if (!item.name) continue;
      const price = item.best_purchase_option;
      const releaseTs = item.release?.steam_release_date ?? item.release?.original_release_date;
      out.set(item.appid, {
        name: item.name.trim(),
        price: price?.formatted_final_price ?? (item.is_free ? 'Free' : null),
        priceCents: price ? Number(price.final_price_in_cents) : null,
        discountPct: price?.discount_pct ?? 0,
        releaseDate: releaseTs ? new Date(releaseTs * 1000).toISOString().slice(0, 10) : null,
        comingSoon: Boolean(item.release?.is_coming_soon) || (releaseTs ? releaseTs * 1000 > Date.now() : false),
        image: item.assets?.header
          ? ASSET_BASE + item.assets.asset_url_format.replace('${FILENAME}', item.assets.header)
          : null,
        url: `https://store.steampowered.com/app/${item.appid}`,
      });
    }
  }
  return out;
}
