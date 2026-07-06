'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Trip, ItineraryItem, TIME_LABELS } from '@/lib/types'
import { ArrowLeft, Printer, Users, Calendar, Plus, X, UtensilsCrossed } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import TripStepper from '@/components/TripStepper'

export default function ItineraryPage() {
  const { id } = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [items, setItems] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => {
    const [tripRes, itinRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('itinerary_items').select('*').eq('trip_id', id)
        .order('day_number').order('sort_order'),
    ])
    setTrip(tripRes.data)
    setItems(itinRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function addActivity(day: number) {
    const dayItems = items.filter(i => i.day_number === day)
    const sort_order = dayItems.length
      ? Math.max(...dayItems.map(i => i.sort_order)) + 1
      : 0
    const { data } = await supabase.from('itinerary_items')
      .insert({ trip_id: id, day_number: day, activity: '', time_label: null, sort_order })
      .select().single()
    if (data) setItems(prev => [...prev, data])
  }

  function updateActivity(itemId: string, value: string) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, activity: value } : i))
    clearTimeout(saveTimers.current[itemId])
    saveTimers.current[itemId] = setTimeout(async () => {
      await supabase.from('itinerary_items').update({ activity: value }).eq('id', itemId)
    }, 500)
  }

  async function updateTimeLabel(itemId: string, value: string) {
    const time_label = value || null
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, time_label: time_label ?? undefined } : i))
    await supabase.from('itinerary_items').update({ time_label }).eq('id', itemId)
  }

  async function removeItem(itemId: string) {
    setItems(prev => prev.filter(i => i.id !== itemId))
    await supabase.from('itinerary_items').delete().eq('id', itemId)
  }

  if (loading) return <div className="text-center py-16 text-stone-400">Loading...</div>
  if (!trip) return <div className="text-center py-16 text-stone-400">Trip not found.</div>

  const days = Array.from({ length: trip.num_days }, (_, i) => i + 1)

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/trips" className="btn-ghost flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Trips
            </Link>
            <div>
              <h1 className="text-xl font-bold text-stone-900">Itinerary</h1>
              <p className="text-sm text-stone-500">{trip.name}</p>
            </div>
          </div>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        <div className="mb-6 print:hidden">
          <TripStepper tripId={id} current="itinerary" />
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">{trip.name} — Itinerary</h1>
        </div>

        {/* Trip info */}
        <div className="card p-4 mb-6 flex items-center gap-6 flex-wrap print:border-none print:shadow-none print:p-0 print:mb-4">
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <Users className="w-4 h-4 text-forest-600 print:hidden" />
            <span className="font-medium">{trip.num_people} people</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <Calendar className="w-4 h-4 text-forest-600 print:hidden" />
            <span className="font-medium">{trip.num_days} days</span>
          </div>
          <p className="text-sm text-stone-400 print:hidden">Map out the activities for each day, then plan meals around them.</p>
        </div>

        {/* Day-by-day activity planner */}
        <div className="space-y-4">
          {days.map(day => {
            const dayItems = items
              .filter(i => i.day_number === day)
              .sort((a, b) => a.sort_order - b.sort_order)

            return (
              <div key={day} className="card overflow-hidden print:break-inside-avoid print:border print:border-stone-200 print:shadow-none">
                <div className="bg-forest-700 text-white px-4 py-2 flex items-center gap-2 print:bg-stone-800">
                  <span className="font-bold text-lg">Day {day}</span>
                </div>

                <div className="divide-y divide-stone-50">
                  {dayItems.map(item => (
                    <div key={item.id} className="px-3 py-2 flex items-center gap-2 group">
                      <select
                        value={item.time_label ?? ''}
                        onChange={e => updateTimeLabel(item.id, e.target.value)}
                        className="input !py-1 !px-2 text-xs w-24 flex-shrink-0 text-stone-600 print:border-none print:bg-transparent"
                      >
                        <option value="">—</option>
                        {TIME_LABELS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        value={item.activity}
                        onChange={e => updateActivity(item.id, e.target.value)}
                        placeholder="What are they doing? e.g. Paddle to Camp 2, glacier hike, rest day…"
                        className="flex-1 min-w-0 bg-transparent text-sm text-stone-800 placeholder-stone-300 focus:outline-none py-1"
                      />
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-stone-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden flex-shrink-0"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {dayItems.length === 0 && (
                    <p className="px-4 py-2 text-sm text-stone-300 italic print:text-stone-400">No activities yet</p>
                  )}
                </div>

                <div className="px-3 py-2 print:hidden">
                  <button
                    onClick={() => addActivity(day)}
                    className="flex items-center gap-1 text-xs text-stone-400 hover:text-forest-600 hover:bg-forest-50 rounded px-1.5 py-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add activity
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Next step */}
        <div className="mt-8 flex justify-end print:hidden">
          <Link href={`/trips/${id}/menu`} className="btn-primary flex items-center gap-2">
            Next: Plan Meals <UtensilsCrossed className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </AuthGuard>
  )
}
