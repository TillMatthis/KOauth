/**
 * API Key management utilities
 * Handles generation, hashing, and validation of personal API keys
 */

import { randomBytes } from 'crypto'
import { hashToken, verifyToken } from './tokens'
import { prisma } from '../prisma'
import type { UserApiKey } from '../../types/prisma'

// API key configuration
const PREFIX_LENGTH = 6 // Length of the visible prefix
const KEY_LENGTH = 32 // Length of the secret part

/**
 * Generate a new API key with format: koa_PREFIX_SECRET
 * @returns Object containing the full key, prefix, and hash
 */
export async function generateApiKey() {
  // Generate prefix (6 chars, base64url)
  const prefix = randomBytes(PREFIX_LENGTH).toString('base64url').slice(0, PREFIX_LENGTH)

  // Generate secret part (32 bytes, base64url)
  const secret = randomBytes(KEY_LENGTH).toString('base64url')

  // Full key format: koa_PREFIX_SECRET
  const fullKey = `koa_${prefix}_${secret}`

  // Hash the full key for storage
  const keyHash = await hashToken(fullKey)

  return {
    fullKey,
    prefix,
    keyHash
  }
}

/**
 * Create a new API key for a user
 * @param userId - User ID to create key for
 * @param name - Friendly name for the key
 * @param expiresInDays - Optional expiration in days (0 = no expiration)
 * @returns Created API key record and the full key (only returned once)
 */
export async function createApiKey(
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<{ apiKey: UserApiKey; fullKey: string }> {
  // Generate the key
  const { fullKey, prefix, keyHash } = await generateApiKey()

  // Calculate expiration date if specified
  let expiresAt: Date | null = null
  if (expiresInDays && expiresInDays > 0) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
  }

  // Create in database
  const apiKey = await prisma.userApiKey.create({
    data: {
      userId,
      name,
      prefix,
      keyHash,
      expiresAt
    }
  })

  return { apiKey, fullKey }
}

/**
 * Validate an API key and return the associated user
 * @param apiKey - Full API key to validate
 * @returns User data if valid, null otherwise
 */
export async function validateApiKey(apiKey: string): Promise<{ id: string; email: string } | null> {
  try {
    // Parse the API key format: koa_PREFIX_SECRET
    // PREFIX is always 6 chars (may contain underscores since it's base64url)
    // SECRET is variable length (may contain underscores)
    // Format: koa_ (4) + PREFIX (6) + _ (1) + SECRET (rest)
    // Min length: 11 chars (koa_ + 6 + _)

    if (!apiKey.startsWith('koa_') || apiKey.length < 11) {
      return null
    }

    // Extract the 6-char prefix (positions 4-9)
    const prefix = apiKey.substring(4, 10)

    // Verify separator at position 10
    if (apiKey[10] !== '_') {
      return null
    }

    // Find API key by prefix
    const keyRecord = await prisma.userApiKey.findUnique({
      where: { prefix },
      include: { user: true }
    })

    if (!keyRecord) {
      return null
    }

    // Check if key has expired
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return null
    }

    // Verify the key hash (timing-safe comparison)
    const isValid = await verifyToken(keyRecord.keyHash, apiKey)

    if (!isValid) {
      return null
    }

    // Update last used timestamp
    await prisma.userApiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() }
    }).catch(() => {
      // Ignore update errors (non-critical)
    })

    return {
      id: keyRecord.user.id,
      email: keyRecord.user.email
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
