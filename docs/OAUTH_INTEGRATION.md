##  OAuth 2.0 Integration Guide for Applications

Complete guide for integrating your application with KOauth's OAuth 2.0 authorization server.

---

## Table of Contents

1. [Overview](#overview)
2. [Register Your Application](#register-your-application)
3. [OAuth Flow](#oauth-flow)
4. [Implementation Example](#implementation-example)
5. [API Reference](#api-reference)
6. [KURA Notes Integration](#kura-notes-integration)

---

## Overview

KOauth provides full OAuth 2.0 Authorization Code Flow with PKCE support. This allows your applications to:

- **Single Sign-On (SSO)**: Users log in once across all your apps
- **Secure Authentication**: Industry-standard OAuth 2.0
- **User Consent**: Users control what data apps can access
- **Token Management**: Automatic token refresh and revocation

### Supported Grant Types

- ✅ **Authorization Code** (recommended)
- ✅ **Refresh Token** (automatic token rotation)
- ✅ **PKCE** (Public Key for Code Exchange) - recommended for SPAs

---

## Register Your Application

### Step 1: Register OAuth Client

```bash
# On KOauth server
cd /path/to/koauth
npm run oauth:register-client
```

**Interactive prompts:**
```
Client name: KURA Notes
Description: Note-taking app with AI features
Website URL: https://kura.tillmaessen.de
Redirect URIs: https://kura.tillmaessen.de/oauth/callback
Trusted client? (y/N): n
```

**Output:**
```
✅ OAuth client registered successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Client ID:     kura-notes
Client Secret: abc123def456...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANT: Save the client secret now!
   You won't be able to see it again.

Configuration for your app:
  OAUTH_CLIENT_ID=kura-notes
  OAUTH_CLIENT_SECRET=abc123def456...
  OAUTH_REDIRECT_URI=https://kura.tillmaessen.de/oauth/callback
```

### Step 2: Configure Your Application

Add to your app's `.env`:

```bash
KOAUTH_URL=https://auth.tillmaessen.de
OAUTH_CLIENT_ID=kura-notes
OAUTH_CLIENT_SECRET=abc123def456...
OAUTH_REDIRECT_URI=https://kura.tillmaessen.de/oauth/callback
```

---

## OAuth Flow

```
┌──────────┐                                    ┌──────────┐
│          │                                    │          │
│   User   │                                    │ KOauth   │
│          │                                    │          │
└────┬─────┘                                    └────┬─────┘
     │                                               │
     │  1. Click "Login with KOauth"                │
     ├──────────────────────────────────────────────►
     │                                               │
     │  2. Redirect to authorization page           │
     │     /oauth/authorize?client_id=...           │
     ◄──────────────────────────────────────────────┤
     │                                               │
     │  3. User logs in (if not already)            │
     │  4. User approves consent screen             │
     │                                               │
     │  5. Redirect back with code                  │
     │     /callback?code=abc123                    │
     ◄──────────────────────────────────────────────┤
     │                                               │
     │  6. Exchange code for tokens                 │
     │     POST /oauth/token                        │
     ├──────────────────────────────────────────────►
     │                                               │
     │  7. Receive access_token + refresh_token     │
     ◄──────────────────────────────────────────────┤
     │                                               │
     │  8. Use access_token for API requests        │
     │     Authorization: Bearer <token>            │
     │                                               │
```

---

## Implementation Example

### 1. Initiate Authorization

When user clicks "Login":

```typescript
// Redirect to KOauth
const authUrl = new URL('https://auth.tillmaessen.de/oauth/authorize')
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID!)
authUrl.searchParams.set('redirect_uri', process.env.OAUTH_REDIRECT_URI!)
authUrl.searchParams.set('scope', 'openid profile email')
authUrl.searchParams.set('state', generateRandomState()) // CSRF protection

window.location.href = authUrl.toString()
```

### 2. Handle Callback

Create `/oauth/callback` endpoint in your app:

```typescript
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query

  // Verify state (CSRF protection)
  if (state !== req.session.oauthState) {
    return res.status(400).send('Invalid state')
  }

  // Exchange code for tokens
  const response = await fetch('https://auth.tillmaessen.de/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.OAUTH_REDIRECT_URI,
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET
    })
  })

  const tokens = await response.json()
  // {
  //   access_token: "eyJ...",
  //   token_type: "Bearer",
  //   expires_in: 900,
  //   refresh_token: "abc123...",
  //   scope: "openid profile email"
  // }

  // Store tokens securely
  req.session.accessToken = tokens.access_token
  req.session.refreshToken = tokens.refresh_token

  // Redirect to app
  res.redirect('/dashboard')
})
```

### 3. Use Access Token

```typescript
// Make authenticated requests
const response = await fetch('https://kura.tillmaessen.de/api/me', {
  headers: {
    'Authorization': `Bearer ${req.session.accessToken}`
  }
})
```

### 4. Refresh Token

When access token expires:

```typescript
async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://auth.tillmaessen.de/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET
    })
  })

  const tokens = await response.json()
  return tokens
}
```

---

## API Reference

### Authorization Endpoint

**GET** `/oauth/authorize`

**Query Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `response_type` | Yes | Must be `code` |
| `client_id` | Yes | Your OAuth client ID |
| `redirect_uri` | Yes | Must match registered URI |
| `scope` | No | Space-separated scopes (default: `openid profile email`) |
| `state` | Recommended | CSRF protection token |
| `code_challenge` | Optional | PKCE code challenge (SHA-256 of verifier) |
| `code_challenge_method` | Optional | `S256` or `plain` |

**Response:**
- Redirects to consent screen (if not trusted)
- After approval, redirects to `redirect_uri?code=XXX&state=YYY`

---

### Token Endpoint

**POST** `/oauth/token`

**Headers:**
```
Content-Type: application/json
```

**Body (Authorization Code Grant):**
```json
{
  "grant_type": "authorization_code",
  "code": "authorization_code_here",
  "redirect_uri": "https://your-app.com/callback",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "code_verifier": "optional_pkce_verifier"
}
```

**Body (Refresh Token Grant):**
```json
{
  "grant_type": "refresh_token",
  "refresh_token": "refresh_token_here",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "abc123def456...",
  "scope": "openid profile email"
}
```

---

## KURA Notes Integration

### Task for KURA Notes Agent

Create this file: `KOAUTH_OAUTH_INTEGRATION.md` in KURA Notes:

```markdown
# Task: Integrate KOauth OAuth 2.0 Authentication

## Objective
Replace API key authentication with proper OAuth 2.0 flow for browser users, while keeping API keys for MCP servers.

## Prerequisites
1. OAuth client registered in KOauth (client_id: `kura-notes`)
2. Environment variables configured

## Implementation Steps

### 1. Add Environment Variables
```bash
# .env
KOAUTH_URL=https://auth.tillmaessen.de
OAUTH_CLIENT_ID=kura-notes
OAUTH_CLIENT_SECRET=<from registration>
OAUTH_REDIRECT_URI=https://kura.tillmaessen.de/oauth/callback
```

### 2. Install OAuth Client Library (Optional)
```bash
npm install simple-oauth2
# OR implement manually (recommended for learning)
```

### 3. Create OAuth Routes

**File:** `src/routes/auth/oauth.ts`

```typescript
import { FastifyInstance } from 'fastify'

export async function oauthRoutes(app: FastifyInstance) {
  // Initiate OAuth flow
  app.get('/auth/login', async (request, reply) => {
    const state = generateRandomString(32)
    request.session.oauthState = state

    const authUrl = new URL(`${process.env.KOAUTH_URL}/oauth/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID!)
    authUrl.searchParams.set('redirect_uri', process.env.OAUTH_REDIRECT_URI!)
    authUrl.searchParams.set('scope', 'openid profile email')
    authUrl.searchParams.set('state', state)

    return reply.redirect(authUrl.toString())
  })

  // Handle OAuth callback
  app.get('/oauth/callback', async (request, reply) => {
    const { code, state } = request.query as { code: string; state: string }

    // Verify state
    if (state !== request.session.oauthState) {
      return reply.status(400).send({ error: 'Invalid state' })
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`${process.env.KOAUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.OAUTH_REDIRECT_URI,
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET
      })
    })

    const tokens = await tokenResponse.json()

    // Store tokens in session
    request.session.accessToken = tokens.access_token
    request.session.refreshToken = tokens.refresh_token

    return reply.redirect('/dashboard')
  })

  // Logout
  app.post('/auth/logout', async (request, reply) => {
    request.session.destroy()
    return reply.send({ success: true })
  })
}
```

### 4. Update Authentication Middleware

**File:** `src/lib/auth/middleware.ts`

```typescript
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  // 1. Check for OAuth access token in session (browser users)
  if (request.session.accessToken) {
    const user = await validateOAuthToken(request.session.accessToken)
    if (user) {
      request.user = user
      return
    }

    // Token expired - try refresh
    if (request.session.refreshToken) {
      const newTokens = await refreshOAuthToken(request.session.refreshToken)
      if (newTokens) {
        request.session.accessToken = newTokens.access_token
        request.session.refreshToken = newTokens.refresh_token
        request.user = await validateOAuthToken(newTokens.access_token)
        return
      }
    }

    // Refresh failed - redirect to login
    return reply.redirect('/auth/login')
  }

  // 2. Check for API key (MCP servers, CLIs)
  const authHeader = request.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)

    // Try as API key first
    const apiKeyUser = await validateApiKey(token)
    if (apiKeyUser) {
      request.user = apiKeyUser
      return
    }

    // Try as JWT access token
    const jwtUser = await validateJWT(token)
    if (jwtUser) {
      request.user = jwtUser
      return
    }
  }

  // No valid authentication
  return reply.status(401).send({ error: 'Unauthorized' })
}
```

### 5. Frontend Integration

**Update login button:**
```html
<a href="/auth/login" class="btn-primary">
  Login with KOauth
</a>
```

### 6. Testing

1. Visit `https://kura.tillmaessen.de`
2. Click "Login with KOauth"
3. Redirected to KOauth
4. Login (or already logged in)
5. Approve consent screen
6. Redirected back to KURA Notes
7. You're logged in!

### 7. MCP Server (Keep API Keys)

MCP servers continue using API keys:
```bash
# MCP server .env
KURA_API_KEY=koa_abc123_...
```

## Testing Checklist
- [ ] Browser OAuth flow works
- [ ] User stays logged in (session persists)
- [ ] Token refresh works when access token expires
- [ ] Logout works
- [ ] MCP server still works with API keys
- [ ] API endpoints accept both OAuth tokens and API keys

## Success Criteria
✅ Browser users authenticate via OAuth 2.0
✅ MCP servers authenticate via API keys
✅ Single sign-on works (login once, works for all apps)
✅ Tokens refresh automatically
✅ No breaking changes to existing API key auth
```

---

## Security Best Practices

### Store Credentials Securely
- ✅ Never commit client secrets to git
- ✅ Use environment variables
- ✅ Rotate secrets periodically

### Validate State Parameter
- ✅ Always use `state` parameter (CSRF protection)
- ✅ Store state in session, verify on callback

### Use HTTPS
- ✅ All OAuth endpoints must use HTTPS in production
- ✅ HTTP only allowed for `localhost` development

### Token Storage
- ✅ Store tokens in secure HTTP-only session cookies
- ❌ Don't store in localStorage (XSS vulnerability)
- ✅ Set short expiration for access tokens (15 min)

### PKCE for SPAs
- ✅ Use PKCE for single-page applications
- ✅ Prevents authorization code interception

---

## Troubleshooting

### Error: "invalid_client"
- Check client_id and client_secret are correct
- Verify client is active in KOauth database

### Error: "invalid_redirect_uri"
- Ensure redirect_uri exactly matches registered URI
- Check for trailing slashes, http vs https

### Error: "invalid_grant"
- Authorization code expired (10 min lifetime)
- Code already used (can only use once)
- redirect_uri doesn't match initial request

### Tokens not refreshing
- Verify refresh token grant type is enabled for client
- Check refresh token hasn't expired (30 days)
- Ensure client_id and client_secret are correct

---

## Next Steps

1. ✅ Register your application
2. ✅ Implement OAuth flow
3. ✅ Test end-to-end
4. 📝 Add user documentation
5. 🚀 Deploy to production

For questions, see [KOauth Documentation](https://github.com/TillMatthis/koauth)
