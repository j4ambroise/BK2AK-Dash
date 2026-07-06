'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Recipe, MealType, MEAL_TYPES, MEAL_LABELS } from '@/lib/types'
import { Plus, Search, ExternalLink, ChevronRight, Tag, Download } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: 'bg-yellow-100 text-yellow-800',
  lunch:     'bg-blue-100 text-blue-800',
  appetizer: 'bg-purple-100 text-purple-800',
  dinner:    'bg-forest-100 text-forest-800',
  dessert:   'bg-pink-100 text-pink-800',
  snack:     'bg-orange-100 text-orange-800',
  drinks:    'bg-cyan-100 text-cyan-800',
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MealType | 'all'>('all')

  useEffect(() => {
    supabase
      .from('recipes')
      .select('*')
      .order('meal_type')
      .order('name')
      .then(({ data }) => {
        setRecipes(data ?? [])
        setLoading(false)
      })
  }, [])

  async function downloadRecipes() {
    const { data } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .order('meal_type').order('name')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bk2ak-recipes-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = recipes.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || r.meal_type === filter
    return matchSearch && matchFilter
  })

  return (
    <AuthGuard>
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Recipe Library</h1>
          <p className="text-sm text-stone-500 mt-1">{recipes.length} recipes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadRecipes} className="btn-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Download
          </button>
          <Link href="/recipes/ingredients" className="btn-secondary flex items-center gap-1.5">
            <Tag className="w-4 h-4" /> Vendors
          </Link>
          <Link href="/recipes/new" className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Recipe
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            className="input pl-9"
            placeholder="Search recipes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-forest-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-forest-300'
            }`}
          >
            All
          </button>
          {MEAL_TYPES.map(mt => (
            <button
              key={mt}
              onClick={() => setFilter(mt)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === mt ? 'bg-forest-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-forest-300'
              }`}
            >
              {MEAL_LABELS[mt]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-stone-400">Loading recipes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-400 mb-4">{search || filter !== 'all' ? 'No recipes match your filter.' : 'No recipes yet.'}</p>
          {!search && filter === 'all' && (
            <Link href="/recipes/new" className="btn-primary inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add your first recipe
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(recipe => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="card p-4 hover:border-forest-300 hover:shadow-md transition-all group flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-stone-900 group-hover:text-forest-700 leading-snug">{recipe.name}</h3>
                <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-forest-500 flex-shrink-0 mt-0.5" />
              </div>

              <span className={`meal-badge self-start ${MEAL_COLORS[recipe.meal_type]}`}>
                {MEAL_LABELS[recipe.meal_type]}
              </span>

              {recipe.description && (
                <p className="text-sm text-stone-500 line-clamp-2">{recipe.description}</p>
              )}

              <div className="flex items-center justify-between mt-auto pt-1">
                <span className="text-xs text-stone-400">Serves {recipe.default_servings}</span>
                {recipe.source_url && (
                  <span className="text-xs text-forest-600 flex items-center gap-0.5">
                    <ExternalLink className="w-3 h-3" /> Source
                  </span>
                )}
              </div>

              {recipe.tags && recipe.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {recipe.tags.map(tag => (
                    <span key={tag} className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
    </AuthGuard>
  )
}
