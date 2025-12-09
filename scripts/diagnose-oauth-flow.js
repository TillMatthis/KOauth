#!/usr/bin/env node
/**
 * Diagnostic tool for OAuth flow troubleshooting
 * Shows recent OAuth client registrations, authorization attempts, and token exchanges
 * Usage: node scripts/diagnose-oauth-flow.js [options]
 * 
 * Options:
 *   --client-id <id>     Filter by specific client ID
 *   --hours <n>          Show events from last N hours (default: 24)
 *   --all                Show all events (no time limit)
 */

import { prisma } from '../dist/lib/prisma.js'

const args = process.argv.slice(2)

let clientIdFilter = null
let hoursFilter = 24
let showAll = false

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--client-id' && args[i + 1]) {
    clientIdFilter = args[i + 1]
    i++
  } else if (args[i] === '--hours' && args[i + 1]) {
    hoursFilter = parseInt(args[i + 1], 10)
    i++
  } else if (args[i] === '--all') {
    showAll = true
  }
}

const timeFilter = showAll ? null : new Date(Date.now() - hoursFilter * 60 * 60 * 1000)

async function diagnose() {
  try {
    console.log('\n🔍 OAuth Flow Diagnostic Tool\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Build filters
    const clientFilter = clientIdFilter ? { clientId: clientIdFilter } : {}
    const timeFilterObj = timeFilter ? { createdAt: { gte: timeFilter } } : {}

    // 1. Recent OAuth Client Registrations
    console.log('📋 Recent OAuth Client Registrations')
    console.log('───────────────────────────────────────────────────────')
    
    const recentClients = await prisma.oAuthClient.findMany({
      where: {
        ...clientFilter,
        ...(timeFilter ? { createdAt: { gte: timeFilter } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: {
          select: {
            authorizationCodes: true,
            refreshTokens: true
          }
        }
      }
    })

    if (recentClients.length === 0) {
      console.log('  No client registrations found')
      if (timeFilter) {
        console.log(`  (in the last ${hoursFilter} hours)`)
      }
    } else {
      recentClients.forEach(client => {
        console.log(`\n  Client ID:     ${client.clientId}`)
        console.log(`  Name:          ${client.name}`)
        console.log(`  Trusted:       ${client.trusted ? '✅ Yes' : '❌ No'}`)
        console.log(`  Active:        ${client.active ? '✅ Yes' : '❌ No'}`)
        console.log(`  Created:       ${client.createdAt.toISOString()}`)
        console.log(`  Redirect URIs:`)
        client.redirectUris.forEach(uri => {
          console.log(`    • ${uri}`)
        })
        console.log(`  Stats:         ${client._count.authorizationCodes} codes, ${client._count.refreshTokens} refresh tokens`)
      })
    }

    // 2. Recent Authorization Attempts
    console.log('\n\n🔐 Recent Authorization Code Requests')
    console.log('───────────────────────────────────────────────────────')

    const recentAuthCodes = await prisma.oAuthAuthorizationCode.findMany({
      where: {
        ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
        ...timeFilterObj
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        client: {
          select: {
            clientId: true,
            name: true,
            redirectUris: true
          }
        }
      }
    })

    if (recentAuthCodes.length === 0) {
      console.log('  No authorization code requests found')
      if (timeFilter) {
        console.log(`  (in the last ${hoursFilter} hours)`)
      }
    } else {
      recentAuthCodes.forEach(code => {
        const status = code.used 
          ? '✅ Used' 
          : code.expiresAt < new Date() 
            ? '⏰ Expired' 
            : '⏳ Pending'
        
        console.log(`\n  Code:          ${code.code.substring(0, 20)}...`)
        console.log(`  Client:        ${code.client.name} (${code.client.clientId})`)
        console.log(`  Redirect URI:  ${code.redirectUri}`)
        console.log(`  Status:        ${status}`)
        console.log(`  Scopes:        ${code.scopes.join(', ')}`)
        console.log(`  Created:       ${code.createdAt.toISOString()}`)
        console.log(`  Expires:       ${code.expiresAt.toISOString()}`)
        
        // Check redirect URI match
        const uriMatch = code.client.redirectUris.includes(code.redirectUri)
        if (!uriMatch) {
          console.log(`  ⚠️  WARNING: Redirect URI not in client's registered URIs!`)
          console.log(`     Registered URIs: ${code.client.redirectUris.join(', ')}`)
        }
      })
    }

    // 3. Recent Token Exchanges
    console.log('\n\n🎫 Recent Token Exchanges')
    console.log('───────────────────────────────────────────────────────')

    // We can't directly track token exchanges, but we can see used codes
    const usedCodes = await prisma.oAuthAuthorizationCode.findMany({
      where: {
        used: true,
        ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
        ...timeFilterObj
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        client: {
          select: {
            clientId: true,
            name: true
          }
        }
      }
    })

    if (usedCodes.length === 0) {
      console.log('  No token exchanges found')
      if (timeFilter) {
        console.log(`  (in the last ${hoursFilter} hours)`)
      }
    } else {
      usedCodes.forEach(code => {
        console.log(`\n  Code:          ${code.code.substring(0, 20)}...`)
        console.log(`  Client:        ${code.client.name} (${code.client.clientId})`)
        console.log(`  Redirect URI:  ${code.redirectUri}`)
        console.log(`  Scopes:        ${code.scopes.join(', ')}`)
        console.log(`  Exchanged:     ${code.createdAt.toISOString()}`)
      })
    }

    // 4. Active Refresh Tokens
    console.log('\n\n🔄 Active Refresh Tokens')
    console.log('───────────────────────────────────────────────────────')

    const activeRefreshTokens = await prisma.oAuthRefreshToken.findMany({
      where: {
        revoked: false,
        expiresAt: { gt: new Date() },
        ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
        ...timeFilterObj
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        client: {
          select: {
            clientId: true,
            name: true
          }
        }
      }
    })

    if (activeRefreshTokens.length === 0) {
      console.log('  No active refresh tokens found')
      if (timeFilter) {
        console.log(`  (in the last ${hoursFilter} hours)`)
      }
    } else {
      activeRefreshTokens.forEach(token => {
        console.log(`\n  Token:         ${token.token.substring(0, 20)}...`)
        console.log(`  Client:        ${token.client.name} (${token.client.clientId})`)
        console.log(`  Scopes:        ${token.scopes.join(', ')}`)
        console.log(`  Created:       ${token.createdAt.toISOString()}`)
        console.log(`  Expires:       ${token.expiresAt.toISOString()}`)
      })
    }

    // 5. Potential Issues
    console.log('\n\n⚠️  Potential Issues')
    console.log('───────────────────────────────────────────────────────')

    const issues = []

    // Check for expired unused codes
    const expiredUnusedCodes = await prisma.oAuthAuthorizationCode.count({
      where: {
        used: false,
        expiresAt: { lt: new Date() },
        ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
        ...timeFilterObj
      }
    })

    if (expiredUnusedCodes > 0) {
      issues.push(`${expiredUnusedCodes} expired authorization code(s) that were never used`)
    }

    // Check for clients with no redirect URIs
    const clientsWithoutUris = await prisma.oAuthClient.findMany({
      where: {
        redirectUris: { equals: [] },
        ...(clientIdFilter ? { clientId: clientIdFilter } : {})
      }
    })

    if (clientsWithoutUris.length > 0) {
      issues.push(`${clientsWithoutUris.length} client(s) with no redirect URIs: ${clientsWithoutUris.map(c => c.clientId).join(', ')}`)
    }

    // Check for authorization codes with redirect URIs not in client's list
    const mismatchedCodes = await prisma.oAuthAuthorizationCode.findMany({
      where: {
        ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
        ...timeFilterObj
      },
      include: {
        client: true
      }
    })

    const mismatched = mismatchedCodes.filter(code => 
      !code.client.redirectUris.includes(code.redirectUri)
    )

    if (mismatched.length > 0) {
      issues.push(`${mismatched.length} authorization code(s) with redirect URIs not matching client's registered URIs`)
    }

    if (issues.length === 0) {
      console.log('  ✅ No issues detected')
    } else {
      issues.forEach(issue => {
        console.log(`  ⚠️  ${issue}`)
      })
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Summary
    console.log('📊 Summary')
    console.log('───────────────────────────────────────────────────────')
    console.log(`  Clients registered:     ${recentClients.length}`)
    console.log(`  Authorization requests: ${recentAuthCodes.length}`)
    console.log(`  Token exchanges:        ${usedCodes.length}`)
    console.log(`  Active refresh tokens:  ${activeRefreshTokens.length}`)
    console.log(`  Potential issues:       ${issues.length}`)
    if (timeFilter) {
      console.log(`  Time range:             Last ${hoursFilter} hours`)
    } else {
      console.log(`  Time range:             All time`)
    }
    if (clientIdFilter) {
      console.log(`  Filtered by client:     ${clientIdFilter}`)
    }
    console.log('\n')

  } catch (error) {
    console.error('\n❌ Error running diagnostic:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

diagnose()
