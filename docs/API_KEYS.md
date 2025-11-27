# API Key Management Documentation

## Overview

API keys provide programmatic authentication for KOauth-protected services without requiring a browser session. They are designed for:

- **MCP Servers**: Model Context Protocol server authentication
- **Mobile Apps**: iOS Shortcuts, Android apps
- **CLI Tools**: Command-line applications
- **Automation**: Scripts, cronjobs, and background services
- **Legacy Systems**: Systems that can't handle OAuth flows

## Table of Contents

- [Key Format and Generation](#key-format-and-generation)
- [User Management Endpoints](#user-management-endpoints)
- [Public Validation Endpoint](#public-validation-endpoint)
- [Security Considerations](#security-considerations)
- [Implementation Guide](#implementation-guide)
- [Testing](#testing)

---

## Key Format and Generation

### Key Format

API keys follow the format: `koa_PREFIX_SECRET`

**Structure:**
- **Prefix**: `koa_` (identifies key type)
- **Visible Part**: 6 random characters (for display purposes)
- **Secret Part**: 32 random characters (base64url encoded)

**Example:**
```
koa_abc123_a1b2c3d4e5f67890a1b2c3d4e5f67890
```

### Generation Process

1. Generate 6-byte prefix: `randomBytes(6).toString('base64url')`
2. Generate 32-byte secret: `randomBytes(32).toString('base64url')`
3. Combine: `koa_${prefix}_${secret}`
4. Hash full key with scrypt for storage
5. Store only: `userId`, `name`, `prefix`, `keyHash`

**Security:**
- Keys use cryptographically secure random generation
- Full keys are NEVER stored (only scrypt hash)
- Keys are shown to user only once at generation
- Prefix allows O(1) lookup before verification

---

## User Management Endpoints

All user-facing endpoints require **session authentication** (HTTP-only cookies).

### 1. Generate API Key

**Endpoint**: `POST /api/me/api-keys`

**Authentication**: Required (session cookie)

**Request Body:**
```json
{
  "name": "MCP Server",
  "expiresInDays": 365  // Optional, 0 = no expiration
}
```

**Validation Rules:**
- `name`: 1-100 characters, required
- `expiresInDays`: 0-365 days, optional
- User can have max **10 active keys**
- Name must be unique per user

**Response (201 Created):**
```json
{
  "success": true,
  "message": "API key created successfully. Save it now - you won't see it again!",
  "apiKey": {
    "id": "clh123456789",
    "name": "MCP Server",
    "prefix": "koa_abc123",
    "key": "koa_abc123_a1b2c3d4e5f67890a1b2c3d4e5f67890",
    "expiresAt": "2026-01-27T12:00:00Z",
    "createdAt": "2025-01-27T12:00:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Maximum number of API keys (10) reached. Please revoke an existing key first."
}
```

**Rate Limit**: 10 requests/minute (per user)

---

### 2. List API Keys

**Endpoint**: `GET /api/me/api-keys`

**Authentication**: Required (session cookie)

**Response (200 OK):**
```json
{
  "success": true,
  "apiKeys": [
    {
      "id": "clh123456789",
      "name": "MCP Server",
      "prefix": "koa_abc123",
      "expiresAt": "2026-01-27T12:00:00Z",
      "lastUsedAt": "2025-01-27T11:30:00Z",
      "createdAt": "2025-01-20T10:00:00Z"
    },
    {
      "id": "clh987654321",
      "name": "iOS Shortcut",
      "prefix": "koa_xyz789",
      "expiresAt": null,
      "lastUsedAt": null,
      "createdAt": "2025-01-25T14:00:00Z"
    }
  ]
}
```

**Notes:**
- Full keys are NEVER returned (only prefix)
- Keys are ordered by creation date (newest first)
- `lastUsedAt` is `null` if never used
- `expiresAt` is `null` for keys that don't expire

**Rate Limit**: 10 requests/minute (per user)

---

### 3. Revoke API Key

**Endpoint**: `DELETE /api/me/api-keys/:id`

**Authentication**: Required (session cookie)

**Parameters:**
- `id`: API key ID (in URL path)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "API key not found or already revoked"
}
```

**Notes:**
- Keys are **hard deleted** (not soft deleted)
- User can only revoke their own keys
- Revoked keys fail validation immediately

**Rate Limit**: 10 requests/minute (per user)

---

## Public Validation Endpoint

This endpoint is used by external services (like KURA Notes) to validate API keys.

### Validate API Key

**Endpoint**: `POST /api/validate-key`

**Authentication**: None (public endpoint)

**Request Body:**
```json
{
  "apiKey": "koa_abc123_a1b2c3d4e5f67890a1b2c3d4e5f67890"
}
```

**Response (200 OK - Valid Key):**
```json
{
  "valid": true,
  "userId": "clh123456789",
  "email": "user@example.com"
}
```

**Response (401 Unauthorized - Invalid Key):**
```json
{
  "valid": false,
  "error": "Invalid or revoked API key"
}
```

**Response (400 Bad Request):**
```json
{
  "valid": false,
  "error": "Invalid request data",
  "details": [
    {
      "path": ["apiKey"],
      "message": "API key is required"
    }
  ]
}
```

### Validation Process

1. **Parse Key**: Extract prefix from `koa_PREFIX_SECRET` format
2. **Lookup**: Find key record by prefix (indexed, O(1) lookup)
3. **Check Expiration**: Reject if `expiresAt` is in the past
4. **Verify Hash**: Use scrypt to compare stored hash with provided key
5. **Update Timestamp**: Set `lastUsedAt` on successful validation
6. **Return User**: Return `userId` and `email` for authenticated requests

**Rate Limit**: 100 requests/minute per IP

**Performance Target**: < 100ms response time

---

## Security Considerations

### Key Generation

✅ **Best Practices Implemented:**
- Cryptographically secure random generation (`crypto.randomBytes`)
- Keys are 38+ characters (high entropy)
- Scrypt hashing with strong parameters
- Keys never logged or stored in plain text

### Storage

✅ **What We Store:**
- Scrypt hash of full key
- 6-character prefix (for lookup)
- User ID, name, timestamps

❌ **What We DON'T Store:**
- Plain text keys
- Reversible encryption
- Secrets in logs

### Validation

✅ **Security Measures:**
- Timing-safe hash comparison (scrypt handles this)
- Rate limiting (100 req/min per IP)
- Failed attempts logged (but not the key itself)
- No information leakage in error messages

### Rate Limiting

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /api/me/api-keys` | 10 | 1 minute | User ID or IP |
| `GET /api/me/api-keys` | 10 | 1 minute | User ID or IP |
| `DELETE /api/me/api-keys/:id` | 10 | 1 minute | User ID or IP |
| `POST /api/validate-key` | 100 | 1 minute | IP Address |

### Best Practices for Users

**DO:**
- ✅ Store keys in environment variables
- ✅ Use different keys for different apps
- ✅ Revoke compromised keys immediately
- ✅ Monitor "Last Used" timestamps
- ✅ Set expiration dates for temporary access

**DON'T:**
- ❌ Commit keys to version control
- ❌ Share keys via email/Slack
- ❌ Hard-code keys in source code
- ❌ Reuse keys across environments
- ❌ Log API keys

---

## Implementation Guide

### For Service Developers (Like KURA Notes)

If you're building a service that needs to validate KOauth API keys:

#### Step 1: Add Validation to Your Service

```typescript
// koauth-client.ts
export async function validateApiKey(apiKey: string): Promise<{ userId: string; email: string } | null> {
  try {
    const response = await fetch('https://auth.tillmaessen.de/api/validate-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiKey })
    })

    const data = await response.json()

    if (!response.ok || !data.valid) {
      return null
    }

    return {
      userId: data.userId,
      email: data.email
    }
  } catch (error) {
    console.error('API key validation failed:', error)
    return null
  }
}
```

#### Step 2: Add Middleware

```typescript
// Fastify example
import { validateApiKey } from './koauth-client'

export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' })
  }

  const apiKey = authHeader.slice(7) // Remove 'Bearer '
  const user = await validateApiKey(apiKey)

  if (!user) {
    return reply.status(401).send({ error: 'Invalid API key' })
  }

  // Attach user to request
  request.user = user
}

// Use in routes
app.get('/api/protected', {
  preHandler: authenticateApiKey
}, async (request, reply) => {
  return { user: request.user }
})
```

#### Step 3: Cache Validation Results

For performance, cache validation results for a short time:

```typescript
import { LRUCache } from 'lru-cache'

const apiKeyCache = new LRUCache<string, { userId: string; email: string }>({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
})

export async function validateApiKeyCached(apiKey: string) {
  // Check cache first
  const cached = apiKeyCache.get(apiKey)
  if (cached) return cached

  // Validate with KOauth
  const user = await validateApiKey(apiKey)
  if (user) {
    apiKeyCache.set(apiKey, user)
  }

  return user
}
```

**Cache Considerations:**
- Use short TTL (5 minutes max) to ensure revoked keys are blocked quickly
- Cache by full key (not prefix)
- Clear cache entry if validation fails
- Monitor cache hit rate

---

## Testing

### Manual Testing

#### 1. Generate a Key

```bash
# Login first (get session cookie)
curl -c cookies.txt -X POST https://auth.tillmaessen.de/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Generate API key
curl -b cookies.txt -X POST https://auth.tillmaessen.de/api/me/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Key"}'

# Save the returned key!
```

#### 2. Validate the Key

```bash
curl -X POST https://auth.tillmaessen.de/api/validate-key \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"koa_abc123_YOUR-KEY-HERE"}'
```

#### 3. Use the Key

```bash
curl https://kura.tillmaessen.de/api/me \
  -H "Authorization: Bearer koa_abc123_YOUR-KEY-HERE"
```

#### 4. List Keys

```bash
curl -b cookies.txt https://auth.tillmaessen.de/api/me/api-keys
```

#### 5. Revoke the Key

```bash
curl -b cookies.txt -X DELETE https://auth.tillmaessen.de/api/me/api-keys/KEY_ID
```

### Integration Testing

```typescript
import { test, expect } from 'vitest'

test('API key flow', async () => {
  // 1. Create user and login
  const session = await login('test@example.com', 'password')

  // 2. Generate API key
  const keyResponse = await fetch('/api/me/api-keys', {
    method: 'POST',
    headers: { 'Cookie': session },
    body: JSON.stringify({ name: 'Test Key' })
  })
  const { apiKey } = await keyResponse.json()

  // 3. Validate key
  const validateResponse = await fetch('/api/validate-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey: apiKey.key })
  })
  const validation = await validateResponse.json()
  expect(validation.valid).toBe(true)

  // 4. Use key for authenticated request
  const meResponse = await fetch('/api/me', {
    headers: { 'Authorization': `Bearer ${apiKey.key}` }
  })
  expect(meResponse.ok).toBe(true)

  // 5. Revoke key
  await fetch(`/api/me/api-keys/${apiKey.id}`, {
    method: 'DELETE',
    headers: { 'Cookie': session }
  })

  // 6. Verify key no longer works
  const invalidResponse = await fetch('/api/validate-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey: apiKey.key })
  })
  const invalidValidation = await invalidResponse.json()
  expect(invalidValidation.valid).toBe(false)
})
```

---

## Troubleshooting

### Common Issues

**Issue**: "Maximum number of API keys (10) reached"
- **Solution**: Revoke unused keys via the dashboard

**Issue**: "Invalid or revoked API key"
- **Causes**:
  - Key was revoked
  - Key has expired
  - Key was copied incorrectly (check for spaces)
  - Wrong KOauth server URL

**Issue**: Validation endpoint is slow
- **Solution**: Implement caching in your service (see Implementation Guide)

**Issue**: "Rate limit exceeded"
- **For users**: Wait 1 minute and try again
- **For services**: Implement caching to reduce validation calls

---

## Database Schema

For reference, the `user_api_keys` table structure:

```sql
CREATE TABLE user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT UNIQUE NOT NULL,
  key_hash TEXT NOT NULL,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT user_api_keys_user_id_name_key UNIQUE(user_id, name)
);

CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_prefix ON user_api_keys(prefix);
```

---

## Support

For issues or questions:
- **GitHub Issues**: [https://github.com/TillMatthis/koauth/issues](https://github.com/TillMatthis/koauth/issues)
- **Documentation**: [https://github.com/TillMatthis/koauth](https://github.com/TillMatthis/koauth)
