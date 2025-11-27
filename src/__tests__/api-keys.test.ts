/**
 * Comprehensive API Keys tests
 * Tests key generation, listing, revocation, and Bearer token authentication
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

describe('API Keys', () => {
  let app: FastifyInstance
  let sessionCookie: string
  let userId: string

  beforeEach(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    // Create a test user and get session
    const signupResponse = await request(app.server)
      .post('/api/auth/signup')
      .send({
        email: 'apikeys@example.com',
        password: 'Test123!@#'
      })

    const cookies = signupResponse.headers['set-cookie']
    sessionCookie = cookies.find((c: string) => c.includes('session_id'))!
    userId = signupResponse.body.user.id
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/me/api-keys', () => {
    it('should create a new API key with valid session', async () => {
      const response = await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Test Key',
          expiresInDays: 365
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.apiKey).toBeDefined()
      expect(response.body.apiKey.name).toBe('Test Key')
      expect(response.body.apiKey.key).toBeDefined()
      expect(response.body.apiKey.key).toMatch(/^koa_[A-Za-z0-9_-]{6}_[A-Za-z0-9_-]+$/)
      expect(response.body.apiKey.prefix).toBeDefined()
      expect(response.body.apiKey.expiresAt).toBeDefined()

      // Verify key is stored in database
      const apiKey = await prisma.userApiKey.findUnique({
        where: { id: response.body.apiKey.id }
      })
      expect(apiKey).toBeDefined()
      expect(apiKey!.name).toBe('Test Key')
      expect(apiKey!.keyHash).toBeDefined()
      expect(apiKey!.keyHash).not.toContain('koa_') // Should be hashed
    })

    it('should create a key without expiration', async () => {
      const response = await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Permanent Key'
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.apiKey.expiresAt).toBeNull()
    })

    it('should reject creation without authentication', async () => {
      const response = await request(app.server)
        .post('/api/me/api-keys')
        .send({
          name: 'Test Key'
        })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Authentication required')
    })

    it('should reject invalid request data', async () => {
      const response = await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({
          name: '' // Empty name
        })
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should enforce maximum API keys limit', async () => {
      // Create 10 keys (the maximum)
      for (let i = 0; i < 10; i++) {
        await request(app.server)
          .post('/api/me/api-keys')
          .set('Cookie', sessionCookie)
          .send({
            name: `Key ${i + 1}`
          })
          .expect(201)
      }

      // Try to create 11th key
      const response = await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Key 11'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Maximum number of API keys')
    })

    it('should rate limit API key creation', async () => {
      // Make 11 requests quickly (limit is 10 per minute)
      const requests = Array(11).fill(null).map((_, i) =>
        request(app.server)
          .post('/api/me/api-keys')
          .set('Cookie', sessionCookie)
          .send({
            name: `Rate Limit Test Key ${i + 1}`
          })
      )

      const responses = await Promise.all(requests)

      // At least one should be rate limited
      const rateLimited = responses.some(r => r.status === 429)
      expect(rateLimited).toBe(true)
    })
  })

  describe('GET /api/me/api-keys', () => {
    it('should list all API keys for user', async () => {
      // Create 3 test keys
      await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({ name: 'Key 1' })

      await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({ name: 'Key 2' })

      await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({ name: 'Key 3' })

      // List all keys
      const response = await request(app.server)
        .get('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.apiKeys).toHaveLength(3)

      // Should NOT include full keys
      response.body.apiKeys.forEach((key: any) => {
        expect(key.id).toBeDefined()
        expect(key.name).toBeDefined()
        expect(key.prefix).toBeDefined()
        expect(key.createdAt).toBeDefined()
        expect(key.key).toBeUndefined() // Full key should NOT be returned
        expect(key.keyHash).toBeUndefined() // Hash should NOT be returned
      })
    })

    it('should return empty array if no keys', async () => {
      const response = await request(app.server)
        .get('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.apiKeys).toEqual([])
    })

    it('should reject without authentication', async () => {
      const response = await request(app.server)
        .get('/api/me/api-keys')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('DELETE /api/me/api-keys/:id', () => {
    it('should revoke an API key', async () => {
      // Create a key
      const createResponse = await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({ name: 'Key to Revoke' })

      const keyId = createResponse.body.apiKey.id

      // Revoke it
      const response = await request(app.server)
        .delete(`/api/me/api-keys/${keyId}`)
        .set('Cookie', sessionCookie)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('revoked')

      // Verify it's deleted from database
      const apiKey = await prisma.userApiKey.findUnique({
        where: { id: keyId }
      })
      expect(apiKey).toBeNull()
    })

    it('should return 404 for non-existent key', async () => {
      const response = await request(app.server)
        .delete('/api/me/api-keys/nonexistent')
        .set('Cookie', sessionCookie)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('not found')
    })

    it('should not allow revoking another user\'s key', async () => {
      // Create another user
      const user2Response = await request(app.server)
        .post('/api/auth/signup')
        .send({
          email: 'user2@example.com',
          password: 'Test123!@#'
        })

      const user2Cookie = user2Response.headers['set-cookie']
        .find((c: string) => c.includes('session_id'))!

      // User 2 creates a key
      const createResponse = await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', user2Cookie)
        .send({ name: 'User 2 Key' })

      const keyId = createResponse.body.apiKey.id

      // User 1 tries to revoke User 2's key
      const response = await request(app.server)
        .delete(`/api/me/api-keys/${keyId}`)
        .set('Cookie', sessionCookie)
        .expect(404)

      expect(response.body.success).toBe(false)
    })

    it('should reject without authentication', async () => {
      const response = await request(app.server)
        .delete('/api/me/api-keys/some-id')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('Bearer Token Authentication', () => {
    let apiKey: string

    beforeEach(async () => {
      // Create an API key
      const response = await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({ name: 'Bearer Test Key' })

      apiKey = response.body.apiKey.key
    })

    it('should authenticate with valid Bearer token', async () => {
      const response = await request(app.server)
        .get('/api/me/api-keys')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject invalid Bearer token', async () => {
      const response = await request(app.server)
        .get('/api/me/api-keys')
        .set('Authorization', 'Bearer koa_invalid_token')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Invalid API key')
    })

    it('should reject malformed Bearer token', async () => {
      const response = await request(app.server)
        .get('/api/me/api-keys')
        .set('Authorization', 'Bearer invalid-format')
        .expect(401)

      expect(response.body.success).toBe(false)
    })

    it('should update lastUsedAt when key is used', async () => {
      // Get the key before use
      const keysBefore = await prisma.userApiKey.findMany({
        where: { userId }
      })
      const keyBefore = keysBefore[0]
      expect(keyBefore.lastUsedAt).toBeNull()

      // Use the key
      await request(app.server)
        .get('/api/me/api-keys')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200)

      // Check lastUsedAt was updated
      const keysAfter = await prisma.userApiKey.findMany({
        where: { userId }
      })
      const keyAfter = keysAfter[0]
      expect(keyAfter.lastUsedAt).not.toBeNull()
    })

    it('should reject expired API key', async () => {
      // Create an expired key manually
      const { prefix, keyHash } = await (async () => {
        const { createApiKey } = await import('../lib/auth/apikey')
        const result = await createApiKey(userId, 'Expired Key', 0)

        // Manually set expiration to past
        await prisma.userApiKey.update({
          where: { id: result.apiKey.id },
          data: { expiresAt: new Date(Date.now() - 1000) }
        })

        return {
          prefix: result.apiKey.prefix,
          keyHash: result.fullKey
        }
      })()

      const response = await request(app.server)
        .get('/api/me/api-keys')
        .set('Authorization', `Bearer ${keyHash}`)
        .expect(401)

      expect(response.body.success).toBe(false)
    })

    it('should allow creating new API key with Bearer token', async () => {
      const response = await request(app.server)
        .post('/api/me/api-keys')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ name: 'Created with Bearer' })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.apiKey.name).toBe('Created with Bearer')
    })

    it('should allow revoking keys with Bearer token', async () => {
      // Create another key
      const createResponse = await request(app.server)
        .post('/api/me/api-keys')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ name: 'Key to Revoke via Bearer' })

      const keyId = createResponse.body.apiKey.id

      // Revoke it using Bearer token
      const response = await request(app.server)
        .delete(`/api/me/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('Parallel Authentication', () => {
    let apiKey: string

    beforeEach(async () => {
      // Create an API key
      const response = await request(app.server)
        .post('/api/me/api-keys')
        .set('Cookie', sessionCookie)
        .send({ name: 'Parallel Test Key' })

      apiKey = response.body.apiKey.key
    })

    it('should prioritize Bearer token over session cookie', async () => {
      // Create another user with session
      const user2Response = await request(app.server)
        .post('/api/auth/signup')
        .send({
          email: 'user2parallel@example.com',
          password: 'Test123!@#'
        })

      const user2Cookie = user2Response.headers['set-cookie']
        .find((c: string) => c.includes('session_id'))!

      // Make request with both Bearer token (user 1) and cookie (user 2)
      const response = await request(app.server)
        .get('/api/me/api-keys')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Cookie', user2Cookie)
        .expect(200)

      // Should use Bearer token (user 1's keys)
      expect(response.body.success).toBe(true)
      // Should return user 1's keys, not user 2's
      const keyNames = response.body.apiKeys.map((k: any) => k.name)
      expect(keyNames).toContain('Parallel Test Key')
    })
  })
})
