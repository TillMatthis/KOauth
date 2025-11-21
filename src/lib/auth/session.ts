/**
 * Session management utilities
 * Handles session creation, validation, and cleanup
 */

import { prisma } from '@/lib/prisma'
import { generateSessionId, generateToken, hashToken, getExpirationDate } from './tokens'
import type { User } from '@/types/prisma'

const REFRESH_TOKEN_EXPIRY_DAYS = 7
const SESSION_COOKIE_NAME = 'session_id'
const REFRESH_COOKIE_NAME = 'refresh_token'

/**
 * Create a new session for a user
 * @param userId - User ID to create session for
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent string
 * @returns Session ID and refresh token
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  // Generate tokens
  const sessionId = generateSessionId()
  const refreshToken = generateToken()
  const refreshTokenHash = await hashToken(refreshToken)

  // Calculate expiration
  const expiresAt = getExpirationDate(REFRESH_TOKEN_EXPIRY_DAYS)

  // Create session in database
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      refreshToken: refreshTokenHash,
      expiresAt,
      ipAddress,
      userAgent
    }
  })

  return {
    sessionId,
    refreshToken,
    expiresAt
  }
}

/**
 * Validate a session by session ID
 * @param sessionId - Session ID to validate
 * @returns User data if session is valid, null otherwise
 */
export async function validateSession(
  sessionId: string
): Promise<(User & { sessionId: string }) | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true }
  })

  if (!session) {
    return null
  }

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    await deleteSession(sessionId)
    return null
  }

  return {
    ...session.user,
    sessionId: session.id
  }
}

/**
 * Refresh a session using a refresh token
 * Implements refresh token rotation for security
 * @param sessionId - Current session ID
 * @param refreshToken - Refresh token
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 * @returns New session ID and refresh token
 */
export async function refreshSession(
  sessionId: string,
  refreshToken: string,
  ipAddress?: string,
  userAgent?: string
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true }
  })

  if (!session) {
    throw new Error('Session not found')
  }

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    await deleteSession(sessionId)
    throw new Error('Session expired')
  }

  // Verify refresh token (timing-safe comparison via verifyToken)
  const { verifyToken } = await import('./tokens')
  const isValid = await verifyToken(session.refreshToken, refreshToken)

  if (!isValid) {
    // Invalid refresh token - possible token reuse attack
    // Delete all sessions for this user as a security measure
    await prisma.session.deleteMany({
      where: { userId: session.userId }
    })
    throw new Error('Invalid refresh token')
  }

  // Delete old session
  await deleteSession(sessionId)

  // Create new session (refresh token rotation)
  return createSession(session.userId, ipAddress, userAgent)
}

/**
 * Delete a session
 * @param sessionId - Session ID to delete
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.session.delete({
    where: { id: sessionId }
  }).catch(() => {
    // Session might not exist, ignore error
  })
}

/**
 * Delete all sessions for a user
 * @param userId - User ID
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId }
  })
}

/**
 * Clean up expired sessions
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  })

  return result.count
}

// Export cookie names for use in route handlers
export { SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME }
