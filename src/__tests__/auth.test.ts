/**
 * Comprehensive authentication tests
 * Tests all auth endpoints: signup, login, refresh, logout
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

describe('Authentication API', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /auth/signup', () => {
    it('should create a new user with valid credentials', async () => {
      const response = await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.user).toHaveProperty('id')
      expect(response.body.user.email).toBe('test@example.com')
      expect(response.body.user.emailVerified).toBe(false)

      // Check cookies are set
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies.some((c: string) => c.includes('session_id'))).toBe(true)
      expect(cookies.some((c: string) => c.includes('refresh_token'))).toBe(true)

      // Verify user in database
      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      })
      expect(user).toBeDefined()
      expect(user!.passwordHash).toBeDefined()
      expect(user!.passwordHash).not.toBe('Test123!@#') // Should be hashed
    })

    it('should reject signup with existing email', async () => {
      // Create first user
      await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        })

      // Try to create duplicate
      const response = await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'DifferentPass123!@#'
        })
        .expect(409)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('already exists')
    })

    it('should reject weak passwords', async () => {
      const response = await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'weak'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should reject invalid email format', async () => {
      const response = await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'Test123!@#'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should normalize email to lowercase', async () => {
      const response = await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'Test123!@#'
        })
        .expect(201)

      expect(response.body.user.email).toBe('test@example.com')
    })
  })

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        })
    })

    it('should login with valid credentials', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.user.email).toBe('test@example.com')

      // Check cookies are set
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies.some((c: string) => c.includes('session_id'))).toBe(true)
      expect(cookies.some((c: string) => c.includes('refresh_token'))).toBe(true)
    })

    it('should reject login with wrong password', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!@#'
        })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Invalid email or password')
    })

    it('should reject login with non-existent email', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123!@#'
        })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Invalid email or password')
    })

    it('should be case-insensitive for email', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'Test123!@#'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('POST /auth/refresh', () => {
    let sessionCookie: string
    let refreshCookie: string

    beforeEach(async () => {
      // Create user and get session
      const response = await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        })

      const cookies = response.headers['set-cookie']
      sessionCookie = cookies.find((c: string) => c.includes('session_id'))!
      refreshCookie = cookies.find((c: string) => c.includes('refresh_token'))!
    })

    it('should refresh session with valid tokens', async () => {
      const response = await request(app.server)
        .post('/auth/refresh')
        .set('Cookie', [sessionCookie, refreshCookie])
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('refreshed')

      // Should get new cookies
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies.some((c: string) => c.includes('session_id'))).toBe(true)
      expect(cookies.some((c: string) => c.includes('refresh_token'))).toBe(true)
    })

    it('should reject refresh without session cookie', async () => {
      const response = await request(app.server)
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401)

      expect(response.body.success).toBe(false)
    })

    it('should reject refresh without refresh token', async () => {
      const response = await request(app.server)
        .post('/auth/refresh')
        .set('Cookie', [sessionCookie])
        .expect(401)

      expect(response.body.success).toBe(false)
    })

    it('should reject refresh with invalid refresh token', async () => {
      const response = await request(app.server)
        .post('/auth/refresh')
        .set('Cookie', [sessionCookie, 'refresh_token=invalid'])
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /auth/logout', () => {
    let sessionCookie: string
    let refreshCookie: string

    beforeEach(async () => {
      // Create user and get session
      const response = await request(app.server)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        })

      const cookies = response.headers['set-cookie']
      sessionCookie = cookies.find((c: string) => c.includes('session_id'))!
      refreshCookie = cookies.find((c: string) => c.includes('refresh_token'))!
    })

    it('should logout and clear cookies', async () => {
      const response = await request(app.server)
        .post('/auth/logout')
        .set('Cookie', [sessionCookie, refreshCookie])
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('Logged out')

      // Check cookies are cleared
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies.some((c: string) => c.includes('session_id=;'))).toBe(true)
    })

    it('should logout even without session cookie', async () => {
      const response = await request(app.server)
        .post('/auth/logout')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should invalidate session in database', async () => {
      // Extract session ID from cookie
      const sessionId = sessionCookie.match(/session_id=([^;]+)/)?.[1]

      await request(app.server)
        .post('/auth/logout')
        .set('Cookie', [sessionCookie, refreshCookie])
        .expect(200)

      // Verify session is deleted
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      })
      expect(session).toBeNull()
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      // Make 6 requests (limit is 5 per 15 minutes)
      const requests = Array(6).fill(null).map(() =>
        request(app.server)
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'Test123!@#'
          })
      )

      const responses = await Promise.all(requests)

      // Last request should be rate limited
      const rateLimited = responses.some(r => r.status === 429)
      expect(rateLimited).toBe(true)
    })
  })
})
