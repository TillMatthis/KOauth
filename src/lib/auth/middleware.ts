/**
 * Authentication middleware
 * Supports both session cookies and Bearer token (API keys)
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { validateSession } from './session'
import { validateApiKey } from './apikey'

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
 * Authenticate request using either session cookie or Bearer token
 * This middleware checks both authentication methods in parallel:
 * 1. Session cookie (session_id)
 * 2. Bearer token (Authorization header with API key)
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Check for Bearer token first (Authorization header)
  const authHeader = request.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Validate API key
    const user = await validateApiKey(token)
    if (user) {
      request.user = user
      return
    }
    // If Bearer token is present but invalid, reject immediately
    // (don't fall through to session auth)
    return reply.status(401).send({
      success: false,
      error: 'Invalid API key'
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
