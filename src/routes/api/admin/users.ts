/**
 * Admin User Management Routes
 * CRUD operations for users
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { protectAdminRoute, getUser } from '../../../lib/auth/middleware'
import { prisma } from '../../../lib/prisma'

interface ListUsersQuery {
  page?: string
  limit?: string
  search?: string
}

interface UpdateUserBody {
  emailVerified?: boolean
  isAdmin?: boolean
}

/**
 * Register user management routes
 */
export async function userRoutes(app: FastifyInstance) {
  // GET /api/admin/users - List all users (paginated)
  app.get<{ Querystring: ListUsersQuery }>(
    '/users',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Querystring: ListUsersQuery }>, reply: FastifyReply) => {
      try {
        const page = parseInt(request.query.page || '1', 10)
        const limit = Math.min(parseInt(request.query.limit || '50', 10), 100) // Max 100 per page
        const search = request.query.search?.trim() || ''
        const skip = (page - 1) * limit

        const where = search
          ? {
              email: {
                contains: search,
                mode: 'insensitive' as const
              }
            }
          : {}

        const [users, total] = await Promise.all([
          prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              email: true,
              emailVerified: true,
              isAdmin: true,
              provider: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  sessions: true,
                  apiKeys: true
                }
              }
            }
          }),
          prisma.user.count({ where })
        ])

        return reply.status(200).send({
          success: true,
          users,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        })
      } catch (error) {
        request.log.error(error, 'Error listing users')
        return reply.status(500).send({
          success: false,
          error: 'Failed to list users'
        })
      }
    }
  )

  // GET /api/admin/users/:id - Get user details
  app.get<{ Params: { id: string } }>(
    '/users/:id',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params

        const user = await prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            emailVerified: true,
            isAdmin: true,
            provider: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                sessions: true,
                apiKeys: true
              }
            }
          }
        })

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: 'User not found'
          })
        }

        return reply.status(200).send({
          success: true,
          user
        })
      } catch (error) {
        request.log.error(error, 'Error fetching user')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch user'
        })
      }
    }
  )

  // PATCH /api/admin/users/:id - Update user
  app.patch<{ Params: { id: string }; Body: UpdateUserBody }>(
    '/users/:id',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserBody }>, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const { emailVerified, isAdmin } = request.body
        const currentUser = getUser(request)

        // Fetch target user
        const targetUser = await prisma.user.findUnique({
          where: { id },
          select: { id: true, isAdmin: true }
        })

        if (!targetUser) {
          return reply.status(404).send({
            success: false,
            error: 'User not found'
          })
        }

        // Self-protection: Admin cannot remove their own admin status
        if (targetUser.id === currentUser.id && isAdmin === false) {
          return reply.status(400).send({
            success: false,
            error: 'Cannot remove your own admin status'
          })
        }

        // Protection: Last admin cannot be demoted
        if (targetUser.isAdmin && isAdmin === false) {
          const adminCount = await prisma.user.count({
            where: { isAdmin: true }
          })
          if (adminCount === 1) {
            return reply.status(400).send({
              success: false,
              error: 'Cannot demote the last admin'
            })
          }
        }

        // Build update data
        const updateData: { emailVerified?: boolean; isAdmin?: boolean } = {}
        if (emailVerified !== undefined) {
          updateData.emailVerified = emailVerified
        }
        if (isAdmin !== undefined) {
          updateData.isAdmin = isAdmin
        }

        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'No fields to update'
          })
        }

        const updatedUser = await prisma.user.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            email: true,
            emailVerified: true,
            isAdmin: true,
            createdAt: true,
            updatedAt: true
          }
        })

        return reply.status(200).send({
          success: true,
          user: updatedUser
        })
      } catch (error) {
        request.log.error(error, 'Error updating user')
        return reply.status(500).send({
          success: false,
          error: 'Failed to update user'
        })
      }
    }
  )

  // DELETE /api/admin/users/:id - Delete user
  app.delete<{ Params: { id: string } }>(
    '/users/:id',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const currentUser = getUser(request)

        // Cannot delete yourself
        if (id === currentUser.id) {
          return reply.status(400).send({
            success: false,
            error: 'Cannot delete your own account'
          })
        }

        // Check if target user is admin
        const targetUser = await prisma.user.findUnique({
          where: { id },
          select: { isAdmin: true }
        })

        if (!targetUser) {
          return reply.status(404).send({
            success: false,
            error: 'User not found'
          })
        }

        // Protection: Cannot delete last admin
        if (targetUser.isAdmin) {
          const adminCount = await prisma.user.count({
            where: { isAdmin: true }
          })
          if (adminCount === 1) {
            return reply.status(400).send({
              success: false,
              error: 'Cannot delete the last admin'
            })
          }
        }

        // Delete user (cascade will handle sessions and API keys)
        await prisma.user.delete({
          where: { id }
        })

        return reply.status(200).send({
          success: true,
          message: 'User deleted successfully'
        })
      } catch (error) {
        request.log.error(error, 'Error deleting user')
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete user'
        })
      }
    }
  )
}
