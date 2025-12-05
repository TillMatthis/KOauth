/**
 * OAuth 2.0 routes index
 * Registers all OAuth endpoints
 */

import type { FastifyInstance } from 'fastify'
import { authorizeRoute } from './authorize'
import { tokenRoute } from './token'
import { registerRoute } from './register'

/**
 * Register all OAuth routes
 */
export async function registerOAuthRoutes(app: FastifyInstance) {
  await authorizeRoute(app)
  await tokenRoute(app)
  await registerRoute(app)
}
