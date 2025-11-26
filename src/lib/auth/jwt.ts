/**
 * JWT utilities for short-lived access tokens
 * Uses jsonwebtoken for signing and verifying JWTs
 */

import jwt, { SignOptions } from 'jsonwebtoken'

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string      // User ID (subject)
  email: string    // User email
  iat?: number     // Issued at (added automatically)
  exp?: number     // Expiration (added automatically)
}

/**
 * Generate a short-lived JWT access token
 * @param userId - User ID to encode in token
 * @param email - User email to encode in token
 * @param jwtSecret - Secret key for signing
 * @param expiresIn - Token expiration time (e.g., "15m", "1h")
 * @returns Signed JWT access token
 */
export function generateAccessToken(
  userId: string,
  email: string,
  jwtSecret: string,
  expiresIn: string | number = '15m'
): string {
  const payload: JwtPayload = {
    sub: userId,
    email
  }

  return jwt.sign(payload, jwtSecret, {
    expiresIn: expiresIn as any,
    algorithm: 'HS256'
  } as SignOptions)
}

/**
 * Verify and decode a JWT access token
 * @param token - JWT token to verify
 * @param jwtSecret - Secret key for verification
 * @returns Decoded payload if valid, null otherwise
 */
export function verifyAccessToken(
  token: string,
  jwtSecret: string
): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256']
    }) as JwtPayload

    // Ensure required fields are present
    if (!decoded.sub || !decoded.email) {
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
