/**
 * POST /auth/token
 * Token exchange endpoint - same as login but returns JWT token only (no cookies)
 * Useful for programmatic access and MCP integrations
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { loginSchema } from '@/lib/auth/validation'
import { UnauthorizedError, ValidationError } from '@/lib/auth/errors'
import { generateAccessToken, createTokenResponse } from '@/lib/auth/jwt'
import { z } from 'zod'

interface TokenRequest extends FastifyRequest {
  body: {
    email: string
    password: string
  }
}

export async function tokenRoute(app: FastifyInstance) {
  app.post('/auth/token', async (request: TokenRequest, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'token' })

    try {
      // Validate input
      const { email, password } = loginSchema.parse(request.body)

      logger.info({ email }, 'Token exchange requested')

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        logger.warn({ email }, 'User not found')
        throw new UnauthorizedError('Invalid email or password')
      }

      // Verify password
      const isValidPassword = await verifyPassword(user.passwordHash, password)

      if (!isValidPassword) {
        logger.warn({ userId: user.id, email }, 'Invalid password')
        throw new UnauthorizedError('Invalid email or password')
      }

      logger.info({ userId: user.id, email }, 'Password verified')

      // Generate JWT access token (no session creation)
      const accessToken = generateAccessToken(
        user.id,
        user.email,
        app.config.JWT_SECRET,
        app.config.JWT_EXPIRES_IN
      )

      logger.info({ userId: user.id }, 'JWT access token issued')

      // Return token response (OAuth 2.0 standard format)
      return reply.code(200).send({
        success: true,
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

      logger.error({ error }, 'Token exchange failed')
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}
