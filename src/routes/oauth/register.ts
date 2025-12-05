/**
 * OAuth 2.0 Dynamic Client Registration Endpoint (RFC 7591)
 * POST /oauth/register - Register a new OAuth client
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { hashToken } from '../../lib/auth/tokens'
import { prisma } from '../../lib/prisma'

// Request schema validation
const registerClientSchema = z.object({
  client_name: z.string().min(1).max(100),
  redirect_uris: z.array(z.string().url()).min(1),
  grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).default(['authorization_code', 'refresh_token']),
  response_types: z.array(z.enum(['code'])).default(['code']),
  scope: z.string().optional(),
  logo_uri: z.string().url().optional(),
  client_uri: z.string().url().optional(),
  token_endpoint_auth_method: z.enum(['client_secret_post', 'client_secret_basic', 'none']).default('client_secret_post')
})

type RegisterClientRequest = z.infer<typeof registerClientSchema>

/**
 * Generate a unique client ID
 */
function generateClientId(): string {
  return `client_${randomBytes(16).toString('hex')}`
}

/**
 * Generate a secure client secret
 */
function generateClientSecret(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Register OAuth client registration route
 */
export async function registerRoute(app: FastifyInstance) {
  app.post<{ Body: RegisterClientRequest }>(
    '/register',
    async (request: FastifyRequest<{ Body: RegisterClientRequest }>, reply: FastifyReply) => {
      try {
        request.log.info({
          msg: 'OAuth client registration request',
          clientName: (request.body as any)?.client_name,
          redirectUrisCount: Array.isArray((request.body as any)?.redirect_uris) 
            ? (request.body as any).redirect_uris.length 
            : 0,
          ip: request.ip,
          userAgent: request.headers['user-agent']
        })

        // Validate request body
        const validationResult = registerClientSchema.safeParse(request.body)

        if (!validationResult.success) {
          request.log.warn({
            msg: 'Invalid client registration request',
            errors: validationResult.error.errors
          })
          return reply.status(400).send({
            error: 'invalid_client_metadata',
            error_description: validationResult.error.message
          })
        }

        const data = validationResult.data

        request.log.info({
          msg: 'Client registration request validated',
          clientName: data.client_name,
          redirectUris: data.redirect_uris,
          grantTypes: data.grant_types,
          scopes: data.scope
        })

        // Parse requested scopes (default to basic scopes)
        const requestedScopes = data.scope
          ? data.scope.split(' ')
          : ['openid', 'profile', 'email']

        // Validate redirect URIs (must be HTTPS in production)
        const isProduction = app.config.NODE_ENV === 'production'
        for (const uri of data.redirect_uris) {
          const url = new URL(uri)

          // In production, require HTTPS (except localhost)
          if (isProduction && url.protocol !== 'https:' && url.hostname !== 'localhost') {
            return reply.status(400).send({
              error: 'invalid_redirect_uri',
              error_description: 'Redirect URIs must use HTTPS in production'
            })
          }
        }

        // Generate client credentials
        const clientId = generateClientId()
        const clientSecret = generateClientSecret()
        const clientSecretHash = await hashToken(clientSecret)

        // Create the OAuth client in database
        const client = await prisma.oAuthClient.create({
          data: {
            clientId,
            clientSecret: clientSecretHash,
            name: data.client_name,
            description: null,
            redirectUris: data.redirect_uris,
            grantTypes: data.grant_types,
            scopes: requestedScopes,
            logoUrl: data.logo_uri || null,
            websiteUrl: data.client_uri || null,
            trusted: false, // New clients are not trusted by default
            active: true
          }
        })

        request.log.info({
          msg: 'OAuth client registered successfully',
          clientId: client.clientId,
          clientName: client.name,
          redirectUris: client.redirectUris
        })

        // Return client registration response (RFC 7591)
        return reply.status(201).send({
          client_id: client.clientId,
          client_secret: clientSecret, // Return plaintext secret (only time it's visible)
          client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
          client_name: client.name,
          redirect_uris: client.redirectUris,
          grant_types: client.grantTypes,
          response_types: ['code'],
          token_endpoint_auth_method: data.token_endpoint_auth_method,
          scope: requestedScopes.join(' ')
        })
      } catch (error) {
        request.log.error({
          msg: 'Error registering OAuth client',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }, 'Error registering OAuth client')
        return reply.status(500).send({
          error: 'server_error',
          error_description: 'Failed to register client'
        })
      }
    }
  )
}
