/**
 * OAuth 2.0 Token Endpoint
 * POST /oauth/token - Exchange authorization code for access token
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  validateClientCredentials,
  exchangeAuthorizationCode,
  refreshAccessToken
} from '../../lib/auth/oauth-server'

// Token request schema for authorization code grant
const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(1),
    redirect_uri: z.string().url(),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    code_verifier: z.string().optional() // PKCE
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(1),
    client_id: z.string().min(1),
    client_secret: z.string().min(1)
  })
])

/**
 * OAuth token endpoint
 */
export async function tokenRoute(app: FastifyInstance) {
  app.post('/token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse request body
      const body = tokenRequestSchema.parse(request.body)

      // Validate client credentials
      const client = await validateClientCredentials(body.client_id, body.client_secret)
      if (!client) {
        return reply.status(401).send({
          error: 'invalid_client',
          error_description: 'Invalid client credentials'
        })
      }

      // Handle different grant types
      if (body.grant_type === 'authorization_code') {
        return await handleAuthorizationCodeGrant(request, reply, body)
      } else if (body.grant_type === 'refresh_token') {
        return await handleRefreshTokenGrant(request, reply, body)
      }

      return reply.status(400).send({
        error: 'unsupported_grant_type',
        error_description: 'Grant type not supported'
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'invalid_request',
          error_description: 'Invalid request parameters',
          details: error.errors
        })
      }

      request.log.error(error, 'Token endpoint error')
      return reply.status(500).send({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    }
  })
}

/**
 * Handle authorization code grant
 */
async function handleAuthorizationCodeGrant(
  request: FastifyRequest,
  reply: FastifyReply,
  body: {
    grant_type: 'authorization_code'
    code: string
    redirect_uri: string
    client_id: string
    client_secret: string
    code_verifier?: string
  }
) {
  const app = request.server
  const rsaKeys = (app as any).rsaKeys
  const audience = (app as any).jwtAudience

  const result = await exchangeAuthorizationCode({
    code: body.code,
    clientId: body.client_id,
    redirectUri: body.redirect_uri,
    codeVerifier: body.code_verifier,
    rsaKeys,
    jwtExpiresIn: app.config.JWT_EXPIRES_IN,
    issuer: app.config.JWT_ISSUER,
    audience
  })

  if (!result) {
    return reply.status(400).send({
      error: 'invalid_grant',
      error_description: 'Invalid or expired authorization code'
    })
  }

  return reply.status(200).send({
    access_token: result.accessToken,
    token_type: 'Bearer',
    expires_in: result.expiresIn,
    refresh_token: result.refreshToken,
    scope: 'openid profile email',
    // OpenID Connect ID token (optional - can implement later)
    // id_token: generateIdToken(result.userId, result.email)
  })
}

/**
 * Handle refresh token grant
 */
async function handleRefreshTokenGrant(
  request: FastifyRequest,
  reply: FastifyReply,
  body: {
    grant_type: 'refresh_token'
    refresh_token: string
    client_id: string
    client_secret: string
  }
) {
  const app = request.server
  const rsaKeys = (app as any).rsaKeys
  const audience = (app as any).jwtAudience

  const result = await refreshAccessToken({
    refreshToken: body.refresh_token,
    clientId: body.client_id,
    rsaKeys,
    jwtExpiresIn: app.config.JWT_EXPIRES_IN,
    issuer: app.config.JWT_ISSUER,
    audience
  })

  if (!result) {
    return reply.status(400).send({
      error: 'invalid_grant',
      error_description: 'Invalid or expired refresh token'
    })
  }

  return reply.status(200).send({
    access_token: result.accessToken,
    token_type: 'Bearer',
    expires_in: result.expiresIn,
    refresh_token: result.refreshToken,
    scope: 'openid profile email'
  })
}
