/**
 * Tests for Express integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express, { Application } from 'express'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { initKOauth, protectRoute, getUser, optionalUser, optionalAuth } from '../index'

describe('Express Integration', () => {
  let app: Application
  let mockAuthServer: FastifyInstance

  // Mock auth server
  beforeAll(async () => {
    mockAuthServer = Fastify()

    mockAuthServer.get('/api/me', async (request, reply) => {
      const authHeader = request.headers.authorization
      const sessionCookie = request.headers.cookie?.includes('session_id=valid-session')

      if (authHeader === 'Bearer valid-token') {
        return reply.send({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com'
          }
        })
      }

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

      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      })
    })

    await mockAuthServer.listen({ port: 3098 })
  })

  afterAll(async () => {
    await mockAuthServer.close()
  })

  beforeAll(() => {
    app = express()

    initKOauth(app, {
      baseUrl: 'http://localhost:3098'
    })

    // Protected route
    app.get('/protected', protectRoute(), (req, res) => {
      const user = getUser(req)
      res.json({ user })
    })

    // Optional auth route
    app.get('/optional', optionalAuth(), (req, res) => {
      const user = optionalUser(req)
      res.json({ user })
    })

    // Public route
    app.get('/public', (req, res) => {
      res.json({ message: 'public' })
    })
  })

  it('should reject protected route without auth', async () => {
    const request = require('supertest')
    const response = await request(app)
      .get('/protected')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      success: false,
      error: 'Authentication required'
    })
  })

  it('should allow protected route with valid Bearer token', async () => {
    const request = require('supertest')
    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token')

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({
      id: 'user-123',
      email: 'test@example.com'
    })
  })

  it('should allow protected route with valid session cookie', async () => {
    const request = require('supertest')
    const response = await request(app)
      .get('/protected')
      .set('Cookie', 'session_id=valid-session')

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({
      id: 'user-456',
      email: 'session@example.com',
      sessionId: 'valid-session'
    })
  })

  it('should reject protected route with invalid token', async () => {
    const request = require('supertest')
    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token')

    expect(response.status).toBe(401)
  })

  it('should allow optional auth route without auth', async () => {
    const request = require('supertest')
    const response = await request(app)
      .get('/optional')

    expect(response.status).toBe(200)
    expect(response.body.user).toBeNull()
  })

  it('should attach user to optional auth route with valid token', async () => {
    const request = require('supertest')
    const response = await request(app)
      .get('/optional')
      .set('Authorization', 'Bearer valid-token')

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({
      id: 'user-123',
      email: 'test@example.com'
    })
  })

  it('should allow public route', async () => {
    const request = require('supertest')
    const response = await request(app)
      .get('/public')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      message: 'public'
    })
  })
})
