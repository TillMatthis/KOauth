#!/usr/bin/env tsx
/**
 * CLI tool to register OAuth 2.0 clients
 * Usage: npm run oauth:register-client
 */

import { randomBytes } from 'crypto'
import { hashToken } from '../src/lib/auth/tokens'
import { prisma } from '../src/lib/prisma'
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function registerClient() {
  console.log('\n🔐 KOauth - Register OAuth 2.0 Client\n')

  const name = await question('Client name (e.g., "KURA Notes"): ')
  const description = await question('Description (optional): ')
  const websiteUrl = await question('Website URL (optional): ')
  const redirectUris = await question('Redirect URIs (comma-separated): ')
  const trusted = await question('Trusted client? Skip consent screen (y/N): ')

  // Generate client credentials
  const clientId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const clientSecret = randomBytes(32).toString('base64url')
  const clientSecretHash = await hashToken(clientSecret)

  // Parse redirect URIs
  const uris = redirectUris.split(',').map(uri => uri.trim()).filter(Boolean)

  if (uris.length === 0) {
    console.error('\n❌ Error: At least one redirect URI is required')
    process.exit(1)
  }

  // Create client
  try {
    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret: clientSecretHash,
        name,
        description: description || undefined,
        websiteUrl: websiteUrl || undefined,
        redirectUris: uris,
        trusted: trusted.toLowerCase() === 'y',
        grantTypes: ['authorization_code', 'refresh_token'],
        scopes: ['openid', 'profile', 'email']
      }
    })

    console.log('\n✅ OAuth client registered successfully!\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Client ID:     ${client.clientId}`)
    console.log(`Client Secret: ${clientSecret}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('⚠️  IMPORTANT: Save the client secret now!')
    console.log('   You won\'t be able to see it again.\n')
    console.log('Configuration for your app:')
    console.log(`  OAUTH_CLIENT_ID=${client.clientId}`)
    console.log(`  OAUTH_CLIENT_SECRET=${clientSecret}`)
    console.log(`  OAUTH_REDIRECT_URI=${uris[0]}\n`)

  } catch (error) {
    console.error('\n❌ Error registering client:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    rl.close()
  }
}

registerClient()
