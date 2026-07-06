'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Trip, Recipe, MenuItem, MealType, MEAL_TYPES, MEAL_LABELS } from '@/lib/types'
import { ArrowLeft, ShoppingCart, Plus, X, Search, ClipboardList, ChevronDown, ChevronUp, Download } from 'lucide-react'

export default function MenuPage() {
  const { id } = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showSummary, setShowSummary] = useState(false)

  // Picker state
  const [pickerCell, setPickerCell] = useState<{ day: number; meal: MealType } | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  // Notes state: itemId → note text
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => {
    const [tripRes, menuRes, recipesRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('menu_items').select('*, recipe:recipes(*)').eq('trip_id', id),
      supabase.from('recipes').select('*').order('meal_type').order('name'),
    ])
    setTrip(tripRes.data)
    const items: MenuItem[] = menuRes.data ?? []
    setMenuItems(items)
    // Seed notes state from DB
    const n: Record<string, string> = {}
    for (const item of items) n[item.id] = item.notes ?? ''
    setNotes(n)
    setRecipes(recipesRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

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
    if (data) {
      setMenuItems(prev => [...prev, data])
      setNotes(prev => ({ ...prev, [data.id]: '' }))
    }
    setPickerCell(null)
    setPickerSearch('')
  }

  async function removeItem(itemId: string) {
    await supabase.from('menu_items').delete().eq('id', itemId)
    setMenuItems(prev => prev.filter(m => m.id !== itemId))
    setNotes(prev => { const n = { ...prev }; delete n[itemId]; return n })
  }

  function updateNote(itemId: string, value: string) {
    setNotes(prev => ({ ...prev, [itemId]: value }))
    // Debounce save
    clearTimeout(noteTimers.current[itemId])
    noteTimers.current[itemId] = setTimeout(async () => {
      await supabase.from('menu_items').update({ notes: value || null }).eq('id', itemId)
    }, 600)
  }

  function toggleNote(itemId: string) {
    setExpandedNotes(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  const pickerRecipes = recipes.filter(r =>
    !pickerSearch || r.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )
  const relevantFirst = pickerCell
    ? [...pickerRecipes.filter(r => r.meal_type === pickerCell.meal), ...pickerRecipes.filter(r => r.meal_type !== pickerCell.meal)]
    : pickerRecipes

  async function downloadTripRecipes() {
    const recipeIds = [...new Set(menuItems.map(m => m.recipe_id))]
    const { data } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .in('id', recipeIds)
      .order('meal_type').order('name')
    const blob = new Blob([JSON.stringify({ trip: trip?.name, recipes: data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip?.name ?? 'trip'}-recipes.json`.replace(/\s+/g, '-').toLowerCase()
    a.click()
    URL.revokeObjectURL(url)
  }

  // Build summary: all items with notes, grouped by day
  const itemsWithNotes = menuItems.filter(m => notes[m.id]?.trim())
  const summaryByDay = Array.from(
    itemsWithNotes.reduce((map, item) => {
      const day = item.day_number
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(item)
      return map
    }, new Map<number, MenuItem[]>())
  ).sort(([a], [b]) => a - b)

  if (loading) return <div className="text-center py-16 text-stone-400">Loading menu...</div>
  if (!trip) return <div className="text-center py-16 text-stone-400">Trip not found.</div>

  const days = Array.from({ length: trip.num_days }, (_, i) => i + 1)
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
        <div className="flex gap-2">
          <button onClick={downloadTripRecipes} className="btn-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Download
          </button>
          <button
            onClick={() => setShowSummary(true)}
            className="btn-secondary flex items-center gap-1.5"
          >
            <ClipboardList className="w-4 h-4" /> Trip Summary
          </button>
          <Link href={`/trips/${id}/shopping`} className="btn-primary flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Shopping List
          </Link>
        </div>
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
                            <div key={item.id} className="bg-forest-50 border border-forest-200 rounded-lg overflow-hidden group">
                              <div className="flex items-start gap-1 px-2 py-1.5">
                                <span className="text-sm text-forest-800 leading-snug flex-1">{item.recipe?.name}</span>
                                <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => toggleNote(item.id)}
                                    className="text-forest-400 hover:text-forest-700 p-0.5"
                                    title="Add note"
                                  >
                                    {expandedNotes[item.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-forest-400 hover:text-red-500 p-0.5"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {/* Show note indicator even when not hovered */}
                                {notes[item.id]?.trim() && !expandedNotes[item.id] && (
                                  <button
                                    onClick={() => toggleNote(item.id)}
                                    className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400"
                                    title="Has note"
                                  />
                                )}
                              </div>
                              {/* Note area */}
                              {expandedNotes[item.id] && (
                                <div className="px-2 pb-1.5">
                                  <textarea
                                    className="w-full text-xs bg-white border border-forest-200 rounded px-1.5 py-1 text-stone-700 placeholder-stone-300 resize-none focus:outline-none focus:border-amber-400"
                                    rows={2}
                                    placeholder="Trip notes, portion feedback…"
                                    value={notes[item.id] ?? ''}
                                    onChange={e => updateNote(item.id, e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Add button */}
                          <div className="relative">
                            <button
                              onClick={() => { setPickerCell({ day, meal }); setPickerSearch('') }}
                              className="flex items-center gap-1 text-xs text-stone-400 hover:text-forest-600 hover:bg-forest-50 rounded px-1.5 py-1 transition-colors w-full"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {cellItems.length === 0 ? 'Add' : 'Add more'}
                            </button>

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

      {/* Trip Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSummary(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Trip Summary — {trip.name}</h2>
                <p className="text-sm text-stone-500 mt-0.5">{trip.num_people} people · {trip.num_days} days</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="btn-secondary text-xs px-3 py-1.5">Print</button>
                <button onClick={() => setShowSummary(false)} className="text-stone-400 hover:text-stone-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {summaryByDay.length === 0 ? (
                <div className="text-center py-8 text-stone-400">
                  <p>No notes yet.</p>
                  <p className="text-sm mt-1">Add notes to meals by hovering over them and clicking the arrow.</p>
                </div>
              ) : (
                summaryByDay.map(([day, items]) => (
                  <div key={day}>
                    <h3 className="font-semibold text-stone-700 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-forest-100 text-forest-700 rounded-full text-sm font-bold">{day}</span>
                      Day {day}
                    </h3>
                    <div className="space-y-2 pl-9">
                      {items.sort((a, b) => MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type)).map(item => (
                        <div key={item.id} className="bg-stone-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">{MEAL_LABELS[item.meal_type]}</span>
                            <span className="text-sm font-semibold text-stone-800">{item.recipe?.name}</span>
                          </div>
                          <p className="text-sm text-stone-600 whitespace-pre-wrap">{notes[item.id]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {/* Full menu recap */}
              <div className="border-t border-stone-100 pt-6">
                <h3 className="font-semibold text-stone-700 mb-3">Full Menu</h3>
                <div className="space-y-1">
                  {days.map(day => {
                    const dayItems = menuItems.filter(m => m.day_number === day)
                    if (!dayItems.length) return null
                    return (
                      <div key={day} className="flex gap-3 text-sm py-1 border-b border-stone-50">
                        <span className="font-medium text-stone-500 w-12 flex-shrink-0">Day {day}</span>
                        <span className="text-stone-700">
                          {dayItems
                            .sort((a, b) => MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type))
                            .map(m => `${MEAL_LABELS[m.meal_type]}: ${m.recipe?.name}`)
                            .join(' · ')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
