# KOauth Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies only when needed
COPY package.json package-lock.json* ./
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
COPY client ./client
COPY scripts ./scripts

# Install client dependencies
RUN cd client && npm ci

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

# Set environment to production
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 koauth && \
    mkdir -p /app/keys && \
    chown -R koauth:nodejs /app && \
    chmod 755 /app && \
    chmod 755 /app/keys

# Set working directory (now owned by koauth)
WORKDIR /app

# Copy necessary files from builder
COPY --from=builder --chown=koauth:nodejs /app/dist ./dist
COPY --from=builder --chown=koauth:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=koauth:nodejs /app/package.json ./package.json
COPY --from=builder --chown=koauth:nodejs /app/prisma ./prisma
COPY --from=builder --chown=koauth:nodejs /app/scripts ./scripts
COPY --from=builder --chown=koauth:nodejs /app/dist/client ./dist/client

# Install OpenSSL for Prisma runtime and curl for health checks
RUN apk add --no-cache openssl curl

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER koauth

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set entrypoint to handle initialization
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start the application
CMD ["node", "dist/server.js"]
