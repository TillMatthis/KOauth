/**
 * Static UI Plugin
 * Serves the built React client from /auth/*
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import path from 'path'

const staticUIPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const isDev = process.env.NODE_ENV === 'development'

  // In production, serve the built static files
  if (!isDev) {
    const clientPath = path.join(process.cwd(), 'server/dist/client')

    // Register static file serving for /auth
    await app.register(fastifyStatic, {
      root: clientPath,
      prefix: '/auth',
      decorateReply: true,
    })

    // Catch-all route for client-side routing
    // This ensures that /auth/signup, /auth/forgot etc. all serve index.html
    app.setNotFoundHandler((_request, reply) => {
      // Only handle /auth/* routes
      if (_request.url.startsWith('/auth')) {
        reply.sendFile('index.html')
      } else {
        reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Route not found',
        })
      }
    })

    app.log.info('Static UI plugin registered (production mode)')
  } else {
    // In development, proxy to Vite dev server or show a message
    app.get('/auth', async (_request, reply) => {
      return reply.send({
        message: 'Auth UI is in development mode',
        note: 'Run the Vite dev server in client/ directory with: npm run dev',
        viteDev: 'http://localhost:5173/auth',
      })
    })

    app.log.info('Static UI plugin registered (development mode - proxy to Vite)')
  }
}

export default fastifyPlugin(staticUIPlugin, {
  name: 'static-ui',
  fastify: '4.x',
})
