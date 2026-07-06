'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { VENDORS } from '@/lib/types'
import AuthGuard from '@/components/AuthGuard'
import DuplicateChecker, { IngRow } from '@/components/DuplicateChecker'
import { Search, Check, Loader2, GitMerge } from 'lucide-react'

function normalizeName(n: string) {
  return n.trim().toLowerCase()
}

export default function IngredientsPage() {
  const [rows, setRows] = useState<IngRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState<string>('all')
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({})
  const [showDuplicates, setShowDuplicates] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('recipe_ingredients')
      .select('id, name, vendor, recipe:recipes(name)')
      .order('name')

    if (!data) { setLoading(false); return }

    const map = new Map<string, IngRow>()
    for (const ing of data) {
      const key = normalizeName(ing.name)
      const recipeName = (ing.recipe as { name?: string })?.name ?? ''
      const existing = map.get(key)
      if (existing) {
        existing.ids.push(ing.id)
        if (!existing.recipes.includes(recipeName) && recipeName) existing.recipes.push(recipeName)
      } else {
        map.set(key, {
          ids: [ing.id],
          name: ing.name,
          vendor: ing.vendor ?? '',
          recipes: recipeName ? [recipeName] : [],
        })
      }
    }

    setRows(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateVendor(key: string, vendor: string) {
    const row = rows.find(r => normalizeName(r.name) === key)
    if (!row) return
    setRows(prev => prev.map(r => normalizeName(r.name) === key ? { ...r, vendor } : r))
    setSavingMap(m => ({ ...m, [key]: true }))
    await supabase.from('recipe_ingredients').update({ vendor: vendor || null }).in('id', row.ids)
    setSavingMap(m => ({ ...m, [key]: false }))
    setSavedMap(m => ({ ...m, [key]: true }))
    setTimeout(() => setSavedMap(m => ({ ...m, [key]: false })), 1500)
  }

  const filtered = rows.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchVendor = vendorFilter === 'all' || r.vendor === vendorFilter || (vendorFilter === '' && !r.vendor)
    return matchSearch && matchVendor
  })

  return (
    <AuthGuard>
      <div className={`max-w-3xl mx-auto transition-all ${showDuplicates ? 'pr-[23rem]' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Ingredient Vendors</h1>
            <p className="text-sm text-stone-500 mt-1">Set the preferred store for each ingredient across all recipes.</p>
          </div>
          <button
            onClick={() => setShowDuplicates(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showDuplicates
                ? 'bg-forest-700 text-white border-forest-700'
                : 'bg-white text-stone-600 border-stone-200 hover:border-forest-300'
            }`}
          >
            <GitMerge className="w-4 h-4" />
            Check Duplicates
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              className="input pl-9"
              placeholder="Search ingredients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', ...VENDORS, ''] as string[]).map(v => (
              <button
                key={v === '' ? 'unset' : v}
                onClick={() => setVendorFilter(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  vendorFilter === v ? 'bg-forest-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-forest-300'
                }`}
              >
                {v === 'all' ? 'All' : v === '' ? 'Unset' : v}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-stone-400">Loading ingredients...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-stone-400">No ingredients found.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-stone-500">Ingredient</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 hidden sm:table-cell">Used in</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 w-40">Vendor</th>
                  <th className="w-8 px-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const key = normalizeName(row.name)
                  return (
                    <tr key={key} className="border-b border-stone-50 last:border-0 hover:bg-stone-50">
                      <td className="px-4 py-2.5 font-medium text-stone-800">{row.name}</td>
                      <td className="px-4 py-2.5 text-stone-400 text-xs hidden sm:table-cell">{row.recipes.join(', ')}</td>
                      <td className="px-4 py-2.5">
                        <select
                          className="input !py-1 text-sm"
                          value={row.vendor}
                          onChange={e => updateVendor(key, e.target.value)}
                          disabled={savingMap[key]}
                        >
                          <option value="">—</option>
                          {VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2.5 w-8">
                        {savingMap[key] && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
                        {savedMap[key] && <Check className="w-3.5 h-3.5 text-green-500" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 text-xs text-stone-400">
              {filtered.length} ingredients · changes save instantly
            </div>
          </div>
        )}
      </div>

      {showDuplicates && (
        <DuplicateChecker
          rows={rows}
          onMerge={load}
          onClose={() => setShowDuplicates(false)}
        />
      )}
    </AuthGuard>
  )
}
