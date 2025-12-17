import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { ErrorAlert } from '../components/ErrorAlert'

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const token = searchParams.get('token')

  useEffect(() => {
    // If token is in URL params, verify it
    if (token) {
      verifyToken(token)
    } else {
      // Check for success/error in query params (from redirect)
      const success = searchParams.get('success')
      const errorParam = searchParams.get('error')

      if (success === 'true') {
        setStatus('success')
      } else if (errorParam) {
        setStatus('error')
        const errorMessages: Record<string, string> = {
          invalid_token: 'Invalid or expired verification link',
          server_error: 'Server error. Please try again.',
        }
        setError(errorMessages[errorParam] || 'Verification failed')
      } else {
        setStatus('error')
        setError('No verification token provided')
      }
    }
  }, [token, searchParams])

  const verifyToken = async (verifyToken: string) => {
    try {
      // The API endpoint redirects, so we navigate to it directly
      // The redirect will include success/error query params
      window.location.href = `/api/auth/verify-email/${verifyToken}`
    } catch (err) {
      setStatus('error')
      setError('Network error. Please try again.')
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="auth-card animate-fade-in text-center">
          <Logo />
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Verifying email...</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Please wait while we verify your email address
          </p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="auth-card animate-fade-in text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-2">Email verified!</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Your email address has been successfully verified. You can now use all features of your account.
          </p>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium mb-4"
          >
            Go to dashboard
          </Link>

          <div className="mt-4">
            <Link
              to="/"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Or sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="auth-card animate-fade-in text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">Verification failed</h1>
        <ErrorAlert message={error} onClose={() => setError('')} />

        <div className="mt-6 space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            The verification link may be invalid or expired. You can request a new verification email from your dashboard.
          </p>

          <div className="flex flex-col gap-3">
            <Link to="/" className="btn-primary">
              Go to sign in
            </Link>
            <Link
              to="/dashboard"
              className="text-sm link-text"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
