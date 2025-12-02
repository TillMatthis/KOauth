/**
 * JWKS (JSON Web Key Set) Endpoint
 * Public endpoint that exposes RSA public key for JWT verification
 * GET /.well-known/jwks.json - Returns JWKS with public key
 */

import type { FastifyInstance } from 'fastify'
import { createJwks, type RsaKeyPair } from '../config/keys'

/**
 * Register the JWKS endpoint
 * This is a public endpoint (no authentication required)
 * Returns the public key in JWKS format for JWT verification
 */
export async function jwksRoute(app: FastifyInstance) {
  app.get('/.well-known/jwks.json', async (request, reply) => {
    try {
      // Get RSA keys from app context
      const rsaKeys = (app as any).rsaKeys as RsaKeyPair

      if (!rsaKeys) {
        request.log.error('RSA keys not initialized')
        return reply.status(500).send({
          error: 'Internal server error'
        })
      }

      // Create JWKS response
      const jwks = createJwks(rsaKeys)

      // Set cache headers (cache for 1 hour)
      reply.header('Cache-Control', 'public, max-age=3600')
      reply.header('Content-Type', 'application/json')

      return reply.status(200).send(jwks)
    } catch (error) {
      request.log.error(error, 'Error generating JWKS')
      return reply.status(500).send({
        error: 'Internal server error'
      })
    }
  })
}
