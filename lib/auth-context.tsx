'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface FakeUser {
  email: string
}

interface AuthContextType {
  user: FakeUser | null
  loading: boolean
  signIn: (email: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: () => {},
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

  function signIn(email: string) {
    localStorage.setItem('bk2ak_user_email', email)
    setUser({ email })
  }

  function signOut() {
    localStorage.removeItem('bk2ak_user_email')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
