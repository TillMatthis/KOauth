# RS256 JWT Upgrade & JWKS/OAuth Discovery Implementation

## Overview

This document describes the upgrade from HS256 (symmetric) to RS256 (asymmetric) JWT signing, and the addition of JWKS and OAuth discovery endpoints for KOauth.

## What Changed

### 1. JWT Signing Algorithm: HS256 → RS256

**Before (HS256):**
- Used a single shared secret (`JWT_SECRET`) for both signing and verification
- Symmetric key cryptography
- Anyone with the secret can create valid tokens

**After (RS256):**
- Uses RSA-2048 key pairs (public + private keys)
- Private key signs tokens, public key verifies them
- Public key can be distributed safely via JWKS endpoint
- Enables true distributed OAuth 2.0 resource servers

### 2. New RSA Key Management

**File:** `src/lib/auth/rsa-keys.ts`

**Features:**
- Automatic RSA-2048 key generation on first startup
- Keys persist to `keys/` directory for reuse across restarts
- Optional environment variable configuration for production
- Singleton pattern for application-wide access
- Generates unique Key ID (kid) for each key pair

**Key Storage Options:**
1. **File-based** (default): Keys saved to `keys/jwt-{private|public}.pem`
2. **Environment variables**: Base64-encoded keys in env vars
3. **Auto-generation**: Creates new keys if none found

### 3. Enhanced JWT Payload Structure

**New Claims:**
- `iss` (issuer): https://auth.tillmaessen.de
- `aud` (audience): Target resource server URL
- `client_id`: OAuth client identifier
- `scope`: Space-separated list of granted scopes
- `kid`: Key ID in JWT header for key rotation support

**Example Token:**
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "a1b2c3d4e5f6..."
  },
  "payload": {
    "sub": "clh123456789",
    "email": "user@example.com",
    "client_id": "myapp-client-id",
    "scope": "mcp:tools:read mcp:tools:execute",
    "iss": "https://auth.tillmaessen.de",
    "aud": "https://auth.tillmaessen.de",
    "iat": 1234567890,
    "exp": 1234568790
  }
}
```

### 4. New MCP Scopes

Added for MCP server integration:
- `mcp:tools:read` - Read MCP tool definitions
- `mcp:tools:execute` - Execute MCP tools
- `kura:notes:search` - Search Kura notes

### 5. JWKS Endpoint

**Endpoint:** `GET /.well-known/jwks.json`

**Purpose:** Distribute public keys for JWT verification

**Response Example:**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "a1b2c3d4e5f6...",
      "n": "xGOr1Tv2qVy7dQE...",
      "e": "AQAB"
    }
  ]
}
```

**Features:**
- RFC 7517 compliant
- 1-hour cache headers for CDN optimization
- Supports key rotation (multiple keys can be returned)
- Public endpoint (no authentication required)

### 6. OAuth Discovery Endpoints

#### OAuth 2.0 Authorization Server Metadata

**Endpoint:** `GET /.well-known/oauth-authorization-server`

**Purpose:** RFC 8414 OAuth discovery for clients

**Includes:**
- `issuer` - Token issuer URL
- `authorization_endpoint` - OAuth authorize URL
- `token_endpoint` - Token exchange URL
- `jwks_uri` - Public key distribution URL
- `scopes_supported` - Available scopes
- `grant_types_supported` - Supported OAuth flows
- `code_challenge_methods_supported` - PKCE methods

#### OpenID Connect Discovery

**Endpoint:** `GET /.well-known/openid-configuration`

**Purpose:** OpenID Connect discovery for OIDC clients

**Additional fields:**
- `userinfo_endpoint` - User info URL
- `id_token_signing_alg_values_supported` - Signing algorithms
- `subject_types_supported` - Subject identifier types

### 7. Updated Environment Configuration

**New Environment Variables:**

```bash
# JWT Issuer (your auth server URL)
JWT_ISSUER=https://auth.tillmaessen.de

# JWT Audience (resource server URL)
JWT_AUDIENCE=https://auth.tillmaessen.de

# Optional: Provide your own RSA keys (base64-encoded)
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
JWT_KEY_ID=
```

**Deprecated:**
- `JWT_SECRET` - No longer required for RS256 (kept for backward compatibility)

## Migration Guide

### For Existing Deployments

1. **Update environment variables:**
   ```bash
   # Add to your .env file
   JWT_ISSUER=https://your-domain.com
   JWT_AUDIENCE=https://your-domain.com
   ```

2. **Deploy the update:**
   ```bash
   git pull
   npm install
   npm run build
   npm start
   ```

3. **Keys are auto-generated on first startup**
   - Keys saved to `keys/` directory
   - Persisted across restarts
   - Check logs for "RSA keys initialized" message

4. **Verify JWKS endpoint:**
   ```bash
   curl https://your-domain.com/.well-known/jwks.json
   ```

### For Production Deployments

**Option 1: Use auto-generated keys (recommended for most cases)**
- Let the server generate keys on startup
- Keys persist to disk
- Simple and secure

**Option 2: Provide your own keys**
1. Generate RSA key pair:
   ```bash
   openssl genrsa -out jwt-private.pem 2048
   openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
   ```

2. Base64 encode for environment variables:
   ```bash
   cat jwt-private.pem | base64 -w 0 > jwt-private.base64
   cat jwt-public.pem | base64 -w 0 > jwt-public.base64
   ```

3. Set environment variables:
   ```bash
   JWT_PRIVATE_KEY=$(cat jwt-private.base64)
   JWT_PUBLIC_KEY=$(cat jwt-public.base64)
   JWT_KEY_ID=$(openssl rand -hex 16)
   ```

### For Existing Tokens

**Important:** Tokens issued with HS256 will **not be valid** after upgrade.

**Migration strategies:**

1. **Hard cutover (recommended):**
   - Deploy RS256 upgrade
   - All users re-authenticate
   - Old HS256 tokens rejected

2. **Gradual migration (if needed):**
   - Add HS256 fallback verification temporarily
   - Monitor HS256 token usage
   - Remove HS256 support after grace period

## API Changes

### `generateAccessToken()`

**Before:**
```typescript
generateAccessToken(userId, email, jwtSecret, expiresIn)
```

**After:**
```typescript
generateAccessToken(userId, email?, {
  expiresIn?: string | number
  clientId?: string
  scope?: string | string[]
  issuer?: string
  audience?: string | string[]
})
```

### `verifyAccessToken()`

**Before:**
```typescript
verifyAccessToken(token, jwtSecret)
```

**After:**
```typescript
verifyAccessToken(token, {
  issuer?: string
  audience?: string | string[]
})
```

## Testing

### Updated Tests

1. **JWT Tests** (`src/__tests__/jwt.test.ts`)
   - Updated to use RS256 public key verification
   - Tests signature verification with correct key
   - Tests rejection of tokens signed with wrong key

2. **Well-Known Tests** (`src/__tests__/well-known.test.ts`)
   - Tests JWKS endpoint structure
   - Tests OAuth discovery metadata
   - Tests OpenID Connect discovery
   - Integration test: verify JWT using JWKS public key

### Running Tests

```bash
npm run prisma:generate
npm test
```

## Integration with KOmcp

### For MCP Servers

1. **Fetch JWKS on startup:**
   ```typescript
   const jwksResponse = await fetch('https://auth.tillmaessen.de/.well-known/jwks.json')
   const jwks = await jwksResponse.json()
   ```

2. **Verify incoming JWT tokens:**
   ```typescript
   import jwt from 'jsonwebtoken'
   import jwkToPem from 'jwk-to-pem'

   const publicKey = jwkToPem(jwks.keys[0])
   const decoded = jwt.verify(token, publicKey, {
     algorithms: ['RS256'],
     issuer: 'https://auth.tillmaessen.de',
     audience: 'https://your-resource-server.com'
   })
   ```

3. **Check scopes:**
   ```typescript
   const requiredScope = 'mcp:tools:execute'
   const tokenScopes = decoded.scope.split(' ')
   if (!tokenScopes.includes(requiredScope)) {
     throw new Error('Insufficient permissions')
   }
   ```

## Security Considerations

### Key Rotation

**Current Implementation:**
- Single active key pair
- Key persists across restarts
- Manual rotation required

**Future Enhancement:**
- Automatic key rotation every 30-90 days
- Multiple active keys in JWKS
- Grace period for old keys

**Manual Rotation Process:**
1. Generate new key pair
2. Add to JWKS (multiple keys)
3. Start signing new tokens with new key
4. Keep old key for 24 hours (grace period)
5. Remove old key from JWKS

### Key Storage Security

**File-based keys:**
- Stored in `keys/` directory
- Private key: mode 0600 (owner read/write only)
- Public key: mode 0644 (world readable)
- **Never commit keys to git** (`.gitignore` includes `keys/`)

**Environment-based keys:**
- Base64-encoded for safe storage
- Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate regularly

### Token Security

**Best Practices:**
- Short token expiration (15 minutes default)
- Use refresh tokens for long-lived sessions
- Validate `iss` and `aud` claims
- Check token expiration (`exp`)
- Verify signature with public key from JWKS

## Troubleshooting

### "RSA keys not initialized" Error

**Cause:** Trying to sign/verify before `rsaKeyManager.initialize()` called

**Solution:** Ensure app initialization completes before handling requests

### JWKS Returns Empty Keys Array

**Cause:** Key manager not initialized

**Solution:** Check server logs for "RSA keys initialized" message

### Tokens Fail Verification

**Possible causes:**
1. Wrong public key used for verification
2. Token expired
3. Issuer/audience mismatch
4. Token signed with different key

**Debug:**
```typescript
const decoded = jwt.decode(token, { complete: true })
console.log('Token header:', decoded.header)
console.log('Token payload:', decoded.payload)
```

### Key Generation Fails

**Symptoms:** Server crashes on startup with crypto error

**Solutions:**
- Check Node.js version (requires Node 16+)
- Verify `keys/` directory is writable
- Check disk space
- Provide keys via environment variables instead

## Performance Impact

### Token Generation

- **HS256:** ~0.1ms per token
- **RS256:** ~1-2ms per token
- **Impact:** Minimal for typical loads (<1000 tokens/sec)

### Token Verification

- **HS256:** ~0.1ms per token
- **RS256:** ~0.5-1ms per token
- **Impact:** Negligible for typical API loads

### JWKS Caching

- Cache public keys for 1 hour
- CDN-friendly with proper cache headers
- Minimal impact on auth server

## References

- **RFC 7517:** JSON Web Key (JWK)
- **RFC 7519:** JSON Web Token (JWT)
- **RFC 8414:** OAuth 2.0 Authorization Server Metadata
- **OpenID Connect Discovery:** https://openid.net/specs/openid-connect-discovery-1_0.html

## Support

For issues or questions:
- GitHub: https://github.com/TillMatthis/KOauth/issues
- Documentation: https://github.com/TillMatthis/KOauth/docs
