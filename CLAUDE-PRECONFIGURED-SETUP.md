# Setting Up Claude Custom Connector with Pre-configured OAuth Credentials

Based on the [official Claude documentation](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp), you can optionally provide OAuth Client ID and Client Secret in "Advanced settings" when adding a custom connector.

## Step-by-Step Setup

### Step 1: Create OAuth Client in KOauth

1. **Register a new OAuth client:**
   ```bash
   npm run oauth:register-client
   ```

2. **Or manually create via script:**
   ```bash
   npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback" --trusted --active
   ```

3. **Important:** The redirect URI **must** be exactly:
   ```
   https://claude.ai/oauth/callback
   ```

4. **Note down:**
   - Client ID (e.g., `claude-mcp`)
   - Client Secret (you'll need this for Claude)

### Step 2: Configure Client in KOauth

Ensure your client has:
- ✅ `active: true`
- ✅ Redirect URI: `https://claude.ai/oauth/callback` (exact match required)
- ✅ `trusted: true` (optional, skips consent screen)
- ✅ Appropriate scopes (e.g., `openid profile email`)

**Update client if needed:**
```bash
# View client details
npm run oauth:update-client claude-mcp --view

# Update redirect URIs
npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback"

# Mark as trusted
npm run oauth:update-client claude-mcp --trusted

# Activate
npm run oauth:update-client claude-mcp --active
```

### Step 3: Add Connector in Claude

1. **Navigate to Settings:**
   - **Pro/Max plans:** Settings > Connectors
   - **Team/Enterprise plans:** Admin settings > Connectors (Owners/Primary Owners only)

2. **Click "Add custom connector"**

3. **Enter your MCP server URL:**
   ```
   https://your-mcp-server.com
   ```

4. **Click "Advanced settings"**

5. **Enter OAuth credentials:**
   - **OAuth Client ID:** `claude-mcp` (or your client ID)
   - **OAuth Client Secret:** The secret from Step 1

6. **Click "Add"**

### Step 4: Connect and Authenticate

1. **Click "Connect"** in Claude's connector settings
2. **You'll be redirected to KOauth** for authorization
3. **Log in and approve** the connection
4. **You'll be redirected back** to Claude
5. **Connection should be established**

## Troubleshooting

### Issue: Redirect URI Mismatch

**Symptom:** Authorization fails with "invalid_redirect_uri" error.

**Fix:**
1. Check server logs for the exact redirect URI Claude is using
2. Ensure your KOauth client has this exact URI:
   ```bash
   npm run oauth:update-client claude-mcp --redirect-uris "https://claude.ai/oauth/callback"
   ```

### Issue: Client Credentials Mismatch

**Symptom:** Token exchange fails with "invalid_client" error.

**Fix:**
1. Verify Client ID matches exactly in KOauth and Claude settings
2. Verify Client Secret matches exactly (no extra spaces, correct encoding)
3. Check server logs for credential validation errors

### Issue: Connection Status Doesn't Change

**Symptom:** Authorization succeeds but Claude shows "not connected".

**Possible Causes:**
1. Authorization code not being exchanged for tokens
2. Token exchange failing silently
3. Redirect URI mismatch during token exchange

**Fix:**
1. Check server logs for token exchange activity
2. Look for "Authorization code exchanged successfully" message
3. Check for expired or already-used authorization codes:
   ```bash
   npm run oauth:diagnose -- --client-id claude-mcp
   ```

## Verification Checklist

- [ ] OAuth client created in KOauth with correct Client ID
- [ ] Redirect URI `https://claude.ai/oauth/callback` added to client
- [ ] Client marked as `active: true`
- [ ] Client ID matches exactly in KOauth and Claude settings
- [ ] Client Secret matches exactly in KOauth and Claude settings
- [ ] MCP server exposes `/.well-known/oauth-protected-resource` endpoint
- [ ] MCP server points to correct KOauth URL
- [ ] Server logs show successful authorization
- [ ] Server logs show successful token exchange

## Testing the Connection

1. **Clear browser cookies** for claude.ai (if needed)
2. **Go to Claude settings** → Connectors
3. **Click "Connect"** for your connector
4. **Watch KOauth server logs** in real-time:
   ```bash
   docker-compose logs -f koauth | grep -i oauth
   ```
5. **Check for:**
   - ✅ Authorization request received
   - ✅ Redirect URI validated successfully
   - ✅ Authorization approved
   - ✅ Token exchange successful

## Common Redirect URIs

Claude typically uses:
- `https://claude.ai/oauth/callback` (most common)

**Important:** The redirect URI must match **exactly** - including:
- Protocol (`https://`)
- Domain (`claude.ai`)
- Path (`/oauth/callback`)
- No trailing slashes
- No query parameters

## Environment Variables

Ensure these are set correctly:

```bash
# KOauth
JWT_ISSUER=https://auth.tillmaessen.de  # Must match your KOauth URL
JWT_AUDIENCE=claude-mcp                  # Or your client ID

# MCP Server
KOAUTH_URL=https://auth.tillmaessen.de
BASE_URL=https://your-mcp-server.com
```

## References

- [Official Claude Documentation](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [KOauth OAuth Integration Guide](./docs/OAUTH_INTEGRATION.md)
- [Debugging Guide](./DEBUG-CLAUDE-CONNECTOR.md)
