/**
 * Test setup file
 * Runs before all tests to set up the test environment
 */

import { beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

// Set test environment
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'
process.env.LOG_LEVEL = 'error' // Reduce log noise in tests

// Clean up database before all tests
beforeAll(async () => {
  // Ensure test database is clean
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS user_api_keys')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS sessions')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS users')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS _prisma_migrations')

  // Run migrations
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "users" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "password_hash" TEXT NOT NULL,
      "email_verified" BOOLEAN NOT NULL DEFAULT false,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL
    )
  `)

  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX "users_email_key" ON "users"("email")')

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "sessions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "user_id" TEXT NOT NULL,
      "refresh_token" TEXT NOT NULL,
      "expires_at" DATETIME NOT NULL,
      "ip_address" TEXT,
      "user_agent" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL,
      CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token")')
  await prisma.$executeRawUnsafe('CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id")')
  await prisma.$executeRawUnsafe('CREATE INDEX "sessions_refresh_token_idx" ON "sessions"("refresh_token")')

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "user_api_keys" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "user_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "prefix" TEXT NOT NULL,
      "key_hash" TEXT NOT NULL,
      "expires_at" DATETIME,
      "last_used_at" DATETIME,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX "user_api_keys_prefix_key" ON "user_api_keys"("prefix")')
  await prisma.$executeRawUnsafe('CREATE INDEX "user_api_keys_user_id_idx" ON "user_api_keys"("user_id")')
  await prisma.$executeRawUnsafe('CREATE INDEX "user_api_keys_prefix_idx" ON "user_api_keys"("prefix")')
})

// Clean up between tests
beforeEach(async () => {
  await prisma.userApiKey.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
})

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect()
})
