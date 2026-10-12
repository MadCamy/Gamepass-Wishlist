# Game Pass Watch

Checks your Steam wishlist against Xbox Game Pass every day, so you don't buy a game that's about to land on Game Pass.

- **Dashboard** (local, never published): every wishlisted game sorted into *Coming to Game Pass*, *On Game Pass now*, *Mentioned in Game Pass news* and *Not on Game Pass*, with Steam prices.
- **Email** (Resend, from a daily GitHub Actions run): sent only when something changes, e.g. a wishlisted game is announced for Game Pass or is leaving.
- **Cost:** $0. GitHub Actions is free for public repos; Resend's free tier allows 100 emails/day.

## Data sources

| What | Where |
|---|---|
| Wishlist | Steam `IWishlistService/GetWishlist`. No API key needed, but the wishlist must be public. |
| Names, prices, images | Steam `IStoreBrowseService/GetItems` |
| Game Pass catalog | Microsoft's catalog feeds (All PC, All Console, Coming to Game Pass, Leaving soon) |
| Early announcements | Xbox Wire's Game Pass RSS feeds, searched for your wishlisted game names |

Steam and Xbox share no game IDs, so games are matched by normalized title. If a game is matched wrongly (or missed), pin it in `overrides.json`:

```json
{
  "1245620": null,
  "2807960": "9P2FF14JZLL3"
}
```

Keys are Steam app IDs. A value of `null` means "never match", and an Xbox product ID (the code at the end of an xbox.com store URL) forces a match.

## One-time setup

1. **Make your Steam wishlist public:** Steam → your profile → Edit Profile → Privacy Settings → **Game details: Public**.
2. **Create a Resend account** at https://resend.com and create an API key. Without your own domain, Resend only sends to the email address you signed up with, which is fine for this.
3. **Create a public GitHub repo** (e.g. `gamepass-wishlist`) and push this folder to it.
4. In **Settings → Secrets and variables → Actions**:
   - New secret `RESEND` = your Resend API key
   - New secret `STEAM` = your 17-digit SteamID64 (a profile URL also works locally, but Steam often blocks the lookup from GitHub servers)
   - New secret `EMAIL_TO` = the address you signed up to Resend with

   Use **Secrets**, not Variables: Actions logs on a public repo are visible to anyone, and only secrets are masked there.
5. Open **Actions → Game Pass check → Run workflow** to run it now. After that it runs daily at 7pm New York time (adjusting for daylight saving).

The run log only shows counts, never game names, because logs on a public repo are public. Between runs, the last result is kept in the Actions cache (which the public can't download) so only changes are emailed.

If a run fails (for example, a Microsoft feed changes or the wishlist goes private), GitHub emails you the failure, so a broken feed never looks like "nothing new".

## Dashboard (local)

Requires Node 22+. There are no dependencies to install. Put your Steam ID in a `.env` file in this folder (it's git-ignored):

```
STEAM_PROFILE=76561190000000000
```

Then, whenever you want to look:

```bash
npm run dashboard
```

This fetches fresh data, writes `site/index.html` and opens it in your browser. Use `npm run check` to print the results without opening it. Set `TEST_APPIDS=1030300,2807960` to test with specific Steam app IDs instead of the wishlist.

## Caveats

- Microsoft's catalog feeds are public but undocumented, so they could change without notice.
- The "Coming to Game Pass" feed only covers the next few weeks. Earlier announcements are caught by the Xbox Wire scan, which is a strong hint rather than a guarantee, so check the linked post.
- Ultimate covers everything in the PC and console catalogs, so both count as "On Game Pass". Console-only titles get a *Console / cloud* tag.
