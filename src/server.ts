/**
 * KOauth Server Entry Point
 * Starts the Fastify server and handles graceful shutdown
 */

import { buildApp } from './app'
import { logger as mainLogger } from './lib/logger'

const logger = mainLogger.child({ context: 'server' })

/**
 * Start the server
 */
async function start() {
  try {
    const app = await buildApp()

    const port = app.config.PORT
    const host = app.config.HOST

    await app.listen({ port, host })

    logger.info({
      msg: '🚀 KOauth server started',
      port,
      host,
      env: app.config.NODE_ENV,
      nodeVersion: process.version
    })

    // Graceful shutdown handlers
    const signals = ['SIGINT', 'SIGTERM'] as const

    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info({ msg: `Received ${signal}, shutting down gracefully...` })
        await app.close()
        logger.info({ msg: 'Server closed successfully' })
        process.exit(0)
      })
    }
  } catch (err) {
    logger.error({ msg: 'Failed to start server', err })
    process.exit(1)
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    msg: 'Unhandled Rejection',
    reason,
    promise
  })
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({
    msg: 'Uncaught Exception',
    error
  })
  process.exit(1)
})

start()
