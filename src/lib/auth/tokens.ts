/**
 * Token generation and hashing utilities
 * Uses Node.js crypto for secure random token generation and scrypt for hashing
 */

import { randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

// Token configuration
const TOKEN_LENGTH = 32 // 256 bits
const SCRYPT_KEYLEN = 64

/**
 * Generate a cryptographically secure random token
 * @returns Base64-encoded random token
 */
export function generateToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('base64url')
}

/**
 * Generate a CUID-like identifier for session IDs
 * @returns Random session ID
 */
export function generateSessionId(): string {
  return `sess_${randomBytes(16).toString('base64url')}`
}

/**
 * Hash a token using scrypt
 * Format: salt$hash (both base64url encoded)
 * @param token - Token to hash
 * @returns Hashed token with salt
 */
export async function hashToken(token: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = (await scryptAsync(
    token,
    salt,
    SCRYPT_KEYLEN
  )) as Buffer

  return `${salt.toString('base64url')}$${hash.toString('base64url')}`
}

/**
 * Verify a token against a hash
 * @param hash - Stored hash (format: salt$hash)
 * @param token - Token to verify
 * @returns True if token matches hash
 */
export async function verifyToken(hash: string, token: string): Promise<boolean> {
  try {
    const [saltStr, hashStr] = hash.split('$')
    if (!saltStr || !hashStr) {
      return false
    }

    const salt = Buffer.from(saltStr, 'base64url')
    const storedHash = Buffer.from(hashStr, 'base64url')

    const derivedHash = (await scryptAsync(
      token,
      salt,
      SCRYPT_KEYLEN
    )) as Buffer

    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(storedHash, derivedHash)
  } catch (error) {
    return false
  }
}

/**
 * Calculate expiration date for tokens
 * @param daysFromNow - Number of days until expiration
 * @returns Date object representing expiration time
 */
export function getExpirationDate(daysFromNow: number): Date {
  const now = new Date()
  now.setDate(now.getDate() + daysFromNow)
  return now
}
