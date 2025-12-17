/**
 * Magic link token management
 * Handles generation, storage, and verification of magic link tokens
 * Used for email verification and password reset
 */

import { prisma } from '../prisma'
import { generateToken, hashToken, verifyToken } from './tokens'

export type MagicLinkType = 'email_verification' | 'password_reset'

// Token expiration times
const EMAIL_VERIFICATION_EXPIRES_IN_HOURS = 24
const PASSWORD_RESET_EXPIRES_IN_HOURS = 1

/**
 * Create a magic link token and store it in the database
 * @param userId - User ID
 * @param type - Token type
 * @returns The plain token (to be included in the magic link)
 */
export async function createMagicLinkToken(
  userId: string,
  type: MagicLinkType
): Promise<string> {
  // Generate secure random token
  const plainToken = generateToken()

  // Hash the token for storage
  const tokenHash = await hashToken(plainToken)

  // Calculate expiration time
  const expiresInHours = type === 'email_verification'
    ? EMAIL_VERIFICATION_EXPIRES_IN_HOURS
    : PASSWORD_RESET_EXPIRES_IN_HOURS

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + expiresInHours)

  // Store token in database
  await prisma.magicLinkToken.create({
    data: {
      userId,
      token: tokenHash,
      type,
      expiresAt,
      used: false
    }
  })

  return plainToken
}

/**
 * Verify a magic link token
 * @param plainToken - The plain token from the magic link
 * @param type - Expected token type
 * @returns User ID if token is valid, null otherwise
 */
export async function verifyMagicLinkToken(
  plainToken: string,
  type: MagicLinkType
): Promise<string | null> {
  // Find all tokens of this type that haven't expired
  const tokens = await prisma.magicLinkToken.findMany({
    where: {
      type,
      used: false,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: true
    }
  })

  // Try to match the token against stored hashes
  for (const tokenRecord of tokens) {
    const isValid = await verifyToken(tokenRecord.token, plainToken)
    if (isValid) {
      // Mark token as used
      await prisma.magicLinkToken.update({
        where: { id: tokenRecord.id },
        data: { used: true }
      })

      return tokenRecord.userId
    }
  }

  return null
}

/**
 * Invalidate all magic link tokens for a user (e.g., after password reset)
 * @param userId - User ID
 * @param type - Optional token type to invalidate (if not provided, invalidates all types)
 */
export async function invalidateUserMagicLinkTokens(
  userId: string,
  type?: MagicLinkType
): Promise<void> {
  await prisma.magicLinkToken.updateMany({
    where: {
      userId,
      ...(type ? { type } : {}),
      used: false
    },
    data: {
      used: true
    }
  })
}

/**
 * Clean up expired tokens (can be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.magicLinkToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  })

  return result.count
}
