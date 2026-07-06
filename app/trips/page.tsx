'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Trip } from '@/lib/types'
import { Plus, Users, Calendar, Loader2, UtensilsCrossed, ShoppingCart, Map, Camera, Backpack } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'

export default function TripsPage() {
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', num_people: 12, num_days: 14, num_shopping_trips: 1, start_date: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('trips').select('*').order('created_at', { ascending: false })
    setTrips(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    let end_date: string | null = null
    if (form.start_date) {
      const d = new Date(form.start_date + 'T00:00:00')
      d.setDate(d.getDate() + Math.max(0, form.num_days - 1))
      end_date = d.toISOString().slice(0, 10)
    }
    const { data } = await supabase
      .from('trips')
      .insert({
        name: form.name.trim(),
        num_people: form.num_people,
        num_days: form.num_days,
        num_shopping_trips: form.num_shopping_trips,
        start_date: form.start_date || null,
        end_date,
      })
      .select()
      .single()
    setSaving(false)
    if (data) {
      // New trips start at step 1 of the flow: itinerary → meals → shopping
      router.push(`/trips/${data.id}/itinerary`)
    }
  }

  return (
    <AuthGuard>
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Trips & Menus</h1>
          <p className="text-sm text-stone-500 mt-1">{trips.length} trips</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Trip
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-stone-900 mb-4">New Trip</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Trip Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Latino Private Trip 2025" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            </div>
            <div>
              <label className="label">People</label>
              <input className="input" type="number" min={1} max={50} value={form.num_people}
                onChange={e => setForm(f => ({ ...f, num_people: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Days</label>
              <input className="input" type="number" min={1} max={30} value={form.num_days}
                onChange={e => setForm(f => ({ ...f, num_days: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Shopping Trips</label>
              <input className="input" type="number" min={1} max={5} value={form.num_shopping_trips}
                onChange={e => setForm(f => ({ ...f, num_shopping_trips: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Start Date</label>
              <input className="input" type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-stone-400 -mt-2 mb-4">Start date sets the trip&apos;s dates for gear conflict detection (end auto-fills from days; editable later).</p>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.name.trim()} className="btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Trip
            </button>
            <button onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-stone-400">Loading trips...</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-400 mb-4">No trips yet.</p>
          <button onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create your first trip
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => (
            <div key={trip.id} className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-stone-900 truncate">{trip.name}</h3>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="flex items-center gap-1 text-sm text-stone-500">
                    <Users className="w-3.5 h-3.5" /> {trip.num_people} people
                  </span>
                  <span className="flex items-center gap-1 text-sm text-stone-500">
                    <Calendar className="w-3.5 h-3.5" /> {trip.num_days} days
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:flex-shrink-0 sm:flex-wrap">
                <Link href={`/trips/${trip.id}/itinerary`} className="btn-primary flex items-center justify-center gap-1.5 text-sm px-3 py-1.5">
                  <Map className="w-3.5 h-3.5" /> Itinerary
                </Link>
                <Link href={`/trips/${trip.id}/menu`} className="btn-secondary flex items-center justify-center gap-1.5 text-sm px-3 py-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5" /> Meals
                </Link>
                <Link href={`/trips/${trip.id}/shopping`} className="btn-secondary flex items-center justify-center gap-1.5 text-sm px-3 py-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" /> Shopping
                </Link>
                <Link href={`/trips/${trip.id}/gear`} className="btn-secondary flex items-center justify-center gap-1.5 text-sm px-3 py-1.5">
                  <Backpack className="w-3.5 h-3.5" /> Gear
                </Link>
                <Link href={`/trips/${trip.id}/photos`} className="btn-secondary flex items-center justify-center gap-1.5 text-sm px-3 py-1.5">
                  <Camera className="w-3.5 h-3.5" /> Photos
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </AuthGuard>
  )
}
