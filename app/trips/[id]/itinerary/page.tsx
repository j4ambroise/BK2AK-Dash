'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Trip, MenuItem, MEAL_TYPES, MEAL_LABELS } from '@/lib/types'
import { ArrowLeft, Printer, Users, Calendar } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'

export default function ItineraryPage() {
  const { id } = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [tripRes, menuRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('menu_items')
        .select('*, recipe:recipes(*)')
        .eq('trip_id', id)
        .order('day_number').order('meal_type'),
    ])
    setTrip(tripRes.data)
    setMenuItems(menuRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-center py-16 text-stone-400">Loading...</div>
  if (!trip) return <div className="text-center py-16 text-stone-400">Trip not found.</div>

  const days = Array.from({ length: trip.num_days }, (_, i) => i + 1)

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <Link href={`/trips/${id}/menu`} className="btn-ghost flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Menu
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
        </div>

        {/* Day-by-day */}
        <div className="space-y-4">
          {days.map(day => {
            const dayItems = menuItems
              .filter(m => m.day_number === day)
              .sort((a, b) => MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type))

            return (
              <div key={day} className="card overflow-hidden print:break-inside-avoid print:border print:border-stone-200 print:shadow-none">
                <div className="bg-forest-700 text-white px-4 py-2 flex items-center gap-2 print:bg-stone-800">
                  <span className="font-bold text-lg">Day {day}</span>
                </div>
                {dayItems.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-stone-400 italic">No meals planned</p>
                ) : (
                  <div className="divide-y divide-stone-50">
                    {dayItems.map(item => (
                      <div key={item.id} className="px-4 py-3 flex items-start gap-4">
                        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">
                          {MEAL_LABELS[item.meal_type]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-stone-800">{item.recipe?.name}</p>
                          {item.recipe?.description && (
                            <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">{item.recipe.description}</p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1 italic">{item.notes}</p>
                          )}
                        </div>
                        <span className="text-xs text-stone-300 flex-shrink-0 pt-0.5">serves {item.recipe?.default_servings}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AuthGuard>
  )
}
