/**
 * Comprehensive OAuth tests
 * Tests Google and GitHub OAuth flows with mocked external APIs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { buildApp } from '@/app'
import type { FastifyInstance } from 'fastify'
import { prisma } from '@/lib/prisma'
import * as oauthModule from '@/lib/auth/oauth'

describe('OAuth Authentication', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    // Set OAuth environment variables for testing
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback'
    process.env.GITHUB_CLIENT_ID = 'test-github-client-id'
    process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret'
    process.env.GITHUB_REDIRECT_URI = 'http://localhost:3000/auth/github/callback'

    app = await buildApp({ logger: false })
    await app.ready()

    // Clear any mocks
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  describe('Google OAuth', () => {
    describe('GET /auth/google', () => {
      it('should redirect to Google OAuth consent screen', async () => {
        const response = await request(app.server)
          .get('/auth/google')
          .expect(302)

        // Verify redirect URL
        const location = response.headers.location
        expect(location).toContain('accounts.google.com/o/oauth2/v2/auth')
        expect(location).toContain('client_id=test-google-client-id')
        expect(location).toContain('redirect_uri=http://localhost:3000/auth/google/callback')
        expect(location).toContain('scope=openid%20email%20profile')
      })

      it('should handle missing Google OAuth configuration', async () => {
        // Create app without OAuth config
        delete process.env.GOOGLE_CLIENT_ID
        const testApp = await buildApp({ logger: false })
        await testApp.ready()

        const response = await request(testApp.server)
          .get('/auth/google')
          .expect(302)

        expect(response.headers.location).toContain('error=oauth_not_configured')
        await testApp.close()
      })
    })

    describe('GET /auth/google/callback', () => {
      it('should create new user on first Google login', async () => {
        // Mock fetch for token exchange
        global.fetch = vi.fn((url: string) => {
          if (url.includes('oauth2.googleapis.com/token')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ access_token: 'test-access-token' })
            } as Response)
          }
          return Promise.reject(new Error('Unexpected fetch call'))
        }) as any

        // Mock fetchGoogleUserInfo
        vi.spyOn(oauthModule, 'fetchGoogleUserInfo').mockResolvedValue({
          provider: 'google',
          providerId: 'google-user-123',
          email: 'testuser@gmail.com',
          emailVerified: true
        })

        const response = await request(app.server)
          .get('/auth/google/callback?code=test-auth-code')
          .expect(302)

        // Should redirect to home
        expect(response.headers.location).toBe('/')

        // Check cookies are set
        const cookies = response.headers['set-cookie']
        expect(cookies).toBeDefined()
        expect(cookies.some((c: string) => c.includes('session_id'))).toBe(true)
        expect(cookies.some((c: string) => c.includes('refresh_token'))).toBe(true)

        // Verify user in database
        const user = await prisma.user.findUnique({
          where: { email: 'testuser@gmail.com' }
        })
        expect(user).toBeDefined()
        expect(user!.provider).toBe('google')
        expect(user!.providerId).toBe('google-user-123')
        expect(user!.emailVerified).toBe(true)
      })

      it('should login existing Google user', async () => {
        // Create existing Google user
        await prisma.user.create({
          data: {
            email: 'existing@gmail.com',
            passwordHash: 'random-hash',
            emailVerified: true,
            provider: 'google',
            providerId: 'google-existing-123'
          }
        })

        // Mock fetch for token exchange
        global.fetch = vi.fn((url: string) => {
          if (url.includes('oauth2.googleapis.com/token')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ access_token: 'test-access-token' })
            } as Response)
          }
          return Promise.reject(new Error('Unexpected fetch call'))
        }) as any

        // Mock fetchGoogleUserInfo
        vi.spyOn(oauthModule, 'fetchGoogleUserInfo').mockResolvedValue({
          provider: 'google',
          providerId: 'google-existing-123',
          email: 'existing@gmail.com',
          emailVerified: true
        })

        const response = await request(app.server)
          .get('/auth/google/callback?code=test-auth-code')
          .expect(302)

        expect(response.headers.location).toBe('/')

        // Check cookies are set
        const cookies = response.headers['set-cookie']
        expect(cookies).toBeDefined()
      })

      it('should link Google account to existing email/password user', async () => {
        // Create existing email/password user
        await request(app.server)
          .post('/auth/signup')
          .send({
            email: 'linktest@gmail.com',
            password: 'Test123!@#'
          })

        // Mock fetch for token exchange
        global.fetch = vi.fn((url: string) => {
          if (url.includes('oauth2.googleapis.com/token')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ access_token: 'test-access-token' })
            } as Response)
          }
          return Promise.reject(new Error('Unexpected fetch call'))
        }) as any

        // Mock fetchGoogleUserInfo with same email
        vi.spyOn(oauthModule, 'fetchGoogleUserInfo').mockResolvedValue({
          provider: 'google',
          providerId: 'google-link-123',
          email: 'linktest@gmail.com',
          emailVerified: true
        })

        const response = await request(app.server)
          .get('/auth/google/callback?code=test-auth-code')
          .expect(302)

        expect(response.headers.location).toBe('/')

        // Verify user has Google linked
        const user = await prisma.user.findUnique({
          where: { email: 'linktest@gmail.com' }
        })
        expect(user!.provider).toBe('google')
        expect(user!.providerId).toBe('google-link-123')
        expect(user!.emailVerified).toBe(true)
      })

      it('should handle missing authorization code', async () => {
        const response = await request(app.server)
          .get('/auth/google/callback')
          .expect(302)

        expect(response.headers.location).toContain('error=invalid_callback')
      })

      it('should handle OAuth error from Google', async () => {
        const response = await request(app.server)
          .get('/auth/google/callback?error=access_denied')
          .expect(302)

        expect(response.headers.location).toContain('error=access_denied')
      })

      it('should handle token exchange failure', async () => {
        // Mock fetch to return error
        global.fetch = vi.fn(() => {
          return Promise.resolve({
            ok: false,
            status: 400,
            text: () => Promise.resolve('Bad Request')
          } as Response)
        }) as any

        const response = await request(app.server)
          .get('/auth/google/callback?code=test-auth-code')
          .expect(302)

        expect(response.headers.location).toContain('error=token_exchange_failed')
      })
    })
  })

  describe('GitHub OAuth', () => {
    describe('GET /auth/github', () => {
      it('should redirect to GitHub OAuth authorization screen', async () => {
        const response = await request(app.server)
          .get('/auth/github')
          .expect(302)

        // Verify redirect URL
        const location = response.headers.location
        expect(location).toContain('github.com/login/oauth/authorize')
        expect(location).toContain('client_id=test-github-client-id')
        expect(location).toContain('redirect_uri=http://localhost:3000/auth/github/callback')
        expect(location).toContain('scope=user:email')
      })

      it('should handle missing GitHub OAuth configuration', async () => {
        // Create app without OAuth config
        delete process.env.GITHUB_CLIENT_ID
        const testApp = await buildApp({ logger: false })
        await testApp.ready()

        const response = await request(testApp.server)
          .get('/auth/github')
          .expect(302)

        expect(response.headers.location).toContain('error=oauth_not_configured')
        await testApp.close()
      })
    })

    describe('GET /auth/github/callback', () => {
      it('should create new user on first GitHub login', async () => {
        // Mock fetch for token exchange
        global.fetch = vi.fn((url: string) => {
          if (url.includes('github.com/login/oauth/access_token')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ access_token: 'test-github-token' })
            } as Response)
          }
          return Promise.reject(new Error('Unexpected fetch call'))
        }) as any

        // Mock fetchGitHubUserInfo
        vi.spyOn(oauthModule, 'fetchGitHubUserInfo').mockResolvedValue({
          provider: 'github',
          providerId: 'github-user-456',
          email: 'githubuser@example.com',
          emailVerified: true
        })

        const response = await request(app.server)
          .get('/auth/github/callback?code=test-auth-code')
          .expect(302)

        // Should redirect to home
        expect(response.headers.location).toBe('/')

        // Check cookies are set
        const cookies = response.headers['set-cookie']
        expect(cookies).toBeDefined()
        expect(cookies.some((c: string) => c.includes('session_id'))).toBe(true)
        expect(cookies.some((c: string) => c.includes('refresh_token'))).toBe(true)

        // Verify user in database
        const user = await prisma.user.findUnique({
          where: { email: 'githubuser@example.com' }
        })
        expect(user).toBeDefined()
        expect(user!.provider).toBe('github')
        expect(user!.providerId).toBe('github-user-456')
        expect(user!.emailVerified).toBe(true)
      })

      it('should login existing GitHub user', async () => {
        // Create existing GitHub user
        await prisma.user.create({
          data: {
            email: 'githubexisting@example.com',
            passwordHash: 'random-hash',
            emailVerified: true,
            provider: 'github',
            providerId: 'github-existing-789'
          }
        })

        // Mock fetch for token exchange
        global.fetch = vi.fn((url: string) => {
          if (url.includes('github.com/login/oauth/access_token')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ access_token: 'test-github-token' })
            } as Response)
          }
          return Promise.reject(new Error('Unexpected fetch call'))
        }) as any

        // Mock fetchGitHubUserInfo
        vi.spyOn(oauthModule, 'fetchGitHubUserInfo').mockResolvedValue({
          provider: 'github',
          providerId: 'github-existing-789',
          email: 'githubexisting@example.com',
          emailVerified: true
        })

        const response = await request(app.server)
          .get('/auth/github/callback?code=test-auth-code')
          .expect(302)

        expect(response.headers.location).toBe('/')

        // Check cookies are set
        const cookies = response.headers['set-cookie']
        expect(cookies).toBeDefined()
      })

      it('should link GitHub account to existing email/password user', async () => {
        // Create existing email/password user
        await request(app.server)
          .post('/auth/signup')
          .send({
            email: 'githublink@example.com',
            password: 'Test123!@#'
          })

        // Mock fetch for token exchange
        global.fetch = vi.fn((url: string) => {
          if (url.includes('github.com/login/oauth/access_token')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ access_token: 'test-github-token' })
            } as Response)
          }
          return Promise.reject(new Error('Unexpected fetch call'))
        }) as any

        // Mock fetchGitHubUserInfo with same email
        vi.spyOn(oauthModule, 'fetchGitHubUserInfo').mockResolvedValue({
          provider: 'github',
          providerId: 'github-link-456',
          email: 'githublink@example.com',
          emailVerified: true
        })

        const response = await request(app.server)
          .get('/auth/github/callback?code=test-auth-code')
          .expect(302)

        expect(response.headers.location).toBe('/')

        // Verify user has GitHub linked
        const user = await prisma.user.findUnique({
          where: { email: 'githublink@example.com' }
        })
        expect(user!.provider).toBe('github')
        expect(user!.providerId).toBe('github-link-456')
        expect(user!.emailVerified).toBe(true)
      })

      it('should handle missing authorization code', async () => {
        const response = await request(app.server)
          .get('/auth/github/callback')
          .expect(302)

        expect(response.headers.location).toContain('error=invalid_callback')
      })

      it('should handle OAuth error from GitHub', async () => {
        const response = await request(app.server)
          .get('/auth/github/callback?error=access_denied&error_description=User%20denied%20access')
          .expect(302)

        expect(response.headers.location).toContain('error=access_denied')
      })

      it('should handle token exchange failure', async () => {
        // Mock fetch to return error
        global.fetch = vi.fn(() => {
          return Promise.resolve({
            ok: false,
            status: 400,
            text: () => Promise.resolve('Bad Request')
          } as Response)
        }) as any

        const response = await request(app.server)
          .get('/auth/github/callback?code=test-auth-code')
          .expect(302)

        expect(response.headers.location).toContain('error=token_exchange_failed')
      })
    })
  })

  describe('OAuth Rate Limiting', () => {
    it('should enforce rate limits on OAuth callback endpoints', async () => {
      // Mock fetch for token exchange
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Bad Request')
        } as Response)
      }) as any

      // Make 6 requests (limit is 5 per 15 minutes for auth endpoints)
      const requests = Array(6).fill(null).map(() =>
        request(app.server)
          .get('/auth/google/callback?code=test-code')
      )

      const responses = await Promise.all(requests)

      // Last request should be rate limited
      const rateLimited = responses.some(r => r.status === 429)
      expect(rateLimited).toBe(true)
    })
  })
})
