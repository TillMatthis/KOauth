/**
 * OAuth 2.0 Authorization Endpoint
 * GET/POST /oauth/authorize - Initiate authorization code flow
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { getUser } from '../../lib/auth/middleware'
import {
  getClientById,
  validateRedirectUri,
  validateScopes,
  createAuthorizationCode
} from '../../lib/auth/oauth-server'

// Query parameter schema
const authorizeSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional().default('openid profile email'),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['plain', 'S256']).optional()
})

/**
 * OAuth authorization endpoint
 */
export async function authorizeRoute(app: FastifyInstance) {
  // GET /oauth/authorize - Show consent screen or auto-approve
  app.get('/authorize', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse and validate query parameters
      const params = authorizeSchema.parse(request.query)

      // Check if user is logged in
      const user = getUser(request)
      if (!user) {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(request.url)
        return reply.redirect(`/?redirect=/oauth${returnUrl}`)
      }

      // Validate client
      const client = await getClientById(params.client_id)
      if (!client || !client.active) {
        return reply.status(400).send({
          error: 'invalid_client',
          error_description: 'Invalid or inactive client'
        })
      }

      // Validate redirect URI
      if (!validateRedirectUri(client, params.redirect_uri)) {
        return reply.status(400).send({
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri'
        })
      }

      // Parse and validate scopes
      const requestedScopes = params.scope.split(' ')
      if (!validateScopes(client, requestedScopes)) {
        return redirectWithError(
          reply,
          params.redirect_uri,
          'invalid_scope',
          'Requested scopes not allowed for this client',
          params.state
        )
      }

      // If client is trusted, skip consent screen
      if (client.trusted) {
        return await approveAuthorization(reply, {
          userId: user.id,
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scopes: requestedScopes,
          state: params.state,
          codeChallenge: params.code_challenge,
          codeChallengeMethod: params.code_challenge_method
        })
      }

      // Show consent screen
      return reply.view('consent', {
        client,
        scopes: requestedScopes,
        user,
        params
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'invalid_request',
          error_description: 'Invalid request parameters',
          details: error.errors
        })
      }

      request.log.error(error, 'Authorization error')
      return reply.status(500).send({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    }
  })

  // POST /oauth/authorize - Handle consent form submission
  app.post('/authorize', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getUser(request)
      if (!user) {
        return reply.status(401).send({
          error: 'unauthorized',
          error_description: 'User not authenticated'
        })
      }

      const body = request.body as any
      const params = authorizeSchema.parse(body)

      // Check if user approved
      if (body.approved !== 'true') {
        return redirectWithError(
          reply,
          params.redirect_uri,
          'access_denied',
          'User denied authorization',
          params.state
        )
      }

      // Validate client again
      const client = await getClientById(params.client_id)
      if (!client || !client.active) {
        return reply.status(400).send({
          error: 'invalid_client',
          error_description: 'Invalid or inactive client'
        })
      }

      // Approve authorization
      return await approveAuthorization(reply, {
        userId: user.id,
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        scopes: params.scope.split(' '),
        state: params.state,
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method
      })
    } catch (error) {
      request.log.error(error, 'Authorization approval error')
      return reply.status(500).send({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    }
  })
}

/**
 * Approve authorization and redirect with code
 */
async function approveAuthorization(
  reply: FastifyReply,
  params: {
    userId: string
    clientId: string
    redirectUri: string
    scopes: string[]
    state?: string
    codeChallenge?: string
    codeChallengeMethod?: string
  }
) {
  // Generate authorization code
  const code = await createAuthorizationCode({
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    scopes: params.scopes,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod
  })

  // Build redirect URL
  const redirectUrl = new URL(params.redirectUri)
  redirectUrl.searchParams.set('code', code)
  if (params.state) {
    redirectUrl.searchParams.set('state', params.state)
  }

  return reply.redirect(redirectUrl.toString())
}

/**
 * Redirect with OAuth error
 */
function redirectWithError(
  reply: FastifyReply,
  redirectUri: string,
  error: string,
  errorDescription: string,
  state?: string
) {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', errorDescription)
  if (state) {
    url.searchParams.set('state', state)
  }

  return reply.redirect(url.toString())
}
