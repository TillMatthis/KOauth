import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { useAdmin } from '../hooks/useAdmin'

interface OAuthClient {
  id: string
  clientId: string
  name: string
  description: string | null
  websiteUrl: string | null
  logoUrl: string | null
  redirectUris: string[]
  trusted: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  _count: {
    authorizationCodes: number
    refreshTokens: number
  }
}

interface CreateClientData {
  name: string
  description: string
  redirectUris: string
  trusted: boolean
  websiteUrl: string
  logoUrl: string
}

interface EditClientData {
  name: string
  description: string
  redirectUris: string
  trusted: boolean
  active: boolean
  websiteUrl: string
  logoUrl: string
}

export const AdminClients: React.FC = () => {
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const [clients, setClients] = useState<OAuthClient[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSecretModal, setShowSecretModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<OAuthClient | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [createData, setCreateData] = useState<CreateClientData>({
    name: '',
    description: '',
    redirectUris: '',
    trusted: false,
    websiteUrl: '',
    logoUrl: ''
  })
  const [editData, setEditData] = useState<Partial<EditClientData>>({})

  useEffect(() => {
    if (adminLoading) return

    if (isAdmin === false) {
      navigate('/dashboard', { replace: true })
      return
    }

    if (isAdmin) {
      loadClients()
    }
  }, [isAdmin, adminLoading, navigate])

  const loadClients = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/clients', {
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 403) {
          navigate('/dashboard', { replace: true })
          return
        }
        throw new Error('Failed to load clients')
      }

      const data = await response.json()
      setClients(data.clients)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const redirectUris = createData.redirectUris
        .split(',')
        .map(uri => uri.trim())
        .filter(Boolean)

      if (redirectUris.length === 0) {
        alert('At least one redirect URI is required')
        return
      }

      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: createData.name,
          description: createData.description || undefined,
          redirectUris,
          trusted: createData.trusted,
          websiteUrl: createData.websiteUrl || undefined,
          logoUrl: createData.logoUrl || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to create client')
        return
      }

      const data = await response.json()
      setNewSecret(data.client.clientSecret)
      setShowCreateModal(false)
      setShowSecretModal(true)
      setCreateData({
        name: '',
        description: '',
        redirectUris: '',
        trusted: false,
        websiteUrl: '',
        logoUrl: ''
      })
      loadClients()
    } catch (error) {
      console.error('Error creating client:', error)
      alert('Failed to create client')
    }
  }

  const handleEdit = (client: OAuthClient) => {
    setSelectedClient(client)
    setEditData({
      name: client.name,
      description: client.description || '',
      redirectUris: client.redirectUris.join(', '),
      trusted: client.trusted,
      active: client.active,
      websiteUrl: client.websiteUrl || '',
      logoUrl: client.logoUrl || ''
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedClient) return

    try {
      const redirectUris = editData.redirectUris
        ? editData.redirectUris.split(',')
            .map(uri => uri.trim())
            .filter(Boolean)
        : selectedClient.redirectUris

      if (redirectUris.length === 0) {
        alert('At least one redirect URI is required')
        return
      }

      const response = await fetch(`/api/admin/clients/${selectedClient.clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editData.name,
          description: editData.description || undefined,
          redirectUris,
          trusted: editData.trusted,
          active: editData.active,
          websiteUrl: editData.websiteUrl || undefined,
          logoUrl: editData.logoUrl || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to update client')
        return
      }

      setShowEditModal(false)
      setSelectedClient(null)
      loadClients()
    } catch (error) {
      console.error('Error updating client:', error)
      alert('Failed to update client')
    }
  }

  const handleDelete = async (client: OAuthClient) => {
    if (!confirm(`Are you sure you want to delete client "${client.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/clients/${client.clientId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete client')
        return
      }

      loadClients()
    } catch (error) {
      console.error('Error deleting client:', error)
      alert('Failed to delete client')
    }
  }

  const handleRegenerateSecret = async (client: OAuthClient) => {
    if (!confirm(`Are you sure you want to regenerate the secret for "${client.name}"? The old secret will stop working immediately.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/clients/${client.clientId}/regenerate-secret`, {
        method: 'POST',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to regenerate secret')
        return
      }

      const data = await response.json()
      setNewSecret(data.clientSecret)
      setShowSecretModal(true)
    } catch (error) {
      console.error('Error regenerating secret:', error)
      alert('Failed to regenerate secret')
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
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
          <h1 className="text-3xl font-bold">OAuth Clients</h1>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            + Create Client
          </button>
        </div>

        {/* Clients Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Client ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
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
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium">{client.name}</div>
                      {client.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{client.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-xs font-mono">{client.clientId}</code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {client.active ? (
                          <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded">
                            Inactive
                          </span>
                        )}
                        {client.trusted && (
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded">
                            Trusted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client._count.authorizationCodes} codes, {client._count.refreshTokens} tokens
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRegenerateSecret(client)}
                        className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300 mr-4"
                      >
                        Regenerate Secret
                      </button>
                      <button
                        onClick={() => handleDelete(client)}
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
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Create OAuth Client</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={createData.name}
                    onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <input
                    type="text"
                    value={createData.description}
                    onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Redirect URIs * (comma-separated)</label>
                  <input
                    type="text"
                    value={createData.redirectUris}
                    onChange={(e) => setCreateData({ ...createData, redirectUris: e.target.value })}
                    className="input-field"
                    placeholder="https://example.com/callback, https://app.example.com/callback"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Website URL</label>
                  <input
                    type="url"
                    value={createData.websiteUrl}
                    onChange={(e) => setCreateData({ ...createData, websiteUrl: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Logo URL</label>
                  <input
                    type="url"
                    value={createData.logoUrl}
                    onChange={(e) => setCreateData({ ...createData, logoUrl: e.target.value })}
                    className="input-field"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createData.trusted}
                    onChange={(e) => setCreateData({ ...createData, trusted: e.target.checked })}
                    className="rounded"
                  />
                  <span>Trusted (skip consent screen)</span>
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button onClick={handleCreate} className="flex-1 btn-primary" disabled={!createData.name || !createData.redirectUris}>
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Edit OAuth Client</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <input
                    type="text"
                    value={editData.description || ''}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Redirect URIs * (comma-separated)</label>
                  <input
                    type="text"
                    value={editData.redirectUris || ''}
                    onChange={(e) => setEditData({ ...editData, redirectUris: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Website URL</label>
                  <input
                    type="url"
                    value={editData.websiteUrl || ''}
                    onChange={(e) => setEditData({ ...editData, websiteUrl: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Logo URL</label>
                  <input
                    type="url"
                    value={editData.logoUrl || ''}
                    onChange={(e) => setEditData({ ...editData, logoUrl: e.target.value })}
                    className="input-field"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData.trusted || false}
                    onChange={(e) => setEditData({ ...editData, trusted: e.target.checked })}
                    className="rounded"
                  />
                  <span>Trusted (skip consent screen)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData.active !== undefined ? editData.active : selectedClient.active}
                    onChange={(e) => setEditData({ ...editData, active: e.target.checked })}
                    className="rounded"
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="flex gap-3 mt-6">
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

        {/* Secret Modal */}
        {showSecretModal && newSecret && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
              <h2 className="text-xl font-bold mb-4">Client Secret</h2>
              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                  ⚠️ Save this secret now!
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  You won't be able to see it again. Store it securely.
                </p>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Client Secret</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSecret}
                    readOnly
                    className="input-field font-mono text-sm flex-1"
                  />
                  <button
                    onClick={() => copyToClipboard(newSecret)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <button onClick={() => { setShowSecretModal(false); setNewSecret(null) }} className="btn-primary w-full">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
