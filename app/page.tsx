'use client'
import Link from 'next/link'
import { Camera, BookOpen, Map, Backpack, ChevronRight } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const { user } = useAuth()

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-forest-700">Welcome back</h1>
          <p className="text-stone-500 mt-1">{user?.email} · BK2AK Staff Portal</p>
        </div>

        <div className="grid gap-4">
          <Link href="/photos" className="card p-6 flex items-center gap-5 hover:border-forest-300 hover:shadow-md transition-all group">
            <div className="w-14 h-14 bg-forest-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Camera className="w-7 h-7 text-forest-700" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-stone-900 group-hover:text-forest-700 text-lg">Photo Picker</h2>
              <p className="text-sm text-stone-500 mt-0.5">Vote on expedition photos for Instagram and reports</p>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-forest-500" />
          </Link>

          <Link href="/recipes" className="card p-6 flex items-center gap-5 hover:border-forest-300 hover:shadow-md transition-all group">
            <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-7 h-7 text-amber-500" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-stone-900 group-hover:text-forest-700 text-lg">Recipe Library</h2>
              <p className="text-sm text-stone-500 mt-0.5">Add and manage expedition recipes with ingredients and notes</p>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-forest-500" />
          </Link>

          <Link href="/trips" className="card p-6 flex items-center gap-5 hover:border-forest-300 hover:shadow-md transition-all group">
            <div className="w-14 h-14 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Map className="w-7 h-7 text-stone-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-stone-900 group-hover:text-forest-700 text-lg">Trips & Menus</h2>
              <p className="text-sm text-stone-500 mt-0.5">Build itineraries, trip menus, and generate shopping lists</p>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-forest-500" />
          </Link>

          <Link href="/gear" className="card p-6 flex items-center gap-5 hover:border-forest-300 hover:shadow-md transition-all group">
            <div className="w-14 h-14 bg-forest-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Backpack className="w-7 h-7 text-forest-700" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-stone-900 group-hover:text-forest-700 text-lg">Gear Inventory</h2>
              <p className="text-sm text-stone-500 mt-0.5">Track gear and supplies, reserve for trips, catch double-bookings</p>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-forest-500" />
          </Link>
        </div>
      </div>
    </AuthGuard>
  )
}
