/**
 * Authentication middleware
 * Supports session cookies, API keys, and JWT Bearer tokens
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { validateSession } from './session'
import { validateApiKey } from './apikey'
import { verifyAccessToken } from './jwt'

/**
 * Extend FastifyRequest to include user property
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string
      email: string
      sessionId?: string
    }
  }
}

/**
 * Authenticate request using session cookie, API key, or JWT Bearer token
 * This middleware checks authentication methods in order:
 * 1. Bearer token (Authorization header) - tries JWT first, then API key
 * 2. Session cookie (session_id)
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Check for Bearer token first (Authorization header)
  const authHeader = request.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Try to verify as JWT access token first (RS256)
    const jwtPayload = verifyAccessToken(token)
    if (jwtPayload) {
      request.user = {
        id: jwtPayload.sub,
        email: jwtPayload.email || ''
      }
      return
    }

    // If not a valid JWT, try to validate as API key
    const user = await validateApiKey(token)
    if (user) {
      request.user = user
      return
    }

    // If Bearer token is present but neither JWT nor API key is valid, reject
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired token'
    })
  }

  // Check for session cookie
  const sessionId = request.cookies.session_id
  if (sessionId) {
    const user = await validateSession(sessionId)
    if (user) {
      request.user = {
        id: user.id,
        email: user.email,
        sessionId: user.sessionId
      }
      return
    }
  }

  // No valid authentication found
  return reply.status(401).send({
    success: false,
    error: 'Authentication required'
  })
}

/**
 * Optional authentication middleware
 * Attaches user to request if authenticated, but doesn't reject if not
 */
export async function optionalAuthenticate(
  request: FastifyRequest
) {
  // Check for Bearer token first
  const authHeader = request.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)

    // Try JWT first (RS256)
    const jwtPayload = verifyAccessToken(token)
    if (jwtPayload) {
      request.user = {
        id: jwtPayload.sub,
        email: jwtPayload.email || ''
      }
      return
    }

    // Try API key
    const user = await validateApiKey(token)
    if (user) {
      request.user = user
      return
    }
  }

  // Check for session cookie
  const sessionId = request.cookies.session_id
  if (sessionId) {
    const user = await validateSession(sessionId)
    if (user) {
      request.user = {
        id: user.id,
        email: user.email,
        sessionId: user.sessionId
      }
      return
    }
  }

  // No authentication, but that's okay - continue without user
}

/**
 * Helper to get the authenticated user or throw
 * Use this in route handlers to ensure user is authenticated
 * Alias: getUser
 */
export function requireUser(request: FastifyRequest): {
  id: string
  email: string
  sessionId?: string
} {
  if (!request.user) {
    throw new Error('User not authenticated')
  }
  return request.user
}

/**
 * Alias for requireUser - get authenticated user or throw
 */
export const getUser = requireUser

/**
 * Create a route protection middleware (preHandler)
 * Use this as a preHandler option in route definitions
 * Example: app.get('/protected', { preHandler: protectRoute() }, handler)
 */
export function protectRoute() {
  return authenticate
}
