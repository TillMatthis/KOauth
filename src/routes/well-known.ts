/**
 * .well-known endpoints for OAuth 2.0 and JWKS
 * These are public endpoints for OAuth discovery and key distribution
 */

import type { FastifyInstance } from 'fastify'
import { rsaKeyManager } from '../lib/auth/rsa-keys'

/**
 * Register .well-known routes
 */
export async function registerWellKnownRoutes(app: FastifyInstance) {
  /**
   * JWKS (JSON Web Key Set) endpoint
   * Returns the public keys used to verify JWT signatures
   * RFC 7517: https://tools.ietf.org/html/rfc7517
   */
  app.get('/.well-known/jwks.json', async (request, reply) => {
    const jwks = rsaKeyManager.getJWKS()

    // Set cache headers for public key distribution
    reply.header('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    reply.header('Content-Type', 'application/json')

    return jwks
  })

  /**
   * OAuth 2.0 Authorization Server Metadata endpoint
   * RFC 8414: https://tools.ietf.org/html/rfc8414
   * OpenID Connect Discovery: https://openid.net/specs/openid-connect-discovery-1_0.html
   */
  app.get('/.well-known/oauth-authorization-server', async (request, reply) => {
    const issuer = process.env.JWT_ISSUER || 'https://auth.tillmaessen.de'
    const baseUrl = issuer

    const metadata = {
      issuer,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,

      // Supported response types
      response_types_supported: ['code'],

      // Supported grant types
      grant_types_supported: [
        'authorization_code',
        'refresh_token'
      ],

      // Supported token endpoint authentication methods
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic'
      ],

      // Supported scopes
      scopes_supported: [
        'openid',
        'profile',
        'email',
        'mcp:tools:read',
        'mcp:tools:execute',
        'kura:notes:search'
      ],

      // Code challenge methods for PKCE
      code_challenge_methods_supported: ['S256', 'plain'],

      // Supported signing algorithms
      token_endpoint_auth_signing_alg_values_supported: ['RS256'],
      id_token_signing_alg_values_supported: ['RS256'],

      // Service documentation
      service_documentation: 'https://github.com/TillMatthis/KOauth',

      // UI locales supported (can be extended)
      ui_locales_supported: ['en-US'],

      // Additional endpoints
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      introspection_endpoint: `${baseUrl}/oauth/introspect`,

      // Claims supported (for OpenID Connect)
      claims_supported: [
        'sub',
        'email',
        'email_verified',
        'iss',
        'aud',
        'exp',
        'iat',
        'client_id',
        'scope'
      ]
    }

    // Set cache headers
    reply.header('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    reply.header('Content-Type', 'application/json')

    return metadata
  })

  /**
   * OpenID Connect Discovery endpoint (alias)
   * Many clients look for this endpoint specifically
   */
  app.get('/.well-known/openid-configuration', async (request, reply) => {
    const issuer = process.env.JWT_ISSUER || 'https://auth.tillmaessen.de'
    const baseUrl = issuer

    const configuration = {
      issuer,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      userinfo_endpoint: `${baseUrl}/api/me`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,

      // Supported response types
      response_types_supported: ['code'],

      // Supported subject types
      subject_types_supported: ['public'],

      // Supported ID token signing algorithms
      id_token_signing_alg_values_supported: ['RS256'],

      // Supported scopes
      scopes_supported: [
        'openid',
        'profile',
        'email',
        'mcp:tools:read',
        'mcp:tools:execute',
        'kura:notes:search'
      ],

      // Supported token endpoint authentication methods
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic'
      ],

      // Supported claims
      claims_supported: [
        'sub',
        'email',
        'email_verified',
        'name',
        'picture',
        'iss',
        'aud',
        'exp',
        'iat'
      ],

      // Code challenge methods for PKCE
      code_challenge_methods_supported: ['S256', 'plain'],

      // Grant types supported
      grant_types_supported: [
        'authorization_code',
        'refresh_token'
      ]
    }

    // Set cache headers
    reply.header('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    reply.header('Content-Type', 'application/json')

    return configuration
  })
}
