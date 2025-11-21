/**
 * Core authentication logic for KOauth client
 * Zero-dependency HTTP client using native Node.js fetch
 */

import type { KOauthUser, KOauthOptions } from './types'

/**
 * Validate authentication by calling KOauth /api/me endpoint
 * Automatically forwards cookies and Authorization headers
 */
export async function validateAuth(
  authHeader: string | undefined,
  cookies: Record<string, string | undefined>,
  options: KOauthOptions
): Promise<KOauthUser | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Forward Authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    // Forward session cookie if present
    if (cookies.session_id) {
      headers['Cookie'] = `session_id=${cookies.session_id}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeout || 5000)

    const response = await fetch(`${options.baseUrl}/api/me`, {
      method: 'GET',
      headers,
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return null
    }

    const data = await response.json() as { success: boolean; user?: KOauthUser }

    if (data.success && data.user) {
      return data.user
    }

    return null
  } catch (error) {
    if (options.onError) {
      options.onError(error as Error)
    }
    return null
  }
}

/**
 * Extract cookies from request headers (for server-side requests)
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}

  return cookieHeader
    .split(';')
    .map(cookie => cookie.trim().split('='))
    .reduce((acc, [key, value]) => {
      if (key && value) {
        acc[key] = decodeURIComponent(value)
      }
      return acc
    }, {} as Record<string, string>)
}
