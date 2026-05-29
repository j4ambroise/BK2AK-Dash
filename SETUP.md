# BK2AK Dashboard — Setup Guide

## What You're Building

A team photo voting dashboard:
- **Swipe** — yes/no on photos to approve them for posting
- **Gallery** — browse all photos, see vote status
- **Queue** — photos approved by 2+ team members, ready to post
- **Upload** — drag & drop local photos
- **Google Photos** — pull directly from your albums
- **Analytics** — what the team collectively approves

All votes, captions, and uploads are saved to Supabase so every team member sees the same data.

---

## Step 1 — Create a Supabase Project (free)

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click **New Project** — name it `bk2ak-dashboard`
3. Choose a region (US East is fine)
4. Note your **Project URL** and **anon public key** (Settings → API)

---

## Step 2 — Create the Database Tables

In your Supabase project, go to **SQL Editor** and run:

```sql
-- Photos table
create table photos (
  id text primary key,
  url text not null,
  source text default 'upload',
  meta text,
  album text,
  filename text,
  google_id text unique,
  uploaded_by text,
  created_at timestamptz default now()
);

-- Votes table
create table votes (
  id uuid primary key default gen_random_uuid(),
  photo_id text references photos(id) on delete cascade,
  user_name text not null,
  vote text not null check (vote in ('yes','no','maybe')),
  created_at timestamptz default now(),
  unique(photo_id, user_name)
);

-- Captions table
create table captions (
  id text primary key,
  photo_id text references photos(id) on delete cascade,
  text text not null,
  author text not null,
  audience text default 'general',
  votes integer default 0,
  created_at timestamptz default now()
);

-- Enable Row Level Security (open for now — add auth later if needed)
alter table photos enable row level security;
alter table votes enable row level security;
alter table captions enable row level security;

create policy "Allow all" on photos for all using (true) with check (true);
create policy "Allow all" on votes for all using (true) with check (true);
create policy "Allow all" on captions for all using (true) with check (true);
```

---

## Step 3 — Create the Storage Bucket

1. In Supabase, go to **Storage**
2. Click **New bucket** → name it `bk2ak-photos`
3. Set it to **Public**
4. Under **Policies**, add an insert policy: `true` (allow all authenticated and anon uploads for now)

---

## Step 4 — Open the Dashboard

Just open `index.html` in a browser. Enter your:
- Supabase Project URL
- Supabase anon key
- Your name (used to attribute your votes)

Your credentials are saved in your browser — you won't need to re-enter them.

---

## Step 5 — Share With the Team

**Option A (simplest): Vercel deployment**

1. Create a free account at [vercel.com](https://vercel.com)
2. Put this folder in a GitHub repo (just `index.html` + `SETUP.md`)
3. Connect Vercel to the GitHub repo
4. Deploy — you'll get a URL like `bk2ak-dashboard.vercel.app`
5. Share that URL with the team
6. Each team member enters their name + the shared Supabase credentials on first load

**Option B: Netlify drop**

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `bk2ak-dashboard` folder onto the page
3. Done — instant URL, no account needed

---

## Step 6 — Connect Google Photos

Google Photos requires OAuth. Here's the quickest path:

### Get a Google Access Token (temporary, good for ~1 hour)

1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground/)
2. In the list on the left, find **Photos Library API v1** → check `https://www.googleapis.com/auth/photoslibrary.readonly`
3. Click **Authorize APIs** → sign in with your Google account
4. Click **Exchange authorization code for tokens**
5. Copy the **Access token** (starts with `ya29...`)
6. Paste it into the dashboard (Upload tab → Connect Google Photos)

### For a permanent connection (optional — when you want it)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Photos Library API**
3. Create **OAuth 2.0 credentials** (Web application)
4. Add your Vercel URL as an authorized redirect URI
5. Use the OAuth flow to get a refresh token
6. Tokens auto-refresh (I can build this into the app if needed)

---

## Step 7 — Import James Photos (local folder)

1. Open the **Upload** tab in the dashboard
2. Click the upload zone and select all photos from the James Photos folder
3. Or drag the whole folder onto the upload zone
4. Photos are uploaded to Supabase Storage and appear in the swipe queue automatically

---

## Posting Workflow

1. Any team member uploads photos or syncs from Google Photos
2. Everyone swipes on their phone or laptop — yes/no/maybe
3. Photos with **2+ yes votes** automatically move to the **Queue** tab
4. The posting lead picks the top caption (or writes a new one), copies it, and posts to Instagram
5. After posting, log the post in the tracker to build performance data over time

---

## Team FAQ

**Do we all need Supabase accounts?**
No — just share the Supabase URL and anon key with the team. Each person enters their own name to attribute their votes.

**Is our data private?**
The anon key gives read/write access to your tables. For additional security, you can add Supabase Auth (email login) — just ask and I can add it.

**Can we use this on mobile?**
Yes — it's a responsive web app. Open the Vercel URL on your phone.

**How do we know which caption won?**
In the Queue tab, the top caption (most team 👍 votes) is shown first. Use that one or write your own.
