/**
 * Prisma Client Singleton
 * Ensures a single instance of PrismaClient across the application
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

const prismaLogger = logger.child({ context: 'prisma' })

/**
 * PrismaClient instance with logging configuration
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' }
    ]
  })
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

// Attach Winston logger to Prisma events
prisma.$on('query', (e) => {
  prismaLogger.debug({
    msg: 'Query executed',
    query: e.query,
    params: e.params,
    duration: `${e.duration}ms`
  })
})

prisma.$on('error', (e) => {
  prismaLogger.error({
    msg: 'Prisma error',
    target: e.target,
    message: e.message
  })
})

prisma.$on('warn', (e) => {
  prismaLogger.warn({
    msg: 'Prisma warning',
    message: e.message
  })
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

/**
 * Graceful shutdown helper for Prisma
 * Call this in your server shutdown handler
 */
export async function disconnectPrisma() {
  await prisma.$disconnect()
  prismaLogger.info({ msg: 'Prisma disconnected' })
}
