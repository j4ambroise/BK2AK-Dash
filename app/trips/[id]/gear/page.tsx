'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Trip, GearItem, GearVariant, GearReservation, GEAR_CATEGORIES } from '@/lib/types'
import { tripDateRange, tripsOverlap, reservedElsewhere } from '@/lib/gear'
import { ArrowLeft, Backpack, AlertTriangle, Minus, Plus, Calendar, Printer, Package } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'

export default function TripGearPage() {
  const { id } = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [items, setItems] = useState<GearItem[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [reservations, setReservations] = useState<GearReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [reservedBy, setReservedBy] = useState('')
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => {
    const [tripRes, itemsRes, tripsRes, resvRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('gear_items').select('*, gear_variants(*)').eq('item_type', 'gear').order('sort_order'),
      supabase.from('trips').select('id,name,start_date,end_date,num_days,num_people,num_shopping_trips,created_at'),
      supabase.from('gear_reservations').select('*'),
    ])
    setTrip(tripRes.data)
    const its = (itemsRes.data ?? []).map(it => ({
      ...it,
      gear_variants: (it.gear_variants ?? []).sort((a: GearVariant, b: GearVariant) => a.sort_order - b.sort_order),
    }))
    setItems(its as GearItem[])
    setTrips((tripsRes.data ?? []) as Trip[])
    setReservations((resvRes.data ?? []) as GearReservation[])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const myResByVariant = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of reservations) if (r.trip_id === id) m[r.variant_id] = r.quantity
    return m
  }, [reservations, id])

  const tripsById = useMemo(() => new Map(trips.map(t => [t.id, t])), [trips])

  function setReservation(variantId: string, qty: number) {
    // optimistic update
    setReservations(prev => {
      const others = prev.filter(r => !(r.trip_id === id && r.variant_id === variantId))
      return qty > 0 ? [...others, { id: `tmp-${variantId}`, trip_id: id, variant_id: variantId, quantity: qty }] : others
    })
    clearTimeout(saveTimers.current[variantId])
    saveTimers.current[variantId] = setTimeout(async () => {
      if (qty > 0) {
        await supabase.from('gear_reservations').upsert(
          { trip_id: id, variant_id: variantId, quantity: qty, reserved_by: reservedBy || null },
          { onConflict: 'trip_id,variant_id' }
        )
      } else {
        await supabase.from('gear_reservations').delete().eq('trip_id', id).eq('variant_id', variantId)
      }
    }, 400)
  }

  async function saveTripDates(start: string, end: string) {
    setTrip(t => t ? { ...t, start_date: start || undefined, end_date: end || undefined } : t)
    setTrips(prev => prev.map(t => t.id === id ? { ...t, start_date: start || undefined, end_date: end || undefined } : t))
    await supabase.from('trips').update({ start_date: start || null, end_date: end || null }).eq('id', id)
  }

  if (loading) return <AuthGuard><div className="text-center py-16 text-stone-400">Loading gear...</div></AuthGuard>
  if (!trip) return <AuthGuard><div className="text-center py-16 text-stone-400">Trip not found.</div></AuthGuard>

  const range = tripDateRange(trip)
  const cats = GEAR_CATEGORIES.filter(c => items.some(i => i.category === c))
  const totalReserved = Object.values(myResByVariant).reduce((s, q) => s + q, 0)

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/trips" className="btn-ghost flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Trips</Link>
            <div>
              <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2"><Backpack className="w-5 h-5 text-forest-700" /> Trip Gear</h1>
              <p className="text-sm text-stone-500">{trip.name} · {totalReserved} items reserved</p>
            </div>
          </div>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5"><Printer className="w-4 h-4" /> Pack List</button>
        </div>

        {/* Dates — required for conflict detection */}
        <DateBar trip={trip} range={range} onSave={saveTripDates} />

        {/* Optional reserver name */}
        <div className="mb-5 print:hidden">
          <input value={reservedBy} onChange={e => setReservedBy(e.target.value)} placeholder="Your name (optional — shown on conflicts)"
            className="input max-w-xs text-sm" />
        </div>

        {!range && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
            Set a start &amp; end date above so the system can flag conflicts with overlapping trips.
          </div>
        )}

        {/* Gear by category */}
        <div className="space-y-8">
          {cats.map(cat => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-semibold text-stone-800">{cat}</h2>
                <div className="flex-1 h-px bg-stone-200" />
              </div>
              <div className="space-y-2">
                {items.filter(i => i.category === cat).map(item => (
                  <div key={item.id} className="card p-4">
                    <h3 className="font-semibold text-stone-900 mb-2">{item.name}</h3>
                    <div className="space-y-2">
                      {(item.gear_variants ?? []).map(v => {
                        const owned = v.quantity
                        const mine = myResByVariant[v.id] ?? 0
                        const elsewhere = reservedElsewhere(v.id, trip, trips, reservations)
                        const available = owned - elsewhere
                        const conflict = mine > available
                        // find overlapping trips holding this variant
                        const clashTrips = conflict
                          ? reservations
                              .filter(r => r.variant_id === v.id && r.trip_id !== id)
                              .map(r => tripsById.get(r.trip_id))
                              .filter((t): t is Trip => !!t && tripsOverlap(trip, t))
                              .map(t => t.name)
                          : []
                        return (
                          <div key={v.id}>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                              <span className="text-stone-600 w-24 sm:w-32 flex-shrink-0 truncate">{v.label === 'Standard' ? 'Quantity' : v.label}</span>
                              <div className="flex items-center gap-1 print:hidden">
                                <button onClick={() => setReservation(v.id, Math.max(0, mine - 1))}
                                  className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                                  disabled={mine <= 0}><Minus className="w-3.5 h-3.5" /></button>
                                <input type="number" min={0} value={mine}
                                  onChange={e => setReservation(v.id, Math.max(0, Number(e.target.value)))}
                                  className={`w-14 text-center input !py-1 !px-1 text-sm ${conflict ? '!border-red-400 !text-red-600' : ''}`} />
                                <button onClick={() => setReservation(v.id, mine + 1)}
                                  className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50"><Plus className="w-3.5 h-3.5" /></button>
                              </div>
                              <span className="hidden print:inline font-bold">{mine}</span>
                              <span className={`text-xs ${conflict ? 'text-red-600 font-semibold' : 'text-stone-400'}`}>
                                {owned} owned{elsewhere > 0 ? ` · ${elsewhere} on overlapping trips` : ''} · {available} free
                              </span>
                            </div>
                            {conflict && (
                              <div className="mt-1 ml-0 sm:ml-32 flex items-start gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1 print:hidden">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span>
                                  Only {Math.max(0, available)} free for your dates — you asked for {mine}.
                                  {clashTrips.length > 0 && <> Overlaps: {clashTrips.join(', ')}.</>}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <AlwaysPackReminder enabled={trip.auto_pack !== false} />
      </div>
    </AuthGuard>
  )
}

function DateBar({ trip, range, onSave }: { trip: Trip; range: { start: string; end: string } | null; onSave: (s: string, e: string) => void }) {
  const [start, setStart] = useState(trip.start_date ?? '')
  const [end, setEnd] = useState(trip.end_date ?? range?.end ?? '')

  function onStartChange(s: string) {
    setStart(s)
    // auto-fill end from num_days if end empty or before start
    let e = end
    if (s && (!e || e < s)) {
      const d = new Date(s + 'T00:00:00')
      d.setDate(d.getDate() + Math.max(0, (trip.num_days || 1) - 1))
      e = d.toISOString().slice(0, 10)
      setEnd(e)
    }
    onSave(s, e)
  }

  return (
    <div className="card p-4 mb-5 flex items-center gap-4 flex-wrap print:border-none print:shadow-none">
      <span className="flex items-center gap-1.5 text-sm text-stone-600 font-medium"><Calendar className="w-4 h-4 text-forest-600" /> Trip dates</span>
      <label className="text-xs text-stone-500 flex items-center gap-1.5">Start
        <input type="date" value={start} onChange={e => onStartChange(e.target.value)} className="input !py-1 text-sm" />
      </label>
      <label className="text-xs text-stone-500 flex items-center gap-1.5">End
        <input type="date" value={end} onChange={e => { setEnd(e.target.value); onSave(start, e.target.value) }} className="input !py-1 text-sm" />
      </label>
      {range && <span className="text-xs text-stone-400">{trip.num_days} days</span>}
    </div>
  )
}

function AlwaysPackReminder({ enabled }: { enabled: boolean }) {
  const [packItems, setPackItems] = useState<GearItem[]>([])
  useEffect(() => {
    if (!enabled) return
    supabase.from('gear_items').select('*, gear_variants(*)').eq('always_pack', true).order('sort_order')
      .then(({ data }) => setPackItems((data ?? []) as GearItem[]))
  }, [enabled])
  if (!enabled || !packItems.length) return null
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-semibold text-stone-800 flex items-center gap-1.5"><Package className="w-4 h-4 text-stone-500" /> Standard kit — always packed</h2>
        <div className="flex-1 h-px bg-stone-200" />
      </div>
      <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {packItems.map(s => {
          const owned = (s.gear_variants ?? []).reduce((a, v) => a + v.quantity, 0)
          const low = s.item_type === 'supply' && owned <= s.low_stock_threshold
          return (
            <div key={s.id} className="flex items-center gap-2 text-sm text-stone-600">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0" />
              <span className="flex-1 truncate">{s.name}</span>
              <span className={`text-xs ${low ? 'text-red-600 font-semibold' : 'text-stone-400'}`}>{owned}{s.unit ? ` ${s.unit}` : ''}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-stone-400 mt-2 print:hidden">Auto-added because this trip has &ldquo;always-pack&rdquo; on. Supplies aren&apos;t reserved — check stock before departure.</p>
    </div>
  )
}
