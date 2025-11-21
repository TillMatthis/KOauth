/**
 * /api/me routes index
 * User-specific endpoints (profile, API keys, etc.)
 */

import type { FastifyInstance } from 'fastify'
import { apiKeyRoutes } from './api-keys'

/**
 * Register all /api/me routes
 */
export async function registerMeRoutes(app: FastifyInstance) {
  await apiKeyRoutes(app)
}
