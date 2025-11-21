/**
 * GitHub OAuth Routes
 * Implements OAuth 2.0 flow for GitHub authentication
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { fetchGitHubUserInfo, findOrCreateOAuthUser } from '@/lib/auth/oauth'
import { createSession, SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/session'
import { z } from 'zod'

/**
 * GET /auth/github
 * Redirect user to GitHub OAuth authorization screen
 */
export async function githubAuthRoute(app: FastifyInstance) {
  app.get('/auth/github', async (request: FastifyRequest, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'github-auth' })

    try {
      const { GITHUB_CLIENT_ID, GITHUB_REDIRECT_URI } = app.config

      if (!GITHUB_CLIENT_ID || !GITHUB_REDIRECT_URI) {
        logger.error('GitHub OAuth not configured')
        return reply.redirect('/?error=oauth_not_configured')
      }

      // Build GitHub OAuth authorization URL
      const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_REDIRECT_URI,
        scope: 'user:email',
        allow_signup: 'true'
      })

      const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`

      logger.info('Redirecting to GitHub OAuth')
      return reply.redirect(authUrl)
    } catch (error) {
      logger.error({ error }, 'GitHub auth redirect failed')
      return reply.redirect('/?error=oauth_redirect_failed')
    }
  })
}

const callbackQuerySchema = z.object({
  code: z.string(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional()
})

/**
 * GET /auth/github/callback
 * Handle OAuth callback from GitHub
 */
export async function githubCallbackRoute(app: FastifyInstance) {
  app.get('/auth/github/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const logger = request.log.child({ route: 'github-callback' })

    try {
      // Validate query parameters
      const queryResult = callbackQuerySchema.safeParse(request.query)

      if (!queryResult.success) {
        logger.warn({ errors: queryResult.error }, 'Invalid callback query')
        return reply.redirect('/?error=invalid_callback')
      }

      const { code, error, error_description } = queryResult.data

      // Check for OAuth error
      if (error) {
        logger.warn({ error, error_description }, 'OAuth error from GitHub')
        return reply.redirect(`/?error=${encodeURIComponent(error)}`)
      }

      const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI } = app.config

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI
        })
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text()
        logger.error({ status: tokenResponse.status, error: errorData }, 'Token exchange failed')
        return reply.redirect('/?error=token_exchange_failed')
      }

      const tokenData = await tokenResponse.json()
      const accessToken = tokenData.access_token

      if (!accessToken) {
        logger.error({ tokenData }, 'No access token received')
        return reply.redirect('/?error=no_access_token')
      }

      // Fetch user information from GitHub
      logger.info('Fetching GitHub user info')
      const userInfo = await fetchGitHubUserInfo(accessToken)

      // Find or create user
      logger.info({ email: userInfo.email, provider: 'github' }, 'Finding or creating user')
      const user = await findOrCreateOAuthUser(userInfo)

      // Create session
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']
      const { sessionId, refreshToken, expiresAt } = await createSession(
        user.id,
        ipAddress,
        userAgent
      )

      logger.info({ userId: user.id, sessionId }, 'GitHub OAuth login successful')

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
          path: '/auth',
          expires: expiresAt
        })

      // Redirect to home page (success)
      return reply.redirect('/')
    } catch (error) {
      logger.error({ error }, 'GitHub OAuth callback failed')
      return reply.redirect('/?error=oauth_callback_failed')
    }
  })
}
