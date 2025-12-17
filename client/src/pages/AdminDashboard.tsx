import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { useAdmin } from '../hooks/useAdmin'

interface Stats {
  totalUsers: number
  totalClients: number
  activeSessions: number
  recentSignups: Array<{
    id: string
    email: string
    createdAt: string
    provider: string | null
  }>
  usersLast7Days: number
  usersLast30Days: number
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (adminLoading) return

    if (isAdmin === false) {
      navigate('/dashboard', { replace: true })
      return
    }

    if (isAdmin) {
      loadStats()
    }
  }, [isAdmin, adminLoading, navigate])

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 403) {
          navigate('/dashboard', { replace: true })
          return
        }
        throw new Error('Failed to load statistics')
      }

      const data = await response.json()
      setStats(data.stats)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (adminLoading || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </AdminLayout>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                <p className="text-3xl font-bold mt-2">{stats.totalUsers}</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">OAuth Clients</p>
                <p className="text-3xl font-bold mt-2">{stats.totalClients}</p>
              </div>
              <div className="text-4xl">🔐</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Sessions</p>
                <p className="text-3xl font-bold mt-2">{stats.activeSessions}</p>
              </div>
              <div className="text-4xl">🔑</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">New Users (7d)</p>
                <p className="text-3xl font-bold mt-2">{stats.usersLast7Days}</p>
              </div>
              <div className="text-4xl">📈</div>
            </div>
          </div>
        </div>

        {/* Recent Signups */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold">Recent Signups</h2>
          </div>
          <div className="p-6">
            {stats.recentSignups.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No recent signups</p>
            ) : (
              <div className="space-y-4">
                {stats.recentSignups.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.provider ? `via ${user.provider}` : 'Email/Password'} •{' '}
                        {new Date(user.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/admin/users')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold mb-2">Manage Users</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View, edit, and manage user accounts
            </p>
          </button>

          <button
            onClick={() => navigate('/admin/clients')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold mb-2">Manage OAuth Clients</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create and configure OAuth client applications
            </p>
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
