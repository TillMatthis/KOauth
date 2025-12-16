/**
 * Admin OAuth Client Management Routes
 * CRUD operations for OAuth clients
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { protectAdminRoute } from '../../../lib/auth/middleware'
import { prisma } from '../../../lib/prisma'
import { randomBytes } from 'crypto'
import { hashToken } from '../../../lib/auth/tokens'

interface CreateClientBody {
  name: string
  description?: string
  redirectUris: string[]
  trusted?: boolean
  websiteUrl?: string
  logoUrl?: string
}

interface UpdateClientBody {
  name?: string
  description?: string
  redirectUris?: string[]
  trusted?: boolean
  active?: boolean
  websiteUrl?: string
  logoUrl?: string
}

/**
 * Generate client ID from name
 */
function generateClientId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/**
 * Register OAuth client management routes
 */
export async function clientRoutes(app: FastifyInstance) {
  // GET /api/admin/clients - List all OAuth clients
  app.get(
    '/clients',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clients = await prisma.oAuthClient.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            clientId: true,
            name: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            redirectUris: true,
            trusted: true,
            active: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                authorizationCodes: true,
                refreshTokens: true
              }
            }
          }
        })

        return reply.status(200).send({
          success: true,
          clients
        })
      } catch (error) {
        request.log.error(error, 'Error listing clients')
        return reply.status(500).send({
          success: false,
          error: 'Failed to list clients'
        })
      }
    }
  )

  // GET /api/admin/clients/:clientId - Get client details
  app.get<{ Params: { clientId: string } }>(
    '/clients/:clientId',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Params: { clientId: string } }>, reply: FastifyReply) => {
      try {
        const { clientId } = request.params

        const client = await prisma.oAuthClient.findUnique({
          where: { clientId },
          select: {
            id: true,
            clientId: true,
            name: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            redirectUris: true,
            grantTypes: true,
            scopes: true,
            trusted: true,
            active: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                authorizationCodes: true,
                refreshTokens: true
              }
            }
          }
        })

        if (!client) {
          return reply.status(404).send({
            success: false,
            error: 'Client not found'
          })
        }

        return reply.status(200).send({
          success: true,
          client
        })
      } catch (error) {
        request.log.error(error, 'Error fetching client')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch client'
        })
      }
    }
  )

  // POST /api/admin/clients - Create new OAuth client
  app.post<{ Body: CreateClientBody }>(
    '/clients',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Body: CreateClientBody }>, reply: FastifyReply) => {
      try {
        const { name, description, redirectUris, trusted = false, websiteUrl, logoUrl } = request.body

        // Validate required fields
        if (!name || !redirectUris || redirectUris.length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'Name and at least one redirect URI are required'
          })
        }

        // Validate redirect URIs
        for (const uri of redirectUris) {
          try {
            new URL(uri)
          } catch (e) {
            return reply.status(400).send({
              success: false,
              error: `Invalid redirect URI: ${uri}`
            })
          }
        }

        // Generate client credentials
        const clientId = generateClientId(name)
        const clientSecret = randomBytes(32).toString('base64url')
        const clientSecretHash = await hashToken(clientSecret)

        // Check if clientId already exists
        const existing = await prisma.oAuthClient.findUnique({
          where: { clientId }
        })

        if (existing) {
          return reply.status(409).send({
            success: false,
            error: 'Client ID already exists. Please use a different name.'
          })
        }

        // Create client
        const client = await prisma.oAuthClient.create({
          data: {
            clientId,
            clientSecret: clientSecretHash,
            name,
            description: description || undefined,
            redirectUris,
            trusted,
            websiteUrl: websiteUrl || undefined,
            logoUrl: logoUrl || undefined,
            grantTypes: ['authorization_code', 'refresh_token'],
            scopes: ['openid', 'profile', 'email']
          },
          select: {
            id: true,
            clientId: true,
            name: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            redirectUris: true,
            trusted: true,
            active: true,
            createdAt: true,
            updatedAt: true
          }
        })

        // Return client with secret (only shown once)
        return reply.status(201).send({
          success: true,
          client: {
            ...client,
            clientSecret // Include secret only on creation
          },
          message: 'Client created successfully. Save the client secret now - it will not be shown again.'
        })
      } catch (error) {
        request.log.error(error, 'Error creating client')
        return reply.status(500).send({
          success: false,
          error: 'Failed to create client'
        })
      }
    }
  )

  // PATCH /api/admin/clients/:clientId - Update client
  app.patch<{ Params: { clientId: string }; Body: UpdateClientBody }>(
    '/clients/:clientId',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Params: { clientId: string }; Body: UpdateClientBody }>, reply: FastifyReply) => {
      try {
        const { clientId } = request.params
        const { name, description, redirectUris, trusted, active, websiteUrl, logoUrl } = request.body

        // Check if client exists
        const existingClient = await prisma.oAuthClient.findUnique({
          where: { clientId }
        })

        if (!existingClient) {
          return reply.status(404).send({
            success: false,
            error: 'Client not found'
          })
        }

        // Validate redirect URIs if provided
        if (redirectUris) {
          if (redirectUris.length === 0) {
            return reply.status(400).send({
              success: false,
              error: 'At least one redirect URI is required'
            })
          }

          for (const uri of redirectUris) {
            try {
              new URL(uri)
            } catch (e) {
              return reply.status(400).send({
                success: false,
                error: `Invalid redirect URI: ${uri}`
              })
            }
          }
        }

        // Build update data
        const updateData: Partial<{
          name: string
          description: string | null
          redirectUris: string[]
          trusted: boolean
          active: boolean
          websiteUrl: string | null
          logoUrl: string | null
        }> = {}

        if (name !== undefined) updateData.name = name
        if (description !== undefined) updateData.description = description || null
        if (redirectUris !== undefined) updateData.redirectUris = redirectUris
        if (trusted !== undefined) updateData.trusted = trusted
        if (active !== undefined) updateData.active = active
        if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl || null
        if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null

        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'No fields to update'
          })
        }

        const updatedClient = await prisma.oAuthClient.update({
          where: { clientId },
          data: updateData,
          select: {
            id: true,
            clientId: true,
            name: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            redirectUris: true,
            trusted: true,
            active: true,
            createdAt: true,
            updatedAt: true
          }
        })

        return reply.status(200).send({
          success: true,
          client: updatedClient
        })
      } catch (error) {
        request.log.error(error, 'Error updating client')
        return reply.status(500).send({
          success: false,
          error: 'Failed to update client'
        })
      }
    }
  )

  // DELETE /api/admin/clients/:clientId - Delete client
  app.delete<{ Params: { clientId: string } }>(
    '/clients/:clientId',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Params: { clientId: string } }>, reply: FastifyReply) => {
      try {
        const { clientId } = request.params

        const existingClient = await prisma.oAuthClient.findUnique({
          where: { clientId },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                authorizationCodes: true,
                refreshTokens: true
              }
            }
          }
        })

        if (!existingClient) {
          return reply.status(404).send({
            success: false,
            error: 'Client not found'
          })
        }

        // Delete client (cascade will handle related records)
        await prisma.oAuthClient.delete({
          where: { clientId }
        })

        return reply.status(200).send({
          success: true,
          message: 'Client deleted successfully'
        })
      } catch (error) {
        request.log.error(error, 'Error deleting client')
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete client'
        })
      }
    }
  )

  // POST /api/admin/clients/:clientId/regenerate-secret - Regenerate client secret
  app.post<{ Params: { clientId: string } }>(
    '/clients/:clientId/regenerate-secret',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Params: { clientId: string } }>, reply: FastifyReply) => {
      try {
        const { clientId } = request.params

        const existingClient = await prisma.oAuthClient.findUnique({
          where: { clientId }
        })

        if (!existingClient) {
          return reply.status(404).send({
            success: false,
            error: 'Client not found'
          })
        }

        // Generate new secret
        const newSecret = randomBytes(32).toString('base64url')
        const newSecretHash = await hashToken(newSecret)

        // Update client secret
        await prisma.oAuthClient.update({
          where: { clientId },
          data: {
            clientSecret: newSecretHash
          }
        })

        return reply.status(200).send({
          success: true,
          clientSecret: newSecret,
          message: 'Client secret regenerated successfully. Save the new secret now - it will not be shown again.'
        })
      } catch (error) {
        request.log.error(error, 'Error regenerating client secret')
        return reply.status(500).send({
          success: false,
          error: 'Failed to regenerate client secret'
        })
      }
    }
  )
}
