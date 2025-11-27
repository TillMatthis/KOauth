/**
 * POST /auth/refresh
 * Refresh a session using refresh token rotation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { refreshSession, SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../../lib/auth/session'
import { UnauthorizedError } from '../../lib/auth/errors'

interface RefreshBody {
  refreshToken?: string
}

export async function refreshRoute(app: FastifyInstance) {
  app.post('/refresh', async (request: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'refresh' })

    try {
      // Get session ID from cookie
      const sessionId = request.cookies[SESSION_COOKIE_NAME]
      if (!sessionId) {
        logger.warn('No session cookie found')
        throw new UnauthorizedError('No session found')
      }

      // Get refresh token from cookie or body
      const refreshToken =
        request.cookies[REFRESH_COOKIE_NAME] || request.body.refreshToken

      if (!refreshToken) {
        logger.warn({ sessionId }, 'No refresh token found')
        throw new UnauthorizedError('No refresh token found')
      }

      logger.info({ sessionId }, 'Attempting session refresh')

      // Refresh session (implements token rotation)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const newSession = await refreshSession(
        sessionId,
        refreshToken,
        ipAddress,
        userAgent
      )

      logger.info(
        { oldSessionId: sessionId, newSessionId: newSession.sessionId },
        'Session refreshed successfully'
      )

      // Set new cookies
      reply
        .setCookie(SESSION_COOKIE_NAME, newSession.sessionId, {
          httpOnly: true,
          secure: app.config.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          expires: newSession.expiresAt
        })
        .setCookie(REFRESH_COOKIE_NAME, newSession.refreshToken, {
          httpOnly: true,
          secure: app.config.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/api/auth',
          expires: newSession.expiresAt
        })

      return reply.code(200).send({
        success: true,
        message: 'Session refreshed'
      })
    } catch (error) {
      logger.error({ error }, 'Session refresh failed')

      // Clear cookies on error
      reply
        .clearCookie(SESSION_COOKIE_NAME, { path: '/' })
        .clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' })

      if (error instanceof Error && error.message.includes('Invalid refresh token')) {
        // Possible token reuse attack - all user sessions have been invalidated
        return reply.code(401).send({
          success: false,
          error: 'Invalid refresh token. All sessions have been invalidated.',
          code: 'TOKEN_REUSE_DETECTED'
        })
      }

      return reply.code(401).send({
        success: false,
        error: 'Session refresh failed',
        code: 'UNAUTHORIZED'
      })
    }
  })
}
