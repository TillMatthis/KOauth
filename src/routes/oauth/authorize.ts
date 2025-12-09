/**
 * OAuth 2.0 Authorization Endpoint
 * GET/POST /oauth/authorize - Initiate authorization code flow
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { optionalAuthenticate } from '../../lib/auth/middleware'
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

      request.log.info({
        msg: 'OAuth authorize request',
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        scope: params.scope,
        state: params.state,
        codeChallenge: params.code_challenge ? 'present' : 'missing',
        codeChallengeMethod: params.code_challenge_method,
        cookies: Object.keys(request.cookies || {}),
        hasSessionCookie: !!request.cookies.session_id,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      })

      // Check if user is logged in (populate request.user from session cookie)
      await optionalAuthenticate(request)
      if (!request.user) {
        request.log.info({ 
          msg: 'User not authenticated, redirecting to login',
          originalUrl: request.url,
          queryParams: request.query
        })
        // Redirect to login with return URL
        // request.url already includes the full path with query params
        const returnUrl = encodeURIComponent(request.url)
        request.log.info({ 
          msg: 'Redirecting to login',
          returnUrl,
          loginUrl: `/?redirect=${returnUrl}`
        })
        return reply.redirect(`/?redirect=${returnUrl}`)
      }

      request.log.info({
        msg: 'User authenticated',
        userId: request.user.id,
        sessionId: request.user.sessionId
      })

      const user = request.user

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
        request.log.warn({
          msg: 'Invalid redirect_uri - redirect URI mismatch',
          clientId: params.client_id,
          clientName: client.name,
          requestedRedirectUri: params.redirect_uri,
          allowedRedirectUris: client.redirectUris,
          redirectUriMatch: false,
          redirectUriExactMatch: client.redirectUris.includes(params.redirect_uri)
        })
        return reply.status(400).send({
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri'
        })
      }
      
      request.log.info({
        msg: 'Redirect URI validated successfully',
        clientId: params.client_id,
        clientName: client.name,
        redirectUri: params.redirect_uri,
        redirectUriMatch: true,
        allowedRedirectUris: client.redirectUris
      })

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
        request.log.info({
          msg: 'Client is trusted, auto-approving authorization',
          clientId: params.client_id,
          userId: user.id
        })
        return await approveAuthorization(reply, request, {
          userId: user.id,
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scopes: requestedScopes,
          state: params.state,
          codeChallenge: params.code_challenge,
          codeChallengeMethod: params.code_challenge_method
        })
      }

      // Redirect to React consent screen
      const consentUrl = new URL('/oauth/consent', `${request.protocol}://${request.hostname}`)
      // Preserve all query parameters
      Object.entries(request.query as Record<string, string>).forEach(([key, value]) => {
        consentUrl.searchParams.set(key, value)
      })
      return reply.redirect(consentUrl.toString())
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
      // Check if user is logged in (populate request.user from session cookie)
      await optionalAuthenticate(request)
      if (!request.user) {
        return reply.status(401).send({
          error: 'unauthorized',
          error_description: 'User not authenticated'
        })
      }

      const user = request.user

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
      return await approveAuthorization(reply, request, {
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
  request: FastifyRequest,
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

  request.log.info({
    msg: 'Authorization approved, redirecting back to client',
    redirectUrl: redirectUrl.toString(),
    codePrefix: code.substring(0, 10) + '...',
    codeLength: code.length,
    userId: params.userId,
    clientId: params.clientId,
    scopes: params.scopes,
    hasState: !!params.state
  })

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
