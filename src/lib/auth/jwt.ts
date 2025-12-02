/**
 * JWT utilities for short-lived access tokens
 * Uses jsonwebtoken for signing and verifying JWTs with RS256
 */

import jwt, { SignOptions } from 'jsonwebtoken'
import { rsaKeyManager } from './rsa-keys'

/**
 * JWT payload structure (OAuth 2.0 + OpenID Connect compatible)
 */
export interface JwtPayload {
  sub: string           // User ID (subject)
  email?: string        // User email (optional, for backward compatibility)
  client_id?: string    // OAuth client ID
  scope?: string        // Space-separated scopes
  iss?: string          // Issuer
  aud?: string | string[] // Audience
  iat?: number          // Issued at (added automatically)
  exp?: number          // Expiration (added automatically)
}

/**
 * Generate a short-lived JWT access token with RS256 signing
 * @param userId - User ID to encode in token
 * @param email - User email to encode in token (optional)
 * @param options - Additional token options
 * @returns Signed JWT access token
 */
export function generateAccessToken(
  userId: string,
  email?: string,
  options?: {
    expiresIn?: string | number
    clientId?: string
    scope?: string | string[]
    issuer?: string
    audience?: string | string[]
  }
): string {
  const expiresIn = options?.expiresIn || '15m'
  const issuer = options?.issuer || process.env.JWT_ISSUER || 'https://auth.tillmaessen.de'
  const audience = options?.audience || process.env.JWT_AUDIENCE || 'https://auth.tillmaessen.de'

  const payload: JwtPayload = {
    sub: userId,
    ...(email && { email }),
    ...(options?.clientId && { client_id: options.clientId }),
    ...(options?.scope && {
      scope: Array.isArray(options.scope) ? options.scope.join(' ') : options.scope
    })
  }

  const privateKey = rsaKeyManager.getPrivateKey()
  const kid = rsaKeyManager.getKeyId()

  return jwt.sign(payload, privateKey, {
    expiresIn: expiresIn as any,
    algorithm: 'RS256',
    issuer,
    audience,
    keyid: kid
  } as SignOptions)
}

/**
 * Verify and decode a JWT access token with RS256
 * @param token - JWT token to verify
 * @param options - Verification options
 * @returns Decoded payload if valid, null otherwise
 */
export function verifyAccessToken(
  token: string,
  options?: {
    issuer?: string
    audience?: string | string[]
  }
): JwtPayload | null {
  try {
    const issuer = options?.issuer || process.env.JWT_ISSUER || 'https://auth.tillmaessen.de'
    const audience = options?.audience || process.env.JWT_AUDIENCE || 'https://auth.tillmaessen.de'

    const publicKey = rsaKeyManager.getPublicKey()

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer,
      audience
    }) as JwtPayload

    // Ensure required fields are present
    if (!decoded.sub) {
      return null
    }

    return decoded
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null
  }
}

/**
 * Parse expiration time string to seconds
 * Supports: "15m", "1h", "7d", etc.
 * @param expiresIn - Expiration time string
 * @returns Expiration time in seconds
 */
export function parseExpiresIn(expiresIn: string): number {
  const unit = expiresIn.slice(-1)
  const value = parseInt(expiresIn.slice(0, -1), 10)

  if (isNaN(value)) {
    throw new Error(`Invalid expiration time: ${expiresIn}`)
  }

  switch (unit) {
    case 's':
      return value
    case 'm':
      return value * 60
    case 'h':
      return value * 60 * 60
    case 'd':
      return value * 24 * 60 * 60
    default:
      throw new Error(`Invalid expiration time unit: ${unit}`)
  }
}

/**
 * Create a standardized token response object
 * @param accessToken - The JWT access token
 * @param expiresIn - Token expiration time string (e.g., "15m")
 * @returns Standardized token response object
 */
export function createTokenResponse(accessToken: string, expiresIn: string) {
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: parseExpiresIn(expiresIn)
  }
}
