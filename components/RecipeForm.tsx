'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Recipe, Ingredient, MealType, MEAL_TYPES, MEAL_LABELS, VENDORS } from '@/lib/types'
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'

type IngredientDraft = Omit<Ingredient, 'id' | 'recipe_id'>

export interface RecipePrefill {
  name?: string
  description?: string
  servings?: number
  source_url?: string
  notes?: string
  ingredients?: IngredientDraft[]
}

interface Props {
  recipe?: Recipe
  prefill?: RecipePrefill
  onSave: (id: string) => void
  onCancel: () => void
}

const emptyIngredient = (): IngredientDraft => ({
  name: '', quantity: 0, unit: '', vendor: '', shopping_note: '', sort_order: 0
})

export default function RecipeForm({ recipe, prefill, onSave, onCancel }: Props) {
  const [name, setName] = useState(prefill?.name ?? recipe?.name ?? '')
  const [description, setDescription] = useState(prefill?.description ?? recipe?.description ?? '')
  const [defaultServings, setDefaultServings] = useState(prefill?.servings ?? recipe?.default_servings ?? 12)
  const [mealType, setMealType] = useState<MealType>(recipe?.meal_type ?? 'dinner')
  const [sourceUrl, setSourceUrl] = useState(prefill?.source_url ?? recipe?.source_url ?? '')
  const [notes, setNotes] = useState(prefill?.notes ?? recipe?.notes ?? '')
  const [tags, setTags] = useState((recipe?.tags ?? []).join(', '))
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    prefill?.ingredients ?? recipe?.recipe_ingredients?.map(i => ({
      name: i.name, quantity: i.quantity, unit: i.unit,
      vendor: i.vendor ?? '', shopping_note: i.shopping_note ?? '', sort_order: i.sort_order
    })) ?? [emptyIngredient()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateIngredient(idx: number, field: keyof IngredientDraft, value: string | number) {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing))
  }

  function addIngredient() {
    setIngredients(prev => [...prev, { ...emptyIngredient(), sort_order: prev.length }])
  }

  function removeIngredient(idx: number) {
    setIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Recipe name is required.'); return }
    setSaving(true)
    setError('')

    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)

    try {
      let recipeId = recipe?.id

      if (recipe) {
        // Update
        await supabase.from('recipes').update({
          name, description, default_servings: defaultServings,
          meal_type: mealType, source_url: sourceUrl, notes, tags: tagArray
        }).eq('id', recipe.id)
        // Delete old ingredients and re-insert
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipe.id)
      } else {
        // Insert
        const { data, error: err } = await supabase.from('recipes').insert({
          name, description, default_servings: defaultServings,
          meal_type: mealType, source_url: sourceUrl, notes, tags: tagArray
        }).select('id').single()
        if (err) throw err
        recipeId = data.id
      }

      // Insert ingredients
      const validIngredients = ingredients.filter(i => i.name.trim())
      if (validIngredients.length > 0) {
        await supabase.from('recipe_ingredients').insert(
          validIngredients.map((ing, idx) => ({
            recipe_id: recipeId,
            name: ing.name.trim(),
            quantity: Number(ing.quantity),
            unit: ing.unit.trim(),
            vendor: ing.vendor || null,
            shopping_note: ing.shopping_note || null,
            sort_order: idx,
          }))
        )
      }

      onSave(recipeId!)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save recipe')
      setSaving(false)
    }
  }

  return (
    <div className="card p-6 space-y-6">
      {/* Basic info */}
      <div className="space-y-4">
        <div>
          <label className="label">Recipe Name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grill Night" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Meal Type</label>
            <select className="input" value={mealType} onChange={e => setMealType(e.target.value as MealType)}>
              {MEAL_TYPES.map(mt => (
                <option key={mt} value={mt}>{MEAL_LABELS[mt]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Default Servings</label>
            <input className="input" type="number" min={1} value={defaultServings}
              onChange={e => setDefaultServings(Number(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2} value={description}
            onChange={e => setDescription(e.target.value)} placeholder="Short description..." />
        </div>

        <div>
          <label className="label">Source URL</label>
          <input className="input" type="url" value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={3} value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Prep tips, dietary notes, wilderness adaptations..." />
        </div>

        <div>
          <label className="label">Tags (comma-separated)</label>
          <input className="input" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="vegan, gluten-free, quick, crowd-pleaser" />
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-stone-900">Ingredients</h2>
          <button onClick={addIngredient} className="btn-ghost flex items-center gap-1 text-forest-600">
            <Plus className="w-4 h-4" /> Add row
          </button>
        </div>

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[24px_1fr_80px_100px_110px_1fr_32px] gap-2 px-2">
            {['', 'Ingredient', 'Qty', 'Unit', 'Vendor', 'Shopping Note', ''].map((h, i) => (
              <span key={i} className="text-xs font-medium text-stone-400 uppercase tracking-wide">{h}</span>
            ))}
          </div>

          {ingredients.map((ing, idx) => (
            <div key={idx} className="grid grid-cols-[24px_1fr_80px_100px_110px_1fr_32px] gap-2 items-center bg-stone-50 rounded-lg px-2 py-1.5">
              <GripVertical className="w-4 h-4 text-stone-300" />
              <input className="input !py-1" value={ing.name} onChange={e => updateIngredient(idx, 'name', e.target.value)} placeholder="Bell pepper" />
              <input className="input !py-1" type="number" step="0.25" min="0" value={ing.quantity || ''}
                onChange={e => updateIngredient(idx, 'quantity', e.target.value)} placeholder="3" />
              <input className="input !py-1" value={ing.unit} onChange={e => updateIngredient(idx, 'unit', e.target.value)} placeholder="pepper" />
              <select className="input !py-1" value={ing.vendor} onChange={e => updateIngredient(idx, 'vendor', e.target.value)}>
                <option value="">—</option>
                {VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input className="input !py-1" value={ing.shopping_note} onChange={e => updateIngredient(idx, 'shopping_note', e.target.value)} placeholder="Must be organic" />
              <button onClick={() => removeIngredient(idx)} className="p-1 text-stone-300 hover:text-red-500 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {ingredients.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-4">No ingredients yet.</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : (recipe ? 'Save Changes' : 'Add Recipe')}
        </button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}
