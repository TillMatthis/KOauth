/**
 * Personal API keys routes
 * All routes require authentication (session-based)
 * POST   /api/me/api-keys      - Generate new key (return full key ONCE)
 * GET    /api/me/api-keys      - List all keys (without full keys)
 * DELETE /api/me/api-keys/:id  - Revoke a key
 */

import type { FastifyInstance } from 'fastify'
import { authenticate } from '@/lib/auth/middleware'
import {
  createApiKey,
  listApiKeys,
  revokeApiKey
} from '@/lib/auth/apikey'
import { z } from 'zod'

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().min(0).max(365).optional()
})

const deleteApiKeySchema = z.object({
  id: z.string().min(1)
})

/**
 * Register API key management routes
 */
export async function apiKeyRoutes(app: FastifyInstance) {
  // POST /api/me/api-keys - Generate new API key
  app.post(
    '/api/me/api-keys',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      try {
        // Validate request body
        const body = createApiKeySchema.parse(request.body)

        // Get authenticated user
        const user = request.user!

        // Check how many API keys the user already has
        const existingKeys = await listApiKeys(user.id)
        const MAX_KEYS = 10 // Could be moved to env config

        if (existingKeys.length >= MAX_KEYS) {
          return reply.status(400).send({
            success: false,
            error: `Maximum number of API keys (${MAX_KEYS}) reached. Please revoke an existing key first.`
          })
        }

        // Create the API key
        const { apiKey, fullKey } = await createApiKey(
          user.id,
          body.name,
          body.expiresInDays
        )

        // Log the creation
        request.log.info({
          userId: user.id,
          keyId: apiKey.id,
          keyName: apiKey.name
        }, 'API key created')

        // Return the full key (ONLY TIME IT'S RETURNED)
        return reply.status(201).send({
          success: true,
          message: 'API key created successfully. Save it now - you won\'t see it again!',
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            prefix: apiKey.prefix,
            key: fullKey, // ONLY RETURNED HERE
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt
          }
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid request data',
            details: error.errors
          })
        }

        request.log.error(error, 'Error creating API key')
        return reply.status(500).send({
          success: false,
          error: 'Failed to create API key'
        })
      }
    }
  )

  // GET /api/me/api-keys - List all API keys
  app.get(
    '/api/me/api-keys',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      try {
        const user = request.user!

        // List all keys for this user
        const apiKeys = await listApiKeys(user.id)

        return reply.status(200).send({
          success: true,
          apiKeys: apiKeys.map((key: any) => ({
            id: key.id,
            name: key.name,
            prefix: key.prefix,
            expiresAt: key.expiresAt,
            lastUsedAt: key.lastUsedAt,
            createdAt: key.createdAt
          }))
        })
      } catch (error) {
        request.log.error(error, 'Error listing API keys')
        return reply.status(500).send({
          success: false,
          error: 'Failed to list API keys'
        })
      }
    }
  )

  // DELETE /api/me/api-keys/:id - Revoke an API key
  app.delete(
    '/api/me/api-keys/:id',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      try {
        const user = request.user!
        const params = deleteApiKeySchema.parse(request.params)

        // Revoke the key
        const deleted = await revokeApiKey(user.id, params.id)

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: 'API key not found or already revoked'
          })
        }

        request.log.info({
          userId: user.id,
          keyId: params.id
        }, 'API key revoked')

        return reply.status(200).send({
          success: true,
          message: 'API key revoked successfully'
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid request data',
            details: error.errors
          })
        }

        request.log.error(error, 'Error revoking API key')
        return reply.status(500).send({
          success: false,
          error: 'Failed to revoke API key'
        })
      }
    }
  )
}
