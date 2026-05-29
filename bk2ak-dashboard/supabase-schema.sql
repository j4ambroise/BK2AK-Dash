-- ============================================================
-- BK2AK Dashboard — Full Supabase Schema
-- Run this in: Supabase → SQL Editor → New Query
-- ============================================================

-- Photos table
create table if not exists photos (
  id            text primary key,
  url           text not null,
  source        text default 'upload',
  meta          text,
  album         text,
  filename      text,
  google_id     text unique,
  uploaded_by   text,
  created_at    timestamptz default now()
);

-- Votes table
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  photo_id    text references photos(id) on delete cascade,
  user_name   text not null,
  vote        text not null check (vote in ('yes','no','maybe')),
  created_at  timestamptz default now(),
  unique(photo_id, user_name)
);

-- Captions table
create table if not exists captions (
  id          text primary key,
  photo_id    text references photos(id) on delete cascade,
  text        text not null,
  author      text not null,
  audience    text default 'general',
  votes       integer default 0,
  created_at  timestamptz default now()
);

-- Competitor posts (scraped by research-sync)
create table if not exists competitor_posts (
  id                 uuid primary key default gen_random_uuid(),
  instagram_id       text unique,
  username           text not null,
  category           text,
  account_weight     float default 0.5,
  caption            text,
  likes              integer default 0,
  comments           integer default 0,
  engagement_score   float default 0,
  image_url          text,
  post_url           text,
  keywords           text[],
  themes             text[],
  posted_at          timestamptz,
  fetched_at         timestamptz default now()
);

-- Research insights (one row per day, updated by research-sync)
create table if not exists research_insights (
  id               uuid primary key default gen_random_uuid(),
  date             date unique not null,
  trending_themes  jsonb,
  post_count       integer default 0,
  computed_at      timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_votes_photo_id     on votes(photo_id);
create index if not exists idx_captions_photo_id  on captions(photo_id);
create index if not exists idx_competitor_username on competitor_posts(username);
create index if not exists idx_competitor_engagement on competitor_posts(engagement_score desc);
create index if not exists idx_insights_date       on research_insights(date desc);

-- Row Level Security (open policies — add auth later if needed)
alter table photos             enable row level security;
alter table votes              enable row level security;
alter table captions           enable row level security;
alter table competitor_posts   enable row level security;
alter table research_insights  enable row level security;

create policy "Allow all" on photos             for all using (true) with check (true);
create policy "Allow all" on votes              for all using (true) with check (true);
create policy "Allow all" on captions           for all using (true) with check (true);
create policy "Allow all" on competitor_posts   for all using (true) with check (true);
create policy "Allow all" on research_insights  for all using (true) with check (true);

-- Storage bucket (run manually in Supabase Storage UI, or via SQL below)
-- insert into storage.buckets (id, name, public) values ('bk2ak-photos', 'bk2ak-photos', true)
-- on conflict (id) do nothing;
