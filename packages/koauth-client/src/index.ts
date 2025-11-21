/**
 * @tillmatthis/koauth-client
 *
 * Zero-dependency TypeScript client SDK for KOauth authentication.
 * Works seamlessly with both Fastify and Express applications.
 *
 * @example Fastify
 * ```typescript
 * import Fastify from 'fastify'
 * import { initKOauth, protectRoute, getUser } from '@tillmatthis/koauth-client'
 *
 * const app = Fastify()
 * initKOauth(app, { baseUrl: 'https://auth.example.com' })
 *
 * app.get('/protected', { preHandler: protectRoute() }, async (request) => {
 *   const user = getUser(request)
 *   return { user }
 * })
 * ```
 *
 * @example Express
 * ```typescript
 * import express from 'express'
 * import { initKOauth, protectRoute, getUser } from '@tillmatthis/koauth-client'
 *
 * const app = express()
 * initKOauth(app, { baseUrl: 'https://auth.example.com' })
 *
 * app.get('/protected', protectRoute(), (req, res) => {
 *   const user = getUser(req)
 *   res.json({ user })
 * })
 * ```
 *
 * @packageDocumentation
 */

import type { Application } from 'express'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { KOauthOptions, KOauthUser, KOauthRequest } from './types'

import {
  initKOauthFastify,
  protectRouteFastify,
  optionalAuthFastify,
  getUserFastify,
  optionalUserFastify
} from './fastify'

import {
  initKOauthExpress,
  protectRouteExpress,
  optionalAuthExpress,
  getUserExpress,
  optionalUserExpress
} from './express'

/**
 * Detect if the app is a Fastify or Express instance
 */
function isFastify(app: any): app is FastifyInstance {
  return typeof app.decorate === 'function' && typeof app.register === 'function'
}

function isExpress(app: any): app is Application {
  return typeof app.use === 'function' && typeof app.get === 'function' && !isFastify(app)
}

/**
 * Initialize KOauth client with your auth server URL.
 * Automatically detects whether you're using Fastify or Express.
 *
 * @param app - Fastify or Express app instance
 * @param options - Configuration options including baseUrl
 *
 * @example Fastify
 * ```typescript
 * import Fastify from 'fastify'
 * import { initKOauth } from '@tillmatthis/koauth-client'
 *
 * const app = Fastify()
 * initKOauth(app, { baseUrl: 'https://auth.example.com' })
 * ```
 *
 * @example Express
 * ```typescript
 * import express from 'express'
 * import { initKOauth } from '@tillmatthis/koauth-client'
 *
 * const app = express()
 * initKOauth(app, { baseUrl: 'https://auth.example.com' })
 * ```
 */
export function initKOauth(
  app: FastifyInstance | Application,
  options: KOauthOptions
): void {
  if (isFastify(app)) {
    initKOauthFastify(app, options)
  } else if (isExpress(app)) {
    initKOauthExpress(app, options)
  } else {
    throw new Error('Unsupported framework. KOauth supports Fastify and Express.')
  }
}

/**
 * Create middleware/decorator that requires authentication.
 * Rejects requests with 401 if not authenticated.
 * Automatically detects framework and returns appropriate middleware.
 *
 * Supported authentication methods (automatic):
 * - Session cookies (session_id)
 * - Bearer API keys (Authorization: Bearer koa_...)
 * - Bearer JWT tokens (Authorization: Bearer eyJ...)
 *
 * @returns Framework-specific middleware function
 *
 * @example Fastify
 * ```typescript
 * app.get('/protected', {
 *   preHandler: protectRoute()
 * }, async (request, reply) => {
 *   const user = getUser(request)
 *   return { user }
 * })
 * ```
 *
 * @example Express
 * ```typescript
 * app.get('/protected', protectRoute(), (req, res) => {
 *   const user = getUser(req)
 *   res.json({ user })
 * })
 * ```
 */
export function protectRoute(): any {
  // Return a wrapper that detects the framework at runtime
  return async function (req: any, res: any, next?: any) {
    // Fastify detection: has reply.send and no next callback
    if (res && typeof res.send === 'function' && !next) {
      return await protectRouteFastify()(req, res)
    }
    // Express detection: has res.json and next callback
    if (res && typeof res.json === 'function' && next) {
      return await protectRouteExpress()(req, res, next)
    }
    throw new Error('Unsupported framework detected in protectRoute()')
  }
}

/**
 * Create middleware/decorator for optional authentication.
 * Attaches user if authenticated, but doesn't reject if not.
 * Automatically detects framework and returns appropriate middleware.
 *
 * @returns Framework-specific middleware function
 *
 * @example Fastify
 * ```typescript
 * app.get('/feed', {
 *   preHandler: optionalAuth()
 * }, async (request) => {
 *   const user = optionalUser(request)
 *   return { user }
 * })
 * ```
 *
 * @example Express
 * ```typescript
 * app.get('/feed', optionalAuth(), (req, res) => {
 *   const user = optionalUser(req)
 *   res.json({ user })
 * })
 * ```
 */
export function optionalAuth(): any {
  return async function (req: any, res: any, next?: any) {
    if (res && typeof res.send === 'function' && !next) {
      return await optionalAuthFastify()(req, res)
    }
    if (res && typeof res.json === 'function' && next) {
      return await optionalAuthExpress()(req, res, next)
    }
    throw new Error('Unsupported framework detected in optionalAuth()')
  }
}

/**
 * Get authenticated user from request or throw error.
 * Use in route handlers after protectRoute() middleware.
 *
 * @param request - Request object (Fastify or Express)
 * @returns Authenticated user object
 * @throws Error if user is not authenticated
 *
 * @example Fastify
 * ```typescript
 * app.get('/me', { preHandler: protectRoute() }, async (request) => {
 *   const user = getUser(request)
 *   return { id: user.id, email: user.email }
 * })
 * ```
 *
 * @example Express
 * ```typescript
 * app.get('/me', protectRoute(), (req, res) => {
 *   const user = getUser(req)
 *   res.json({ id: user.id, email: user.email })
 * })
 * ```
 */
export function getUser(request: KOauthRequest): KOauthUser {
  // Works the same for both frameworks
  if (!request.user) {
    throw new Error('User not authenticated')
  }
  return request.user
}

/**
 * Get authenticated user from request or return null.
 * Use in route handlers with optional authentication.
 *
 * @param request - Request object (Fastify or Express)
 * @returns Authenticated user object or null
 *
 * @example Fastify
 * ```typescript
 * app.get('/feed', async (request) => {
 *   const user = optionalUser(request)
 *   if (user) {
 *     return { personalized: true, userId: user.id }
 *   }
 *   return { personalized: false }
 * })
 * ```
 *
 * @example Express
 * ```typescript
 * app.get('/feed', (req, res) => {
 *   const user = optionalUser(req)
 *   if (user) {
 *     res.json({ personalized: true, userId: user.id })
 *   } else {
 *     res.json({ personalized: false })
 *   }
 * })
 * ```
 */
export function optionalUser(request: KOauthRequest): KOauthUser | null {
  return request.user || null
}

// Re-export types for convenience
export type { KOauthOptions, KOauthUser, KOauthRequest } from './types'

// Re-export framework-specific functions for advanced use cases
export {
  initKOauthFastify,
  protectRouteFastify,
  optionalAuthFastify,
  getUserFastify,
  optionalUserFastify,
  initKOauthExpress,
  protectRouteExpress,
  optionalAuthExpress,
  getUserExpress,
  optionalUserExpress
}
