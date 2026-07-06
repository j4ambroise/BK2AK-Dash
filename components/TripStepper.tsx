'use client'
import Link from 'next/link'
import { Map, UtensilsCrossed, ShoppingCart, ChevronRight } from 'lucide-react'

type Step = 'itinerary' | 'menu' | 'shopping'

const STEPS: { key: Step; label: string; icon: typeof Map; href: (id: string) => string }[] = [
  { key: 'itinerary', label: 'Itinerary', icon: Map, href: id => `/trips/${id}/itinerary` },
  { key: 'menu', label: 'Meals', icon: UtensilsCrossed, href: id => `/trips/${id}/menu` },
  { key: 'shopping', label: 'Shopping', icon: ShoppingCart, href: id => `/trips/${id}/shopping` },
]

export default function TripStepper({ tripId, current }: { tripId: string; current: Step }) {
  return (
    <div className="flex items-center gap-1 flex-wrap print:hidden">
      {STEPS.map((step, i) => {
        const Icon = step.icon
        const active = step.key === current
        return (
          <div key={step.key} className="flex items-center">
            <Link
              href={step.href(tripId)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-forest-700 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                active ? 'bg-white/20' : 'bg-white text-stone-500'
              }`}>
                {i + 1}
              </span>
              <Icon className="w-3.5 h-3.5" />
              {step.label}
            </Link>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-stone-300 mx-0.5" />}
          </div>
        )
      })}
    </div>
  )
}
