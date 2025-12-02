/**
 * Google OAuth Routes
 * Implements OAuth 2.0 flow for Google authentication
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { fetchGoogleUserInfo, findOrCreateOAuthUser } from '../../lib/auth/oauth'
import { createSession, SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../../lib/auth/session'
import { generateAccessToken } from '../../lib/auth/jwt'
import { z } from 'zod'

/**
 * GET /api/auth/google
 * Redirect user to Google OAuth consent screen
 */
export async function googleAuthRoute(app: FastifyInstance) {
  app.get('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'google-auth' })

    try {
      const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = app.config

      if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
        logger.error('Google OAuth not configured')
        return reply.redirect('/?error=oauth_not_configured')
      }

      // Build Google OAuth authorization URL
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'online',
        prompt: 'select_account'
      })

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

      logger.info('Redirecting to Google OAuth')
      return reply.redirect(authUrl)
    } catch (error) {
      logger.error({ error }, 'Google auth redirect failed')
      return reply.redirect('/?error=oauth_redirect_failed')
    }
  })
}

const callbackQuerySchema = z.object({
  code: z.string(),
  state: z.string().optional(),
  error: z.string().optional()
})

/**
 * GET /api/auth/google/callback
 * Handle OAuth callback from Google
 */
export async function googleCallbackRoute(app: FastifyInstance) {
  app.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'google-callback' })

    try {
      // Validate query parameters
      const queryResult = callbackQuerySchema.safeParse(request.query)

      if (!queryResult.success) {
        logger.warn({ errors: queryResult.error }, 'Invalid callback query')
        return reply.redirect('/?error=invalid_callback')
      }

      const { code, error } = queryResult.data

      // Check for OAuth error
      if (error) {
        logger.warn({ error }, 'OAuth error from Google')
        return reply.redirect(`/?error=${encodeURIComponent(error)}`)
      }

      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = app.config

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text()
        logger.error({ status: tokenResponse.status, error: errorData }, 'Token exchange failed')
        return reply.redirect('/?error=token_exchange_failed')
      }

      const tokenData = await tokenResponse.json() as any
      const googleAccessToken = tokenData.access_token

      if (!googleAccessToken) {
        logger.error('No access token received')
        return reply.redirect('/?error=no_access_token')
      }

      // Fetch user information from Google
      logger.info('Fetching Google user info')
      const userInfo = await fetchGoogleUserInfo(googleAccessToken)

      // Find or create user
      logger.info({ email: userInfo.email, provider: 'google' }, 'Finding or creating user')
      const user = await findOrCreateOAuthUser(userInfo)

      // Create session
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']
      const { sessionId, refreshToken, expiresAt } = await createSession(
        user.id,
        ipAddress,
        userAgent
      )

      logger.info({ userId: user.id, sessionId }, 'Google OAuth login successful')

      // Generate JWT access token with RS256
      const jwtToken = generateAccessToken(user.id, user.email, {
        expiresIn: app.config.JWT_EXPIRES_IN
      })

      // Set HTTP-only cookies
      reply
        .setCookie(SESSION_COOKIE_NAME, sessionId, {
          httpOnly: true,
          secure: app.config.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          expires: expiresAt
        })
        .setCookie(REFRESH_COOKIE_NAME, refreshToken, {
          httpOnly: true,
          secure: app.config.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/api/auth',
          expires: expiresAt
        })

      // For OAuth flows, we redirect with the token as a query parameter
      // (Frontend can extract and store it for API calls)
      return reply.redirect(`/?access_token=${jwtToken}`)
    } catch (error) {
      logger.error({ error }, 'Google OAuth callback failed')
      return reply.redirect('/?error=oauth_callback_failed')
    }
  })
}
