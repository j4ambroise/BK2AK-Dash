'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Trip, MenuItem, ShoppingItem, MEAL_LABELS } from '@/lib/types'
import { ArrowLeft, Printer, Users, Calendar, ShoppingCart } from 'lucide-react'

const VENDOR_ORDER = ['Costco', 'Fred Meyer', 'PoHo', 'Other', '']

type GroupMode = 'vendor' | 'shop'

function normalizeKey(name: string, unit: string) {
  return `${name.trim().toLowerCase()}__${unit.trim().toLowerCase()}`
}

function displayName(raw: string) {
  const t = raw.trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function ShoppingPage() {
  const { id } = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [assignments, setAssignments] = useState<Record<string, number>>({}) // key → shop#
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState<GroupMode>('vendor')

  const load = useCallback(async () => {
    const [tripRes, menuRes, assignRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('menu_items')
        .select('*, recipe:recipes(*, recipe_ingredients(*))')
        .eq('trip_id', id)
        .order('day_number').order('meal_type'),
      supabase.from('shopping_trip_assignments').select('ingredient_key, shop_number').eq('trip_id', id),
    ])
    setTrip(tripRes.data)
    setMenuItems(menuRes.data ?? [])
    const map: Record<string, number> = {}
    for (const a of (assignRes.data ?? [])) map[a.ingredient_key] = a.shop_number
    setAssignments(map)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function setShop(key: string, shop: number) {
    setAssignments(prev => ({ ...prev, [key]: shop }))
    await supabase.from('shopping_trip_assignments').upsert(
      { trip_id: id, ingredient_key: key, shop_number: shop },
      { onConflict: 'trip_id,ingredient_key' }
    )
  }

  function buildShoppingList(): ShoppingItem[] {
    if (!trip) return []
    const itemMap = new Map<string, ShoppingItem>()

    for (const menuItem of menuItems) {
      const recipe = menuItem.recipe as (typeof menuItem.recipe & { recipe_ingredients?: { name: string; quantity: number; unit: string; vendor?: string; shopping_note?: string }[] }) | undefined
      if (!recipe?.recipe_ingredients) continue
      const scale = trip.num_people / (recipe.default_servings || 1)

      for (const ing of recipe.recipe_ingredients) {
        const key = normalizeKey(ing.name, ing.unit)
        const existing = itemMap.get(key)
        if (existing) {
          existing.total_qty += ing.quantity * scale
          if (!existing.recipes.includes(recipe.name)) existing.recipes.push(recipe.name)
        } else {
          itemMap.set(key, {
            name: displayName(ing.name),
            total_qty: ing.quantity * scale,
            unit: ing.unit.trim(),
            vendor: ing.vendor || '',
            shopping_note: ing.shopping_note || '',
            recipes: [recipe.name],
          })
        }
      }
    }
    return Array.from(itemMap.entries()).map(([key, item]) => ({ ...item, _key: key } as ShoppingItem & { _key: string }))
  }

  function formatQty(qty: number): string {
    const rounded = Math.ceil(qty * 4) / 4
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '')
  }

  const shoppingList = buildShoppingList() as (ShoppingItem & { _key: string })[]
  const multiShop = (trip?.num_shopping_trips ?? 1) > 1
  const shopCount = trip?.num_shopping_trips ?? 1

  function groupedByVendor() {
    const groups = new Map<string, (ShoppingItem & { _key: string })[]>()
    for (const vendor of VENDOR_ORDER) {
      const items = shoppingList.filter(i => (i.vendor || '') === vendor)
      if (items.length > 0) groups.set(vendor || 'No Vendor', items.sort((a, b) => a.name.localeCompare(b.name)))
    }
    return groups
  }

  function groupedByShop() {
    const groups = new Map<string, (ShoppingItem & { _key: string })[]>()
    for (let s = 1; s <= shopCount; s++) {
      const label = `Shop Run ${s}`
      const items = shoppingList.filter(i => (assignments[i._key] ?? 1) === s)
      if (items.length > 0) groups.set(label, items.sort((a, b) => a.name.localeCompare(b.name)))
    }
    // Unassigned (shouldn't happen but just in case)
    const unassigned = shoppingList.filter(i => (assignments[i._key] ?? 1) > shopCount)
    if (unassigned.length > 0) groups.set('Unassigned', unassigned)
    return groups
  }

  const groups = groupBy === 'vendor' ? groupedByVendor() : groupedByShop()

  if (loading) return <div className="text-center py-16 text-stone-400">Loading...</div>
  if (!trip) return <div className="text-center py-16 text-stone-400">Trip not found.</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/trips/${id}/menu`} className="btn-ghost flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Menu
          </Link>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Shopping List</h1>
            <p className="text-sm text-stone-500">{trip.name}</p>
          </div>
        </div>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* Trip summary */}
      <div className="card p-4 mb-5 flex items-center gap-6 flex-wrap print:border-none print:shadow-none">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Users className="w-4 h-4 text-forest-600" />
          <span className="font-medium">{trip.num_people} people</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Calendar className="w-4 h-4 text-forest-600" />
          <span className="font-medium">{trip.num_days} days</span>
        </div>
        {multiShop && (
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <ShoppingCart className="w-4 h-4 text-forest-600" />
            <span className="font-medium">{trip.num_shopping_trips} shopping runs</span>
          </div>
        )}
        <div className="text-sm text-stone-500">
          {shoppingList.length} items · {menuItems.length} meals planned
        </div>
      </div>

      {/* Group by selector */}
      <div className="flex gap-2 mb-5 print:hidden">
        <button
          onClick={() => setGroupBy('vendor')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${groupBy === 'vendor' ? 'bg-forest-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}
        >
          By Vendor
        </button>
        {multiShop && (
          <button
            onClick={() => setGroupBy('shop')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${groupBy === 'shop' ? 'bg-forest-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}
          >
            By Shop Run
          </button>
        )}
      </div>

      {shoppingList.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <p className="mb-3">No items yet — add recipes to your menu first.</p>
          <Link href={`/trips/${id}/menu`} className="btn-primary inline-block">Go to Menu</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="font-semibold text-stone-800">{group}</h2>
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs text-stone-400">{items.length} items</span>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-stone-500">Item</th>
                      <th className="text-right px-4 py-2.5 font-medium text-stone-500 w-20">Total</th>
                      <th className="text-left px-3 py-2.5 font-medium text-stone-500 w-24">Unit</th>
                      {multiShop && <th className="text-left px-3 py-2.5 font-medium text-stone-500 w-32 print:hidden">Shop Run</th>}
                      <th className="text-left px-3 py-2.5 font-medium text-stone-500 hidden sm:table-cell">Note</th>
                      <th className="text-left px-3 py-2.5 font-medium text-stone-500 hidden md:table-cell">For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-stone-50 last:border-0 hover:bg-stone-50 print:hover:bg-transparent">
                        <td className="px-4 py-2.5 font-medium text-stone-800">{item.name}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-forest-700">{formatQty(item.total_qty)}</td>
                        <td className="px-3 py-2.5 text-stone-500">{item.unit}</td>
                        {multiShop && (
                          <td className="px-3 py-2.5 print:hidden">
                            <select
                              className="input !py-0.5 text-xs w-full"
                              value={assignments[item._key] ?? 1}
                              onChange={e => setShop(item._key, Number(e.target.value))}
                            >
                              {Array.from({ length: shopCount }, (_, i) => (
                                <option key={i + 1} value={i + 1}>Run {i + 1}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-stone-400 italic text-xs hidden sm:table-cell">{item.shopping_note}</td>
                        <td className="px-3 py-2.5 text-stone-400 text-xs hidden md:table-cell">{item.recipes.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
