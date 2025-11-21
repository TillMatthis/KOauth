/**
 * Type definitions for KOauth client SDK
 */

/**
 * Authenticated user information returned from KOauth
 */
export interface KOauthUser {
  id: string
  email: string
  sessionId?: string
}

/**
 * Configuration options for KOauth client
 */
export interface KOauthOptions {
  /**
   * Base URL of your KOauth server (e.g., "https://auth.example.com")
   */
  baseUrl: string

  /**
   * Optional timeout for auth validation requests (in milliseconds)
   * @default 5000
   */
  timeout?: number

  /**
   * Optional custom error handler
   */
  onError?: (error: Error) => void
}

/**
 * Express-compatible request with user property
 */
export interface ExpressRequestWithUser {
  user?: KOauthUser
  headers: Record<string, string | string[] | undefined>
  cookies?: Record<string, string>
}

/**
 * Fastify-compatible request with user property
 */
export interface FastifyRequestWithUser {
  user?: KOauthUser
  headers: Record<string, string | string[] | undefined>
  cookies: Record<string, string | undefined>
}

/**
 * Generic request type that works with both Express and Fastify
 */
export type KOauthRequest = ExpressRequestWithUser | FastifyRequestWithUser
