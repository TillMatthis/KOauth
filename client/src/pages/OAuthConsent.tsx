import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'

interface ClientInfo {
  name: string
  description: string
  logoUrl: string | null
  websiteUrl: string | null
}

export const OAuthConsent: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [scopes, setScopes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    loadClientInfo()
  }, [])

  const loadClientInfo = async () => {
    const clientId = searchParams.get('client_id')

    if (!clientId) {
      setError('Missing client_id parameter')
      setLoading(false)
      return
    }

    try {
      // Fetch client info
      const response = await fetch(`/api/oauth/clients/${clientId}`)

      if (!response.ok) {
        throw new Error('Invalid client')
      }

      const data = await response.json()
      setClient(data.client)

      // Parse scopes
      const scopeParam = searchParams.get('scope') || 'openid profile email'
      setScopes(scopeParam.split(' '))

      setLoading(false)
    } catch (err) {
      setError('Invalid or unknown OAuth client')
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    setApproving(true)

    // Build form data with all OAuth parameters
    const formData = new URLSearchParams()
    formData.append('approved', 'true')
    formData.append('response_type', searchParams.get('response_type') || 'code')
    formData.append('client_id', searchParams.get('client_id') || '')
    formData.append('redirect_uri', searchParams.get('redirect_uri') || '')
    formData.append('scope', searchParams.get('scope') || 'openid profile email')

    const state = searchParams.get('state')
    if (state) formData.append('state', state)

    const codeChallenge = searchParams.get('code_challenge')
    if (codeChallenge) formData.append('code_challenge', codeChallenge)

    const codeChallengeMethod = searchParams.get('code_challenge_method')
    if (codeChallengeMethod) formData.append('code_challenge_method', codeChallengeMethod)

    try {
      const response = await fetch('/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
        credentials: 'include',
        redirect: 'manual'
      })

      // OAuth endpoint will redirect - follow it
      if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 303) {
        const location = response.headers.get('location')
        if (location) {
          window.location.href = location
        }
      } else {
        setError('Authorization failed. Please try again.')
        setApproving(false)
      }
    } catch (err) {
      setError('Network error. Please try again.')
      setApproving(false)
    }
  }

  const handleDeny = () => {
    const redirectUri = searchParams.get('redirect_uri')
    const state = searchParams.get('state')

    if (redirectUri) {
      const url = new URL(redirectUri)
      url.searchParams.set('error', 'access_denied')
      url.searchParams.set('error_description', 'User denied authorization')
      if (state) url.searchParams.set('state', state)

      window.location.href = url.toString()
    } else {
      navigate('/dashboard')
    }
  }

  const getScopeDescription = (scope: string): string => {
    const descriptions: Record<string, string> = {
      'openid': 'Verify your identity',
      'profile': 'Access your profile information (name, etc.)',
      'email': 'Access your email address',
      'offline_access': 'Access your data while you\'re offline'
    }
    return descriptions[scope] || scope
  }

  const getScopeIcon = (scope: string): string => {
    const icons: Record<string, string> = {
      'openid': '🔐',
      'profile': '👤',
      'email': '📧',
      'offline_access': '🔄'
    }
    return icons[scope] || '🔹'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="auth-card">
          <Logo />
          <h1 className="text-2xl font-bold text-center mb-4 text-red-600">Authorization Error</h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <Logo />

        <div className="text-center mb-6">
          {client.logoUrl && (
            <img
              src={client.logoUrl}
              alt={client.name}
              className="w-16 h-16 mx-auto mb-4 rounded"
            />
          )}
          <h1 className="text-2xl font-bold mb-2">{client.name} wants to access your account</h1>
          {client.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{client.description}</p>
          )}
          {client.websiteUrl && (
            <a
              href={client.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Visit website →
            </a>
          )}
        </div>

        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            This application will be able to:
          </h2>
          <ul className="space-y-2">
            {scopes.map((scope) => (
              <li key={scope} className="flex items-start gap-3">
                <span className="text-lg">{getScopeIcon(scope)}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {getScopeDescription(scope)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleApprove}
            disabled={approving}
            className="w-full btn-primary"
          >
            {approving ? 'Authorizing...' : 'Authorize'}
          </button>

          <button
            onClick={handleDeny}
            disabled={approving}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="mt-6 text-xs text-center text-gray-500 dark:text-gray-400">
          By authorizing, you allow {client.name} to use your information in accordance with their
          privacy policy. You can revoke access at any time from your dashboard.
        </p>
      </div>
    </div>
  )
}
