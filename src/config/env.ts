/**
 * Environment configuration with validation
 * Uses @fastify/env for runtime validation
 */

export const envSchema = {
  type: 'object',
  required: ['NODE_ENV', 'PORT', 'DATABASE_URL'],
  properties: {
    // Server
    NODE_ENV: {
      type: 'string',
      enum: ['development', 'production', 'test'],
      default: 'development'
    },
    PORT: {
      type: 'number',
      default: 3000
    },
    HOST: {
      type: 'string',
      default: '0.0.0.0'
    },
    LOG_LEVEL: {
      type: 'string',
      enum: ['error', 'warn', 'info', 'debug', 'trace'],
      default: 'info'
    },

    // Database
    DATABASE_URL: {
      type: 'string'
    },

    // Security
    SESSION_SECRET: {
      type: 'string'
    },

    // JWT Configuration (RS256)
    JWT_PRIVATE_KEY_PATH: {
      type: 'string',
      default: './keys/jwt-private.pem'
    },
    JWT_PUBLIC_KEY_PATH: {
      type: 'string',
      default: './keys/jwt-public.pem'
    },
    JWT_EXPIRES_IN: {
      type: 'string',
      default: '15m'
    },
    REFRESH_TOKEN_EXPIRES_IN: {
      type: 'string',
      default: '30d'
    },
    JWT_ISSUER: {
      type: 'string',
      default: 'http://localhost:3000'
    },
    JWT_AUDIENCE: {
      type: 'string',
      default: 'kura-notes,komcp'
    },

    // OAuth Providers (optional for now)
    GOOGLE_CLIENT_ID: {
      type: 'string',
      default: ''
    },
    GOOGLE_CLIENT_SECRET: {
      type: 'string',
      default: ''
    },
    GOOGLE_REDIRECT_URI: {
      type: 'string',
      default: 'http://localhost:3000/auth/google/callback'
    },
    GITHUB_CLIENT_ID: {
      type: 'string',
      default: ''
    },
    GITHUB_CLIENT_SECRET: {
      type: 'string',
      default: ''
    },
    GITHUB_REDIRECT_URI: {
      type: 'string',
      default: 'http://localhost:3000/auth/github/callback'
    },

    // Email (optional for now)
    EMAIL_FROM: {
      type: 'string',
      default: 'noreply@koauth.local'
    },
    RESEND_API_KEY: {
      type: 'string',
      default: ''
    },

    // CORS
    CORS_ORIGIN: {
      type: 'string',
      default: '*'
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      NODE_ENV: string
      PORT: number
      HOST: string
      LOG_LEVEL: string
      DATABASE_URL: string
      SESSION_SECRET: string
      JWT_PRIVATE_KEY_PATH: string
      JWT_PUBLIC_KEY_PATH: string
      JWT_EXPIRES_IN: string
      REFRESH_TOKEN_EXPIRES_IN: string
      JWT_ISSUER: string
      JWT_AUDIENCE: string
      GOOGLE_CLIENT_ID: string
      GOOGLE_CLIENT_SECRET: string
      GOOGLE_REDIRECT_URI: string
      GITHUB_CLIENT_ID: string
      GITHUB_CLIENT_SECRET: string
      GITHUB_REDIRECT_URI: string
      EMAIL_FROM: string
      RESEND_API_KEY: string
      CORS_ORIGIN: string
    }
  }
}
