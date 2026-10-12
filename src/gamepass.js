// Game Pass: Microsoft's public (but undocumented) catalog feeds.
// Each "sigl" list returns Microsoft product IDs; displaycatalog turns IDs into titles.

const LISTS = {
  pc: 'fdd9e2a7-0fee-49f6-ad69-4354098401ff', // All PC Games
  console: 'f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e', // All Console Games
  coming: '095bda36-f5cd-43f2-9ee1-0a72f371fb96', // Coming to Game Pass
  leaving: '393f05bf-e596-4ef6-9487-6d4fa0eab987', // Leaving soon
};

async function getList(siglId) {
  const url = `https://catalog.gamepass.com/sigls/v2?id=${siglId}&language=en-us&market=US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Game Pass list ${siglId} failed: HTTP ${res.status}`);
  const ids = (await res.json()).filter((x) => x.id).map((x) => x.id);
  if (!ids.length) throw new Error(`Game Pass list ${siglId} came back empty — the feed may have changed`);
  return ids;
}

async function getProducts(ids) {
  const batches = [];
  for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
  const results = await Promise.all(
    batches.map(async (batch) => {
      const url =
        'https://displaycatalog.mp.microsoft.com/v7.0/products?fieldsTemplate=browse' +
        `&market=US&languages=en-us&bigIds=${batch.join(',')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Microsoft catalog lookup failed: HTTP ${res.status}`);
      return (await res.json()).Products ?? [];
    })
  );
  const out = new Map();
  for (const p of results.flat()) {
    out.set(p.ProductId, {
      productId: p.ProductId,
      title: p.LocalizedProperties?.[0]?.ProductTitle ?? p.ProductId,
      releaseDate: p.MarketProperties?.[0]?.OriginalReleaseDate?.slice(0, 10) ?? null,
      url: `https://www.xbox.com/en-US/games/store/x/${p.ProductId}`,
    });
  }
  return out;
}

// Returns one entry per Game Pass product, flagged with which lists it appears in.
export async function getGamePassCatalog() {
  const [pc, consoleIds, coming, leaving] = await Promise.all(
    [LISTS.pc, LISTS.console, LISTS.coming, LISTS.leaving].map(getList)
  );
  const products = await getProducts([...new Set([...pc, ...consoleIds, ...coming, ...leaving])]);
  const flags = { pc: new Set(pc), console: new Set(consoleIds), coming: new Set(coming), leaving: new Set(leaving) };
  return [...products.values()].map((p) => ({
    ...p,
    onPc: flags.pc.has(p.productId),
    onConsole: flags.console.has(p.productId),
    coming: flags.coming.has(p.productId),
    leaving: flags.leaving.has(p.productId),
  }));
}
