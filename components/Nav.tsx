'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UtensilsCrossed, Camera, BookOpen, Map, Backpack, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function Nav() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  const items = [
    { href: '/photos', label: 'Photos', icon: Camera },
    { href: '/recipes', label: 'Recipes', icon: BookOpen },
    { href: '/trips', label: 'Trips', icon: Map },
    { href: '/gear', label: 'Gear', icon: Backpack },
  ]

  return (
    <nav className="bg-forest-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 justify-between">
          {/* Logo + dropdown */}
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
            >
              <UtensilsCrossed className="w-5 h-5 text-amber-400" />
              <span className="hidden sm:block">BK2AK</span>
              <ChevronDown className={`w-4 h-4 text-forest-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-stone-100 overflow-hidden z-50">
                {items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-stone-700 hover:bg-stone-50 text-sm font-medium transition-colors"
                  >
                    <Icon className="w-4 h-4 text-forest-600" />
                    {label}
                  </Link>
                ))}
                <div className="border-t border-stone-100">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-3 text-stone-500 hover:bg-stone-50 text-sm w-full transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {user && (
            <span className="text-xs text-forest-300 hidden md:block">{user.email}</span>
          )}
        </div>
      </div>
    </nav>
  )
}
