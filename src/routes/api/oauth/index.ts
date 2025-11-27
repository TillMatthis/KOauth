/**
 * /api/oauth routes index
 * OAuth client public API endpoints
 */

import type { FastifyInstance } from 'fastify'
import { clientInfoRoutes } from './clients'

/**
 * Register all /api/oauth routes
 */
export async function registerOAuthApiRoutes(app: FastifyInstance) {
  await clientInfoRoutes(app)
}
