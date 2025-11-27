/**
 * API Key Validation Endpoint
 * Public endpoint for external services (like KURA Notes) to validate API keys
 * POST /api/validate-key - Validate an API key and return user info
 */

import type { FastifyInstance } from 'fastify'
import { validateApiKey } from '../lib/auth/apikey'
import { z } from 'zod'

// Validation schema
const validateKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required')
})

/**
 * Register the API key validation route
 * This is a public endpoint (no authentication required)
 * Rate limited to 100 requests per minute per IP
 */
export async function validateKeyRoute(app: FastifyInstance) {
  app.post(
    '/api/validate-key',
    {
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      try {
        // Validate request body
        const body = validateKeySchema.parse(request.body)

        // Validate the API key
        const user = await validateApiKey(body.apiKey)

        if (!user) {
          // Invalid or revoked key
          return reply.status(401).send({
            valid: false,
            error: 'Invalid or revoked API key'
          })
        }

        // Valid key - return user info
        return reply.status(200).send({
          valid: true,
          userId: user.id,
          email: user.email
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            valid: false,
            error: 'Invalid request data',
            details: error.errors
          })
        }

        // Log error but don't expose details for security
        request.log.error(error, 'Error validating API key')

        return reply.status(401).send({
          valid: false,
          error: 'Invalid or revoked API key'
        })
      }
    }
  )
}
