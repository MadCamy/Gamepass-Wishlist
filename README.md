# Game Pass Watch

Checks your Steam wishlist against Xbox Game Pass every day, so you don't buy a game that's about to land on Game Pass.

- **Dashboard** (GitHub Pages): every wishlisted game sorted into *Coming to Game Pass*, *On Game Pass now*, *Mentioned in Game Pass news* and *Not on Game Pass*, with Steam prices.
- **Email** (Resend): sent only when something changes, e.g. a wishlisted game is announced for Game Pass or is leaving.
- **Cost:** $0. GitHub Actions and Pages are free for public repos; Resend's free tier allows 100 emails/day.

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
4. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
5. In **Settings → Secrets and variables → Actions**:
   - New secret `RESEND_API_KEY` = your Resend key
   - New secret `STEAM_PROFILE` = your Steam profile URL
   - New secret `EMAIL_TO` = the address you signed up to Resend with

   Use **Secrets**, not Variables: Actions logs on a public repo are visible to anyone, and only secrets are masked there.
6. Open **Actions → Game Pass check → Run workflow** to run it now. After that it runs daily at 14:00 UTC.

The dashboard will be at `https://<your-github-username>.github.io/gamepass-wishlist/`.

If a run fails (for example, a Microsoft feed changes or the wishlist goes private), GitHub emails you the failure, so a broken feed never looks like "nothing new".

## Running locally

Requires Node 20+. There are no dependencies to install.

```bash
STEAM_PROFILE=https://steamcommunity.com/id/yourname/ node src/main.js
```

This prints the results and writes `site/index.html` and `site/data.json`. Set `TEST_APPIDS=1030300,2807960` to test with specific Steam app IDs instead of the wishlist.

## Caveats

- Microsoft's catalog feeds are public but undocumented, so they could change without notice.
- The "Coming to Game Pass" feed only covers the next few weeks. Earlier announcements are caught by the Xbox Wire scan, which is a strong hint rather than a guarantee, so check the linked post.
- Ultimate covers everything in the PC and console catalogs, so both count as "On Game Pass". Console-only titles get a *Console / cloud* tag.
