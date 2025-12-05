# Claude.ai OAuth Flow Debugging Guide

This guide helps debug the OAuth flow between Claude.ai, KOmcp, and KOauth.

## Current Issue

- Claude.ai custom connector connects to `mcp.tillmaessen.de`
- KOauth dashboard opens with authorize/cancel buttons
- No login requirement shown (user may not be authenticated)
- After authorize, redirects back but connection fails (button spins then returns to initial state)

## Fixed Issues

### 1. Redirect URL Bug (FIXED)
**Problem:** When redirecting unauthenticated users to login, the URL was incorrectly constructed.

**Fix:** Changed from `/?redirect=/oauth${returnUrl}` to `/?redirect=${returnUrl}` where `returnUrl` is the encoded full URL path.

**File:** `src/routes/oauth/authorize.ts` line 50

### 2. Comprehensive Logging (ADDED)
Added detailed logging throughout the OAuth flow to help debug issues:

- **Authorization endpoint:** Logs client_id, redirect_uri, scopes, state, code_challenge, cookies, IP, user agent
- **Token endpoint:** Logs grant_type, client_id, code/refresh_token prefixes, validation results
- **Client registration:** Logs client_name, redirect_uris, grant_types, scopes

**Files:**
- `src/routes/oauth/authorize.ts`
- `src/routes/oauth/token.ts`
- `src/routes/oauth/register.ts`

## Remaining Issues to Check

### Issue 1: KOmcp Missing OAuth Metadata Endpoint

**Problem:** KOmcp must expose `/.well-known/oauth-protected-resource` endpoint for Claude to discover OAuth configuration.

**Check:**
```bash
curl https://mcp.tillmaessen.de/.well-known/oauth-protected-resource
```

**Expected:** Should return JSON with `authorization_servers` pointing to `https://auth.tillmaessen.de`

**Fix:** See `docs/KOMPC_OAUTH_SETUP.md` for implementation guide.

### Issue 2: User Not Authenticated Before Consent

**Problem:** Consent screen shows without requiring login first.

**Check KOauth logs for:**
```
msg: 'User not authenticated, redirecting to login'
```

**Possible causes:**
1. Session cookie not being sent (check CORS/cookie settings)
2. Login redirect not preserving OAuth parameters
3. Login page not redirecting back correctly

**Debug steps:**
1. Check browser network tab - is session cookie being sent?
2. Check KOauth logs - is user being redirected to login?
3. After login, does redirect URL contain all OAuth parameters?

### Issue 3: Redirect URI Mismatch

**Problem:** After authorization, redirect might fail if URI doesn't match.

**Check KOauth logs for:**
```
msg: 'Invalid redirect_uri'
requestedRedirectUri: '...'
allowedRedirectUris: [...]
```

**Debug steps:**
1. Check what redirect_uri Claude sends in authorization request
2. Check what redirect_uris were registered during dynamic client registration
3. Verify they match exactly (including protocol, domain, path, trailing slashes)

### Issue 4: Token Exchange Failure

**Problem:** Authorization code might not be exchanged for tokens successfully.

**Check KOauth logs for:**
```
msg: 'Authorization code exchange failed'
```

**Possible causes:**
1. Authorization code expired (10 minutes)
2. Code already used (one-time use)
3. PKCE code_verifier mismatch
4. Redirect URI mismatch during exchange

**Debug steps:**
1. Check token endpoint logs
2. Verify code is being exchanged immediately after authorization
3. Check if PKCE is being used correctly

### Issue 5: KOmcp Token Validation

**Problem:** KOmcp might not be validating tokens correctly.

**Check:**
1. Is KOmcp receiving Bearer tokens from Claude?
2. Is KOmcp validating tokens via KOauth JWKS endpoint?
3. Are tokens being rejected incorrectly?

## Debugging Checklist

### Step 1: Verify KOmcp Endpoint
```bash
curl -v https://mcp.tillmaessen.de/.well-known/oauth-protected-resource
```
- [ ] Returns 200 OK
- [ ] Content-Type: application/json
- [ ] Contains `authorization_servers: ["https://auth.tillmaessen.de"]`

### Step 2: Verify KOauth Metadata
```bash
curl -v https://auth.tillmaessen.de/.well-known/oauth-authorization-server
```
- [ ] Returns 200 OK
- [ ] Contains `authorization_endpoint`
- [ ] Contains `token_endpoint`
- [ ] Contains `registration_endpoint`

### Step 3: Test Dynamic Client Registration
```bash
curl -X POST https://auth.tillmaessen.de/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test Client",
    "redirect_uris": ["https://claude.ai/oauth/callback"],
    "grant_types": ["authorization_code"],
    "response_types": ["code"]
  }'
```
- [ ] Returns 201 Created
- [ ] Contains `client_id` and `client_secret`
- [ ] `redirect_uris` match what was sent

### Step 4: Monitor OAuth Flow

**Watch KOauth logs during Claude connection attempt:**

1. **Client Registration:**
   ```
   msg: 'OAuth client registration request'
   ```

2. **Authorization Request:**
   ```
   msg: 'OAuth authorize request'
   clientId: '...'
   redirectUri: '...'
   ```

3. **User Authentication:**
   ```
   msg: 'User not authenticated, redirecting to login'
   ```
   OR
   ```
   msg: 'User authenticated'
   userId: '...'
   ```

4. **Consent Screen:**
   ```
   msg: 'Redirecting to consent screen'
   ```

5. **Authorization Approved:**
   ```
   msg: 'Authorization approved, redirecting back to client'
   redirectUrl: '...'
   ```

6. **Token Exchange:**
   ```
   msg: 'OAuth token request received'
   msg: 'Exchanging authorization code for tokens'
   msg: 'Authorization code exchanged successfully'
   ```

### Step 5: Check Browser Network Tab

During Claude connection attempt, check:

1. **Authorization Request:**
   - URL: `https://auth.tillmaessen.de/oauth/authorize?...`
   - Status: 302 Redirect
   - Location header: Should redirect to login or consent

2. **Login Request (if needed):**
   - URL: `https://auth.tillmaessen.de/?redirect=...`
   - Cookies: Should set `session_id` cookie
   - Redirect: Should go back to `/oauth/authorize` with all params

3. **Consent Screen:**
   - URL: `https://auth.tillmaessen.de/oauth/consent?...`
   - Should show authorize/cancel buttons

4. **Authorization Approval:**
   - POST to `/oauth/authorize`
   - Should redirect to Claude's redirect_uri with `code` parameter

5. **Token Exchange:**
   - POST to `https://auth.tillmaessen.de/oauth/token`
   - Should return `access_token` and `refresh_token`

## Common Error Messages

### "Invalid redirect_uri"
- **Cause:** Redirect URI doesn't match registered URIs
- **Fix:** Check registered redirect_uris match exactly what Claude sends

### "Invalid or expired authorization code"
- **Cause:** Code expired (10 min) or already used
- **Fix:** Ensure token exchange happens immediately after authorization

### "Invalid client credentials"
- **Cause:** client_id or client_secret incorrect
- **Fix:** Verify credentials from dynamic registration are used correctly

### "User not authenticated"
- **Cause:** No valid session cookie
- **Fix:** Ensure login happens before consent screen

## Next Steps

1. ✅ Fixed redirect URL bug in authorize endpoint
2. ✅ Added comprehensive logging
3. ⏳ **TODO:** Implement `/.well-known/oauth-protected-resource` in KOmcp
4. ⏳ **TODO:** Test end-to-end flow with Claude.ai
5. ⏳ **TODO:** Verify token validation in KOmcp

## Log Analysis

After attempting to connect Claude, check KOauth logs for:

1. **Authorization flow:**
   ```bash
   grep "OAuth authorize request" /path/to/koauth/logs
   grep "User authenticated" /path/to/koauth/logs
   grep "Authorization approved" /path/to/koauth/logs
   ```

2. **Token exchange:**
   ```bash
   grep "OAuth token request" /path/to/koauth/logs
   grep "Authorization code exchanged" /path/to/koauth/logs
   ```

3. **Errors:**
   ```bash
   grep "error" /path/to/koauth/logs | grep -i oauth
   ```

## Support

If issues persist after checking all above:

1. Collect KOauth logs from connection attempt
2. Collect browser network tab screenshots
3. Check KOmcp logs for token validation errors
4. Verify all endpoints are accessible from Claude.ai's servers
