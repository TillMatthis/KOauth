/**
 * JWT utilities for short-lived access tokens
 * Uses RS256 (RSA) for JWT signing with asymmetric keys
 */

import jwt, { SignOptions } from 'jsonwebtoken'

/**
 * JWT token types
 */
export type TokenType = 'access_token' | 'refresh_token' | 'api_key'

/**
 * JWT payload structure with enhanced claims
 */
export interface JwtPayload {
  sub: string           // User ID (subject)
  email: string         // User email
  iss?: string          // Issuer (KOauth base URL)
  aud?: string[]        // Audience (resource servers)
  type?: TokenType      // Token type
  jti?: string          // JWT ID (for revocation)
  scope?: string        // OAuth scopes (space-separated)
  iat?: number          // Issued at (added automatically)
  exp?: number          // Expiration (added automatically)
}

/**
 * RSA key configuration for JWT signing
 */
export interface RsaKeyConfig {
  privateKey: string    // RSA private key (PEM format)
  publicKey: string     // RSA public key (PEM format)
  kid: string           // Key ID for JWT header
}

/**
 * Generate a short-lived JWT access token using RS256
 * @param userId - User ID to encode in token
 * @param email - User email to encode in token
 * @param rsaKeys - RSA key configuration (private key, public key, kid)
 * @param expiresIn - Token expiration time (e.g., "15m", "1h")
 * @param issuer - Issuer URL (KOauth base URL)
 * @param audience - Audience list (resource servers)
 * @param scope - OAuth scopes (space-separated string)
 * @returns Signed JWT access token
 */
export function generateAccessToken(
  userId: string,
  email: string,
  rsaKeys: RsaKeyConfig,
  expiresIn: string | number = '15m',
  issuer?: string,
  audience?: string[],
  scope?: string
): string {
  // Generate unique JWT ID for token tracking and revocation
  const jti = `at_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

  const payload: JwtPayload = {
    sub: userId,
    email,
    type: 'access_token',
    jti
  }

  if (issuer) {
    payload.iss = issuer
  }

  if (audience && audience.length > 0) {
    payload.aud = audience
  }

  if (scope) {
    payload.scope = scope
  }

  return jwt.sign(payload, rsaKeys.privateKey, {
    expiresIn: expiresIn as any,
    algorithm: 'RS256',
    keyid: rsaKeys.kid
  } as SignOptions)
}

/**
 * Generate a refresh token JWT using RS256
 * @param userId - User ID to encode in token
 * @param email - User email to encode in token
 * @param rsaKeys - RSA key configuration
 * @param tokenId - Unique token ID (jti) for revocation tracking
 * @param expiresIn - Token expiration time (e.g., "7d", "30d")
 * @param issuer - Issuer URL
 * @param audience - Audience list
 * @returns Signed refresh token JWT
 */
export function generateRefreshToken(
  userId: string,
  email: string,
  rsaKeys: RsaKeyConfig,
  tokenId: string,
  expiresIn: string | number = '30d',
  issuer?: string,
  audience?: string[]
): string {
  const payload: JwtPayload = {
    sub: userId,
    email,
    type: 'refresh_token',
    jti: tokenId
  }

  if (issuer) {
    payload.iss = issuer
  }

  if (audience && audience.length > 0) {
    payload.aud = audience
  }

  return jwt.sign(payload, rsaKeys.privateKey, {
    expiresIn: expiresIn as any,
    algorithm: 'RS256',
    keyid: rsaKeys.kid
  } as SignOptions)
}

/**
 * Generate an API key JWT using RS256
 * @param userId - User ID to encode in token
 * @param email - User email to encode in token
 * @param rsaKeys - RSA key configuration
 * @param tokenId - Unique token ID (jti) for revocation tracking
 * @param expiresIn - Token expiration time (default: 90 days)
 * @param issuer - Issuer URL
 * @param audience - Audience list
 * @returns Signed API key JWT
 */
export function generateApiKeyToken(
  userId: string,
  email: string,
  rsaKeys: RsaKeyConfig,
  tokenId: string,
  expiresIn: string | number = '90d',
  issuer?: string,
  audience?: string[]
): string {
  const payload: JwtPayload = {
    sub: userId,
    email,
    type: 'api_key',
    jti: tokenId
  }

  if (issuer) {
    payload.iss = issuer
  }

  if (audience && audience.length > 0) {
    payload.aud = audience
  }

  return jwt.sign(payload, rsaKeys.privateKey, {
    expiresIn: expiresIn as any,
    algorithm: 'RS256',
    keyid: rsaKeys.kid
  } as SignOptions)
}

/**
 * Verify and decode a JWT token using RS256
 * @param token - JWT token to verify
 * @param rsaKeys - RSA key configuration (public key for verification)
 * @param expectedAudience - Optional expected audience to validate
 * @param expectedIssuer - Optional expected issuer to validate
 * @returns Decoded payload if valid, null otherwise
 */
export function verifyAccessToken(
  token: string,
  rsaKeys: RsaKeyConfig,
  expectedAudience?: string[],
  expectedIssuer?: string
): JwtPayload | null {
  try {
    const options: any = {
      algorithms: ['RS256']
    }

    if (expectedAudience && expectedAudience.length > 0) {
      options.audience = expectedAudience
    }

    if (expectedIssuer) {
      options.issuer = expectedIssuer
    }

    const decoded = jwt.verify(token, rsaKeys.publicKey, options)

    // Type guard to ensure it's a JwtPayload
    if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
      return null
    }

    const payload = decoded as unknown as JwtPayload

    // Ensure required fields are present
    if (!payload.sub || !payload.email) {
      return null
    }

    return payload
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

/**
 * Extract scopes from JWT payload
 * @param payload - JWT payload
 * @returns Array of scope strings, empty array if no scopes
 */
export function getTokenScopes(payload: JwtPayload): string[] {
  if (!payload.scope) {
    return []
  }
  return payload.scope.split(' ').filter(scope => scope.length > 0)
}

/**
 * Check if JWT payload has a specific scope
 * @param payload - JWT payload
 * @param requiredScope - Required scope to check
 * @returns True if the payload contains the required scope
 */
export function hasScope(payload: JwtPayload, requiredScope: string): boolean {
  const scopes = getTokenScopes(payload)
  return scopes.includes(requiredScope)
}

/**
 * Check if JWT payload has any of the required scopes
 * @param payload - JWT payload
 * @param requiredScopes - Array of scopes to check (at least one must be present)
 * @returns True if the payload contains at least one of the required scopes
 */
export function hasAnyScope(payload: JwtPayload, requiredScopes: string[]): boolean {
  const scopes = getTokenScopes(payload)
  return requiredScopes.some(scope => scopes.includes(scope))
}

/**
 * OpenID Connect ID Token payload structure
 */
export interface IdTokenPayload {
  sub: string           // User ID (subject) - REQUIRED
  iss: string           // Issuer - REQUIRED
  aud: string           // Audience (client_id) - REQUIRED
  exp: number           // Expiration time - REQUIRED
  iat: number           // Issued at - REQUIRED
  auth_time?: number    // Authentication time (when user authenticated)
  nonce?: string        // Nonce for replay protection
  email?: string        // User email (if email scope requested)
  email_verified?: boolean // Email verification status (if email scope requested)
  name?: string         // User name (if profile scope requested)
}

/**
 * Generate an OpenID Connect ID token
 * @param userId - User ID (subject)
 * @param email - User email
 * @param emailVerified - Whether email is verified
 * @param clientId - OAuth client ID (audience)
 * @param rsaKeys - RSA key configuration
 * @param issuer - Issuer URL
 * @param expiresIn - Token expiration time (default: 1 hour for ID tokens)
 * @param nonce - Optional nonce for replay protection
 * @param authTime - Optional authentication time
 * @returns Signed ID token JWT
 */
export function generateIdToken(
  userId: string,
  email: string,
  emailVerified: boolean,
  clientId: string,
  rsaKeys: RsaKeyConfig,
  issuer: string,
  expiresIn: string | number = '1h',
  nonce?: string,
  authTime?: number
): string {
  const now = Math.floor(Date.now() / 1000)
  
  const payload: IdTokenPayload = {
    sub: userId,
    iss: issuer,
    aud: clientId,
    exp: now + (typeof expiresIn === 'number' ? expiresIn : parseExpiresIn(expiresIn as string)),
    iat: now,
    email,
    email_verified: emailVerified
  }

  if (nonce) {
    payload.nonce = nonce
  }

  if (authTime) {
    payload.auth_time = authTime
  }

  return jwt.sign(payload, rsaKeys.privateKey, {
    algorithm: 'RS256',
    keyid: rsaKeys.kid
  } as SignOptions)
}
