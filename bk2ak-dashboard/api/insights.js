/**
 * GET /api/insights
 * Returns:
 *  - Latest trending themes from competitor research
 *  - Top competitor posts (by engagement) from last 30 days
 *  - Photo scores for all photos (using the learning algorithm)
 *  - Content pattern analysis from team votes
 *
 * Query params:
 *  - scores=true  → include per-photo algorithm scores (requires supabase photos+votes+captions)
 */

import { getSupabase } from '../lib/supabase.js';
import { scorePhoto, buildUploaderStats, deriveContentPatterns } from '../lib/algorithm.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  const includeScores = req.query.scores === 'true';

  try {
    // ── 1. Latest research insights ──────────────────────────────────────────
    const { data: latestInsight } = await supabase
      .from('research_insights')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // ── 2. Top competitor posts from last 30 days ─────────────────────────────
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: topPosts } = await supabase
      .from('competitor_posts')
      .select('username, caption, likes, comments, engagement_score, image_url, post_url, themes, posted_at')
      .gte('posted_at', since)
      .order('engagement_score', { ascending: false })
      .limit(20);

    // ── 3. Per-theme breakdown of top posts ───────────────────────────────────
    const themeBreakdown = {};
    for (const post of (topPosts || [])) {
      for (const theme of (post.themes || [])) {
        if (!themeBreakdown[theme]) themeBreakdown[theme] = { count: 0, totalEngagement: 0 };
        themeBreakdown[theme].count++;
        themeBreakdown[theme].totalEngagement += post.engagement_score || 0;
      }
    }

    // ── 4. Algorithm scores (optional — expensive, only when requested) ───────
    let photoScores = null;
    let contentPatterns = null;
    let uploaderStats = null;

    if (includeScores) {
      const [{ data: photos }, { data: votesRaw }, { data: captionsRaw }] = await Promise.all([
        supabase.from('photos').select('id, url, source, meta, album, filename, uploaded_by, created_at'),
        supabase.from('votes').select('photo_id, user_name, vote'),
        supabase.from('captions').select('id, photo_id, text, author, audience, votes'),
      ]);

      // Reshape into maps
      const votes = {};
      for (const v of (votesRaw || [])) {
        if (!votes[v.photo_id]) votes[v.photo_id] = {};
        votes[v.photo_id][v.user_name] = v.vote;
      }

      const captions = {};
      for (const c of (captionsRaw || [])) {
        if (!captions[c.photo_id]) captions[c.photo_id] = [];
        captions[c.photo_id].push(c);
      }

      uploaderStats = buildUploaderStats(photos || [], votes);
      const researchInsights = latestInsight
        ? { trendingThemes: latestInsight.trending_themes || [] }
        : null;

      photoScores = {};
      for (const photo of (photos || [])) {
        photoScores[photo.id] = scorePhoto(photo, votes, captions, uploaderStats, researchInsights);
      }

      contentPatterns = deriveContentPatterns(photos || [], votes, captions);
    }

    return res.status(200).json({
      trendingThemes:  latestInsight?.trending_themes || [],
      lastResearchAt:  latestInsight?.computed_at || null,
      topCompetitorPosts: topPosts || [],
      themeBreakdown,
      photoScores,
      contentPatterns,
      uploaderStats,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
