# BK2AK Dashboard — Setup Guide

## Project Structure

```
bk2ak-dashboard/
  public/
    index.html          ← the dashboard (served at /)
  api/
    google-albums.js    ← proxies Google Photos album list (fixes CORS)
    google-photos.js    ← proxies Google Photos photo fetch (fixes CORS)
    research-sync.js    ← scrapes peer accounts, computes trending themes
    insights.js         ← returns algorithm scores + research data
  lib/
    supabase.js         ← server-side Supabase client
    algorithm.js        ← scoring + pattern learning logic
  vercel.json           ← routes + daily cron (9am)
  package.json
  supabase-schema.sql   ← run this once in Supabase SQL editor
  .env.example          ← copy to .env.local
```

---

## Step 1 — Supabase (database + file storage)

1. Go to [supabase.com](https://supabase.com), create a free project named `bk2ak-dashboard`
2. Go to **SQL Editor → New Query**, paste `supabase-schema.sql`, click **Run**
3. Go to **Storage → New bucket**, name it `bk2ak-photos`, set it to **Public**
4. Note your **Project URL** and **anon key** (Settings → API)
5. Also note your **service_role key** (Settings → API → service_role — keep this secret)

---

## Step 2 — Apify (Instagram research scraper)

The research engine scrapes @blackfolkscamp, @diversifyoutdoors, @outdoorafro, @rei, @nps_wrst, and 6 other peer/brand accounts daily to surface trending themes.

1. Create a free account at [apify.com](https://apify.com)
2. Go to **Settings → Integrations → API tokens**
3. Create a new token and copy it
4. The free tier gives ~1000 results/month — more than enough for daily syncs of 10 accounts × 12 posts

If you skip this step, the research sync will fall back to Instagram's public API (less reliable but free).

---

## Step 3 — Deploy to Vercel

### Option A: Via GitHub (recommended — enables auto-deploys)

1. Put the `bk2ak-dashboard` folder in a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import the repo
3. Add environment variables (Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
   | `APIFY_TOKEN` | Your Apify API token (optional) |

4. Click **Deploy** — you'll get a URL like `bk2ak-dashboard.vercel.app`

### Option B: Vercel CLI

```bash
npm i -g vercel
cd bk2ak-dashboard
vercel
# Follow prompts, then:
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add APIFY_TOKEN
vercel --prod
```

---

## Step 4 — Share With the Team

Share the Vercel URL + these two values (from Supabase → Settings → API):
- **Supabase URL**
- **Supabase anon key** (safe to share — it's public-facing)

Each team member opens the URL, enters their name + the shared credentials on first load. Their name is used to attribute votes — they each get their own vote per photo.

---

## Step 5 — Connect Google Photos

### Get an access token (2 minutes, lasts ~1 hour)

1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground/)
2. In the scope list, find **Photos Library API v1** → check `https://www.googleapis.com/auth/photoslibrary.readonly`
3. Click **Authorize APIs** → sign in with your Google account
4. Click **Exchange authorization code for tokens**
5. Copy the **Access token** (starts with `ya29...`)
6. In the dashboard, go to **Upload tab → Connect Google Photos**, paste the token, click Connect
7. Your albums appear — click **Import** on each one

### Why tokens expire

Google access tokens expire after ~1 hour. For a permanent connection, you'd set up a proper OAuth flow with refresh tokens — that's a future upgrade. For now, re-pasting from OAuth Playground takes 30 seconds.

---

## Step 6 — Run the First Research Sync

1. Open the dashboard → **Insights tab**
2. Click **Sync Now**
3. The server will scrape all 10 peer accounts, compute trending themes, and populate the Insights tab
4. After that, the Vercel cron job runs automatically every day at 9am

---

## How the Algorithm Works

Every vote your team casts feeds a scoring model (0–100) that ranks photos in the swipe queue and gallery.

**Score components:**
- **Team vote ratio (40 pts)** — the strongest signal. More yes votes = higher score.
- **Uploader approval rate (20 pts)** — learned over time. If one person's uploads consistently get approved, their new photos rank higher.
- **Caption quality (15 pts)** — photos with well-voted captions score higher.
- **Research alignment (15 pts)** — does this photo match themes trending on peer accounts right now?
- **Source preference (10 pts)** — calibrated as the team votes (do Google Photos or uploads get approved more?).

The algorithm gets smarter with every swipe. In the first week it's noisy; after 50+ votes per person it becomes a reliable predictor.

---

## Team Workflow

1. **Upload** — any team member uploads photos or syncs Google Photos
2. **Swipe** — everyone votes yes/no/maybe on their own device
3. **Queue** — photos with 2+ yes votes appear in the Queue tab, sorted by algorithm score
4. **Caption** — write or vote up captions for queued photos
5. **Copy & Post** — copy the top caption, download the photo, post to Instagram
6. **Insights** — check the Insights tab weekly to see what's trending on peer accounts and what the algorithm recommends next

---

## FAQ

**Do team members need Supabase accounts?**
No. Share the URL, Supabase URL, and anon key. Everyone enters their own name.

**Can I use this on mobile?**
Yes — fully responsive. Open the Vercel URL on your phone.

**The research sync isn't populating competitor posts — why?**
Two likely causes: (1) Apify token not set — add it in Vercel env vars, or (2) Instagram's public API rate-limited the fallback. Try again in an hour, or add the Apify token.

**How do I add more accounts to watch?**
Edit `api/research-sync.js` → `RESEARCH_ACCOUNTS` array at the top. Add any public Instagram username.

**How do I change the approval threshold (currently 2 votes)?**
Search for `>= 2` in `public/index.html` and change both occurrences to your preferred number.
