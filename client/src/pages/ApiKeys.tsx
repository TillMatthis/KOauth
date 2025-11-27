import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'

interface ApiKey {
  id: string
  name: string
  prefix: string
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

interface GenerateModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (name: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  apiKey: string
  keyName: string
}

const GenerateKeyModal: React.FC<GenerateModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isLoading,
  error
}) => {
  const [name, setName] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      await onGenerate(name.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Generate New API Key</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="keyName" className="block text-sm font-medium mb-2">
              Name
            </label>
            <input
              id="keyName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., MCP Server, iOS Shortcut"
              className="input-field"
              maxLength={100}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Give your key a descriptive name
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const KeyGeneratedModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  keyName
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">API Key Generated</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
            ⚠️ Save this key now!
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            You won't be able to see it again. Store it securely.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Key Name</label>
          <p className="text-sm text-gray-600 dark:text-gray-400">{keyName}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">API Key</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={apiKey}
              readOnly
              className="input-field font-mono text-sm flex-1"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-sm font-medium mb-2">Usage in your applications:</p>
          <code className="text-xs text-gray-600 dark:text-gray-400 block">
            Authorization: Bearer {apiKey}
          </code>
        </div>

        <button onClick={onClose} className="btn-primary w-full">
          Done
        </button>
      </div>
    </div>
  )
}

export const ApiKeys: React.FC = () => {
  const navigate = useNavigate()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<{ key: string; name: string } | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/me/api-keys', {
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/', { replace: true })
          return
        }
        throw new Error('Failed to load API keys')
      }

      const data = await response.json()
      setApiKeys(data.apiKeys || [])
    } catch (error) {
      console.error('Error loading API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async (name: string) => {
    setIsGenerating(true)
    setGenerateError(null)

    try {
      const response = await fetch('/api/me/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate API key')
      }

      // Show success modal with the generated key
      setGeneratedKey({ key: data.apiKey.key, name: data.apiKey.name })
      setShowGenerateModal(false)
      setShowSuccessModal(true)

      // Reload the list
      await loadApiKeys()
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Failed to generate API key')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRevoke = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke the API key "${keyName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/me/api-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to revoke API key')
      }

      // Reload the list
      await loadApiKeys()
    } catch (error) {
      console.error('Error revoking API key:', error)
      alert('Failed to revoke API key. Please try again.')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            ← Back to Dashboard
          </button>
          <Logo />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">API Keys</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage API keys for programmatic access to KURA Notes
              </p>
            </div>
            <button
              onClick={() => {
                setGenerateError(null)
                setShowGenerateModal(true)
              }}
              className="btn-primary"
            >
              + New Key
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No API keys yet. Generate one to get started.
              </p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="btn-primary"
              >
                Generate Your First API Key
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg mb-1">{key.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mb-2">
                        {key.prefix}...
                      </p>
                      <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(key.createdAt).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">Last used:</span>{' '}
                          {formatDate(key.lastUsedAt)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(key.id, key.name)}
                      className="ml-4 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {apiKeys.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Security tip:</strong> Treat API keys like passwords. Store them securely
                and revoke any keys you suspect have been compromised.
              </p>
            </div>
          )}
        </div>
      </div>

      <GenerateKeyModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGenerate}
        isLoading={isGenerating}
        error={generateError}
      />

      {generatedKey && (
        <KeyGeneratedModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false)
            setGeneratedKey(null)
          }}
          apiKey={generatedKey.key}
          keyName={generatedKey.name}
        />
      )}
    </div>
  )
}
