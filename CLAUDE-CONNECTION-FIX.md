# Fixing Claude MCP OAuth Connection Issues

## The Problem

You're experiencing:
- ✅ Clicking "Connect" redirects to KOauth
- ✅ Authorization appears to succeed
- ❌ Redirects back to Claude settings page
- ❌ Connection status remains "not connected"

## Root Cause

Based on the [official Claude documentation](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp), Claude supports **two OAuth modes**:

1. **Pre-configured Client Credentials** (Advanced Settings) - You provide Client ID and Secret
2. **Dynamic Client Registration** - Claude registers automatically

Since you mentioned adding "claude-mcp as oauth client to KOauth server and added the data to claude custom connector. OAuth ID and Secret", you're using **Mode 1 (Pre-configured)**. The issue is likely:
- Redirect URI mismatch between what Claude uses and what's registered in KOauth
- Client ID/Secret mismatch between KOauth and Claude settings
- Authorization code not being exchanged for tokens

## How Claude OAuth Works

### With Pre-configured Credentials (Your Case)

1. **You create OAuth client in KOauth** → Get Client ID and Secret
2. **You add connector in Claude** → Enter MCP server URL and credentials in Advanced settings
3. **Claude discovers your MCP server** → Requests `/.well-known/oauth-protected-resource`
4. **MCP server points to KOauth** → Returns authorization server URL
5. **User clicks "Connect"** → Claude uses your Client ID/Secret to redirect to KOauth
6. **KOauth authorizes** → Redirects back with authorization code
7. **Claude exchanges code** → `POST /oauth/token` with your Client ID/Secret
8. **Connection established** → Claude stores token and marks as connected

### With Dynamic Registration (Alternative)

1. **Claude discovers your MCP server** → Requests `/.well-known/oauth-protected-resource`
2. **MCP server points to KOauth** → Returns authorization server URL
3. **Claude registers dynamically** → `POST /oauth/register` with:
   - Client name: Auto-generated
   - Client ID: Auto-generated (e.g., `client_abc123...`)
   - Redirect URI: `https://claude.ai/oauth/callback` (typically)
4. **User clicks "Connect"** → Claude redirects to KOauth
5. **KOauth authorizes** → Redirects back with authorization code
6. **Claude exchanges code** → `POST /oauth/token` to get access token
7. **Connection established** → Claude stores token and marks as connected

## Why It's Failing

The most common issues are:

### Issue 1: Redirect URI Mismatch

**Symptom:** Authorization redirects back but connection doesn't establish.

**Cause:** The redirect URI used during authorization doesn't match what Claude registered.

**Fix:**
1. Check server logs for what redirect URI Claude registered with
2. Verify the redirect URI in authorization logs matches exactly
3. Update the client's redirect URIs if needed

### Issue 2: Authorization Code Not Exchanged

**Symptom:** Authorization succeeds but token exchange fails.

**Cause:**
- Authorization code expired (10 minute lifetime)
- Code already used (single-use only)
- Redirect URI mismatch during token exchange
- Client secret mismatch

**Fix:**
- Check server logs for token exchange errors
- Verify authorization code wasn't already used
- Ensure redirect URI matches exactly during token exchange

### Issue 3: Wrong Client Being Used

**Symptom:** You manually created "claude-mcp" but it's not being used.

**Cause:** Claude uses its own dynamically registered client, not your manual one.

**Fix:**
- Don't manually create clients for Claude
- Let Claude register dynamically
- Use the diagnostic tools to find Claude's actual client ID

## Step-by-Step Fix

### Step 1: Check Server Logs

Look for these log entries:

```bash
# If using Docker
docker-compose logs -f koauth | grep -i oauth

# Or check log files directly
tail -f /path/to/koauth.log | grep -i oauth
```

**Key log entries:**

1. **Client Registration:**
   ```
   OAuth client registration request
   clientName: <claude-generated-name>
   redirectUris: ["https://claude.ai/oauth/callback"]
   ```

2. **Authorization:**
   ```
   OAuth authorize request
   clientId: <claude-client-id>
   redirectUri: https://claude.ai/oauth/callback
   ```

3. **Redirect URI Validation:**
   ```
   Invalid redirect_uri - redirect URI mismatch
   requestedRedirectUri: <what-claude-sent>
   allowedRedirectUris: [<what-client-has>]
   ```

4. **Token Exchange:**
   ```
   Authorization code exchange failed
   possibleReasons: [...]
   ```

### Step 2: Find Claude's Client ID

**If using pre-configured credentials (your case):**
- Use the Client ID you created in KOauth (e.g., `claude-mcp`)
- Verify it matches exactly what you entered in Claude's Advanced settings

**If using dynamic registration:**
- From the logs, find the client ID that Claude registered with
- It will look like: `client_abc123def456...` (auto-generated)

### Step 3: Check Client Configuration

```bash
# View all clients
npm run oauth:diagnose -- --all

# View specific client details
npm run oauth:update-client <claude-client-id> --view
```

Check:
- ✅ `active: true`
- ✅ Redirect URIs include `https://claude.ai/oauth/callback`
- ✅ Client is registered

### Step 4: Fix Redirect URI Issues

If redirect URIs don't match:

```bash
# Update redirect URIs
npm run oauth:update-client <claude-client-id> --redirect-uris "https://claude.ai/oauth/callback"

# Mark as trusted (skip consent screen)
npm run oauth:update-client <claude-client-id> --trusted

# Ensure active
npm run oauth:update-client <claude-client-id> --active
```

### Step 5: Check Authorization Codes

```bash
# Check recent authorization activity
npm run oauth:diagnose -- --client-id <claude-client-id>
```

Look for:
- ⏰ Expired codes (never exchanged)
- ✅ Used codes (successfully exchanged)
- ⏳ Pending codes (waiting for exchange)

### Step 6: Test Connection

1. **Clear browser cookies** for claude.ai
2. **Go to Claude settings** → Custom Connectors
3. **Click "Connect"** for your MCP server
4. **Watch server logs** in real-time
5. **Check for errors** in the logs

## Common Redirect URIs

Claude typically uses:
- `https://claude.ai/oauth/callback` (most common)
- `https://claude.ai/oauth/redirect` (some versions)

**Important:** Check your logs to see what Claude actually registered with - it must match exactly.

## Debugging Checklist

- [ ] Check server logs for OAuth activity
- [ ] Find Claude's dynamically registered client ID
- [ ] Verify redirect URIs match exactly (including protocol, domain, path)
- [ ] Check if authorization codes are being created
- [ ] Verify token exchange is succeeding
- [ ] Check for expired or already-used authorization codes
- [ ] Ensure client is marked as `active: true`
- [ ] Review error messages in logs for specific failure reasons

## Quick Diagnostic Commands

```bash
# View all OAuth activity
npm run oauth:diagnose -- --all

# View specific client
npm run oauth:diagnose -- --client-id <client-id>

# View last 24 hours
npm run oauth:diagnose -- --hours 24

# Update client redirect URIs
npm run oauth:update-client <client-id> --redirect-uris "https://claude.ai/oauth/callback"

# Mark as trusted
npm run oauth:update-client <client-id> --trusted

# View client details
npm run oauth:update-client <client-id> --view
```

## What NOT to Do

❌ **Don't use different redirect URIs** - Must match exactly (typically `https://claude.ai/oauth/callback`)
❌ **Don't ignore server logs** - They contain the exact error messages
❌ **Don't mismatch Client ID/Secret** - Must match exactly between KOauth and Claude settings
❌ **Don't forget to add redirect URI** - Your KOauth client must have `https://claude.ai/oauth/callback` in redirect URIs

## What TO Do

✅ **Verify Client ID/Secret match** - Check they're identical in KOauth and Claude Advanced settings
✅ **Check server logs** - They show exactly what's happening
✅ **Use diagnostic tools** - `npm run oauth:diagnose` shows all activity
✅ **Verify redirect URIs match exactly** - Including protocol, domain, path
✅ **Check authorization code status** - Expired/used/pending
✅ **Ensure redirect URI is registered** - Your KOauth client must include `https://claude.ai/oauth/callback`

## Still Having Issues?

1. **Check server logs** - Look for specific error messages
2. **Run diagnostics** - `npm run oauth:diagnose -- --all`
3. **Verify redirect URIs** - Must match exactly
4. **Check client status** - Active, trusted, redirect URIs
5. **Review authorization codes** - Expired, used, pending

## Environment Variables

Make sure these are set correctly:

```bash
# KOauth
JWT_ISSUER=https://auth.tillmaessen.de  # Must match your KOauth URL
JWT_AUDIENCE=claude-mcp                  # Or whatever Claude expects

# MCP Server
KOAUTH_URL=https://auth.tillmaessen.de
BASE_URL=https://mcp.tillmaessen.de
```

## Next Steps

1. **Check server logs** for OAuth activity when you click "Connect"
2. **Find Claude's client ID** from the registration logs
3. **Verify redirect URIs** match exactly
4. **Check if authorization codes** are being created and exchanged
5. **Review error messages** in logs for specific failure reasons

For more details, see: `DEBUG-CLAUDE-CONNECTOR.md`
