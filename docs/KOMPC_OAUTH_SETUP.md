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

### Redirect URI mismatch (Remote MCP Servers)

This is a common issue when Claude web connects to remote MCP servers. Claude dynamically registers OAuth clients, and if the redirect URIs don't match exactly, authorization fails.

#### Symptoms
- User completes authorization but connection isn't established
- Authorization redirects back to Claude but no connection is made
- Error logs show "invalid_redirect_uri" or "invalid_grant"

#### Diagnostic Steps

1. **Check what redirect URIs Claude registered with:**
   ```bash
   # View all OAuth clients
   npm run oauth:diagnose
   
   # View specific client details
   npm run oauth:update-client <client_id> --view
   ```

2. **Check recent OAuth flow activity:**
   ```bash
   # Show all recent OAuth activity
   npm run oauth:diagnose --all
   
   # Filter by specific client
   npm run oauth:diagnose --client-id <client_id>
   
   # Show last 12 hours
   npm run oauth:diagnose --hours 12
   ```

3. **Check server logs for redirect URI validation:**
   - Look for log entries with `msg: 'Invalid redirect_uri - redirect URI mismatch'`
   - Check `requestedRedirectUri` vs `allowedRedirectUris` in logs
   - Look for `msg: 'Redirect URI validated successfully'` to confirm matches

4. **Common redirect URI patterns:**
   - Claude web typically uses: `https://claude.ai/oauth/callback`
   - Some versions may use: `https://claude.ai/oauth/redirect`
   - Check exact URI in authorization request logs

#### Fixing Redirect URI Issues

If Claude registered with incorrect redirect URIs, update them:

```bash
# Update redirect URIs for a client
npm run oauth:update-client <client_id> --redirect-uris "https://claude.ai/oauth/callback"

# Mark client as trusted (skip consent screen)
npm run oauth:update-client <client_id> --trusted

# View updated client details
npm run oauth:update-client <client_id> --view
```

#### Authorization Code Exchange Failures

If authorization succeeds but token exchange fails:

1. **Check authorization code status:**
   ```bash
   npm run oauth:diagnose --client-id <client_id>
   ```
   Look for codes marked as "⏰ Expired" or "✅ Used"

2. **Common causes:**
   - Authorization code expired (10 minute lifetime)
   - Code already used (codes are single-use)
   - Redirect URI mismatch during token exchange
   - PKCE code verifier mismatch (if PKCE is used)

3. **Check logs for token exchange errors:**
   - Look for `msg: 'Authorization code exchange failed'`
   - Check `possibleReasons` array in logs for specific failure cause

#### Debugging Checklist

When troubleshooting remote MCP server OAuth connection issues:

- [ ] Check what redirect URIs Claude registered with (`oauth:diagnose`)
- [ ] Verify redirect URI used during authorization matches registered URIs
- [ ] Check if authorization codes are being created successfully
- [ ] Verify token exchange is succeeding (check logs for "Authorization code exchanged successfully")
- [ ] Check for expired or already-used authorization codes
- [ ] Verify client is marked as `active: true` and optionally `trusted: true`
- [ ] Review server logs for detailed error messages with full context

#### Enhanced Logging

KOauth now includes enhanced logging throughout the OAuth flow:

- **Registration:** Logs all redirect URIs, grant types, and scopes Claude registers with
- **Authorization:** Logs exact redirect URI validation with match status
- **Token Exchange:** Logs detailed failure reasons when exchange fails

Check server logs (stdout/stderr or log files) for entries prefixed with:
- `OAuth client registration request`
- `OAuth authorize request`
- `OAuth token request received`
- `Authorization code exchange failed` (with detailed reasons)

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

## Diagnostic Tools

KOauth includes diagnostic tools to help troubleshoot OAuth flow issues:

### View OAuth Client Details

```bash
npm run oauth:update-client <client_id> --view
```

Shows:
- Client ID, name, and configuration
- All registered redirect URIs
- Trusted/active status
- Grant types and scopes
- Statistics (authorization codes, refresh tokens)

### Update OAuth Client

```bash
# Update redirect URIs
npm run oauth:update-client <client_id> --redirect-uris "uri1,uri2"

# Mark as trusted (skip consent screen)
npm run oauth:update-client <client_id> --trusted

# Mark as untrusted (require consent)
npm run oauth:update-client <client_id> --untrusted

# Activate/deactivate client
npm run oauth:update-client <client_id> --active
npm run oauth:update-client <client_id> --inactive
```

### Diagnose OAuth Flow

```bash
# Show recent activity (last 24 hours)
npm run oauth:diagnose

# Show all activity
npm run oauth:diagnose --all

# Filter by client ID
npm run oauth:diagnose --client-id <client_id>

# Custom time range
npm run oauth:diagnose --hours 12
```

Shows:
- Recent client registrations
- Recent authorization code requests
- Recent token exchanges
- Active refresh tokens
- Potential issues (expired codes, URI mismatches, etc.)

## References

- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)
- [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414.html)
- [RFC 7591 - OAuth 2.0 Dynamic Client Registration](https://www.rfc-editor.org/rfc/rfc7591.html)
