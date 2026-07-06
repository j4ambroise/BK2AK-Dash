'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, signIn } from '@/lib/auth-context'
import { UtensilsCrossed } from 'lucide-react'

const ALLOWED_EMAILS = [
  'jambroise@scu.edu',
  'j4.ambroise@gmail.com',
]

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading, router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!ALLOWED_EMAILS.includes(normalized)) {
      setError("This email hasn't been added to the portal yet. Ask James to add you.")
      return
    }
    signIn(normalized)
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-forest-700 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-forest-600 rounded-2xl mb-4">
            <UtensilsCrossed className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Brooklyn to Alaska</h1>
          <p className="text-forest-300 text-sm mt-1">Staff Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="you@email.com"
                required
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              className="w-full bg-forest-700 text-white py-2.5 rounded-lg font-medium hover:bg-forest-800 transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
