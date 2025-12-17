#!/usr/bin/env tsx
/**
 * Setup initial admin user
 * Usage: npm run admin:setup <email>
 * Or set INITIAL_ADMIN_EMAIL in .env and run on server startup
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setupInitialAdmin(email?: string) {
  try {
    // Get email from env or argument
    const adminEmail = email || process.env.INITIAL_ADMIN_EMAIL

    if (!adminEmail) {
      console.error('\n❌ Error: Email is required')
      console.error('\nUsage: npm run admin:setup <email>')
      console.error('   Or set INITIAL_ADMIN_EMAIL in .env\n')
      process.exit(1)
    }

    // Check if any admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { isAdmin: true }
    })

    if (existingAdmin) {
      console.log('\n⚠️  Admin user already exists. Skipping setup.')
      console.log(`   Existing admin: ${existingAdmin.email}\n`)
      await prisma.$disconnect()
      process.exit(0)
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (!user) {
      console.error(`\n❌ Error: User with email "${adminEmail}" not found`)
      console.error('   Please create the user account first (signup/login)\n')
      await prisma.$disconnect()
      process.exit(1)
    }

    if (user.isAdmin) {
      console.log(`\n✅ User "${adminEmail}" is already an admin\n`)
      await prisma.$disconnect()
      process.exit(0)
    }

    // Grant admin status
    await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true }
    })

    console.log('\n✅ Admin setup successful!')
    console.log(`   ${adminEmail} is now an admin\n`)
  } catch (error) {
    console.error('\n❌ Error setting up admin:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const email = process.argv[2]
  setupInitialAdmin(email)
}

export { setupInitialAdmin }
