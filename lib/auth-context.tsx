'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface FakeUser {
  email: string
}

interface AuthContextType {
  user: FakeUser | null
  loading: boolean
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FakeUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('bk2ak_user_email')
    if (stored) setUser({ email: stored })
    setLoading(false)
  }, [])

  function signOut() {
    localStorage.removeItem('bk2ak_user_email')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function signIn(email: string) {
  localStorage.setItem('bk2ak_user_email', email)
}

export const useAuth = () => useContext(AuthContext)
