/**
 * /api/me routes index
 * User-specific endpoints (profile, API keys, etc.)
 */

import type { FastifyInstance } from 'fastify'
import { authenticate, getUser } from '../../../lib/auth/middleware'
import { apiKeyRoutes } from './api-keys'

/**
 * Register all /api/me routes
 */
export async function registerMeRoutes(app: FastifyInstance) {
  // GET /api/me - Get current user info
  // Protected by session cookie, API key, or JWT Bearer token
  app.get(
    '/api/me',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      try {
        const user = getUser(request)

        return reply.status(200).send({
          success: true,
          user: {
            id: user.id,
            email: user.email
          }
        })
      } catch (error) {
        request.log.error(error, 'Error fetching user info')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch user info'
        })
      }
    }
  )

  // API key management routes
  await apiKeyRoutes(app)
}
