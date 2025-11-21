/**
 * Express integration for KOauth client
 */

import type { Application, Request, Response, NextFunction, RequestHandler } from 'express'
import type { KOauthOptions, KOauthUser } from './types'
import { validateAuth, parseCookies } from './core'

/**
 * Extend Express request to include user property
 */
declare global {
  namespace Express {
    interface Request {
      user?: KOauthUser
    }
  }
}

// Store options globally for Express (since it doesn't have app.decorate)
let expressKoauthOptions: KOauthOptions | null = null

/**
 * Initialize KOauth for Express
 * Stores configuration for authentication middleware
 *
 * @example
 * ```typescript
 * import express from 'express'
 * import { initKOauth } from '@tillmatthis/koauth-client'
 *
 * const app = express()
 * initKOauth(app, { baseUrl: 'https://auth.example.com' })
 * ```
 */
export function initKOauthExpress(
  app: Application,
  options: KOauthOptions
): void {
  expressKoauthOptions = options

  // Store options on app for potential access
  ;(app as any).koauthOptions = options
}

/**
 * Create Express middleware that requires authentication
 * Rejects requests with 401 if not authenticated
 *
 * @example
 * ```typescript
 * app.get('/protected', protectRoute(), (req, res) => {
 *   res.json({ user: req.user })
 * })
 * ```
 */
export function protectRouteExpress(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const options = expressKoauthOptions || (req.app as any).koauthOptions

    if (!options) {
      throw new Error('KOauth not initialized. Call initKOauth() first.')
    }

    // Get auth header
    const authHeader = req.headers.authorization

    // Get cookies (handle both parsed and unparsed)
    let cookies: Record<string, string | undefined> = {}
    if (req.cookies) {
      cookies = req.cookies
    } else if (req.headers.cookie) {
      cookies = parseCookies(req.headers.cookie)
    }

    // Validate authentication
    const user = await validateAuth(authHeader, cookies, options)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
    }

    // Attach user to request
    req.user = user
    next()
  }
}

/**
 * Create Express middleware for optional authentication
 * Attaches user if authenticated, but doesn't reject if not
 *
 * @example
 * ```typescript
 * app.get('/optional', optionalAuth(), (req, res) => {
 *   if (req.user) {
 *     res.json({ user: req.user })
 *   } else {
 *     res.json({ user: null })
 *   }
 * })
 * ```
 */
export function optionalAuthExpress(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const options = expressKoauthOptions || (req.app as any).koauthOptions

    if (!options) {
      return next() // No auth configured, continue without user
    }

    const authHeader = req.headers.authorization
    let cookies: Record<string, string | undefined> = {}
    if (req.cookies) {
      cookies = req.cookies
    } else if (req.headers.cookie) {
      cookies = parseCookies(req.headers.cookie)
    }

    const user = await validateAuth(authHeader, cookies, options)
    if (user) {
      req.user = user
    }
    next()
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
 * app.get('/me', protectRoute(), (req, res) => {
 *   const user = getUser(req)
 *   res.json({ user })
 * })
 * ```
 */
export function getUserExpress(req: Request): KOauthUser {
  if (!req.user) {
    throw new Error('User not authenticated')
  }
  return req.user
}

/**
 * Get authenticated user or return null
 * Use in route handlers with optional authentication
 *
 * @example
 * ```typescript
 * app.get('/feed', (req, res) => {
 *   const user = optionalUser(req)
 *   if (user) {
 *     res.json({ personalizedFeed: true, userId: user.id })
 *   } else {
 *     res.json({ personalizedFeed: false })
 *   }
 * })
 * ```
 */
export function optionalUserExpress(req: Request): KOauthUser | null {
  return req.user || null
}
