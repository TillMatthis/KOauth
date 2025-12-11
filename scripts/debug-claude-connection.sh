#!/bin/bash
# Debug script for Claude MCP OAuth connection issues
# Usage: ./scripts/debug-claude-connection.sh

set -e

echo "🔍 Claude MCP OAuth Connection Debugger"
echo "========================================"
echo ""

# Check if database is accessible
echo "📊 Checking database connection..."
if npm run oauth:diagnose -- --hours 1 > /dev/null 2>&1; then
    echo "✅ Database is accessible"
    echo ""
    
    echo "📋 Recent OAuth Clients (last 48 hours):"
    echo "----------------------------------------"
    npm run oauth:diagnose -- --hours 48 | grep -A 20 "Recent OAuth Client Registrations" || echo "No clients found"
    echo ""
    
    echo "🔐 Recent Authorization Attempts:"
    echo "----------------------------------"
    npm run oauth:diagnose -- --hours 48 | grep -A 30 "Recent Authorization Code Requests" || echo "No authorization attempts found"
    echo ""
    
    echo "⚠️  Potential Issues:"
    echo "---------------------"
    npm run oauth:diagnose -- --hours 48 | grep -A 10 "Potential Issues" || echo "No issues detected"
    echo ""
else
    echo "❌ Database is not accessible"
    echo ""
    echo "Please ensure:"
    echo "  1. Database server is running"
    echo "  2. DATABASE_URL is set correctly in .env"
    echo "  3. Database is accessible from this machine"
    echo ""
fi

echo "📝 Checking server logs..."
echo "-------------------------"
echo ""
echo "To check server logs, run:"
echo "  docker-compose logs -f koauth | grep -i oauth"
echo ""
echo "Or if running directly:"
echo "  tail -f /path/to/logs | grep -i oauth"
echo ""

echo "🔑 Key things to look for in logs:"
echo "----------------------------------"
echo "  1. 'OAuth client registration request' - Shows what Claude registered"
echo "  2. 'Invalid redirect_uri' - Redirect URI mismatch"
echo "  3. 'Authorization code exchange failed' - Token exchange issues"
echo "  4. 'Redirect URI validated successfully' - Good sign"
echo "  5. 'Authorization code exchanged successfully' - Success!"
echo ""

echo "💡 Common fixes:"
echo "---------------"
echo "  1. Update redirect URIs: npm run oauth:update-client <id> --redirect-uris 'https://claude.ai/oauth/callback'"
echo "  2. Mark as trusted: npm run oauth:update-client <id> --trusted"
echo "  3. Activate client: npm run oauth:update-client <id> --active"
echo ""

echo "📚 For more details, see: DEBUG-CLAUDE-CONNECTOR.md"
echo ""
