'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RecipeForm, { RecipePrefill } from '@/components/RecipeForm'
import { Link2, Loader2, X } from 'lucide-react'

export default function NewRecipePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [prefill, setPrefill] = useState<RecipePrefill | null>(null)
  const [formKey, setFormKey] = useState(0)

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setScraping(true)
    setScrapeError('')
    try {
      const res = await fetch('/api/scrape-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setScrapeError(data.error ?? 'Failed to scrape recipe')
      } else {
        setPrefill(data)
        setFormKey(k => k + 1) // force form to re-mount with new prefill
      }
    } catch {
      setScrapeError('Network error — check your connection')
    } finally {
      setScraping(false)
    }
  }

  function clearPrefill() {
    setPrefill(null)
    setUrl('')
    setFormKey(k => k + 1)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-6">Add Recipe</h1>

      {/* Scraper */}
      <div className="card p-5 mb-6">
        <p className="text-sm font-medium text-stone-700 mb-3">Import from URL</p>
        <form onSubmit={handleScrape} className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              className="input pl-9"
              type="url"
              placeholder="https://www.allrecipes.com/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={scraping}
            />
          </div>
          <button
            type="submit"
            disabled={scraping || !url.trim()}
            className="btn-primary flex items-center gap-2 flex-shrink-0"
          >
            {scraping && <Loader2 className="w-4 h-4 animate-spin" />}
            {scraping ? 'Importing...' : 'Import'}
          </button>
        </form>
        {scrapeError && (
          <p className="text-sm text-red-600 mt-2">{scrapeError}</p>
        )}
        {prefill && !scrapeError && (
          <div className="flex items-center justify-between mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <p className="text-sm text-green-700">
              ✓ Imported <strong>{prefill.name}</strong> — review and save below
            </p>
            <button onClick={clearPrefill} className="text-green-500 hover:text-green-700 ml-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <p className="text-xs text-stone-400 mt-2">Works with AllRecipes, Food Network, NYT Cooking, and most major recipe sites.</p>
      </div>

      <RecipeForm
        key={formKey}
        prefill={prefill ?? undefined}
        onSave={id => router.push(`/recipes/${id}`)}
        onCancel={() => router.push('/recipes')}
      />
    </div>
  )
}
