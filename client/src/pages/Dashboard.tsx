import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'

interface User {
  id: string
  email: string
  emailVerified: boolean
  isAdmin?: boolean
  createdAt: string
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verify user is authenticated
    fetch('/api/me', {
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          // Not authenticated, redirect to login
          navigate('/', { replace: true })
          return
        }
        const data = await response.json()
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => {
        navigate('/', { replace: true })
      })
  }, [navigate])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="auth-card animate-fade-in">
        <Logo />

        <h1 className="text-2xl font-bold text-center mb-2">Welcome!</h1>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
          You're logged in to KOauth
        </p>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            Account Information
          </h2>
          <div className="space-y-3">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="text-sm font-medium mt-1">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Status</dt>
              <dd className="text-sm font-medium mt-1">
                {user.emailVerified ? (
                  <span className="text-green-600 dark:text-green-400">Verified</span>
                ) : (
                  <span className="text-yellow-600 dark:text-yellow-400">Not Verified</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Member Since</dt>
              <dd className="text-sm font-medium mt-1">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => navigate('/api-keys')}
            className="w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100">API Keys</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Manage keys for programmatic access
                </p>
              </div>
              <span className="text-blue-600 dark:text-blue-400">→</span>
            </div>
          </button>
          {user.isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-purple-900 dark:text-purple-100">Admin Panel</h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Manage users and OAuth clients
                  </p>
                </div>
                <span className="text-purple-600 dark:text-purple-400">→</span>
              </div>
            </button>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="btn-primary w-full"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
