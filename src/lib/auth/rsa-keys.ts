/**
 * RSA Key Management for JWT RS256 Signing
 * Generates and manages RSA-2048 key pairs for JWT signing
 */

import crypto from 'crypto'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const generateKeyPair = promisify(crypto.generateKeyPair)
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)

/**
 * RSA key pair structure
 */
export interface RSAKeyPair {
  publicKey: string
  privateKey: string
  kid: string // Key ID for JWKS
  createdAt: Date
}

/**
 * JWKS (JSON Web Key Set) key structure
 */
export interface JWKSKey {
  kty: string // Key type (RSA)
  use: string // Key use (sig for signature)
  alg: string // Algorithm (RS256)
  kid: string // Key ID
  n: string   // RSA modulus (base64url)
  e: string   // RSA exponent (base64url)
}

/**
 * Generate a new RSA-2048 key pair
 */
export async function generateRSAKeyPair(): Promise<RSAKeyPair> {
  const kid = crypto.randomBytes(16).toString('hex')

  const { publicKey, privateKey } = await generateKeyPair('rsa', {
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

  return {
    publicKey,
    privateKey,
    kid,
    createdAt: new Date()
  }
}

/**
 * Load RSA key pair from environment variables or generate new ones
 */
export async function loadOrGenerateKeys(): Promise<RSAKeyPair> {
  // Try to load from environment variables
  const privateKeyEnv = process.env.JWT_PRIVATE_KEY
  const publicKeyEnv = process.env.JWT_PUBLIC_KEY
  const kidEnv = process.env.JWT_KEY_ID

  if (privateKeyEnv && publicKeyEnv && kidEnv) {
    // Keys exist in environment, decode from base64
    return {
      privateKey: Buffer.from(privateKeyEnv, 'base64').toString('utf-8'),
      publicKey: Buffer.from(publicKeyEnv, 'base64').toString('utf-8'),
      kid: kidEnv,
      createdAt: new Date() // Unknown creation date
    }
  }

  // Try to load from files
  const keysDir = path.join(process.cwd(), 'keys')
  const privateKeyPath = path.join(keysDir, 'jwt-private.pem')
  const publicKeyPath = path.join(keysDir, 'jwt-public.pem')
  const kidPath = path.join(keysDir, 'jwt-kid.txt')

  try {
    const privateKey = await readFile(privateKeyPath, 'utf-8')
    const publicKey = await readFile(publicKeyPath, 'utf-8')
    const kid = await readFile(kidPath, 'utf-8')

    return {
      privateKey,
      publicKey,
      kid: kid.trim(),
      createdAt: new Date()
    }
  } catch (error) {
    // Keys don't exist, generate new ones
    console.log('No RSA keys found, generating new key pair...')
    const keyPair = await generateRSAKeyPair()

    // Save to files for persistence
    try {
      await mkdir(keysDir, { recursive: true })
      await writeFile(privateKeyPath, keyPair.privateKey, { mode: 0o600 })
      await writeFile(publicKeyPath, keyPair.publicKey, { mode: 0o644 })
      await writeFile(kidPath, keyPair.kid, { mode: 0o644 })
      console.log(`RSA keys generated and saved to ${keysDir}`)
    } catch (saveError) {
      console.warn('Could not save keys to disk, using in-memory keys only:', saveError)
    }

    return keyPair
  }
}

/**
 * Convert RSA public key to JWK (JSON Web Key) format for JWKS endpoint
 */
export function publicKeyToJWK(publicKeyPem: string, kid: string): JWKSKey {
  // Create a public key object from the PEM
  const publicKey = crypto.createPublicKey(publicKeyPem)

  // Export as JWK format
  const jwk = publicKey.export({ format: 'jwk' })

  // Return JWKS-compatible structure
  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid,
    n: jwk.n as string,
    e: jwk.e as string
  }
}

/**
 * Create a JWKS (JSON Web Key Set) response
 */
export function createJWKS(keys: JWKSKey[]): { keys: JWKSKey[] } {
  return { keys }
}

/**
 * Singleton key manager for application-wide key access
 */
class RSAKeyManager {
  private keyPair: RSAKeyPair | null = null

  async initialize(): Promise<void> {
    if (this.keyPair) {
      return // Already initialized
    }

    this.keyPair = await loadOrGenerateKeys()
    console.log(`RSA keys initialized (kid: ${this.keyPair.kid})`)
  }

  getPrivateKey(): string {
    if (!this.keyPair) {
      throw new Error('RSA keys not initialized. Call initialize() first.')
    }
    return this.keyPair.privateKey
  }

  getPublicKey(): string {
    if (!this.keyPair) {
      throw new Error('RSA keys not initialized. Call initialize() first.')
    }
    return this.keyPair.publicKey
  }

  getKeyId(): string {
    if (!this.keyPair) {
      throw new Error('RSA keys not initialized. Call initialize() first.')
    }
    return this.keyPair.kid
  }

  getJWK(): JWKSKey {
    if (!this.keyPair) {
      throw new Error('RSA keys not initialized. Call initialize() first.')
    }
    return publicKeyToJWK(this.keyPair.publicKey, this.keyPair.kid)
  }

  getJWKS(): { keys: JWKSKey[] } {
    return createJWKS([this.getJWK()])
  }
}

// Export singleton instance
export const rsaKeyManager = new RSAKeyManager()
