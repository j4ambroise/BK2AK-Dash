/**
 * BK2AK Photo Scoring Algorithm
 *
 * Learns from every vote the team casts. The more the team swipes,
 * the smarter the queue sorting becomes.
 *
 * Score components (0–100):
 *   - Team vote ratio          (0–40 pts)  strongest signal
 *   - Uploader approval rate   (0–20 pts)  learned: whose eye the team trusts
 *   - Caption quality          (0–15 pts)  photos with strong captions rank higher
 *   - Source preference        (0–10 pts)  learned: does team prefer Google Photos vs uploads?
 *   - Research alignment       (0–15 pts)  does this photo match what's trending on top accounts?
 */

export function scorePhoto(photo, votes, captions, uploaderStats, researchInsights) {
  let score = 0;

  // ── 1. Vote ratio (0–40) ──────────────────────────────────────────────────
  const photoVotes = votes[photo.id] || {};
  const yes   = Object.values(photoVotes).filter(v => v === 'yes').length;
  const no    = Object.values(photoVotes).filter(v => v === 'no').length;
  const maybe = Object.values(photoVotes).filter(v => v === 'maybe').length;
  const totalVotes = yes + no + maybe;

  if (totalVotes > 0) {
    const approvalRate = (yes + maybe * 0.4) / totalVotes;
    score += approvalRate * 40;
    // Bonus for photos with many votes (more confidence)
    score += Math.min(totalVotes, 5) * 0.5;
  }

  // ── 2. Uploader approval rate (0–20) ─────────────────────────────────────
  const uploader = photo.uploaded_by;
  if (uploader && uploaderStats[uploader]) {
    const { approvalRate: uRate, sampleSize } = uploaderStats[uploader];
    // Only apply weight if we have enough data (5+ photos from this person)
    if (sampleSize >= 5) {
      score += uRate * 20;
    } else {
      score += 10; // neutral until we have data
    }
  } else {
    score += 10; // neutral for unknown uploaders
  }

  // ── 3. Caption quality (0–15) ─────────────────────────────────────────────
  const photoCaptions = captions[photo.id] || [];
  if (photoCaptions.length > 0) {
    const topCaptionVotes = Math.max(...photoCaptions.map(c => c.votes || 0));
    // Has captions = good (+5), top caption has votes = better (+10)
    score += 5;
    score += Math.min(topCaptionVotes / 3, 1) * 10;
  }

  // ── 4. Source preference (0–10) ───────────────────────────────────────────
  // Neutral by default. Will be calibrated once we have vote data per source.
  const sourceWeights = { google: 5, upload: 5, demo: 0 };
  score += sourceWeights[photo.source] || 5;

  // ── 5. Research alignment (0–15) ──────────────────────────────────────────
  // Compare photo metadata/tags against trending themes from competitor accounts
  if (researchInsights && researchInsights.trendingThemes) {
    const photoText = `${photo.meta || ''} ${photo.album || ''} ${photo.filename || ''}`.toLowerCase();
    const matchScore = researchInsights.trendingThemes.reduce((sum, theme) => {
      return sum + (photoText.includes(theme.keyword.toLowerCase()) ? theme.weight : 0);
    }, 0);
    score += Math.min(matchScore, 15);
  }

  return Math.round(Math.min(score, 100));
}

/**
 * Build uploader stats from all votes across all photos.
 * Returns: { [uploaderName]: { approvalRate, sampleSize } }
 */
export function buildUploaderStats(photos, votes) {
  const stats = {};

  for (const photo of photos) {
    const uploader = photo.uploaded_by;
    if (!uploader) continue;
    if (!stats[uploader]) stats[uploader] = { yes: 0, total: 0 };

    const photoVotes = votes[photo.id] || {};
    const yes   = Object.values(photoVotes).filter(v => v === 'yes').length;
    const total = Object.keys(photoVotes).length;
    stats[uploader].yes   += yes;
    stats[uploader].total += total;
  }

  const result = {};
  for (const [name, s] of Object.entries(stats)) {
    result[name] = {
      approvalRate: s.total > 0 ? s.yes / s.total : 0.5,
      sampleSize: s.total,
    };
  }
  return result;
}

/**
 * Derive content patterns from team votes.
 * Returns a summary of what the team approves most.
 */
export function deriveContentPatterns(photos, votes, captions) {
  const approved = photos.filter(p => {
    const pv = votes[p.id] || {};
    return Object.values(pv).filter(v => v === 'yes').length >= 2;
  });

  // Source breakdown
  const sourceCount = {};
  approved.forEach(p => { sourceCount[p.source] = (sourceCount[p.source] || 0) + 1; });

  // Uploader breakdown
  const uploaderCount = {};
  approved.forEach(p => { uploaderCount[p.uploaded_by] = (uploaderCount[p.uploaded_by] || 0) + 1; });

  // Caption style: average length of top-voted captions
  const captionLengths = [];
  for (const [photoId, caps] of Object.entries(captions)) {
    const topCap = caps.sort((a, b) => (b.votes || 0) - (a.votes || 0))[0];
    if (topCap) captionLengths.push(topCap.text.length);
  }
  const avgCaptionLength = captionLengths.length > 0
    ? Math.round(captionLengths.reduce((a, b) => a + b, 0) / captionLengths.length)
    : 0;

  // Audience type preference
  const audienceVotes = {};
  Object.values(captions).flat().forEach(c => {
    if (!audienceVotes[c.audience]) audienceVotes[c.audience] = 0;
    audienceVotes[c.audience] += (c.votes || 0);
  });

  return {
    totalApproved: approved.length,
    sourceBreakdown: sourceCount,
    uploaderBreakdown: uploaderCount,
    avgApprovedCaptionLength: avgCaptionLength,
    captionAudiencePreference: audienceVotes,
    approvalRate: photos.length > 0 ? (approved.length / photos.length * 100).toFixed(1) : 0,
  };
}
