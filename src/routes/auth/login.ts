/**
 * POST /auth/login
 * Authenticate user with email and password
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/session'
import { loginSchema } from '@/lib/auth/validation'
import { UnauthorizedError, ValidationError } from '@/lib/auth/errors'
import { z } from 'zod'

interface LoginRequest extends FastifyRequest {
  body: {
    email: string
    password: string
  }
}

export async function loginRoute(app: FastifyInstance) {
  app.post('/auth/login', async (request: LoginRequest, reply: FastifyReply) => {
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
          path: '/auth',
          expires: expiresAt
        })

      // Return user data (exclude sensitive fields)
      return reply.code(200).send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt
        }
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
