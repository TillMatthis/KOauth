/**
 * RSA Key Management for RS256 JWT Signing
 * Handles generation, loading, and JWKS formatting of RSA keys
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { generateKeyPairSync } from 'crypto'
import { resolve } from 'path'

/**
 * RSA key pair for JWT signing
 */
export interface RsaKeyPair {
  privateKey: string  // PEM format
  publicKey: string   // PEM format
  kid: string         // Key ID
}

/**
 * JWKS key format for public key distribution
 */
export interface JwksKey {
  kty: 'RSA'
  use: 'sig'
  alg: 'RS256'
  kid: string
  n: string   // Modulus (base64url)
  e: string   // Exponent (base64url)
}

/**
 * Generate a new RSA 2048-bit key pair for JWT signing
 * @returns RSA key pair in PEM format with key ID
 */
export function generateRsaKeyPair(): RsaKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })

  // Generate a unique key ID based on timestamp
  const kid = `koauth-${Date.now()}`

  return {
    privateKey,
    publicKey,
    kid
  }
}

/**
 * Save RSA key pair to disk
 * @param keyPair - RSA key pair to save
 * @param privateKeyPath - Path to save private key
 * @param publicKeyPath - Path to save public key
 */
export function saveKeyPair(
  keyPair: RsaKeyPair,
  privateKeyPath: string,
  publicKeyPath: string
): void {
  // Ensure keys directory exists
  const keysDir = resolve(privateKeyPath, '..')
  if (!existsSync(keysDir)) {
    mkdirSync(keysDir, { recursive: true })
  }

  // Save private key
  writeFileSync(privateKeyPath, keyPair.privateKey, { mode: 0o600 })
  console.log(`[Keys] Private key saved to ${privateKeyPath}`)

  // Save public key
  writeFileSync(publicKeyPath, keyPair.publicKey, { mode: 0o644 })
  console.log(`[Keys] Public key saved to ${publicKeyPath}`)

  // Save key ID in a metadata file
  const metadataPath = resolve(keysDir, 'kid.txt')
  writeFileSync(metadataPath, keyPair.kid, { mode: 0o644 })
  console.log(`[Keys] Key ID saved to ${metadataPath}`)
}

/**
 * Load RSA key pair from disk
 * @param privateKeyPath - Path to private key file
 * @param publicKeyPath - Path to public key file
 * @returns RSA key pair
 * @throws Error if keys are not found
 */
export function loadKeyPair(
  privateKeyPath: string,
  publicKeyPath: string
): RsaKeyPair {
  if (!existsSync(privateKeyPath)) {
    throw new Error(`Private key not found at ${privateKeyPath}`)
  }

  if (!existsSync(publicKeyPath)) {
    throw new Error(`Public key not found at ${publicKeyPath}`)
  }

  const privateKey = readFileSync(privateKeyPath, 'utf8')
  const publicKey = readFileSync(publicKeyPath, 'utf8')

  // Load key ID from metadata file
  const keysDir = resolve(privateKeyPath, '..')
  const metadataPath = resolve(keysDir, 'kid.txt')
  let kid = `koauth-default`

  if (existsSync(metadataPath)) {
    kid = readFileSync(metadataPath, 'utf8').trim()
  }

  return {
    privateKey,
    publicKey,
    kid
  }
}

/**
 * Convert RSA public key (PEM) to JWKS format
 * @param publicKey - Public key in PEM format
 * @param kid - Key ID
 * @returns JWKS key object
 */
export function pemToJwks(publicKey: string, kid: string): JwksKey {
  // Extract the key data from PEM format
  const keyData = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')

  // Parse the DER-encoded public key
  const der = Buffer.from(keyData, 'base64')

  // Parse RSA public key from DER format (SPKI)
  // SPKI format: SEQUENCE { algorithm, subjectPublicKey }
  // We need to extract n (modulus) and e (exponent)

  // This is a simplified parser for RSA public keys in SPKI format
  // For production, consider using a proper ASN.1 parser like 'asn1.js' or 'node-forge'

  // Skip the SPKI wrapper and get to the RSA key
  // SPKI has a header, algorithm identifier, then BIT STRING containing the actual key
  let offset = 0

  // Skip SEQUENCE tag and length
  if (der[offset] === 0x30) {
    offset++
    const len = der[offset]
    if (len && len > 0x80) {
      offset += (len & 0x7f) + 1
    } else {
      offset++
    }
  }

  // Skip algorithm identifier SEQUENCE
  if (der[offset] === 0x30) {
    offset++
    const len = der[offset]
    if (len) {
      offset += len + 1
    }
  }

  // BIT STRING tag
  if (der[offset] === 0x03) {
    offset++
    const len = der[offset]
    if (len && len > 0x80) {
      const lenBytes = len & 0x7f
      offset += lenBytes + 1
    } else {
      offset++
    }
    // Skip unused bits byte
    offset++
  }

  // Now we're at the RSA public key SEQUENCE
  if (der[offset] === 0x30) {
    offset++
    const len = der[offset]
    if (len && len > 0x80) {
      offset += (len & 0x7f) + 1
    } else {
      offset++
    }
  }

  // Read modulus (n) - INTEGER
  if (der[offset] === 0x02) {
    offset++
    let len = der[offset] || 0
    offset++

    if (len > 0x80) {
      const lenBytes = len & 0x7f
      len = 0
      for (let i = 0; i < lenBytes; i++) {
        len = (len << 8) | (der[offset++] || 0)
      }
    }

    // Skip leading zero byte if present (for positive numbers)
    if (der[offset] === 0x00) {
      offset++
      len--
    }

    const modulus = der.subarray(offset, offset + len)
    offset += len

    // Read exponent (e) - INTEGER
    if (der[offset] === 0x02) {
      offset++
      let eLen = der[offset] || 0
      offset++

      if (eLen > 0x80) {
        const lenBytes = eLen & 0x7f
        eLen = 0
        for (let i = 0; i < lenBytes; i++) {
          eLen = (eLen << 8) | (der[offset++] || 0)
        }
      }

      const exponent = der.subarray(offset, offset + eLen)

      // Convert to base64url
      const n = modulus.toString('base64url')
      const e = exponent.toString('base64url')

      return {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid,
        n,
        e
      }
    }
  }

  throw new Error('Failed to parse RSA public key')
}

/**
 * Initialize RSA keys for JWT signing
 * Auto-generates keys if they don't exist
 * @param privateKeyPath - Path to private key file
 * @param publicKeyPath - Path to public key file
 * @returns Loaded or generated RSA key pair
 */
export function initializeKeys(
  privateKeyPath: string,
  publicKeyPath: string
): RsaKeyPair {
  console.log('[Keys] Initializing RSA keys for JWT signing...')

  // Check if keys exist
  const privateExists = existsSync(privateKeyPath)
  const publicExists = existsSync(publicKeyPath)

  if (privateExists && publicExists) {
    console.log('[Keys] Loading existing RSA keys...')
    try {
      const keyPair = loadKeyPair(privateKeyPath, publicKeyPath)
      console.log(`[Keys] RSA keys loaded successfully (kid: ${keyPair.kid})`)
      return keyPair
    } catch (error) {
      console.error('[Keys] Failed to load existing keys:', error)
      console.log('[Keys] Generating new keys...')
    }
  }

  // Generate new keys
  console.log('[Keys] Generating new RSA 2048-bit key pair...')
  const keyPair = generateRsaKeyPair()

  // Save keys to disk
  saveKeyPair(keyPair, privateKeyPath, publicKeyPath)

  console.log(`[Keys] RSA keys initialized successfully (kid: ${keyPair.kid})`)
  return keyPair
}

/**
 * Create JWKS response object
 * @param keyPair - RSA key pair
 * @returns JWKS response object
 */
export function createJwks(keyPair: RsaKeyPair): { keys: JwksKey[] } {
  const jwksKey = pemToJwks(keyPair.publicKey, keyPair.kid)
  return {
    keys: [jwksKey]
  }
}
