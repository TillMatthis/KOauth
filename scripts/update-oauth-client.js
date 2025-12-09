#!/usr/bin/env node
/**
 * CLI tool to update OAuth 2.0 client configuration
 * Usage: node scripts/update-oauth-client.js <client_id> [options]
 * 
 * Options:
 *   --redirect-uris "uri1,uri2"  Update redirect URIs
 *   --trusted                    Mark client as trusted (skip consent)
 *   --untrusted                  Mark client as untrusted (require consent)
 *   --active                     Mark client as active
 *   --inactive                   Mark client as inactive
 *   --view                       View client details (default if no update flags)
 */

import { prisma } from '../dist/lib/prisma.js'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('\n❌ Error: Client ID is required')
  console.error('\nUsage: node scripts/update-oauth-client.js <client_id> [options]')
  console.error('\nOptions:')
  console.error('  --redirect-uris "uri1,uri2"  Update redirect URIs')
  console.error('  --trusted                    Mark client as trusted')
  console.error('  --untrusted                  Mark client as untrusted')
  console.error('  --active                     Mark client as active')
  console.error('  --inactive                   Mark client as inactive')
  console.error('  --view                       View client details (default)')
  process.exit(1)
}

const clientId = args[0]
const flags = args.slice(1)

// Parse flags
const redirectUrisFlag = flags.find(f => f.startsWith('--redirect-uris='))
const redirectUris = redirectUrisFlag 
  ? redirectUrisFlag.split('=')[1].split(',').map(uri => uri.trim()).filter(Boolean)
  : null

const trusted = flags.includes('--trusted') ? true : flags.includes('--untrusted') ? false : null
const active = flags.includes('--active') ? true : flags.includes('--inactive') ? false : null
const viewOnly = !redirectUris && trusted === null && active === null

async function updateClient() {
  try {
    // Check if client exists
    const existingClient = await prisma.oAuthClient.findUnique({
      where: { clientId },
      include: {
        authorizationCodes: {
          where: {
            used: false,
            expiresAt: { gt: new Date() }
          },
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
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

    if (viewOnly) {
      // View mode - show client details
      console.log('\n📋 OAuth Client Details\n')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`Client ID:      ${existingClient.clientId}`)
      console.log(`Name:           ${existingClient.name}`)
      console.log(`Description:    ${existingClient.description || '(none)'}`)
      console.log(`Website URL:    ${existingClient.websiteUrl || '(none)'}`)
      console.log(`Logo URL:       ${existingClient.logoUrl || '(none)'}`)
      console.log(`Trusted:         ${existingClient.trusted ? '✅ Yes' : '❌ No'}`)
      console.log(`Active:          ${existingClient.active ? '✅ Yes' : '❌ No'}`)
      console.log(`Created:         ${existingClient.createdAt.toISOString()}`)
      console.log(`Updated:         ${existingClient.updatedAt.toISOString()}`)
      console.log('\nRedirect URIs:')
      if (existingClient.redirectUris.length === 0) {
        console.log('  (none)')
      } else {
        existingClient.redirectUris.forEach(uri => {
          console.log(`  • ${uri}`)
        })
      }
      console.log('\nGrant Types:')
      existingClient.grantTypes.forEach(gt => {
        console.log(`  • ${gt}`)
      })
      console.log('\nAllowed Scopes:')
      existingClient.scopes.forEach(scope => {
        console.log(`  • ${scope}`)
      })
      console.log('\nStatistics:')
      console.log(`  Authorization Codes: ${existingClient._count.authorizationCodes}`)
      console.log(`  Refresh Tokens:      ${existingClient._count.refreshTokens}`)
      console.log(`  Active Codes:        ${existingClient.authorizationCodes.length}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    } else {
      // Update mode
      const updateData = {}
      
      if (redirectUris) {
        // Validate redirect URIs
        for (const uri of redirectUris) {
          try {
            new URL(uri)
          } catch (e) {
            console.error(`\n❌ Error: Invalid redirect URI: ${uri}`)
            process.exit(1)
          }
        }
        updateData.redirectUris = redirectUris
        console.log(`\n📝 Updating redirect URIs to: ${redirectUris.join(', ')}`)
      }
      
      if (trusted !== null) {
        updateData.trusted = trusted
        console.log(`\n📝 Setting trusted status to: ${trusted ? 'Yes' : 'No'}`)
      }
      
      if (active !== null) {
        updateData.active = active
        console.log(`\n📝 Setting active status to: ${active ? 'Yes' : 'No'}`)
      }

      const updatedClient = await prisma.oAuthClient.update({
        where: { clientId },
        data: updateData
      })

      console.log('\n✅ OAuth client updated successfully!\n')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`Client ID:      ${updatedClient.clientId}`)
      console.log(`Name:           ${updatedClient.name}`)
      console.log(`Trusted:         ${updatedClient.trusted ? '✅ Yes' : '❌ No'}`)
      console.log(`Active:          ${updatedClient.active ? '✅ Yes' : '❌ No'}`)
      console.log('\nRedirect URIs:')
      updatedClient.redirectUris.forEach(uri => {
        console.log(`  • ${uri}`)
      })
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    }
  } catch (error) {
    console.error('\n❌ Error updating client:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updateClient()
