/**
 * Auth routes index
 * Registers all authentication endpoints
 */

import type { FastifyInstance } from 'fastify'
import { signupRoute } from './signup'
import { loginRoute } from './login'
import { tokenRoute } from './token'
import { refreshRoute } from './refresh'
import { logoutRoute } from './logout'
import { googleAuthRoute, googleCallbackRoute } from './google'
import { githubAuthRoute, githubCallbackRoute } from './github'
import { verifyEmailRoute } from './verify-email'
import { resetPasswordRoute } from './reset-password'

/**
 * Register all auth routes
 * @param app - Fastify instance
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  await signupRoute(app)
  await loginRoute(app)
  await tokenRoute(app) // JWT token exchange endpoint (Task 1.5)
  await refreshRoute(app)
  await logoutRoute(app)

  // OAuth routes (Task 1.4)
  await googleAuthRoute(app)
  await googleCallbackRoute(app)
  await githubAuthRoute(app)
  await githubCallbackRoute(app)

  // Email verification and password reset routes (Phase 2)
  await app.register(verifyEmailRoute, { prefix: '/verify-email' })
  await app.register(resetPasswordRoute, { prefix: '/reset-password' })
}
