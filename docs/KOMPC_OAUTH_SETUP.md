# KOmcp OAuth Setup Guide

This document describes what KOmcp (mcp.tillmaessen.de) needs to implement to work with Claude.ai custom connectors and KOauth.

## Critical Requirement: OAuth Protected Resource Metadata Endpoint

KOmcp **MUST** expose a `/.well-known/oauth-protected-resource` endpoint per RFC 9728. This is how Claude.ai discovers the OAuth configuration.

### Endpoint Specification

**URL:** `GET https://mcp.tillmaessen.de/.well-known/oauth-protected-resource`

**Response (200 OK):**
```json
{
  "resource": "https://mcp.tillmaessen.de",
  "authorization_servers": ["https://auth.tillmaessen.de"],
  "jwks_uri": "https://auth.tillmaessen.de/.well-known/jwks.json",
  "scopes_supported": [
    "mcp:tools:read",
    "mcp:tools:execute",
    "kura:notes:read",
    "kura:notes:write",
    "kura:notes:delete",
    "openid",
    "profile",
    "email"
  ],
  "bearer_methods_supported": ["header"]
}
```

### Implementation Example (Fastify)

```typescript
// src/routes/oauth-metadata.ts
import type { FastifyInstance } from 'fastify'

export async function oauthProtectedResourceRoute(app: FastifyInstance) {
  app.get('/.well-known/oauth-protected-resource', async (request, reply) => {
    const koauthUrl = process.env.KOAUTH_URL || 'https://auth.tillmaessen.de'
    const mcpUrl = process.env.BASE_URL || 'https://mcp.tillmaessen.de'

    const metadata = {
      resource: mcpUrl,
      authorization_servers: [koauthUrl],
      jwks_uri: `${koauthUrl}/.well-known/jwks.json`,
      scopes_supported: [
        'mcp:tools:read',
        'mcp:tools:execute',
        'kura:notes:read',
        'kura:notes:write',
        'kura:notes:delete',
        'openid',
        'profile',
        'email'
      ],
      bearer_methods_supported: ['header']
    }

    reply.header('Cache-Control', 'public, max-age=3600')
    reply.header('Content-Type', 'application/json')
    
    return reply.status(200).send(metadata)
  })
}
```

### Register the Route

In your main app file:

```typescript
import { oauthProtectedResourceRoute } from './routes/oauth-metadata'

// Register before other routes
await oauthProtectedResourceRoute(app)
```

## OAuth Flow Overview

1. **Claude requests metadata:** `GET https://mcp.tillmaessen.de/.well-known/oauth-protected-resource`
2. **KOmcp returns metadata** pointing to `https://auth.tillmaessen.de`
3. **Claude discovers KOauth:** `GET https://auth.tillmaessen.de/.well-known/oauth-authorization-server`
4. **Claude registers dynamically:** `POST https://auth.tillmaessen.de/oauth/register`
5. **Claude redirects user:** `https://auth.tillmaessen.de/oauth/authorize?client_id=...&redirect_uri=...`
6. **User authorizes** via KOauth
7. **KOauth redirects back** to Claude with authorization code
8. **Claude exchanges code** for tokens: `POST https://auth.tillmaessen.de/oauth/token`
9. **Claude uses tokens** to authenticate MCP requests to KOmcp
10. **KOmcp validates tokens** via KOauth JWKS endpoint

## Token Validation

KOmcp must validate Bearer tokens from Claude using KOauth's JWKS endpoint:

```typescript
import { verifyAccessToken } from './lib/auth/jwt' // or use jwks-rsa

// In your MCP endpoint middleware
const authHeader = request.headers.authorization
if (authHeader?.startsWith('Bearer ')) {
  const token = authHeader.substring(7)
  
  // Validate token via KOauth JWKS
  const koauthUrl = process.env.KOAUTH_URL || 'https://auth.tillmaessen.de'
  const jwksUri = `${koauthUrl}/.well-known/jwks.json`
  
  // Use jwks-rsa or similar library to verify token
  const payload = await verifyToken(token, jwksUri)
  
  if (payload) {
    request.user = {
      id: payload.sub,
      email: payload.email
    }
  } else {
    return reply.status(401).send({ error: 'Invalid token' })
  }
}
```

## Testing the Endpoint

Test that the endpoint is accessible:

```bash
curl https://mcp.tillmaessen.de/.well-known/oauth-protected-resource
```

Expected response:
- Status: 200 OK
- Content-Type: application/json
- Body: JSON metadata as shown above

## Troubleshooting

### Claude can't discover OAuth configuration
- **Check:** Is `/.well-known/oauth-protected-resource` accessible?
- **Check:** Does it return valid JSON?
- **Check:** Does `authorization_servers` point to `https://auth.tillmaessen.de`?

### Token validation fails
- **Check:** Is JWKS endpoint accessible? `curl https://auth.tillmaessen.de/.well-known/jwks.json`
- **Check:** Are you using the correct issuer/audience when validating tokens?
- **Check:** Are tokens being passed in `Authorization: Bearer <token>` header?

### Redirect URI mismatch
- **Check:** What redirect_uri is Claude sending?
- **Check:** Is it registered in KOauth's dynamic client registration?
- **Check:** KOauth logs will show the redirect_uri being validated

## Environment Variables

Add to KOmcp's `.env`:

```bash
# KOauth Integration
KOAUTH_URL=https://auth.tillmaessen.de
BASE_URL=https://mcp.tillmaessen.de
```

## Next Steps

1. ✅ Add `/.well-known/oauth-protected-resource` endpoint to KOmcp
2. ✅ Test endpoint is accessible
3. ✅ Implement token validation middleware
4. ✅ Test end-to-end flow with Claude.ai

## References

- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)
- [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414.html)
- [RFC 7591 - OAuth 2.0 Dynamic Client Registration](https://www.rfc-editor.org/rfc/rfc7591.html)
