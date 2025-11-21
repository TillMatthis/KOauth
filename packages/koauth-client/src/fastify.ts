/**
 * Fastify integration for KOauth client
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { KOauthOptions, KOauthUser } from './types'
import { validateAuth, parseCookies } from './core'

/**
 * Extend Fastify request to include user property and optional cookies
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: KOauthUser
    cookies?: Record<string, string | undefined>
  }
}

/**
 * Initialize KOauth for Fastify
 * Registers request decorators for authentication
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify'
 * import { initKOauth } from '@tillmatthis/koauth-client'
 *
 * const app = Fastify()
 * initKOauth(app, { baseUrl: 'https://auth.example.com' })
 * ```
 */
export function initKOauthFastify(
  app: FastifyInstance,
  options: KOauthOptions
): void {
  // Store options on the app instance
  app.decorate('koauthOptions', options)

  // Add helper methods to request
  app.decorateRequest('koauthOptions', {
    getter() {
      return (this.server as any).koauthOptions
    }
  })
}

/**
 * Create Fastify preHandler middleware that requires authentication
 * Rejects requests with 401 if not authenticated
 *
 * @example
 * ```typescript
 * app.get('/protected', {
 *   preHandler: protectRoute()
 * }, async (request, reply) => {
 *   return { user: request.user }
 * })
 * ```
 */
export function protectRouteFastify() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const options = (request.server as any).koauthOptions as KOauthOptions

    if (!options) {
      throw new Error('KOauth not initialized. Call initKOauth() first.')
    }

    // Get auth header
    const authHeader = request.headers.authorization

    // Get cookies (handle both parsed and unparsed)
    let cookies: Record<string, string | undefined> = {}
    if (request.cookies) {
      cookies = request.cookies
    } else if (request.headers.cookie) {
      cookies = parseCookies(request.headers.cookie)
    }

    // Validate authentication
    const user = await validateAuth(authHeader, cookies, options)

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required'
      })
    }

    // Attach user to request
    request.user = user
  }
}

/**
 * Create Fastify preHandler middleware for optional authentication
 * Attaches user if authenticated, but doesn't reject if not
 *
 * @example
 * ```typescript
 * app.get('/optional', {
 *   preHandler: optionalAuth()
 * }, async (request, reply) => {
 *   if (request.user) {
 *     return { user: request.user }
 *   }
 *   return { user: null }
 * })
 * ```
 */
export function optionalAuthFastify() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const options = (request.server as any).koauthOptions as KOauthOptions

    if (!options) {
      return // No auth configured, continue without user
    }

    const authHeader = request.headers.authorization
    let cookies: Record<string, string | undefined> = {}
    if (request.cookies) {
      cookies = request.cookies
    } else if (request.headers.cookie) {
      cookies = parseCookies(request.headers.cookie)
    }

    const user = await validateAuth(authHeader, cookies, options)
    if (user) {
      request.user = user
    }
  }
}

/**
 * Get authenticated user or throw error
 * Use in route handlers after protectRoute() middleware
 *
 * @throws Error if user is not authenticated
 *
 * @example
 * ```typescript
 * app.get('/me', { preHandler: protectRoute() }, async (request) => {
 *   const user = getUser(request)
 *   return { user }
 * })
 * ```
 */
export function getUserFastify(request: FastifyRequest): KOauthUser {
  if (!request.user) {
    throw new Error('User not authenticated')
  }
  return request.user
}

/**
 * Get authenticated user or return null
 * Use in route handlers with optional authentication
 *
 * @example
 * ```typescript
 * app.get('/feed', async (request) => {
 *   const user = optionalUser(request)
 *   if (user) {
 *     return { personalizedFeed: true, userId: user.id }
 *   }
 *   return { personalizedFeed: false }
 * })
 * ```
 */
export function optionalUserFastify(request: FastifyRequest): KOauthUser | null {
  return request.user || null
}
