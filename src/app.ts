/**
 * KOauth Main Application
 * Configures Fastify with all plugins and routes
 */

import Fastify, { FastifyInstance } from 'fastify'
import fastifyEnv from '@fastify/env'
import fastifyHelmet from '@fastify/helmet'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyRateLimit from '@fastify/rate-limit'
import { envSchema } from '@/config/env'
import { fastifyLogger } from '@/lib/logger'

/**
 * Build and configure the Fastify application
 * @param opts - Fastify server options
 * @returns Configured Fastify instance
 */
export async function buildApp(opts = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: fastifyLogger,
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    ...opts
  })

  // Register environment variables with validation
  await app.register(fastifyEnv, {
    confKey: 'config',
    schema: envSchema,
    dotenv: true
  })

  // Security plugins
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:']
      }
    }
  })

  await app.register(fastifyCors, {
    origin: app.config.CORS_ORIGIN,
    credentials: true
  })

  await app.register(fastifyCookie, {
    secret: app.config.SESSION_SECRET,
    hook: 'onRequest'
  })

  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    cache: 10000
  })

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  })

  // Root endpoint
  app.get('/', async () => {
    return {
      name: 'KOauth',
      version: '0.1.0',
      description: 'Reusable self-hosted auth server',
      status: 'ready'
    }
  })

  // Register auth routes with stricter rate limiting
  await app.register(async (authScope) => {
    // Stricter rate limit for auth endpoints
    await authScope.register(fastifyRateLimit, {
      max: 5,
      timeWindow: '15 minutes',
      cache: 10000,
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
      })
    })

    // Import and register auth routes
    const { registerAuthRoutes } = await import('@/routes/auth')
    await registerAuthRoutes(authScope)
  })

  // Register API routes with rate limiting
  await app.register(async (apiScope) => {
    // Rate limit for API endpoints (stricter for key generation)
    await apiScope.register(fastifyRateLimit, {
      max: 10,
      timeWindow: '1 minute',
      cache: 10000,
      keyGenerator: (request) => {
        // Rate limit by user if authenticated, otherwise by IP
        return request.user?.id || request.ip
      },
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
      })
    })

    // Import and register API routes
    const { registerMeRoutes } = await import('@/routes/api/me')
    await registerMeRoutes(apiScope)
  }, { prefix: '/api/me' })

  // Register static UI plugin (after auth routes so API routes take precedence)
  const staticUI = await import('@/plugins/static-ui')
  await app.register(staticUI.default)

  return app
}
