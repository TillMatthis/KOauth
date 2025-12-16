/**
 * Admin API routes index
 * All routes require admin authentication
 */

import type { FastifyInstance } from 'fastify'
import { userRoutes } from './users'
import { clientRoutes } from './clients'
import { statsRoutes } from './stats'

/**
 * Register all admin routes
 */
export async function registerAdminRoutes(app: FastifyInstance) {
  await userRoutes(app)
  await clientRoutes(app)
  await statsRoutes(app)
}
