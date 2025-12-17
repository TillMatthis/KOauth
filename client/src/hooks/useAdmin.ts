import { useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  emailVerified: boolean
  isAdmin?: boolean
  createdAt: string
}

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me', {
      credentials: 'include'
    })
      .then(async (response) => {
        if (!response.ok) {
          setIsAdmin(false)
          setLoading(false)
          return
        }
        const data = await response.json()
        setUser(data.user)
        setIsAdmin(data.user?.isAdmin === true)
      })
      .catch(() => {
        setIsAdmin(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { isAdmin, user, loading }
}
