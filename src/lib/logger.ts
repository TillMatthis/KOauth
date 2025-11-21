/**
 * Winston Logger Configuration
 * Provides structured JSON logging for production and readable console logs for development
 */

import winston from 'winston'

const isDevelopment = process.env.NODE_ENV !== 'production'
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')

/**
 * Custom format for development console output
 * Shows timestamp, level, message, and metadata in a readable format
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let log = `${timestamp} [${level}]`

    if (context) {
      log += ` [${context}]`
    }

    log += `: ${message}`

    // Add metadata if present
    const metaKeys = Object.keys(meta)
    if (metaKeys.length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`
    }

    return log
  })
)

/**
 * JSON format for production
 * Structured logs for log aggregation services
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

/**
 * Main Winston logger instance
 * Automatically uses appropriate format based on NODE_ENV
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: {
    service: 'koauth',
    env: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false
})

/**
 * Fastify logger adapter
 * Converts Fastify's Pino-style logs to Winston format
 */
export const fastifyLogger = {
  level: logLevel,
  serializers: {
    req(request: any) {
      return {
        method: request.method,
        url: request.url,
        headers: request.headers,
        hostname: request.hostname,
        remoteAddress: request.ip,
        remotePort: request.socket?.remotePort
      }
    },
    res(response: any) {
      return {
        statusCode: response.statusCode
      }
    }
  },
  stream: {
    write: (message: string) => {
      logger.info(message.trim())
    }
  }
}

// Export logger types for use in other modules
export type Logger = typeof logger
