# Fix Redirect URI Mismatch

## Current Issue

Your OAuth client has these redirect URIs:
- `https://claude.ai/api/mcp/auth_callback`
- `https://claude.com/api/mcp/auth_callback`

But Claude might be requesting a different redirect URI, causing the authorization to fail.

## Step 1: Check What Claude Is Actually Requesting

When you click "Connect" in Claude, check your KOauth server logs for the authorization request:

```bash
# If using Docker
docker-compose logs -f koauth | grep -i "OAuth authorize request"

# Or check log files
tail -f /path/to/koauth.log | grep -i "OAuth authorize request"
```

Look for a log entry like:
```
OAuth authorize request
clientId: claude-mcp
redirectUri: <THIS IS WHAT CLAUDE IS REQUESTING>
```

Or if there's a mismatch:
```
Invalid redirect_uri - redirect URI mismatch
requestedRedirectUri: <WHAT CLAUDE REQUESTED>
allowedRedirectUris: [<WHAT YOU HAVE REGISTERED>]
```

## Step 2: Update Redirect URIs

Based on common patterns, Claude might use one of these:

### Option A: Standard OAuth Callback (Most Common)
```bash
npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback,https://claude.com/oauth/callback"
```

### Option B: MCP-Specific Callback (What You Currently Have)
```bash
npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback"
```

### Option C: Include Both Patterns (Safest)
```bash
npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback,https://claude.com/oauth/callback,https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback"
```

## Step 3: Mark as Trusted (Optional)

To skip the consent screen:
```bash
npm run oauth:update-client claude-mcp --trusted
```

## Step 4: Verify

Check the updated configuration:
```bash
npm run oauth:update-client claude-mcp --view
```

## What to Look For in Logs

When you click "Connect" in Claude, you should see one of these:

### ✅ Success (Redirect URI Matches)
```
OAuth authorize request
clientId: claude-mcp
redirectUri: https://claude.ai/oauth/callback
...
Redirect URI validated successfully
redirectUriMatch: true
```

### ❌ Failure (Redirect URI Mismatch)
```
Invalid redirect_uri - redirect URI mismatch
requestedRedirectUri: https://claude.ai/oauth/callback
allowedRedirectUris: ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"]
redirectUriMatch: false
```

## Quick Fix (Try This First)

Since we don't know which redirect URI Claude is using, let's add the most common ones:

```bash
# Add both common patterns
npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback,https://claude.com/oauth/callback,https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback"

# Mark as trusted
npm run oauth:update-client claude-mcp --trusted

# Verify
npm run oauth:update-client claude-mcp --view
```

Then try connecting again in Claude and check the logs to see which redirect URI Claude actually uses.
