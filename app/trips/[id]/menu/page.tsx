'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Trip, Recipe, MenuItem, MealType, MEAL_TYPES, MEAL_LABELS } from '@/lib/types'
import { ArrowLeft, ShoppingCart, Plus, X, Search } from 'lucide-react'

export default function MenuPage() {
  const { id } = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  // Picker state
  const [pickerCell, setPickerCell] = useState<{ day: number; meal: MealType } | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  async function load() {
    const [tripRes, menuRes, recipesRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('menu_items').select('*, recipe:recipes(*)').eq('trip_id', id),
      supabase.from('recipes').select('*').order('meal_type').order('name'),
    ])
    setTrip(tripRes.data)
    setMenuItems(menuRes.data ?? [])
    setRecipes(recipesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerCell(null)
        setPickerSearch('')
      }
    }
    if (pickerCell) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerCell])

  function getCell(day: number, meal: MealType): MenuItem[] {
    return menuItems.filter(m => m.day_number === day && m.meal_type === meal)
  }

  async function addRecipe(day: number, meal: MealType, recipe: Recipe) {
    const { data } = await supabase.from('menu_items').insert({
      trip_id: id, recipe_id: recipe.id, day_number: day, meal_type: meal
    }).select('*, recipe:recipes(*)').single()
    if (data) setMenuItems(prev => [...prev, data])
    setPickerCell(null)
    setPickerSearch('')
  }

  async function removeItem(itemId: string) {
    await supabase.from('menu_items').delete().eq('id', itemId)
    setMenuItems(prev => prev.filter(m => m.id !== itemId))
  }

  const pickerRecipes = recipes.filter(r => {
    if (!pickerSearch) return true
    return r.name.toLowerCase().includes(pickerSearch.toLowerCase())
  })

  // Group by meal type for picker when in a specific meal slot
  const relevantFirst = pickerCell
    ? [...pickerRecipes.filter(r => r.meal_type === pickerCell.meal), ...pickerRecipes.filter(r => r.meal_type !== pickerCell.meal)]
    : pickerRecipes

  if (loading) return <div className="text-center py-16 text-stone-400">Loading menu...</div>
  if (!trip) return <div className="text-center py-16 text-stone-400">Trip not found.</div>

  const days = Array.from({ length: trip.num_days }, (_, i) => i + 1)
  // Show only meal types that are commonly used (can expand with snack/drinks as needed)
  const activeMealTypes: MealType[] = ['breakfast', 'lunch', 'appetizer', 'dinner', 'dessert']

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/trips" className="btn-ghost flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Trips
          </Link>
          <div>
            <h1 className="text-xl font-bold text-stone-900">{trip.name}</h1>
            <p className="text-sm text-stone-500">{trip.num_people} people · {trip.num_days} days</p>
          </div>
        </div>
        <Link href={`/trips/${id}/shopping`} className="btn-primary flex items-center gap-1.5">
          <ShoppingCart className="w-4 h-4" /> Shopping List
        </Link>
      </div>

      {/* Menu grid */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[700px] px-4 sm:px-0">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-16 text-left pb-3 pl-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Day</th>
                {activeMealTypes.map(mt => (
                  <th key={mt} className="pb-3 px-2 text-left text-xs font-semibold text-stone-400 uppercase tracking-wide">
                    {MEAL_LABELS[mt]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day} className="border-t border-stone-100">
                  <td className="py-2 pl-2 align-top">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-forest-100 text-forest-700 rounded-full text-sm font-bold">
                      {day}
                    </span>
                  </td>
                  {activeMealTypes.map(meal => {
                    const cellItems = getCell(day, meal)
                    return (
                      <td key={meal} className="py-2 px-2 align-top min-w-[140px]">
                        <div className="space-y-1">
                          {cellItems.map(item => (
                            <div key={item.id} className="flex items-start gap-1 bg-forest-50 border border-forest-200 rounded-lg px-2 py-1.5 group">
                              <span className="text-sm text-forest-800 leading-snug flex-1">{item.recipe?.name}</span>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-forest-400 hover:text-red-500 flex-shrink-0 mt-0.5"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          {/* Add button / Picker trigger */}
                          <div className="relative">
                            <button
                              onClick={() => {
                                setPickerCell({ day, meal })
                                setPickerSearch('')
                              }}
                              className="flex items-center gap-1 text-xs text-stone-400 hover:text-forest-600 hover:bg-forest-50 rounded px-1.5 py-1 transition-colors w-full"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {cellItems.length === 0 ? 'Add' : 'Add more'}
                            </button>

                            {/* Picker dropdown */}
                            {pickerCell?.day === day && pickerCell?.meal === meal && (
                              <div ref={pickerRef} className="absolute z-50 top-full left-0 mt-1 w-64 card shadow-xl border-forest-200">
                                <div className="p-2 border-b border-stone-100">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                                    <input
                                      autoFocus
                                      className="input !py-1 pl-7 text-sm"
                                      placeholder="Search recipes..."
                                      value={pickerSearch}
                                      onChange={e => setPickerSearch(e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="max-h-56 overflow-y-auto">
                                  {relevantFirst.length === 0 ? (
                                    <p className="text-sm text-stone-400 text-center py-4">No recipes found</p>
                                  ) : (
                                    relevantFirst.map(recipe => (
                                      <button
                                        key={recipe.id}
                                        onClick={() => addRecipe(day, meal, recipe)}
                                        className="w-full text-left px-3 py-2 hover:bg-forest-50 transition-colors flex items-center justify-between gap-2 text-sm"
                                      >
                                        <span className="text-stone-800">{recipe.name}</span>
                                        <span className="text-xs text-stone-400 flex-shrink-0">{MEAL_LABELS[recipe.meal_type]}</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {recipes.length === 0 && (
        <div className="text-center py-8 text-stone-400">
          <p className="mb-3">You need recipes before you can build a menu.</p>
          <Link href="/recipes/new" className="btn-primary inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Recipes
          </Link>
        </div>
      )}
    </div>
  )
}
