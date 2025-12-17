import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { useAdmin } from '../hooks/useAdmin'

interface User {
  id: string
  email: string
  emailVerified: boolean
  isAdmin: boolean
  provider: string | null
  createdAt: string
  updatedAt: string
  _count: {
    sessions: number
    apiKeys: number
  }
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export const AdminUsers: React.FC = () => {
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editEmailVerified, setEditEmailVerified] = useState(false)
  const [editIsAdmin, setEditIsAdmin] = useState(false)

  useEffect(() => {
    if (adminLoading) return

    if (isAdmin === false) {
      navigate('/dashboard', { replace: true })
      return
    }

    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin, adminLoading, navigate, page, search])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })
      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 403) {
          navigate('/dashboard', { replace: true })
          return
        }
        throw new Error('Failed to load users')
      }

      const data = await response.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadUsers()
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setEditEmailVerified(user.emailVerified)
    setEditIsAdmin(user.isAdmin)
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          emailVerified: editEmailVerified,
          isAdmin: editIsAdmin
        })
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to update user')
        return
      }

      setShowEditModal(false)
      setSelectedUser(null)
      loadUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    }
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.email}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete user')
        return
      }

      loadUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
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

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Users</h1>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email..."
              className="flex-1 input-field"
            />
            <button type="submit" className="btn-primary">
              Search
            </button>
          </div>
        </form>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stats
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium">{user.email}</div>
                      {user.isAdmin && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">Admin</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.emailVerified ? (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded">
                          Verified
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 rounded">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.provider || 'Email/Password'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user._count.sessions} sessions, {user._count.apiKeys} API keys
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} users
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
              <h2 className="text-xl font-bold mb-4">Edit User</h2>
              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{selectedUser.email}</p>
                <label className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={editEmailVerified}
                    onChange={(e) => setEditEmailVerified(e.target.checked)}
                    className="rounded"
                  />
                  <span>Email Verified</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editIsAdmin}
                    onChange={(e) => setEditIsAdmin(e.target.checked)}
                    className="rounded"
                  />
                  <span>Admin</span>
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="flex-1 btn-primary">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
