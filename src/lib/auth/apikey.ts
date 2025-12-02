/**
 * API Key management utilities
 * Handles generation and validation of JWT-based API keys
 */

import { randomBytes } from 'crypto'
import { prisma } from '../prisma'
import type { UserApiKey } from '../../types/prisma'
import { generateApiKeyToken, verifyAccessToken, type RsaKeyConfig } from './jwt'

/**
 * Generate a new JWT-based API key
 * @param userId - User ID to encode in token
 * @param email - User email to encode in token
 * @param rsaKeys - RSA key configuration for signing
 * @param expiresInDays - Optional expiration in days (default: 90 days)
 * @param issuer - Issuer URL (KOauth base URL)
 * @param audience - Audience list (resource servers)
 * @returns Object containing the JWT token and token ID (jti)
 */
export async function generateApiKey(
  userId: string,
  email: string,
  rsaKeys: RsaKeyConfig,
  expiresInDays: number = 90,
  issuer?: string,
  audience?: string[]
) {
  // Generate unique token ID (jti) for revocation tracking
  const jti = randomBytes(16).toString('base64url')

  // Calculate expiration time
  const expiresIn = expiresInDays > 0 ? `${expiresInDays}d` : '90d'

  // Generate JWT token
  const fullKey = generateApiKeyToken(
    userId,
    email,
    rsaKeys,
    jti,
    expiresIn,
    issuer,
    audience
  )

  return {
    fullKey,
    jti,
    expiresInDays
  }
}

/**
 * Create a new JWT-based API key for a user
 * @param userId - User ID to create key for
 * @param email - User email
 * @param name - Friendly name for the key
 * @param rsaKeys - RSA key configuration for signing
 * @param expiresInDays - Optional expiration in days (default: 90 days)
 * @param issuer - Issuer URL
 * @param audience - Audience list
 * @returns Created API key record and the full JWT token (only returned once)
 */
export async function createApiKey(
  userId: string,
  email: string,
  name: string,
  rsaKeys: RsaKeyConfig,
  expiresInDays: number = 90,
  issuer?: string,
  audience?: string[]
): Promise<{ apiKey: UserApiKey; fullKey: string }> {
  // Generate the JWT-based API key
  const { fullKey, jti, expiresInDays: expDays } = await generateApiKey(
    userId,
    email,
    rsaKeys,
    expiresInDays,
    issuer,
    audience
  )

  // Calculate expiration date
  let expiresAt: Date | null = null
  if (expDays > 0) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expDays)
  }

  // Create in database (store jti for revocation tracking)
  const apiKey = await prisma.userApiKey.create({
    data: {
      userId,
      name,
      prefix: jti.substring(0, 8), // Use first 8 chars of jti as prefix for display
      keyHash: jti, // Store jti instead of hash for JWT-based keys
      expiresAt
    }
  })

  return { apiKey, fullKey }
}

/**
 * Validate a JWT-based API key and return the associated user
 * @param apiKey - JWT token to validate
 * @param rsaKeys - RSA key configuration for verification
 * @param expectedIssuer - Optional expected issuer
 * @param expectedAudience - Optional expected audience
 * @returns User data if valid, null otherwise
 */
export async function validateApiKey(
  apiKey: string,
  rsaKeys: RsaKeyConfig,
  expectedIssuer?: string,
  expectedAudience?: string[]
): Promise<{ id: string; email: string } | null> {
  try {
    // Verify the JWT token
    const payload = verifyAccessToken(apiKey, rsaKeys, expectedAudience, expectedIssuer)

    if (!payload) {
      return null
    }

    // Check if this is an API key token
    if (payload.type !== 'api_key') {
      return null
    }

    // Check if the key has been revoked
    if (payload.jti) {
      const keyRecord = await prisma.userApiKey.findFirst({
        where: {
          keyHash: payload.jti,
          userId: payload.sub
        },
        include: { user: true }
      })

      if (!keyRecord) {
        // Key has been revoked (not found in database)
        return null
      }

      // Check if key has expired in database
      if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        return null
      }

      // Update last used timestamp
      await prisma.userApiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() }
      }).catch(() => {
        // Ignore update errors (non-critical)
      })
    }

    return {
      id: payload.sub,
      email: payload.email
    }
  } catch (error) {
    return null
  }
}

/**
 * List all API keys for a user (without full keys)
 * @param userId - User ID
 * @returns Array of API key records
 */
export async function listApiKeys(userId: string) {
  return prisma.userApiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      prefix: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })
}

/**
 * Revoke (delete) an API key
 * @param userId - User ID (for authorization check)
 * @param keyId - API key ID to revoke
 * @returns True if deleted, false if not found or unauthorized
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  try {
    await prisma.userApiKey.delete({
      where: {
        id: keyId,
        userId // Ensure user owns this key
      }
    })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Clean up expired API keys
 * Should be run periodically (e.g., via cron job)
 * @returns Number of keys deleted
 */
export async function cleanupExpiredApiKeys(): Promise<number> {
  const result = await prisma.userApiKey.deleteMany({
    where: {
      expiresAt: {
        not: null,
        lt: new Date()
      }
    }
  })

  return result.count
}
