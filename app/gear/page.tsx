'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { GearItem, GearVariant, GearReservation, Trip, GEAR_CATEGORIES } from '@/lib/types'
import { tripDateRange, tripsOverlap } from '@/lib/gear'
import { Plus, X, Backpack, Package, AlertTriangle, Pencil, Trash2, Check, ChevronRight, Boxes } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'

const TODAY = new Date().toISOString().slice(0, 10)

export default function GearPage() {
  const [items, setItems] = useState<GearItem[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [reservations, setReservations] = useState<GearReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'gear' | 'supply'>('gear')
  const [catFilter, setCatFilter] = useState<string>('All')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    const [itemsRes, tripsRes, resvRes] = await Promise.all([
      supabase.from('gear_items').select('*, gear_variants(*)').order('sort_order'),
      supabase.from('trips').select('id,name,start_date,end_date,num_days,num_people,num_shopping_trips,created_at'),
      supabase.from('gear_reservations').select('*'),
    ])
    const its = (itemsRes.data ?? []).map(it => ({
      ...it,
      gear_variants: (it.gear_variants ?? []).sort((a: GearVariant, b: GearVariant) => a.sort_order - b.sort_order),
    }))
    setItems(its as GearItem[])
    setTrips((tripsRes.data ?? []) as Trip[])
    setReservations((resvRes.data ?? []) as GearReservation[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // out-now = units reserved by trips whose date range includes today
  const outNowByVariant = useMemo(() => {
    const activeTripIds = new Set(
      trips.filter(t => {
        const r = tripDateRange(t)
        return r && r.start <= TODAY && TODAY <= r.end
      }).map(t => t.id)
    )
    const map: Record<string, number> = {}
    for (const r of reservations) {
      if (activeTripIds.has(r.trip_id)) map[r.variant_id] = (map[r.variant_id] ?? 0) + r.quantity
    }
    return map
  }, [trips, reservations])

  // conflicts: any variant where overlapping trips together reserve more than owned
  const conflictCount = useMemo(() => {
    const ownedByVariant: Record<string, number> = {}
    for (const it of items) for (const v of it.gear_variants ?? []) ownedByVariant[v.id] = v.quantity
    const byVariant: Record<string, GearReservation[]> = {}
    for (const r of reservations) (byVariant[r.variant_id] ??= []).push(r)
    const tripsById = new Map(trips.map(t => [t.id, t]))
    let count = 0
    for (const [variantId, resvs] of Object.entries(byVariant)) {
      const owned = ownedByVariant[variantId] ?? 0
      // check each pair-cluster: for each reservation, sum overlapping reservations
      for (const r of resvs) {
        const self = tripsById.get(r.trip_id)
        if (!self) continue
        let sum = r.quantity
        for (const o of resvs) {
          if (o === r) continue
          const other = tripsById.get(o.trip_id)
          if (other && tripsOverlap(self, other)) sum += o.quantity
        }
        if (sum > owned) { count++; break }
      }
    }
    return count
  }, [items, reservations, trips])

  async function addItem(form: NewItem) {
    const { data: item } = await supabase.from('gear_items').insert({
      name: form.name.trim(),
      category: form.category,
      item_type: form.item_type,
      unit: form.unit.trim(),
      always_pack: form.always_pack,
      low_stock_threshold: form.low_stock_threshold || 0,
      sort_order: items.length,
    }).select().single()
    if (item) {
      await supabase.from('gear_variants').insert({ item_id: item.id, label: 'Standard', quantity: form.quantity || 0, sort_order: 0 })
      setShowAdd(false)
      load()
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item and all its reservations?')) return
    await supabase.from('gear_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <AuthGuard><div className="text-center py-16 text-stone-400">Loading inventory...</div></AuthGuard>

  const filtered = items.filter(i => i.item_type === typeFilter && (catFilter === 'All' || i.category === catFilter))
  const cats = ['All', ...GEAR_CATEGORIES.filter(c => items.some(i => i.item_type === typeFilter && i.category === c))]
  const byCat = cats.filter(c => c !== 'All').map(c => ({ cat: c, items: filtered.filter(i => i.category === c) })).filter(g => g.items.length)

  return (
    <AuthGuard>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
              <Backpack className="w-6 h-6 text-forest-700" /> Gear Inventory
            </h1>
            <p className="text-sm text-stone-500 mt-1">{items.filter(i => i.item_type === 'gear').length} gear items · {items.filter(i => i.item_type === 'supply').length} supplies</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        {/* Conflicts banner */}
        {conflictCount > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1 text-sm text-red-800">
              <span className="font-semibold">{conflictCount} gear conflict{conflictCount > 1 ? 's' : ''}</span> — overlapping trips are reserving more than you own. Open the trips to resolve.
            </div>
            <Link href="/trips" className="text-sm font-medium text-red-700 hover:underline flex items-center gap-0.5">Trips <ChevronRight className="w-4 h-4" /></Link>
          </div>
        )}

        {/* Type toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => { setTypeFilter('gear'); setCatFilter('All') }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${typeFilter === 'gear' ? 'bg-forest-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
            <Boxes className="w-4 h-4" /> Gear
          </button>
          <button onClick={() => { setTypeFilter('supply'); setCatFilter('All') }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${typeFilter === 'supply' ? 'bg-forest-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
            <Package className="w-4 h-4" /> Supplies
          </button>
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1.5 mb-6 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${catFilter === c ? 'bg-forest-100 text-forest-800 border border-forest-300' : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-300'}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Items grouped by category */}
        <div className="space-y-8">
          {byCat.map(({ cat, items: catItems }) => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-semibold text-stone-800">{cat}</h2>
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs text-stone-400">{catItems.length}</span>
              </div>
              <div className="space-y-2">
                {catItems.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    outNow={outNowByVariant}
                    editing={editingItem === item.id}
                    onEdit={() => setEditingItem(item.id)}
                    onClose={() => setEditingItem(null)}
                    onDelete={() => deleteItem(item.id)}
                    onChanged={load}
                  />
                ))}
              </div>
            </div>
          ))}
          {byCat.length === 0 && (
            <div className="text-center py-16 text-stone-400">No {typeFilter === 'gear' ? 'gear' : 'supplies'} here yet.</div>
          )}
        </div>
      </div>

      {showAdd && <AddItemModal defaultType={typeFilter} onClose={() => setShowAdd(false)} onSave={addItem} />}
    </AuthGuard>
  )
}

/* ---------------- Item card ---------------- */
function ItemCard({ item, outNow, editing, onEdit, onClose, onDelete, onChanged }: {
  item: GearItem
  outNow: Record<string, number>
  editing: boolean
  onEdit: () => void
  onClose: () => void
  onDelete: () => void
  onChanged: () => void
}) {
  const variants = item.gear_variants ?? []
  const isSupply = item.item_type === 'supply'
  const totalOwned = variants.reduce((s, v) => s + v.quantity, 0)
  const lowStock = isSupply && totalOwned <= item.low_stock_threshold

  async function updateQty(v: GearVariant, qty: number) {
    await supabase.from('gear_variants').update({ quantity: qty }).eq('id', v.id)
    onChanged()
  }
  async function addVariant() {
    const label = prompt('Size / variant label (e.g. Large):')
    if (!label) return
    await supabase.from('gear_variants').insert({ item_id: item.id, label, quantity: 0, sort_order: variants.length })
    onChanged()
  }
  async function removeVariant(v: GearVariant) {
    if (variants.length === 1) { alert('An item needs at least one variant.'); return }
    await supabase.from('gear_variants').delete().eq('id', v.id)
    onChanged()
  }
  async function saveMeta(patch: Partial<GearItem>) {
    await supabase.from('gear_items').update(patch).eq('id', item.id)
    onChanged()
  }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-stone-900">{item.name}</h3>
            {item.always_pack && <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-semibold">Always pack</span>}
            {lowStock && <span className="text-[10px] uppercase tracking-wide bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Low</span>}
          </div>

          {/* Variant rows */}
          <div className="mt-2 space-y-1">
            {variants.map(v => {
              const out = outNow[v.id] ?? 0
              const avail = v.quantity - out
              return (
                <div key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-stone-500 w-24 sm:w-28 flex-shrink-0 truncate">{v.label === 'Standard' ? (item.unit || 'Qty') : v.label}</span>
                  {editing ? (
                    <>
                      <input type="number" min={0} step="any" defaultValue={v.quantity}
                        onBlur={e => updateQty(v, Number(e.target.value))}
                        className="input !py-1 !px-2 w-24 text-sm" />
                      {variants.length > 1 && (
                        <button onClick={() => removeVariant(v)} className="text-stone-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-forest-700 w-12 text-right">{v.quantity}</span>
                      <span className="text-stone-400 text-xs">{item.unit || 'owned'}</span>
                      {!isSupply && (
                        <span className={`text-xs ml-auto ${avail < 0 ? 'text-red-600 font-semibold' : out > 0 ? 'text-amber-600' : 'text-stone-300'}`}>
                          {out > 0 ? `${out} out · ${avail} available` : 'all in'}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {editing && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
              <button onClick={addVariant} className="text-xs text-forest-600 hover:text-forest-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add size/variant</button>
              <label className="text-xs text-stone-500 flex items-center gap-1.5">
                <input type="checkbox" defaultChecked={item.always_pack} onChange={e => saveMeta({ always_pack: e.target.checked })} /> Always pack
              </label>
              <label className="text-xs text-stone-500 flex items-center gap-1.5">
                Unit
                <input defaultValue={item.unit} onBlur={e => saveMeta({ unit: e.target.value })} className="input !py-0.5 !px-1.5 w-20 text-xs" placeholder="each" />
              </label>
              {isSupply && (
                <label className="text-xs text-stone-500 flex items-center gap-1.5">
                  Low at
                  <input type="number" min={0} defaultValue={item.low_stock_threshold} onBlur={e => saveMeta({ low_stock_threshold: Number(e.target.value) })} className="input !py-0.5 !px-1.5 w-16 text-xs" />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {editing ? (
            <button onClick={onClose} className="text-forest-600 hover:text-forest-800 p-1" title="Done"><Check className="w-4 h-4" /></button>
          ) : (
            <button onClick={onEdit} className="text-stone-300 hover:text-forest-600 p-1" title="Edit"><Pencil className="w-4 h-4" /></button>
          )}
          <button onClick={onDelete} className="text-stone-300 hover:text-red-500 p-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Add item modal ---------------- */
interface NewItem { name: string; category: string; item_type: 'gear' | 'supply'; unit: string; always_pack: boolean; low_stock_threshold: number; quantity: number }

function AddItemModal({ defaultType, onClose, onSave }: { defaultType: 'gear' | 'supply'; onClose: () => void; onSave: (f: NewItem) => void }) {
  const [f, setF] = useState<NewItem>({ name: '', category: 'Gear', item_type: defaultType, unit: '', always_pack: defaultType === 'supply', low_stock_threshold: 0, quantity: 0 })
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="font-bold text-stone-900">Add Item</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">Name</label>
            <input autoFocus className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Dry bags" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={f.item_type} onChange={e => setF({ ...f, item_type: e.target.value as 'gear' | 'supply' })}>
                <option value="gear">Gear (reservable)</option>
                <option value="supply">Supply (consumable)</option>
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
                {GEAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity owned</label>
              <input type="number" min={0} step="any" className="input" value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Unit (optional)</label>
              <input className="input" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} placeholder="each, rolls, oz" />
            </div>
          </div>
          {f.item_type === 'supply' && (
            <div className="flex items-center gap-4">
              <label className="label !mb-0">Low-stock at</label>
              <input type="number" min={0} className="input !w-24" value={f.low_stock_threshold} onChange={e => setF({ ...f, low_stock_threshold: Number(e.target.value) })} />
            </div>
          )}
          <label className="text-sm text-stone-600 flex items-center gap-2">
            <input type="checkbox" checked={f.always_pack} onChange={e => setF({ ...f, always_pack: e.target.checked })} /> Always packed on trips
          </label>
          <p className="text-xs text-stone-400">Sizes/variants (S/M/L, cam-strap lengths) can be added after creating the item.</p>
        </div>
        <div className="flex gap-3 p-5 border-t border-stone-100">
          <button onClick={() => f.name.trim() && onSave(f)} disabled={!f.name.trim()} className="btn-primary flex-1">Add Item</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
