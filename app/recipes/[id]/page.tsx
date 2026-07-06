'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Recipe, MEAL_LABELS } from '@/lib/types'
import RecipeForm from '@/components/RecipeForm'
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react'

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('id', id)
      .single()
    if (data) {
      data.recipe_ingredients = data.recipe_ingredients?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      setRecipe(data)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleDelete() {
    if (!confirm(`Delete "${recipe?.name}"? This will also remove it from any menus.`)) return
    await supabase.from('recipes').delete().eq('id', id)
    router.push('/recipes')
  }

  if (loading) return <div className="text-center py-16 text-stone-400">Loading...</div>
  if (!recipe) return <div className="text-center py-16 text-stone-400">Recipe not found.</div>

  if (editing) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(false)} className="btn-ghost flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-stone-900">Edit Recipe</h1>
        </div>
        <RecipeForm recipe={recipe} onSave={() => { setEditing(false); load() }} onCancel={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recipes" className="btn-ghost flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Recipes
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{recipe.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm font-medium text-forest-700 bg-forest-50 px-2 py-0.5 rounded-full">
                {MEAL_LABELS[recipe.meal_type]}
              </span>
              <span className="text-sm text-stone-500">Serves {recipe.default_servings}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={handleDelete} className="btn-danger flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {recipe.description && (
          <p className="text-stone-600 mb-4">{recipe.description}</p>
        )}

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-forest-600 hover:text-forest-800 mb-4">
            <ExternalLink className="w-4 h-4" /> View Source Recipe
          </a>
        )}

        {/* Ingredients */}
        {recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0 && (
          <div className="mt-4">
            <h2 className="font-semibold text-stone-900 mb-3">Ingredients</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left py-2 pr-4 font-medium text-stone-500">Item</th>
                    <th className="text-right py-2 pr-4 font-medium text-stone-500">Qty</th>
                    <th className="text-left py-2 pr-4 font-medium text-stone-500">Unit</th>
                    <th className="text-left py-2 pr-4 font-medium text-stone-500">Vendor</th>
                    <th className="text-left py-2 font-medium text-stone-500">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.recipe_ingredients.map(ing => (
                    <tr key={ing.id} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="py-2 pr-4 font-medium text-stone-800">{ing.name}</td>
                      <td className="py-2 pr-4 text-right text-stone-600">{ing.quantity}</td>
                      <td className="py-2 pr-4 text-stone-500">{ing.unit}</td>
                      <td className="py-2 pr-4">
                        {ing.vendor && (
                          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{ing.vendor}</span>
                        )}
                      </td>
                      <td className="py-2 text-stone-500 italic text-xs">{ing.shopping_note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        {recipe.notes && (
          <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="text-sm font-semibold text-amber-800 mb-1">Notes</h3>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{recipe.notes}</p>
          </div>
        )}

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-4">
            {recipe.tags.map(tag => (
              <span key={tag} className="text-xs bg-stone-100 text-stone-500 px-2 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
