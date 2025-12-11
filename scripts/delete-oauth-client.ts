#!/usr/bin/env tsx
/**
 * CLI tool to delete an OAuth 2.0 client
 * Usage: npm run oauth:delete-client <client_id> [--confirm]
 * 
 * Options:
 *   --confirm  Skip confirmation prompt (useful for scripts)
 */

import { prisma } from '../dist/lib/prisma.js'
import * as readline from 'readline'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('\n❌ Error: Client ID is required')
  console.error('\nUsage: npm run oauth:delete-client <client_id> [--confirm]')
  console.error('\nOptions:')
  console.error('  --confirm  Skip confirmation prompt')
  process.exit(1)
}

const clientId = args[0]
const skipConfirmation = args.includes('--confirm')

function question(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function deleteClient() {
  try {
    // Check if client exists
    const existingClient = await prisma.oAuthClient.findUnique({
      where: { clientId },
      include: {
        _count: {
          select: {
            authorizationCodes: true,
            refreshTokens: true
          }
        }
      }
    })

    if (!existingClient) {
      console.error(`\n❌ Error: Client with ID "${clientId}" not found`)
      process.exit(1)
    }

    // Show client details
    console.log('\n📋 OAuth Client Details\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Client ID:      ${existingClient.clientId}`)
    console.log(`Name:           ${existingClient.name}`)
    console.log(`Description:    ${existingClient.description || '(none)'}`)
    console.log(`Active:         ${existingClient.active ? '✅ Yes' : '❌ No'}`)
    console.log(`Trusted:        ${existingClient.trusted ? '✅ Yes' : '❌ No'}`)
    console.log(`Redirect URIs:  ${existingClient.redirectUris.length}`)
    existingClient.redirectUris.forEach(uri => {
      console.log(`  • ${uri}`)
    })
    console.log(`\nStatistics:`)
    console.log(`  Authorization Codes: ${existingClient._count.authorizationCodes}`)
    console.log(`  Refresh Tokens:      ${existingClient._count.refreshTokens}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Confirmation prompt
    if (!skipConfirmation) {
      const answer = await question(`⚠️  Are you sure you want to delete client "${clientId}"? (yes/no): `)
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('\n❌ Deletion cancelled')
        process.exit(0)
      }
    }

    // Delete the client (cascade will handle related records)
    await prisma.oAuthClient.delete({
      where: { clientId }
    })

    console.log(`\n✅ Client "${clientId}" deleted successfully!\n`)
  } catch (error) {
    if (error.code === 'P2025') {
      console.error(`\n❌ Error: Client "${clientId}" not found`)
    } else {
      console.error('\n❌ Error deleting client:', error instanceof Error ? error.message : String(error))
      if (error instanceof Error && error.stack) {
        console.error(error.stack)
      }
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

deleteClient()
