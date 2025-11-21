/**
 * Auth routes index
 * Registers all authentication endpoints
 */

import type { FastifyInstance } from 'fastify'
import { signupRoute } from './signup'
import { loginRoute } from './login'
import { refreshRoute } from './refresh'
import { logoutRoute } from './logout'

/**
 * Register all auth routes
 * @param app - Fastify instance
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  await signupRoute(app)
  await loginRoute(app)
  await refreshRoute(app)
  await logoutRoute(app)
}
