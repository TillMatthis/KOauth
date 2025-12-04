#!/usr/bin/env node
/**
 * Check OAuth client registration status
 * Usage: node scripts/check-oauth-client.js [client_id]
 */

import { prisma } from '../dist/lib/prisma.js'

async function checkClient() {
  const clientId = process.argv[2]

  console.log('\n🔍 Checking OAuth Clients...\n')

  try {
    if (clientId) {
      // Check specific client
      const client = await prisma.oAuthClient.findUnique({
        where: { clientId },
        select: {
          clientId: true,
          name: true,
          active: true,
          trusted: true,
          redirectUris: true,
          grantTypes: true,
          scopes: true,
          createdAt: true,
        }
      })

      if (!client) {
        console.log(`❌ Client '${clientId}' not found!\n`)
        console.log('Available clients:')
        const allClients = await prisma.oAuthClient.findMany({
          select: { clientId: true, name: true, active: true }
        })
        if (allClients.length === 0) {
          console.log('  (none registered)\n')
        } else {
          allClients.forEach(c => {
            console.log(`  - ${c.clientId} (${c.name}) ${c.active ? '✅' : '❌ INACTIVE'}`)
          })
        }
      } else {
        console.log(`Found: ${client.name}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`Client ID:     ${client.clientId}`)
        console.log(`Active:        ${client.active ? '✅ YES' : '❌ NO'}`)
        console.log(`Trusted:       ${client.trusted ? 'Yes' : 'No'}`)
        console.log(`Grant Types:   ${client.grantTypes.join(', ')}`)
        console.log(`Scopes:        ${client.scopes.join(', ')}`)
        console.log(`Redirect URIs:`)
        client.redirectUris.forEach(uri => console.log(`  - ${uri}`))
        console.log(`Created:       ${client.createdAt.toISOString()}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      }
    } else {
      // List all clients
      const clients = await prisma.oAuthClient.findMany({
        select: {
          clientId: true,
          name: true,
          active: true,
          trusted: true,
          redirectUris: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' }
      })

      if (clients.length === 0) {
        console.log('❌ No OAuth clients registered!\n')
        console.log('Register a client with: npm run oauth:register-client\n')
      } else {
        console.log(`Found ${clients.length} client(s):\n`)
        clients.forEach(client => {
          console.log(`${client.active ? '✅' : '❌'} ${client.clientId} - ${client.name}`)
          console.log(`   Redirect URIs: ${client.redirectUris.join(', ')}`)
          console.log(`   Trusted: ${client.trusted ? 'Yes' : 'No'}`)
          console.log(`   Created: ${client.createdAt.toISOString()}`)
          console.log()
        })
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkClient()
