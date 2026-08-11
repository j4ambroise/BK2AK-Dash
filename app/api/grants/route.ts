import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Grants.gov Search2 — public, no auth. POST endpoint, so it must be called
// server-side (browsers/agents can't reach it directly). This route fans out a
// curated set of BK2AK-relevant queries, dedupes, scores each opportunity for
// fit with BK2AK's program (youth + outdoor access + BIPOC + workforce), drops
// obvious land/infrastructure grants a program nonprofit can't use, and returns
// a ranked shortlist. Eligibility is heuristic here — the detail page is the
// source of truth, and the weekly agent does the deeper 501(c)(3) check before
// anything lands on the Monday board.

const SEARCH2_URL = 'https://api.grants.gov/v1/api/search2'

// Curated queries tuned to BK2AK's actual program, not generic "outdoors".
const QUERIES = [
  'youth outdoor',
  'wilderness youth',
  'environmental education youth',
  'outdoor recreation access',
  'conservation corps youth',
  'workforce development youth',
  'underserved communities outdoors',
  'national parks youth',
]

interface Search2Hit {
  id: string
  number: string
  title: string
  agencyCode: string
  agencyName: string
  openDate: string
  closeDate: string
  oppStatus: string
  docType: string
  alnist?: string[]
}

interface ScoredGrant extends Search2Hit {
  fitScore: number
  fitBucket: 'High' | 'Medium' | 'Low'
  reasons: string[]
  flags: string[]
  daysToDeadline: number | null
  detailUrl: string
}

// [regex, points, human-readable reason]
const THEME_SIGNALS: [RegExp, number, string][] = [
  [/\b(youth|teen|teenager|young people|adolescent|k-12|high school)\b/i, 20, 'Youth-focused'],
  [/\b(outdoor|wilderness|backcountry|public lands|trail-based)\b/i, 15, 'Outdoor / wilderness'],
  [/\b(recreation|outdoor recreation)\b/i, 8, 'Recreation'],
  [/\b(environmental education|conservation education|place-based education|education)\b/i, 10, 'Education / env-ed'],
  [/\b(conservation|stewardship|corps)\b/i, 8, 'Conservation / corps'],
  [/\b(equity|underserved|underrepresented|diverse|diversity|inclusion|bipoc|justice40|disadvantaged communit)\b/i, 12, 'Equity / access angle'],
  [/\b(workforce|career|job training|employment|apprentice|credential)\b/i, 10, 'Workforce (Graduate-to-Guide fit)'],
  [/\b(national park|forest service|public land)\b/i, 8, 'Public-lands agency angle'],
  [/\b(mentor|leadership|youth development)\b/i, 8, 'Leadership / youth development'],
]

const AGENCY_SIGNALS: [RegExp, number, string][] = [
  [/(interior|national park|nps|fish and wildlife|land management|reclamation|\bDOI\b)/i, 12, 'Dept. of Interior / NPS'],
  [/(agriculture|forest service|\bUSDA\b)/i, 10, 'USDA / Forest Service'],
  [/(education|\bED\b)/i, 8, 'Dept. of Education'],
  [/(labor|\bDOL\b|employment and training)/i, 8, 'Dept. of Labor (workforce)'],
  [/(environmental protection|\bEPA\b)/i, 8, 'EPA (environmental ed)'],
  [/(national endowment|institute of museum|\bIMLS\b|\bNEA\b|americorps|national service|\bCNCS\b)/i, 8, 'Culture / national-service funder'],
]

// Signals that a grant funds land/facilities/construction — a program nonprofit
// like BK2AK generally can't use these (they fund states, cities, land owners).
const INFRA_SIGNALS: [RegExp, number, string][] = [
  [/\b(acquisition|acquire land|land and water conservation)\b/i, 26, 'Land acquisition'],
  [/\b(construction|constructing|build(ing)? of|infrastructure|facilit(y|ies)|renovation|rehabilitation of|development of park|capital improvement)\b/i, 22, 'Capital / construction'],
  [/\b(trail (construction|development|building)|boat ramp|campground|playground)\b/i, 20, 'Facility build-out'],
  [/\b(research|fellowship|dissertation|principal investigator|university|postdoctoral)\b/i, 12, 'Academic / research grant'],
  [/\b(state (agency|government) only|units of government only|tribal governments only)\b/i, 30, 'Government-only eligibility'],
]

function scoreHit(hit: Search2Hit): ScoredGrant {
  const title = hit.title || ''
  const agencyBlob = `${hit.agencyName || ''} ${hit.agencyCode || ''}`
  const reasons: string[] = []
  const flags: string[] = []
  let score = 0

  for (const [re, pts, label] of THEME_SIGNALS) {
    if (re.test(title)) {
      score += pts
      reasons.push(label)
    }
  }
  for (const [re, pts, label] of AGENCY_SIGNALS) {
    if (re.test(agencyBlob)) {
      score += pts
      if (!reasons.includes(label)) reasons.push(label)
    }
  }

  let infraPenalty = 0
  for (const [re, pts, label] of INFRA_SIGNALS) {
    if (re.test(title)) {
      infraPenalty += pts
      flags.push(label)
    }
  }
  score -= infraPenalty

  const clamped = Math.max(0, Math.min(100, score))

  let bucket: ScoredGrant['fitBucket']
  if (clamped >= 55) bucket = 'High'
  else if (clamped >= 32) bucket = 'Medium'
  else bucket = 'Low'

  // Strong infrastructure/government-only signal with weak program signal → force Low.
  if (infraPenalty >= 22 && clamped < 45) {
    bucket = 'Low'
    if (!flags.includes('Likely program-ineligible')) flags.push('Likely program-ineligible')
  }

  return {
    ...hit,
    fitScore: clamped,
    fitBucket: bucket,
    reasons,
    flags,
    daysToDeadline: daysUntil(hit.closeDate),
    detailUrl: `https://grants.gov/search-results-detail/${hit.id}`,
  }
}

function daysUntil(mmddyyyy: string): number | null {
  if (!mmddyyyy) return null
  const parts = mmddyyyy.split('/')
  if (parts.length !== 3) return null
  const [mm, dd, yyyy] = parts.map((p) => parseInt(p, 10))
  if (!mm || !dd || !yyyy) return null
  const close = new Date(yyyy, mm - 1, dd)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((close.getTime() - today.getTime()) / 86_400_000)
}

async function runQuery(keyword: string, oppStatuses: string): Promise<Search2Hit[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(SEARCH2_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, rows: 30, oppStatuses }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json?.data?.oppHits ?? []) as Search2Hit[]
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const oppStatuses = searchParams.get('statuses') || 'forecasted|posted'
  const minBucket = (searchParams.get('min') || 'Medium') as 'High' | 'Medium' | 'Low'
  const extra = searchParams.get('q')
  const queries = extra ? [extra, ...QUERIES] : QUERIES

  try {
    const batches = await Promise.all(queries.map((q) => runQuery(q, oppStatuses)))
    const byId = new Map<string, Search2Hit>()
    for (const batch of batches) {
      for (const hit of batch) {
        if (hit?.id && !byId.has(hit.id)) byId.set(hit.id, hit)
      }
    }

    const rankOf = { High: 3, Medium: 2, Low: 1 }
    const scored = Array.from(byId.values())
      .map(scoreHit)
      .filter((g) => rankOf[g.fitBucket] >= rankOf[minBucket])
      .sort((a, b) => {
        if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore
        // then soonest real deadline first
        const ad = a.daysToDeadline ?? 9999
        const bd = b.daysToDeadline ?? 9999
        return ad - bd
      })

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: 'grants.gov Search2',
      totalCandidates: byId.size,
      returned: scored.length,
      note: 'Fit is a heuristic from title + agency. Confirm 501(c)(3) eligibility and award size on each detail page before applying.',
      grants: scored,
    })
  } catch (err) {
    console.error('grants GET error:', err)
    return NextResponse.json({ error: 'Failed to search grants.gov' }, { status: 502 })
  }
}
