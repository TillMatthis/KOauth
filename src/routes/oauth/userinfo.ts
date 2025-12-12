/**
 * OpenID Connect UserInfo Endpoint
 * GET /oauth/userinfo - Returns user information based on access token
 * 
 * Per OpenID Connect Core 1.0 specification:
 * - Requires Bearer token authentication
 * - Returns claims based on requested scopes
 * - Must validate token signature and expiration
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from '../../lib/auth/jwt'
import { prisma } from '../../lib/prisma'

/**
 * Register the OpenID Connect UserInfo endpoint
 */
export async function userinfoRoute(app: FastifyInstance) {
  app.get('/userinfo', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = request.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Missing or invalid Authorization header'
        })
      }

      const token = authHeader.substring(7)
      const rsaKeys = (app as any).rsaKeys
      const audience = (app as any).jwtAudience
      const issuer = app.config.JWT_ISSUER

      // Verify the access token
      const payload = verifyAccessToken(token, rsaKeys, audience, issuer)
      if (!payload) {
        return reply.status(401).send({
          error: 'invalid_token',
          error_description: 'Invalid or expired access token'
        })
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: payload.sub }
      })

      if (!user) {
        return reply.status(401).send({
          error: 'invalid_token',
          error_description: 'User not found'
        })
      }

      // Extract scopes from token
      const scopes = payload.scope ? payload.scope.split(' ') : []

      // Build userinfo response based on requested scopes
      // Per OpenID Connect spec, 'sub' is always included
      const userinfo: any = {
        sub: user.id
      }

      // Include email if 'email' or 'openid' scope is present
      if (scopes.includes('email') || scopes.includes('openid')) {
        userinfo.email = user.email
        userinfo.email_verified = user.emailVerified
      }

      // Include profile information if 'profile' or 'openid' scope is present
      if (scopes.includes('profile') || scopes.includes('openid')) {
        // Note: We don't have a name field in the user model yet
        // You can add more profile fields as needed
        userinfo.email = user.email
        userinfo.email_verified = user.emailVerified
      }

      // Set appropriate headers
      reply.header('Content-Type', 'application/json')
      reply.header('Cache-Control', 'no-store')
      reply.header('Pragma', 'no-cache')

      return reply.status(200).send(userinfo)
    } catch (error) {
      request.log.error({
        msg: 'UserInfo endpoint error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'UserInfo endpoint error')
      
      return reply.status(500).send({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    }
  })

  // Handle OPTIONS for CORS
  app.options('/userinfo', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    return reply.status(204).send()
  })
}
