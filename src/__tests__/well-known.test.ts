/**
 * .well-known endpoints tests
 * Tests for JWKS and OAuth discovery endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { build } from '../app'
import type { FastifyInstance } from 'fastify'
import { rsaKeyManager } from '../lib/auth/rsa-keys'

describe('.well-known endpoints', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await build()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /.well-known/jwks.json', () => {
    it('should return JWKS with public keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json'
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('application/json')
      expect(response.headers['cache-control']).toContain('public')

      const jwks = response.json()
      expect(jwks).toHaveProperty('keys')
      expect(Array.isArray(jwks.keys)).toBe(true)
      expect(jwks.keys.length).toBeGreaterThan(0)

      // Verify JWKS key structure
      const key = jwks.keys[0]
      expect(key.kty).toBe('RSA')
      expect(key.use).toBe('sig')
      expect(key.alg).toBe('RS256')
      expect(key.kid).toBeDefined()
      expect(key.n).toBeDefined() // RSA modulus
      expect(key.e).toBeDefined() // RSA exponent

      // Verify kid matches our key manager
      const ourKid = rsaKeyManager.getKeyId()
      expect(key.kid).toBe(ourKid)
    })

    it('should have proper cache headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json'
      })

      expect(response.headers['cache-control']).toContain('max-age=3600')
    })
  })

  describe('GET /.well-known/oauth-authorization-server', () => {
    it('should return OAuth 2.0 Authorization Server Metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/oauth-authorization-server'
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('application/json')

      const metadata = response.json()

      // Required metadata fields (RFC 8414)
      expect(metadata.issuer).toBeDefined()
      expect(metadata.authorization_endpoint).toBeDefined()
      expect(metadata.token_endpoint).toBeDefined()
      expect(metadata.jwks_uri).toBeDefined()

      // Verify endpoints structure
      expect(metadata.issuer).toContain('https://')
      expect(metadata.authorization_endpoint).toContain('/oauth/authorize')
      expect(metadata.token_endpoint).toContain('/oauth/token')
      expect(metadata.jwks_uri).toContain('/.well-known/jwks.json')

      // Verify supported features
      expect(metadata.response_types_supported).toContain('code')
      expect(metadata.grant_types_supported).toContain('authorization_code')
      expect(metadata.grant_types_supported).toContain('refresh_token')
      expect(metadata.code_challenge_methods_supported).toContain('S256')

      // Verify MCP scopes are included
      expect(metadata.scopes_supported).toContain('mcp:tools:read')
      expect(metadata.scopes_supported).toContain('mcp:tools:execute')
      expect(metadata.scopes_supported).toContain('kura:notes:search')

      // Verify RS256 is supported
      expect(metadata.token_endpoint_auth_signing_alg_values_supported).toContain('RS256')
      expect(metadata.id_token_signing_alg_values_supported).toContain('RS256')
    })

    it('should have proper cache headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/oauth-authorization-server'
      })

      expect(response.headers['cache-control']).toContain('max-age=3600')
    })
  })

  describe('GET /.well-known/openid-configuration', () => {
    it('should return OpenID Connect Discovery configuration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/openid-configuration'
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('application/json')

      const config = response.json()

      // Required OpenID Connect Discovery fields
      expect(config.issuer).toBeDefined()
      expect(config.authorization_endpoint).toBeDefined()
      expect(config.token_endpoint).toBeDefined()
      expect(config.userinfo_endpoint).toBeDefined()
      expect(config.jwks_uri).toBeDefined()

      // Verify endpoints
      expect(config.userinfo_endpoint).toContain('/api/me')
      expect(config.jwks_uri).toContain('/.well-known/jwks.json')

      // Verify supported features
      expect(config.response_types_supported).toContain('code')
      expect(config.subject_types_supported).toContain('public')
      expect(config.id_token_signing_alg_values_supported).toContain('RS256')

      // Verify MCP scopes are included
      expect(config.scopes_supported).toContain('mcp:tools:read')
      expect(config.scopes_supported).toContain('mcp:tools:execute')
      expect(config.scopes_supported).toContain('kura:notes:search')

      // Verify standard OpenID scopes
      expect(config.scopes_supported).toContain('openid')
      expect(config.scopes_supported).toContain('profile')
      expect(config.scopes_supported).toContain('email')
    })

    it('should have proper cache headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/openid-configuration'
      })

      expect(response.headers['cache-control']).toContain('max-age=3600')
    })
  })

  describe('JWKS and JWT Integration', () => {
    it('should be able to verify JWT using public key from JWKS', async () => {
      // Get JWKS
      const jwksResponse = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json'
      })
      const jwks = jwksResponse.json()
      const jwk = jwks.keys[0]

      // Create a test user and get JWT
      const signupResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'jwks-integration@example.com',
          password: 'SecurePass123!@#'
        }
      })
      expect(signupResponse.statusCode).toBe(201)

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'jwks-integration@example.com',
          password: 'SecurePass123!@#'
        }
      })
      expect(loginResponse.statusCode).toBe(200)

      const { access_token } = loginResponse.json()

      // Decode JWT header to check kid
      const jwt = await import('jsonwebtoken')
      const decoded = jwt.decode(access_token, { complete: true })
      expect(decoded).toBeDefined()
      expect(decoded!.header.kid).toBe(jwk.kid)
      expect(decoded!.header.alg).toBe('RS256')

      // Verify token can be used
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      })
      expect(meResponse.statusCode).toBe(200)
    })
  })
})
