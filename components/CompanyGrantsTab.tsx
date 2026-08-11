'use client'

import { useState, useEffect, useCallback } from 'react'

interface Grant {
  id: string
  title: string
  agency: string
  closeDate: string
  oppStatus: string
  aln?: string[]
  fitScore: number
  fitBucket: 'High' | 'Medium' | 'Low'
  reasons: string[]
  flags: string[]
  daysToDeadline: number | null
  detailUrl: string
}

interface GrantsResponse {
  generatedAt: string
  totalCandidates: number
  returned: number
  note: string
  grants: Grant[]
}

const BUCKET_BADGE: Record<Grant['fitBucket'], string> = {
  High: 'bg-forest-700 text-white',
  Medium: 'bg-amber-500 text-white',
  Low: 'bg-stone-300 text-stone-700',
}

function deadlineLabel(g: Grant): { text: string; className: string } {
  if (g.oppStatus === 'forecasted') return { text: 'Forecasted', className: 'text-stone-500' }
  if (g.daysToDeadline === null) return { text: 'No close date', className: 'text-stone-500' }
  if (g.daysToDeadline < 0) return { text: 'Closed', className: 'text-stone-400' }
  if (g.daysToDeadline <= 21)
    return { text: `Closes in ${g.daysToDeadline}d`, className: 'text-red-600 font-medium' }
  if (g.daysToDeadline <= 45)
    return { text: `Closes in ${g.daysToDeadline}d`, className: 'text-amber-600' }
  return { text: `Closes in ${g.daysToDeadline}d`, className: 'text-stone-500' }
}

export default function CompanyGrantsTab() {
  const [data, setData] = useState<GrantsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minBucket, setMinBucket] = useState<'High' | 'Medium'>('Medium')
  const [includeForecasted, setIncludeForecasted] = useState(false)

  const fetchGrants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const statuses = includeForecasted ? 'forecasted|posted' : 'posted'
      const res = await fetch(`/api/grants?min=${minBucket}&statuses=${encodeURIComponent(statuses)}`)
      if (!res.ok) throw new Error('search failed')
      setData(await res.json())
    } catch {
      setError('Could not reach grants.gov. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [minBucket, includeForecasted])

  useEffect(() => {
    fetchGrants()
  }, [fetchGrants])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Grant Finder</h2>
          <p className="text-xs text-stone-500">
            Live from grants.gov, scored for BK2AK fit. Confirm eligibility on each detail page before applying.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={minBucket}
            onChange={(e) => setMinBucket(e.target.value as 'High' | 'Medium')}
            className="input w-auto py-1.5 text-sm"
          >
            <option value="Medium">Medium+ fit</option>
            <option value="High">High fit only</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={includeForecasted}
              onChange={(e) => setIncludeForecasted(e.target.checked)}
              className="accent-forest-700"
            />
            Include forecasted
          </label>
          <button onClick={fetchGrants} className="btn-secondary py-1.5">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && <div className="text-sm text-stone-500">Searching grants.gov…</div>}

      {!loading && data && (
        <p className="text-xs text-stone-500">
          {data.returned} of {data.totalCandidates} candidates shown · updated{' '}
          {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}

      {!loading && data && data.grants.length === 0 && (
        <div className="text-sm text-stone-500">
          No matches at this filter. Try “Medium+ fit” or include forecasted opportunities.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {data?.grants.map((g) => {
          const dl = deadlineLabel(g)
          return (
            <div key={g.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={g.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-forest-700 hover:underline"
                  >
                    {g.title}
                  </a>
                  <div className="mt-0.5 text-xs text-stone-500">
                    {g.agency}
                    {g.aln?.length ? ` · ALN ${g.aln.join(', ')}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`meal-badge ${BUCKET_BADGE[g.fitBucket]}`}>
                    {g.fitBucket} · {g.fitScore}
                  </span>
                  <span className={`text-xs ${dl.className}`}>{dl.text}</span>
                </div>
              </div>

              {(g.reasons.length > 0 || g.flags.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.reasons.map((r) => (
                    <span key={r} className="rounded-full bg-forest-50 px-2 py-0.5 text-xs text-forest-700">
                      {r}
                    </span>
                  ))}
                  {g.flags.map((f) => (
                    <span key={f} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
                      ⚠ {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!loading && data && (
        <p className="text-xs text-stone-400">{data.note}</p>
      )}
    </div>
  )
}
