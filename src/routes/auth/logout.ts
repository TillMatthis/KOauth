/**
 * POST /auth/logout
 * Logout user and invalidate session
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { deleteSession, SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../../lib/auth/session'

export async function logoutRoute(app: FastifyInstance) {
  app.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'logout' })

    try {
      // Get session ID from cookie
      const sessionId = request.cookies[SESSION_COOKIE_NAME]

      if (sessionId) {
        logger.info({ sessionId }, 'Deleting session')
        await deleteSession(sessionId)
      }

      // Clear cookies
      reply
        .clearCookie(SESSION_COOKIE_NAME, { path: '/' })
        .clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' })

      logger.info('Logout successful')

      return reply.code(200).send({
        success: true,
        message: 'Logged out successfully'
      })
    } catch (error) {
      logger.error({ error }, 'Logout failed')

      // Still clear cookies even on error
      reply
        .clearCookie(SESSION_COOKIE_NAME, { path: '/' })
        .clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' })

      return reply.code(200).send({
        success: true,
        message: 'Logged out successfully'
      })
    }
  })
}
