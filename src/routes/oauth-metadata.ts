/**
 * OAuth 2.0 Authorization Server Metadata Endpoint (RFC 8414)
 * Public endpoint for OAuth client auto-discovery
 * GET /.well-known/oauth-authorization-server - Returns server metadata
 */

import type { FastifyInstance } from 'fastify'

/**
 * Register the OAuth Authorization Server Metadata endpoint
 * This is a public endpoint (no authentication required)
 * Returns OAuth 2.0 server metadata per RFC 8414
 */
export async function oauthMetadataRoute(app: FastifyInstance) {
  app.get('/.well-known/oauth-authorization-server', async (request, reply) => {
    try {
      const issuer = app.config.JWT_ISSUER

      // OAuth 2.0 Authorization Server Metadata (RFC 8414)
      const metadata = {
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        registration_endpoint: `${issuer}/oauth/register`,
        scopes_supported: [
          'mcp:tools:read',
          'mcp:tools:execute',
          'kura:notes:read',
          'kura:notes:write',
          'kura:notes:delete',
          'openid',
          'profile',
          'email'
        ],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: [
          'client_secret_post',
          'client_secret_basic',
          'none'
        ],
        code_challenge_methods_supported: ['S256', 'plain']
      }

      // Set cache headers (cache for 1 hour)
      reply.header('Cache-Control', 'public, max-age=3600')
      reply.header('Content-Type', 'application/json')

      return reply.status(200).send(metadata)
    } catch (error) {
      request.log.error(error, 'Error generating OAuth metadata')
      return reply.status(500).send({
        error: 'Internal server error'
      })
    }
  })
}
