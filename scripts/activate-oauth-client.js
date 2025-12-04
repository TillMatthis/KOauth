#!/usr/bin/env node
/**
 * Activate an OAuth client
 * Usage: node scripts/activate-oauth-client.js <client_id>
 */

import { prisma } from '../dist/lib/prisma.js'

async function activateClient() {
  const clientId = process.argv[2]

  if (!clientId) {
    console.error('\n❌ Error: client_id is required')
    console.log('Usage: node scripts/activate-oauth-client.js <client_id>\n')
    process.exit(1)
  }

  console.log(`\n🔧 Activating OAuth client: ${clientId}\n`)

  try {
    const client = await prisma.oAuthClient.update({
      where: { clientId },
      data: { active: true },
      select: {
        clientId: true,
        name: true,
        active: true,
        redirectUris: true,
      }
    })

    console.log('✅ Client activated successfully!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Client ID:     ${client.clientId}`)
    console.log(`Name:          ${client.name}`)
    console.log(`Active:        ${client.active ? '✅ YES' : '❌ NO'}`)
    console.log(`Redirect URIs:`)
    client.redirectUris.forEach(uri => console.log(`  - ${uri}`))
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  } catch (error) {
    if (error.code === 'P2025') {
      console.error(`\n❌ Error: Client '${clientId}' not found!\n`)
      console.log('Available clients:')
      const allClients = await prisma.oAuthClient.findMany({
        select: { clientId: true, name: true, active: true }
      })
      if (allClients.length === 0) {
        console.log('  (none registered)\n')
        console.log('Register a new client with: npm run oauth:register-client\n')
      } else {
        allClients.forEach(c => {
          console.log(`  - ${c.clientId} (${c.name}) ${c.active ? '✅' : '❌ INACTIVE'}`)
        })
        console.log()
      }
    } else {
      console.error('❌ Error:', error.message)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

activateClient()
