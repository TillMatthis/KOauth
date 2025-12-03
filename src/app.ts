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
import fastifyFormbody from '@fastify/formbody'
import { envSchema } from './config/env'
import { fastifyLogger } from './lib/logger'
import { initializeKeys } from './config/keys'
import { resolve } from 'path'

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

  // Initialize RSA keys for JWT signing (RS256)
  // Priority: environment variables > files > generate new
  const privateKeyPath = resolve(app.config.JWT_PRIVATE_KEY_PATH)
  const publicKeyPath = resolve(app.config.JWT_PUBLIC_KEY_PATH)
  const rsaKeys = initializeKeys(
    privateKeyPath,
    publicKeyPath,
    app.config.JWT_PRIVATE_KEY,
    app.config.JWT_PUBLIC_KEY
  )

  // Store RSA keys in app context for use in routes
  ;(app as any).rsaKeys = rsaKeys

  // Parse audience list from config
  const audienceList = app.config.JWT_AUDIENCE
    ? app.config.JWT_AUDIENCE.split(',').map(s => s.trim())
    : []
  ;(app as any).jwtAudience = audienceList

  // Security plugins
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Allow 'unsafe-inline' for scripts to support Vite's module system
        // In production, Vite generates ES modules that may use inline scripts
        scriptSrc: ["'self'", "'unsafe-inline'"],
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

  // Parse form data (application/x-www-form-urlencoded)
  await app.register(fastifyFormbody)

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

  // API info endpoint
  app.get('/api', async () => {
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
    const { registerAuthRoutes } = await import('./routes/auth')
    await registerAuthRoutes(authScope)
  }, { prefix: '/api/auth' })

  // Register OAuth 2.0 routes (authorization server for multi-app)
  await app.register(async (oauthScope) => {
    const { registerOAuthRoutes } = await import('./routes/oauth')
    await registerOAuthRoutes(oauthScope)
  }, { prefix: '/oauth' })

  // Register public API key validation endpoint (no auth required)
  const { validateKeyRoute } = await import('./routes/validate-key')
  await validateKeyRoute(app)

  // Register JWKS endpoint (/.well-known/jwks.json)
  const { jwksRoute } = await import('./routes/jwks')
  await jwksRoute(app)

  // Register /api/me routes with rate limiting
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
    const { registerMeRoutes } = await import('./routes/api/me')
    await registerMeRoutes(apiScope)
  }, { prefix: '/api/me' })

  // Register /api/oauth routes (public OAuth client info)
  await app.register(async (apiOAuthScope) => {
    const { registerOAuthApiRoutes } = await import('./routes/api/oauth')
    await registerOAuthApiRoutes(apiOAuthScope)
  }, { prefix: '/api/oauth' })

  // Register static UI plugin (after auth routes so API routes take precedence)
  const staticUI = await import('./plugins/static-ui')
  await app.register(staticUI.default)

  return app
}
