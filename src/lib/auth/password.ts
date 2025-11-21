/**
 * Password hashing utilities using Argon2id
 * Argon2id is the recommended algorithm for password hashing (OWASP, 2024)
 */

import * as argon2 from 'argon2'

/**
 * Argon2id configuration optimized for security and performance
 * Based on OWASP recommendations
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1
}

/**
 * Hash a password using Argon2id
 * @param password - Plain text password to hash
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS)
}

/**
 * Verify a password against a hash
 * @param hash - Stored password hash
 * @param password - Plain text password to verify
 * @returns True if password matches hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch (error) {
    // Invalid hash format or other errors
    return false
  }
}

/**
 * Check if a password hash needs to be rehashed
 * This is useful for upgrading to stronger parameters over time
 * @param hash - Password hash to check
 * @returns True if hash should be regenerated
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS)
}
