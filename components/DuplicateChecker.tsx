'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { X, GitMerge, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'

export interface IngRow {
  ids: string[]
  name: string
  vendor: string
  recipes: string[]
}

interface DupGroup {
  key: string
  rows: IngRow[]
}

// Strip common modifiers, punctuation, normalize whitespace
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\-]/g, ' ')
    .replace(/\b(to taste|for serving|optional|as needed|divided|plus more|or more|if needed|finely|coarsely|freshly|ground|chopped|sliced|diced|minced)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = []
  for (let i = 0; i <= m; i++) {
    dp[i] = []
    for (let j = 0; j <= n; j++) {
      if (i === 0) dp[i][j] = j
      else if (j === 0) dp[i][j] = i
      else if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b)
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(na, nb) / maxLen
}

interface Props {
  rows: IngRow[]
  onMerge: () => void
  onClose: () => void
}

export default function DuplicateChecker({ rows, onMerge, onClose }: Props) {
  const [activeMerge, setActiveMerge] = useState<string | null>(null)
  const [keepName, setKeepName] = useState('')
  const [saving, setSaving] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [merged, setMerged] = useState<Set<string>>(new Set())

  const groups: DupGroup[] = useMemo(() => {
    const THRESHOLD = 0.72
    const parent = new Map<string, string>()

    function find(x: string): string {
      if (!parent.has(x)) parent.set(x, x)
      if (parent.get(x) === x) return x
      const root = find(parent.get(x)!)
      parent.set(x, root)
      return root
    }
    function union(a: string, b: string) {
      parent.set(find(a), find(b))
    }

    const names = rows.map(r => r.name)
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (similarity(names[i], names[j]) >= THRESHOLD) union(names[i], names[j])
      }
    }

    const groupMap = new Map<string, IngRow[]>()
    for (const row of rows) {
      const root = find(row.name)
      if (!groupMap.has(root)) groupMap.set(root, [])
      groupMap.get(root)!.push(row)
    }

    return Array.from(groupMap.entries())
      .filter(([, g]) => g.length >= 2)
      .map(([, g]) => ({ key: g.map(r => r.name).sort().join('||'), rows: g }))
  }, [rows])

  const visible = groups.filter(g => !dismissed.has(g.key) && !merged.has(g.key))

  async function handleMerge(group: DupGroup) {
    if (!keepName) return
    setSaving(true)
    const toReplace = group.rows.filter(r => r.name !== keepName)
    const ids = toReplace.flatMap(r => r.ids)
    await supabase.from('recipe_ingredients').update({ name: keepName }).in('id', ids)
    setSaving(false)
    setMerged(prev => new Set([...prev, group.key]))
    setActiveMerge(null)
    setKeepName('')
    onMerge()
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[22rem] bg-white shadow-2xl border-l border-stone-200 flex flex-col z-50">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
        <div>
          <h2 className="font-semibold text-stone-900">Duplicate Check</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {visible.length} potential group{visible.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-14">
            <CheckCircle2 className="w-9 h-9 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-stone-700">No duplicates found</p>
            <p className="text-xs text-stone-400 mt-1">All ingredient names look unique.</p>
          </div>
        ) : (
          visible.map(group => {
            const isMerging = activeMerge === group.key
            return (
              <div key={group.key} className="border border-stone-200 rounded-xl overflow-hidden text-sm">
                <div className="bg-amber-50 px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-amber-700">Possible duplicates</span>
                </div>

                <div className="px-3 py-2.5 space-y-2.5">
                  {group.rows.map(r => (
                    <label key={r.name} className={`flex items-start gap-2.5 cursor-pointer ${isMerging ? '' : 'cursor-default'}`}>
                      {isMerging && (
                        <input
                          type="radio"
                          name={group.key}
                          value={r.name}
                          checked={keepName === r.name}
                          onChange={() => setKeepName(r.name)}
                          className="mt-0.5 accent-forest-700 flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 leading-snug">{r.name}</p>
                        {r.recipes.length > 0 && (
                          <p className="text-xs text-stone-400 truncate">{r.recipes.join(', ')}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {isMerging && keepName && (
                  <p className="px-3 pb-1 text-xs text-stone-500">
                    Keep <strong>"{keepName}"</strong> — rename all others to match.
                  </p>
                )}

                <div className="px-3 pb-3 flex gap-2">
                  {isMerging ? (
                    <>
                      <button
                        onClick={() => handleMerge(group)}
                        disabled={!keepName || saving}
                        className="flex-1 bg-forest-700 text-white text-xs py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5 transition-opacity"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                        Confirm Merge
                      </button>
                      <button
                        onClick={() => { setActiveMerge(null); setKeepName('') }}
                        className="px-3 bg-stone-100 text-stone-600 text-xs py-2 rounded-lg font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setActiveMerge(group.key); setKeepName(group.rows[0].name) }}
                        className="flex-1 bg-forest-700 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1.5"
                      >
                        <GitMerge className="w-3 h-3" /> Merge
                      </button>
                      <button
                        onClick={() => setDismissed(prev => new Set([...prev, group.key]))}
                        className="flex-1 bg-stone-100 text-stone-600 text-xs py-2 rounded-lg font-medium"
                      >
                        Keep Separate
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
