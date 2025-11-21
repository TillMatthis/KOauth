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
    JWT_SECRET: {
      type: 'string'
    },
    JWT_EXPIRES_IN: {
      type: 'string',
      default: '15m'
    },
    REFRESH_TOKEN_EXPIRES_IN: {
      type: 'string',
      default: '7d'
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
    GITHUB_CLIENT_ID: {
      type: 'string',
      default: ''
    },
    GITHUB_CLIENT_SECRET: {
      type: 'string',
      default: ''
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
      JWT_SECRET: string
      JWT_EXPIRES_IN: string
      REFRESH_TOKEN_EXPIRES_IN: string
      GOOGLE_CLIENT_ID: string
      GOOGLE_CLIENT_SECRET: string
      GITHUB_CLIENT_ID: string
      GITHUB_CLIENT_SECRET: string
      EMAIL_FROM: string
      RESEND_API_KEY: string
      CORS_ORIGIN: string
    }
  }
}
