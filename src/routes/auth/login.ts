/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma'
import { verifyPassword } from '../../lib/auth/password'
import { createSession, SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../../lib/auth/session'
import { loginSchema } from '../../lib/auth/validation'
import { UnauthorizedError, ValidationError } from '../../lib/auth/errors'
import { generateAccessToken, createTokenResponse } from '../../lib/auth/jwt'
import { z } from 'zod'

interface LoginBody {
  email: string
  password: string
}

export async function loginRoute(app: FastifyInstance) {
  app.post('/login', async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'login' })

    try {
      // Validate input
      const { email, password } = loginSchema.parse(request.body)

      logger.info({ email }, 'Attempting login')

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        logger.warn({ email }, 'User not found')
        // Use generic error message to prevent user enumeration
        throw new UnauthorizedError('Invalid email or password')
      }

      // Verify password
      const isValidPassword = await verifyPassword(user.passwordHash, password)

      if (!isValidPassword) {
        logger.warn({ userId: user.id, email }, 'Invalid password')
        throw new UnauthorizedError('Invalid email or password')
      }

      logger.info({ userId: user.id, email }, 'Password verified')

      // Create session
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']
      const { sessionId, refreshToken, expiresAt } = await createSession(
        user.id,
        ipAddress,
        userAgent
      )

      logger.info({ userId: user.id, sessionId }, 'Session created')

      // Set HTTP-only cookies
      reply
        .setCookie(SESSION_COOKIE_NAME, sessionId, {
          httpOnly: true,
          secure: app.config.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          expires: expiresAt
        })
        .setCookie(REFRESH_COOKIE_NAME, refreshToken, {
          httpOnly: true,
          secure: app.config.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/api/auth',
          expires: expiresAt
        })

      // Generate JWT access token
      const accessToken = generateAccessToken(
        user.id,
        user.email,
        app.config.JWT_SECRET,
        app.config.JWT_EXPIRES_IN
      )

      logger.info({ userId: user.id }, 'JWT access token generated')

      // Return user data with JWT access token
      return reply.code(200).send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt
        },
        ...createTokenResponse(accessToken, app.config.JWT_EXPIRES_IN)
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({ errors: error.errors }, 'Validation failed')
        throw new ValidationError('Invalid input', error.flatten().fieldErrors as any)
      }

      if (error instanceof UnauthorizedError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code
        })
      }

      logger.error({ error }, 'Login failed')
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}
