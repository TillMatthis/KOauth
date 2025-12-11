# Quick Fix Guide for Your Claude Connection Issue

## Your Current Setup

Based on your description:
- ✅ You created "claude-mcp" OAuth client in KOauth
- ✅ You added Client ID and Secret to Claude's Advanced settings
- ❌ Connection status shows "not connected" after clicking "Connect"

## Most Likely Issues

### Issue #1: Redirect URI Not Registered (90% likely)

**Problem:** Your KOauth client doesn't have `https://claude.ai/oauth/callback` in its redirect URIs.

**Fix:**
```bash
# Check current redirect URIs
npm run oauth:update-client claude-mcp --view

# Add the correct redirect URI
npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback"

# Mark as trusted (skip consent screen)
npm run oauth:update-client claude-mcp --trusted

# Ensure active
npm run oauth:update-client claude-mcp --active
```

### Issue #2: Client Credentials Mismatch

**Problem:** Client ID or Secret in Claude settings doesn't match KOauth.

**Fix:**
1. Get the exact Client ID and Secret from KOauth:
   ```bash
   npm run oauth:update-client claude-mcp --view
   ```
2. Verify they match **exactly** in Claude's Advanced settings:
   - No extra spaces
   - No typos
   - Exact case matching

### Issue #3: Authorization Code Not Exchanged

**Problem:** Authorization succeeds but token exchange fails.

**Check:**
```bash
# View recent OAuth activity
npm run oauth:diagnose -- --client-id claude-mcp --hours 24
```

Look for:
- ⏰ Expired codes (never exchanged)
- ✅ Used codes (successfully exchanged)
- ⏳ Pending codes (waiting for exchange)

## Immediate Action Steps

### Step 1: Check Server Logs

When you click "Connect" in Claude, watch your KOauth server logs:

```bash
# If using Docker
docker-compose logs -f koauth | grep -i oauth

# Or check log files
tail -f /path/to/koauth.log | grep -i oauth
```

**Look for these specific messages:**

1. **Good signs:**
   ```
   ✅ OAuth authorize request
   ✅ Redirect URI validated successfully
   ✅ Authorization approved, redirecting back to client
   ✅ Authorization code exchanged successfully
   ```

2. **Bad signs:**
   ```
   ❌ Invalid redirect_uri - redirect URI mismatch
   ❌ Invalid client credentials
   ❌ Authorization code exchange failed
   ```

### Step 2: Verify Client Configuration

```bash
# View your client details
npm run oauth:update-client claude-mcp --view
```

**Check:**
- ✅ `active: true`
- ✅ Redirect URIs include `https://claude.ai/oauth/callback`
- ✅ Client ID matches what you entered in Claude

### Step 3: Fix Redirect URI (Most Common Fix)

```bash
# Update redirect URIs
npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback"

# Mark as trusted
npm run oauth:update-client claude-mcp --trusted
```

### Step 4: Test Again

1. Clear browser cookies for claude.ai (optional but recommended)
2. Go to Claude settings → Connectors
3. Click "Connect" for your connector
4. Watch server logs in real-time
5. Check for errors

## Quick Diagnostic Commands

```bash
# View all OAuth clients
npm run oauth:diagnose -- --all

# View specific client activity
npm run oauth:diagnose -- --client-id claude-mcp

# View last 24 hours
npm run oauth:diagnose -- --hours 24

# View client details
npm run oauth:update-client claude-mcp --view
```

## Expected Log Flow (Success)

When connection works, you should see in logs:

```
1. OAuth authorize request
   clientId: claude-mcp
   redirectUri: https://claude.ai/oauth/callback

2. Redirect URI validated successfully
   redirectUriMatch: true

3. Authorization approved, redirecting back to client
   redirectUrl: https://claude.ai/oauth/callback?code=...

4. OAuth token request received
   grant_type: authorization_code

5. Authorization code exchanged successfully - tokens issued
```

## If Still Not Working

1. **Share server logs** - The exact error messages will tell us what's wrong
2. **Check redirect URI** - Must be exactly `https://claude.ai/oauth/callback`
3. **Verify credentials** - Client ID and Secret must match exactly
4. **Check authorization codes** - See if they're being created and exchanged

## Key Points

- **Redirect URI must match exactly:** `https://claude.ai/oauth/callback`
- **Client ID/Secret must match exactly** between KOauth and Claude
- **Check server logs** - They show the exact error
- **Authorization codes expire** after 10 minutes
- **Codes are single-use** - Can't be exchanged twice

## Next Steps

1. Run: `npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback"`
2. Check server logs when clicking "Connect"
3. Share the log output if you need help interpreting it
