/**
 * OAuth Client Info API
 * Public endpoint to get OAuth client information for the consent screen
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getClientById } from '../../../lib/auth/oauth-server'

/**
 * Register OAuth client info routes
 */
export async function clientInfoRoutes(app: FastifyInstance) {
  // GET /api/oauth/clients/:clientId - Get public client information
  app.get<{ Params: { clientId: string } }>(
    '/clients/:clientId',
    async (request: FastifyRequest<{ Params: { clientId: string } }>, reply: FastifyReply) => {
      try {
        const { clientId } = request.params

        // Get client from database
        const client = await getClientById(clientId)

        if (!client || !client.active) {
          return reply.status(404).send({
            success: false,
            error: 'Client not found or inactive'
          })
        }

        // Return only public information (not client secret)
        return reply.status(200).send({
          success: true,
          client: {
            name: client.name,
            description: client.description,
            logoUrl: client.logoUrl,
            websiteUrl: client.websiteUrl
          }
        })
      } catch (error) {
        request.log.error(error, 'Error fetching client info')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch client info'
        })
      }
    }
  )
}
