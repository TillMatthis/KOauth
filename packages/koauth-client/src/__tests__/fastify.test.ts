/**
 * Tests for Fastify integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { initKOauth, getUser, optionalUser } from '../index'
import { protectRouteFastify, optionalAuthFastify } from '../fastify'

describe('Fastify Integration', () => {
  let app: FastifyInstance
  let mockAuthServer: FastifyInstance

  // Mock auth server
  beforeAll(async () => {
    mockAuthServer = Fastify()

    // Mock /api/me endpoint
    mockAuthServer.get('/api/me', async (request, reply) => {
      const authHeader = request.headers.authorization
      const sessionCookie = request.headers.cookie?.includes('session_id=valid-session')

      // Valid Bearer token
      if (authHeader === 'Bearer valid-token') {
        return reply.send({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com'
          }
        })
      }

      // Valid session cookie
      if (sessionCookie) {
        return reply.send({
          success: true,
          user: {
            id: 'user-456',
            email: 'session@example.com',
            sessionId: 'valid-session'
          }
        })
      }

      // Invalid auth
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      })
    })

    await mockAuthServer.listen({ port: 3099 })
  })

  afterAll(async () => {
    await mockAuthServer.close()
  })

  beforeAll(() => {
    app = Fastify()

    initKOauth(app, {
      baseUrl: 'http://localhost:3099'
    })

    // Protected route
    app.get('/protected', {
      preHandler: protectRouteFastify()
    }, async (request) => {
      const user = getUser(request)
      return { user }
    })

    // Optional auth route
    app.get('/optional', {
      preHandler: optionalAuthFastify()
    }, async (request) => {
      const user = optionalUser(request)
      return { user }
    })

    // Public route
    app.get('/public', async () => {
      return { message: 'public' }
    })
  })

  it('should reject protected route without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected'
    })

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: 'Authentication required'
    })
  })

  it('should allow protected route with valid Bearer token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Bearer valid-token'
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.user).toEqual({
      id: 'user-123',
      email: 'test@example.com'
    })
  })

  it('should allow protected route with valid session cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        cookie: 'session_id=valid-session'
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.user).toEqual({
      id: 'user-456',
      email: 'session@example.com',
      sessionId: 'valid-session'
    })
  })

  it('should reject protected route with invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Bearer invalid-token'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  it('should allow optional auth route without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/optional'
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.user).toBeNull()
  })

  it('should attach user to optional auth route with valid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/optional',
      headers: {
        authorization: 'Bearer valid-token'
      }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.user).toEqual({
      id: 'user-123',
      email: 'test@example.com'
    })
  })

  it('should allow public route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/public'
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      message: 'public'
    })
  })
})
