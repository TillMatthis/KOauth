/**
 * JWT Bearer Strategy Tests (Task 1.5)
 * Tests for short-lived JWT access tokens and Bearer token authentication
 * Updated for RS256 signing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { build } from '../app'
import type { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import { rsaKeyManager } from '../lib/auth/rsa-keys'

describe('JWT Bearer Strategy (Task 1.5)', () => {
  let app: FastifyInstance
  let testUserId: string
  let testUserEmail: string
  let validAccessToken: string
  let sessionCookie: string

  beforeAll(async () => {
    app = await build()
    await app.ready()

    // Create test user
    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        email: 'jwt-test@example.com',
        password: 'SecurePass123!@#'
      }
    })

    expect(signupResponse.statusCode).toBe(201)
    const signupData = signupResponse.json()
    testUserId = signupData.user.id
    testUserEmail = signupData.user.email
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/auth/login - JWT Token Issuance', () => {
    it('should return JWT access token on successful login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUserEmail,
          password: 'SecurePass123!@#'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = response.json()

      // Check standard OAuth 2.0 token response format
      expect(data.success).toBe(true)
      expect(data.access_token).toBeDefined()
      expect(data.token_type).toBe('bearer')
      expect(data.expires_in).toBe(900) // 15 minutes = 900 seconds

      // Verify JWT structure and payload
      const decoded = jwt.decode(data.access_token) as any
      expect(decoded.sub).toBe(testUserId)
      expect(decoded.email).toBe(testUserEmail)
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()

      // Store for later tests
      validAccessToken = data.access_token

      // Also extract session cookie for comparison tests
      const cookies = response.cookies
      const sessionCookieObj = cookies.find(c => c.name === 'session_id')
      expect(sessionCookieObj).toBeDefined()
      sessionCookie = `${sessionCookieObj!.name}=${sessionCookieObj!.value}`
    })

    it('should verify JWT signature correctly with RS256', async () => {
      const publicKey = rsaKeyManager.getPublicKey()
      expect(() => {
        jwt.verify(validAccessToken, publicKey, { algorithms: ['RS256'] })
      }).not.toThrow()
    })

    it('should reject tampered JWT', async () => {
      const publicKey = rsaKeyManager.getPublicKey()
      const tamperedToken = validAccessToken.slice(0, -10) + 'TAMPERED123'

      expect(() => {
        jwt.verify(tamperedToken, publicKey, { algorithms: ['RS256'] })
      }).toThrow()
    })
  })

  describe('POST /api/auth/token - Token Exchange Endpoint', () => {
    it('should issue JWT token without creating session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/token',
        payload: {
          email: testUserEmail,
          password: 'SecurePass123!@#'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = response.json()

      expect(data.success).toBe(true)
      expect(data.access_token).toBeDefined()
      expect(data.token_type).toBe('bearer')
      expect(data.expires_in).toBe(900)

      // Verify NO session cookies are set
      const cookies = response.cookies
      expect(cookies.length).toBe(0)
    })

    it('should reject invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/token',
        payload: {
          email: testUserEmail,
          password: 'WrongPassword123!'
        }
      })

      expect(response.statusCode).toBe(401)
      const data = response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid email or password')
    })
  })

  describe('GET /api/me - JWT Bearer Authentication', () => {
    it('should authenticate with valid JWT Bearer token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: `Bearer ${validAccessToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const data = response.json()

      expect(data.success).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.id).toBe(testUserId)
      expect(data.user.email).toBe(testUserEmail)
    })

    it('should reject expired JWT token', async () => {
      // Create an expired token (1 second expiry, already expired)
      const privateKey = rsaKeyManager.getPrivateKey()
      const kid = rsaKeyManager.getKeyId()
      const expiredToken = jwt.sign(
        { sub: testUserId, email: testUserEmail },
        privateKey,
        {
          expiresIn: '-1s', // Negative time = already expired
          algorithm: 'RS256',
          keyid: kid,
          issuer: 'https://auth.tillmaessen.de',
          audience: 'https://auth.tillmaessen.de'
        }
      )

      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: `Bearer ${expiredToken}`
        }
      })

      expect(response.statusCode).toBe(401)
      const data = response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid or expired token')
    })

    it('should reject tampered JWT token', async () => {
      const tamperedToken = validAccessToken.slice(0, -10) + 'TAMPERED123'

      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: `Bearer ${tamperedToken}`
        }
      })

      expect(response.statusCode).toBe(401)
      const data = response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid or expired token')
    })

    it('should reject JWT with invalid signature (wrong key)', async () => {
      // Create a token with a different private key
      const crypto = await import('crypto')
      const { privateKey: wrongPrivateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      })

      const invalidToken = jwt.sign(
        { sub: testUserId, email: testUserEmail },
        wrongPrivateKey,
        {
          expiresIn: '15m',
          algorithm: 'RS256',
          issuer: 'https://auth.tillmaessen.de',
          audience: 'https://auth.tillmaessen.de'
        }
      )

      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: `Bearer ${invalidToken}`
        }
      })

      expect(response.statusCode).toBe(401)
      const data = response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid or expired token')
    })

    it('should reject malformed JWT token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: 'Bearer not-a-valid-jwt-token'
        }
      })

      expect(response.statusCode).toBe(401)
      const data = response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid or expired token')
    })

    it('should reject missing Bearer token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me'
      })

      expect(response.statusCode).toBe(401)
      const data = response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('Dual Auth - JWT vs Session vs API Key', () => {
    let apiKey: string

    beforeAll(async () => {
      // Create an API key for comparison tests
      const apiKeyResponse = await app.inject({
        method: 'POST',
        url: '/api/me/api-keys',
        headers: {
          Cookie: sessionCookie
        },
        payload: {
          name: 'JWT Test API Key'
        }
      })

      expect(apiKeyResponse.statusCode).toBe(201)
      apiKey = apiKeyResponse.json().apiKey.key
    })

    it('should authenticate with JWT Bearer token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: `Bearer ${validAccessToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().user.id).toBe(testUserId)
    })

    it('should authenticate with session cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Cookie: sessionCookie
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().user.id).toBe(testUserId)
    })

    it('should authenticate with API key Bearer token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().user.id).toBe(testUserId)
    })

    it('should prioritize Bearer token (JWT) over session cookie', async () => {
      // Create a different user
      const user2Response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'jwt-test-2@example.com',
          password: 'SecurePass123!@#'
        }
      })

      const user2Id = user2Response.json().user.id
      const user2Cookie = user2Response.cookies.find(c => c.name === 'session_id')
      const user2SessionCookie = `${user2Cookie!.name}=${user2Cookie!.value}`

      // Try to access with user1's JWT but user2's session cookie
      // JWT should take precedence
      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          Authorization: `Bearer ${validAccessToken}`,
          Cookie: user2SessionCookie
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().user.id).toBe(testUserId) // JWT user, not session user
    })
  })

  describe('JWT Expiration Time', () => {
    it('should issue JWT with 15-minute expiration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/token',
        payload: {
          email: testUserEmail,
          password: 'SecurePass123!@#'
        }
      })

      const data = response.json()
      expect(data.expires_in).toBe(900) // 15 minutes = 900 seconds

      const decoded = jwt.decode(data.access_token) as any
      const issuedAt = decoded.iat
      const expiresAt = decoded.exp
      const lifetime = expiresAt - issuedAt

      expect(lifetime).toBe(900) // 15 minutes in seconds
    })
  })
})
