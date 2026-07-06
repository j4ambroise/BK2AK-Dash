import { Trip, GearReservation } from './types'

// A trip has a usable date range only if both start and end are set.
export function tripDateRange(trip: Pick<Trip, 'start_date' | 'end_date' | 'num_days'>): { start: string; end: string } | null {
  if (!trip.start_date) return null
  const start = trip.start_date
  let end = trip.end_date
  if (!end) {
    // fall back to start + (num_days - 1)
    const d = new Date(start + 'T00:00:00')
    d.setDate(d.getDate() + Math.max(0, (trip.num_days || 1) - 1))
    end = d.toISOString().slice(0, 10)
  }
  return { start, end }
}

// Two inclusive date ranges overlap when each starts on or before the other ends.
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export function tripsOverlap(a: Trip, b: Trip): boolean {
  const ra = tripDateRange(a)
  const rb = tripDateRange(b)
  if (!ra || !rb) return false
  return rangesOverlap(ra.start, ra.end, rb.start, rb.end)
}

export interface TripLite {
  id: string
  start_date?: string
  end_date?: string
  num_days: number
}

// How many units of a variant are reserved by OTHER trips whose dates overlap `trip`.
export function reservedElsewhere(
  variantId: string,
  trip: TripLite,
  allTrips: TripLite[],
  reservations: Pick<GearReservation, 'trip_id' | 'variant_id' | 'quantity'>[],
): number {
  const tripsById = new Map(allTrips.map(t => [t.id, t]))
  const self = tripsById.get(trip.id) ?? trip
  let sum = 0
  for (const r of reservations) {
    if (r.variant_id !== variantId) continue
    if (r.trip_id === trip.id) continue
    const other = tripsById.get(r.trip_id)
    if (!other) continue
    if (tripsOverlap(self as Trip, other as Trip)) sum += r.quantity
  }
  return sum
}

// A reservation is over-committed when this trip's need + everyone else overlapping exceeds what we own.
export function isOverCommitted(owned: number, thisQty: number, elsewhere: number): boolean {
  return thisQty + elsewhere > owned
}
