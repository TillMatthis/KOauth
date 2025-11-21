/**
 * Prisma type definitions
 * Provides type safety for database models
 */

export interface User {
  id: string
  email: string
  passwordHash: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  userId: string
  refreshToken: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  updatedAt: Date
}
