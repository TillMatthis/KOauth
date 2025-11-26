/**
 * POST /auth/signup
 * Register a new user with email and password
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { createSession, SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/session'
import { signupSchema } from '@/lib/auth/validation'
import { ConflictError, ValidationError } from '@/lib/auth/errors'
import { z } from 'zod'

interface SignupBody {
  email: string
  password: string
}

export async function signupRoute(app: FastifyInstance) {
  app.post('/auth/signup', async (request: FastifyRequest<{ Body: SignupBody }>, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'signup' })

    try {
      // Validate input
      const { email, password } = signupSchema.parse(request.body)

      logger.info({ email }, 'Attempting signup')

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        logger.warn({ email }, 'User already exists')
        throw new ConflictError('User with this email already exists')
      }

      // Hash password using Argon2id
      const passwordHash = await hashPassword(password)

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          emailVerified: false // Can be enabled in Task 2.2
        }
      })

      logger.info({ userId: user.id, email }, 'User created successfully')

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
      return reply.code(201).send({
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

      if (error instanceof ConflictError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code
        })
      }

      logger.error({ error }, 'Signup failed')
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}
