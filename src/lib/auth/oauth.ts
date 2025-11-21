/**
 * OAuth Helper Functions
 * Handles OAuth user creation and management
 */

import { prisma } from '@/lib/prisma'
import { hashPassword } from './password'
import { randomBytes } from 'crypto'

export type OAuthProvider = 'google' | 'github'

export interface OAuthUserInfo {
  provider: OAuthProvider
  providerId: string
  email: string
  emailVerified: boolean
}

/**
 * Generate a secure random password hash for OAuth users
 * OAuth users don't have real passwords, but we need to store something in passwordHash
 */
async function generateRandomPasswordHash(): Promise<string> {
  const randomPassword = randomBytes(32).toString('base64')
  return hashPassword(randomPassword)
}

/**
 * Find or create a user based on OAuth provider information
 * @param userInfo - OAuth user information
 * @returns User record
 */
export async function findOrCreateOAuthUser(userInfo: OAuthUserInfo) {
  const { provider, providerId, email, emailVerified } = userInfo

  // First, try to find user by provider + providerId
  let user = await prisma.user.findFirst({
    where: {
      provider,
      providerId
    }
  })

  if (user) {
    return user
  }

  // If not found by provider, check if user with this email already exists
  const existingEmailUser = await prisma.user.findUnique({
    where: { email }
  })

  if (existingEmailUser) {
    // User exists with email/password auth
    // Link this OAuth provider to the existing account
    user = await prisma.user.update({
      where: { id: existingEmailUser.id },
      data: {
        provider,
        providerId,
        emailVerified: emailVerified || existingEmailUser.emailVerified
      }
    })
    return user
  }

  // Create new user with OAuth credentials
  const passwordHash = await generateRandomPasswordHash()

  user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified,
      provider,
      providerId
    }
  })

  return user
}

/**
 * Fetch Google user information using access token
 * @param accessToken - Google OAuth access token
 * @returns Google user info
 */
export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<OAuthUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Google user info: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    provider: 'google',
    providerId: data.id,
    email: data.email,
    emailVerified: data.verified_email || false
  }
}

/**
 * Fetch GitHub user information using access token
 * @param accessToken - GitHub OAuth access token
 * @returns GitHub user info
 */
export async function fetchGitHubUserInfo(
  accessToken: string
): Promise<OAuthUserInfo> {
  // Fetch user profile
  const profileResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'KOauth'
    }
  })

  if (!profileResponse.ok) {
    throw new Error(`Failed to fetch GitHub user info: ${profileResponse.statusText}`)
  }

  const profile = await profileResponse.json()

  // Fetch primary email
  const emailsResponse = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'KOauth'
    }
  })

  if (!emailsResponse.ok) {
    throw new Error(`Failed to fetch GitHub user emails: ${emailsResponse.statusText}`)
  }

  const emails = await emailsResponse.json()
  const primaryEmail = emails.find((e: any) => e.primary) || emails[0]

  return {
    provider: 'github',
    providerId: profile.id.toString(),
    email: primaryEmail.email,
    emailVerified: primaryEmail.verified || false
  }
}
