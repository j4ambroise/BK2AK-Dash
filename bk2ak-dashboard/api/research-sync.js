/**
 * GET /api/research-sync
 * Runs daily via Vercel cron (9am). Can also be triggered manually from the dashboard.
 *
 * What it does:
 *  1. Scrapes recent posts from BK2AK's peer/inspiration accounts using Apify
 *  2. Calculates engagement rates to surface what's resonating
 *  3. Extracts trending themes/keywords from top-performing posts
 *  4. Stores everything in Supabase for the dashboard's Insights tab
 *  5. Falls back to Instagram's public API if Apify token is not set
 */

import { getSupabase } from '../lib/supabase.js';

// Accounts to watch — ordered by relevance to BK2AK
const RESEARCH_ACCOUNTS = [
  // Direct peers / aligned mission
  { username: 'blackfolkscamp',    category: 'peer',       weight: 1.0 },
  { username: 'diversifyoutdoors', category: 'peer',       weight: 1.0 },
  { username: 'outdoorafro',       category: 'peer',       weight: 0.9 },
  { username: 'latinxhikers',      category: 'peer',       weight: 0.8 },
  { username: 'melanin_base_camp', category: 'peer',       weight: 0.8 },
  // Outdoor brands (larger accounts — see what content styles work at scale)
  { username: 'rei',               category: 'brand',      weight: 0.6 },
  { username: 'patagonia',         category: 'brand',      weight: 0.6 },
  { username: 'thenorthface',      category: 'brand',      weight: 0.5 },
  // Youth / nonprofit storytelling accounts (content style inspiration)
  { username: 'outwardbound',      category: 'nonprofit',  weight: 0.7 },
  { username: 'nps_wrst',          category: 'partner',    weight: 0.9 },
];

export default async function handler(req, res) {
  // Allow manual triggers from the dashboard (POST) and cron (GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const results = [];

  for (const account of RESEARCH_ACCOUNTS) {
    try {
      const posts = await fetchAccountPosts(account.username);
      if (!posts || posts.length === 0) continue;

      // Calculate engagement rate for each post
      const analyzed = posts.map(post => analyzePost(post, account));

      // Upsert into competitor_posts table
      for (const post of analyzed) {
        await supabase.from('competitor_posts').upsert(post, { onConflict: 'instagram_id' });
      }

      results.push({ account: account.username, fetched: analyzed.length });
    } catch (err) {
      results.push({ account: account.username, error: err.message });
    }
  }

  // After fetching, compute and store trending themes
  await computeTrendingThemes(supabase);

  return res.status(200).json({ success: true, synced: results, timestamp: new Date().toISOString() });
}

// ── Fetch posts ──────────────────────────────────────────────────────────────

async function fetchAccountPosts(username) {
  const apifyToken = process.env.APIFY_TOKEN;

  if (apifyToken) {
    return fetchViaApify(username, apifyToken);
  } else {
    return fetchViaPublicAPI(username);
  }
}

async function fetchViaApify(username, token) {
  // Apify Instagram Profile Scraper — free tier: 1000 results/month
  // https://apify.com/apify/instagram-profile-scraper
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}&maxItems=12`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [username],
        resultsLimit: 12,
      }),
    }
  );
  if (!runRes.ok) throw new Error(`Apify error: ${runRes.status}`);
  const data = await runRes.json();

  // Flatten: Apify returns profile objects with latestPosts array
  const posts = [];
  for (const profile of data) {
    for (const post of (profile.latestPosts || [])) {
      posts.push({ ...post, _username: username });
    }
  }
  return posts;
}

async function fetchViaPublicAPI(username) {
  // Instagram public profile API (no auth, may be rate-limited)
  const res = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'X-IG-App-ID': '936619743392459',
        'Accept': 'application/json',
      },
    }
  );
  if (!res.ok) throw new Error(`Instagram public API error: ${res.status}`);
  const data = await res.json();

  const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
  return edges.map(e => ({ ...e.node, _username: username }));
}

// ── Analyze a post ───────────────────────────────────────────────────────────

function analyzePost(post, account) {
  // Normalize fields across Apify and public API formats
  const id         = post.id || post.shortCode || `${account.username}_${Date.now()}`;
  const caption    = post.caption || post.edge_media_to_caption?.edges?.[0]?.node?.text || '';
  const likes      = post.likesCount ?? post.edge_liked_by?.count ?? post.edge_media_preview_like?.count ?? 0;
  const comments   = post.commentsCount ?? post.edge_media_to_comment?.count ?? 0;
  const timestamp  = post.timestamp || post.taken_at_timestamp
    ? new Date((post.taken_at_timestamp || 0) * 1000).toISOString()
    : new Date().toISOString();
  const imageUrl   = post.displayUrl || post.thumbnail_src || post.display_url || '';
  const postUrl    = post.url || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : '');

  // Engagement rate proxy (likes + comments * 2 is a common formula)
  const engagementScore = likes + comments * 2;

  // Extract keywords from caption
  const keywords = extractKeywords(caption);

  // Detect content themes
  const themes = detectThemes(caption, imageUrl);

  return {
    instagram_id:      id,
    username:          account.username,
    category:          account.category,
    account_weight:    account.weight,
    caption:           caption.slice(0, 2000),
    likes,
    comments,
    engagement_score:  engagementScore,
    image_url:         imageUrl,
    post_url:          postUrl,
    keywords:          keywords,
    themes:            themes,
    posted_at:         timestamp,
    fetched_at:        new Date().toISOString(),
  };
}

function extractKeywords(caption) {
  if (!caption) return [];
  // Extract hashtags
  const hashtags = (caption.match(/#\w+/g) || []).map(h => h.toLowerCase().slice(1));
  // Extract meaningful words (4+ chars, not common stopwords)
  const stopwords = new Set(['that', 'this', 'with', 'from', 'have', 'will', 'been', 'they', 'were', 'just', 'into', 'your', 'more', 'what', 'when', 'only', 'some', 'like', 'then', 'than', 'very', 'also']);
  const words = caption.toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopwords.has(w));
  return [...new Set([...hashtags, ...words])].slice(0, 20);
}

function detectThemes(caption, imageUrl) {
  const text = (caption + ' ' + imageUrl).toLowerCase();
  const themeMap = {
    wilderness:   ['wilderness', 'glacier', 'mountain', 'trail', 'backpack', 'hiking', 'camp', 'forest', 'river', 'alaska', 'national park'],
    youth:        ['youth', 'teen', 'kid', 'young', 'student', 'school', 'future', 'next generation'],
    bipoc:        ['bipoc', 'black', 'melanin', 'diverse', 'diversity', 'latinx', 'poc', 'people of color'],
    community:    ['community', 'together', 'team', 'family', 'group', 'connection', 'belong'],
    leadership:   ['leader', 'guide', 'mentor', 'coach', 'inspire', 'empower', 'certif'],
    adventure:    ['adventure', 'explore', 'discover', 'journey', 'expedition', 'challenge', 'summit'],
    storytelling: ['story', 'share', 'voice', 'perspective', 'narrative', 'real', 'authentic'],
  };
  return Object.entries(themeMap)
    .filter(([, keywords]) => keywords.some(k => text.includes(k)))
    .map(([theme]) => theme);
}

// ── Compute trending themes ──────────────────────────────────────────────────

async function computeTrendingThemes(supabase) {
  // Pull the last 30 days of competitor posts
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: posts } = await supabase
    .from('competitor_posts')
    .select('keywords, themes, engagement_score, account_weight, posted_at')
    .gte('posted_at', since);

  if (!posts || posts.length === 0) return;

  // Weight keywords by engagement_score × account_weight
  const keywordScores = {};
  for (const post of posts) {
    const weight = (post.engagement_score || 1) * (post.account_weight || 0.5);
    for (const kw of (post.keywords || [])) {
      keywordScores[kw] = (keywordScores[kw] || 0) + weight;
    }
    for (const theme of (post.themes || [])) {
      keywordScores[theme] = (keywordScores[theme] || 0) + weight * 2; // themes weighted 2×
    }
  }

  // Normalize to 0–1 and take top 20
  const maxScore = Math.max(...Object.values(keywordScores), 1);
  const trendingThemes = Object.entries(keywordScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, score]) => ({
      keyword,
      weight: parseFloat((score / maxScore).toFixed(3)),
      normalized_score: score,
    }));

  // Store in a dedicated insights row (upsert by date)
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from('research_insights').upsert(
    {
      date: today,
      trending_themes: trendingThemes,
      post_count: posts.length,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'date' }
  );
}
