/**
 * Email verification routes
 * POST /api/auth/verify-email/request - Request verification email
 * GET /api/auth/verify-email/:token - Verify email via magic link token
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'
import { prisma } from '../../lib/prisma'
import { emailSchema } from '../../lib/auth/validation'
import { ValidationError } from '../../lib/auth/errors'
import { createMagicLinkToken, verifyMagicLinkToken } from '../../lib/auth/magic-link'
import { sendEmailVerification } from '../../lib/email'
import { z } from 'zod'

interface RequestVerificationBody {
  email: string
}

/**
 * Register email verification routes
 */
export async function verifyEmailRoute(app: FastifyInstance) {
  // Rate limit for email request endpoint (prevent abuse)
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
      message: 'Too many verification email requests. Please try again later.'
    })
  })

  // POST /api/auth/verify-email/request - Request verification email
  app.post(
    '/request',
    async (request: FastifyRequest<{ Body: RequestVerificationBody }>, reply: FastifyReply) => {
      const logger = request.log.child({ route: 'verify-email-request' })

      try {
        // Validate email
        const email = emailSchema.parse(request.body.email)

        logger.info({ email }, 'Verification email requested')

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
            message: 'If an account exists, a verification email has been sent.'
          })
        }

        // Check if already verified
        if (user.emailVerified) {
          logger.info({ userId: user.id, email }, 'Email already verified')
          return reply.code(200).send({
            success: true,
            message: 'Email is already verified.'
          })
        }

        // Create magic link token
        const token = await createMagicLinkToken(user.id, 'email_verification')

        // Send verification email (non-blocking - don't fail if email fails)
        const emailSent = await sendEmailVerification(app, email, token)
        if (!emailSent) {
          logger.warn({ userId: user.id, email }, 'Failed to send verification email')
          // Still return success to prevent email enumeration
        }

        logger.info({ userId: user.id, email }, 'Verification email sent')

        return reply.code(200).send({
          success: true,
          message: 'If an account exists, a verification email has been sent.'
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

        logger.error({ error }, 'Error requesting verification email')
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  )

  // GET /api/auth/verify-email/:token - Verify email via magic link
  app.get(
    '/:token',
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      const logger = request.log.child({ route: 'verify-email' })
      const { token } = request.params

      try {
        // Verify token
        const userId = await verifyMagicLinkToken(token, 'email_verification')

        if (!userId) {
          logger.warn({ token }, 'Invalid or expired verification token')
          // Redirect to frontend error page
          const baseUrl = app.config.JWT_ISSUER || 'http://localhost:3000'
          return reply.redirect(`${baseUrl}/verify-email?error=invalid_token`)
        }

        // Update user email verification status
        await prisma.user.update({
          where: { id: userId },
          data: { emailVerified: true }
        })

        logger.info({ userId }, 'Email verified successfully')

        // Redirect to success page
        const baseUrl = app.config.JWT_ISSUER || 'http://localhost:3000'
        return reply.redirect(`${baseUrl}/verify-email?success=true`)
      } catch (error) {
        logger.error({ error, token }, 'Error verifying email')
        const baseUrl = app.config.JWT_ISSUER || 'http://localhost:3000'
        return reply.redirect(`${baseUrl}/verify-email?error=server_error`)
      }
    }
  )
}
