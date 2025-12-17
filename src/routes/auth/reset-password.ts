/**
 * Password reset routes
 * POST /api/auth/reset-password/request - Request password reset email
 * POST /api/auth/reset-password/verify - Verify token and reset password
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'
import { prisma } from '../../lib/prisma'
import { emailSchema, passwordSchema } from '../../lib/auth/validation'
import { ValidationError } from '../../lib/auth/errors'
import { createMagicLinkToken, verifyMagicLinkToken, invalidateUserMagicLinkTokens } from '../../lib/auth/magic-link'
import { sendPasswordReset } from '../../lib/email'
import { hashPassword } from '../../lib/auth/password'
import { z } from 'zod'

interface RequestResetBody {
  email: string
}

interface VerifyResetBody {
  token: string
  password: string
}

/**
 * Register password reset routes
 */
export async function resetPasswordRoute(app: FastifyInstance) {
  // Rate limit for password reset request endpoint (prevent abuse)
  await app.register(fastifyRateLimit, {
    max: 5, // 5 requests per hour
    timeWindow: '1 hour',
    cache: 10000,
    keyGenerator: (request) => {
      // Rate limit by IP address
      return request.ip
    },
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many password reset requests. Please try again later.'
    })
  })

  // POST /api/auth/reset-password/request - Request password reset email
  app.post(
    '/request',
    async (request: FastifyRequest<{ Body: RequestResetBody }>, reply: FastifyReply) => {
      const logger = request.log.child({ route: 'reset-password-request' })

      try {
        // Validate email
        const email = emailSchema.parse(request.body.email)

        logger.info({ email }, 'Password reset requested')

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email }
        })

        // Don't reveal if user exists (security best practice)
        // Always return success to prevent email enumeration
        if (!user) {
          logger.warn({ email }, 'User not found (not revealing to client)')
          return reply.code(200).send({
            success: true,
            message: 'If an account exists, a password reset email has been sent.'
          })
        }

        // Create magic link token
        const token = await createMagicLinkToken(user.id, 'password_reset')

        // Send password reset email (non-blocking - don't fail if email fails)
        const emailSent = await sendPasswordReset(app, email, token)
        if (!emailSent) {
          logger.warn({ userId: user.id, email }, 'Failed to send password reset email')
          // Still return success to prevent email enumeration
        }

        logger.info({ userId: user.id, email }, 'Password reset email sent')

        return reply.code(200).send({
          success: true,
          message: 'If an account exists, a password reset email has been sent.'
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.warn({ errors: error.errors }, 'Validation failed')
          return reply.code(400).send({
            success: false,
            error: 'Invalid email address',
            code: 'VALIDATION_ERROR',
            fields: error.flatten().fieldErrors
          })
        }

        logger.error({ error }, 'Error requesting password reset')
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  )

  // POST /api/auth/reset-password/verify - Verify token and reset password
  app.post(
    '/verify',
    async (request: FastifyRequest<{ Body: VerifyResetBody }>, reply: FastifyReply) => {
      const logger = request.log.child({ route: 'reset-password-verify' })

      try {
        // Validate input
        const { token, password } = z
          .object({
            token: z.string().min(1, 'Token is required'),
            password: passwordSchema
          })
          .parse(request.body)

        logger.info({ token }, 'Password reset verification attempted')

        // Verify token
        const userId = await verifyMagicLinkToken(token, 'password_reset')

        if (!userId) {
          logger.warn({ token }, 'Invalid or expired password reset token')
          return reply.code(400).send({
            success: false,
            error: 'Invalid or expired reset token',
            code: 'INVALID_TOKEN'
          })
        }

        // Hash new password
        const passwordHash = await hashPassword(password)

        // Update user password
        await prisma.user.update({
          where: { id: userId },
          data: { passwordHash }
        })

        // Invalidate all user sessions (security - force re-login)
        await prisma.session.deleteMany({
          where: { userId }
        })

        // Invalidate all password reset tokens for this user
        await invalidateUserMagicLinkTokens(userId, 'password_reset')

        logger.info({ userId }, 'Password reset successfully')

        return reply.code(200).send({
          success: true,
          message: 'Password has been reset successfully. Please log in with your new password.'
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.warn({ errors: error.errors }, 'Validation failed')
          return reply.code(400).send({
            success: false,
            error: 'Invalid input',
            code: 'VALIDATION_ERROR',
            fields: error.flatten().fieldErrors
          })
        }

        logger.error({ error }, 'Error resetting password')
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  )
}
