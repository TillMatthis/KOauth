/**
 * OAuth 2.0 Authorization Server Metadata Endpoint (RFC 8414)
 * Public endpoint for OAuth client auto-discovery
 * GET /.well-known/oauth-authorization-server - Returns server metadata
 * 
 * OAuth 2.0 Protected Resource Metadata Endpoint (RFC 9728)
 * Public endpoint for resource server auto-discovery
 * GET /.well-known/oauth-protected-resource - Returns resource server metadata
 */

import type { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'

/**
 * Register the OAuth Authorization Server Metadata endpoint
 * This is a public endpoint (no authentication required)
 * Returns OAuth 2.0 server metadata per RFC 8414
 * 
 * CRITICAL: This endpoint MUST be publicly accessible and never return 401/403
 * It's a discovery endpoint used by OAuth clients (like Claude Custom Connector)
 * 
 * NOTE: Uses route-scoped CORS without credentials to allow wildcard origin (*)
 * This is incompatible with the global CORS config that uses credentials: true
 */
export async function oauthMetadataRoute(app: FastifyInstance) {
  // Register route-scoped CORS for this endpoint only
  // This allows wildcard origin (*) without credentials, which is required
  // for public discovery endpoints per RFC 8414
  // NOTE: credentials: false is required when using origin: '*' per CORS spec
  await app.register(async (routeScope) => {
    await routeScope.register(fastifyCors, {
      origin: '*', // Wildcard origin - requires credentials: false
      credentials: false // Must be false when using wildcard origin
    })

    routeScope.get('/.well-known/oauth-authorization-server', async (request, reply) => {
      try {
        const issuer = app.config.JWT_ISSUER

        // OAuth 2.0 Authorization Server Metadata (RFC 8414)
        // REQUIRED fields
        const metadata = {
          issuer,
          authorization_endpoint: `${issuer}/oauth/authorize`,
          token_endpoint: `${issuer}/oauth/token`,
          jwks_uri: `${issuer}/.well-known/jwks.json`,
          // RECOMMENDED fields
          scopes_supported: [
            'openid',
            'profile',
            'email',
            'mcp:tools:read',
            'mcp:tools:execute',
            'kura:notes:read',
            'kura:notes:write',
            'kura:notes:delete'
          ],
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          // CRITICAL: S256 is REQUIRED for Claude Custom Connector support
          code_challenge_methods_supported: ['S256', 'plain'],
          token_endpoint_auth_methods_supported: [
            'client_secret_post',
            'client_secret_basic'
          ],
          // Optional but useful
          registration_endpoint: `${issuer}/oauth/register`
        }

        // Set cache headers (cache for 1 hour)
        reply.header('Cache-Control', 'public, max-age=3600')
        reply.header('Content-Type', 'application/json')

        return reply.status(200).send(metadata)
      } catch (error) {
        request.log.error(error, 'Error generating OAuth metadata')
        // Never return 401/403 - this is a public discovery endpoint
        // Return 500 instead if there's an error
        return reply.status(500).send({
          error: 'Internal server error'
        })
      }
    })
  })
}

/**
 * Register the OAuth Protected Resource Metadata endpoint (RFC 9728)
 * This is a public endpoint (no authentication required)
 * Returns OAuth 2.0 protected resource metadata per RFC 9728
 * Used by resource servers (like KOmcp) to discover how to authenticate with KOauth
 */
export async function oauthProtectedResourceRoute(app: FastifyInstance) {
  app.get('/.well-known/oauth-protected-resource', async (request, reply) => {
    try {
      const issuer = app.config.JWT_ISSUER

      // OAuth 2.0 Protected Resource Metadata (RFC 9728)
      const metadata = {
        resource: issuer, // Resource server identifier (KOauth itself)
        authorization_servers: [issuer], // Array of authorization server URLs
        jwks_uri: `${issuer}/.well-known/jwks.json`, // JWKS endpoint for token verification
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
        bearer_methods_supported: ['header'] // Supported bearer token methods
      }

      // Set cache headers (cache for 1 hour)
      reply.header('Cache-Control', 'public, max-age=3600')
      reply.header('Content-Type', 'application/json')

      return reply.status(200).send(metadata)
    } catch (error) {
      request.log.error(error, 'Error generating OAuth protected resource metadata')
      return reply.status(500).send({
        error: 'Internal server error'
      })
    }
  })
}
