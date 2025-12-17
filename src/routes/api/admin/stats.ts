/**
 * Admin Statistics Routes
 * Dashboard statistics and metrics
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { protectAdminRoute } from '../../../lib/auth/middleware'
import { prisma } from '../../../lib/prisma'

/**
 * Register statistics routes
 */
export async function statsRoutes(app: FastifyInstance) {
  // GET /api/admin/stats - Dashboard statistics
  app.get(
    '/stats',
    {
      preHandler: protectAdminRoute()
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const [
          totalUsers,
          totalClients,
          activeSessions,
          recentSignups,
          usersLast7Days,
          usersLast30Days
        ] = await Promise.all([
          // Total users
          prisma.user.count(),
          // Total clients
          prisma.oAuthClient.count(),
          // Active sessions (not expired)
          prisma.session.count({
            where: {
              expiresAt: {
                gt: now
              }
            }
          }),
          // Recent signups (last 7 days)
          prisma.user.findMany({
            where: {
              createdAt: {
                gte: sevenDaysAgo
              }
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 10,
            select: {
              id: true,
              email: true,
              createdAt: true,
              provider: true
            }
          }),
          // Users created in last 7 days
          prisma.user.count({
            where: {
              createdAt: {
                gte: sevenDaysAgo
              }
            }
          }),
          // Users created in last 30 days
          prisma.user.count({
            where: {
              createdAt: {
                gte: thirtyDaysAgo
              }
            }
          })
        ])

        return reply.status(200).send({
          success: true,
          stats: {
            totalUsers,
            totalClients,
            activeSessions,
            recentSignups,
            usersLast7Days,
            usersLast30Days
          }
        })
      } catch (error) {
        request.log.error(error, 'Error fetching statistics')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch statistics'
        })
      }
    }
  )
}
