#!/bin/bash
# VPS Diagnostic Script for OAuth Flow Issues
# Run this on your VPS to diagnose why logs aren't appearing

echo "=== KOauth VPS Diagnostic ==="
echo

# 1. Check if .env file exists
echo "1. Checking .env file..."
if [ -f .env ]; then
    echo "✓ .env file exists"
    echo "LOG_LEVEL setting:"
    grep "^LOG_LEVEL" .env || echo "  LOG_LEVEL not set (will default to 'info')"
    echo "NODE_ENV setting:"
    grep "^NODE_ENV" .env || echo "  NODE_ENV not set in .env (overridden in docker-compose)"
else
    echo "✗ .env file NOT found - this might cause issues"
fi
echo

# 2. Add LOG_LEVEL=debug to .env if not present
echo "2. Setting LOG_LEVEL=debug..."
if ! grep -q "^LOG_LEVEL=" .env 2>/dev/null; then
    echo "LOG_LEVEL=debug" >> .env
    echo "✓ Added LOG_LEVEL=debug to .env"
else
    sed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=debug/' .env
    echo "✓ Updated LOG_LEVEL=debug in .env"
fi
echo

# 3. Check current git branch
echo "3. Checking git branch..."
git branch --show-current
echo

# 4. Restart containers
echo "4. Restarting containers..."
docker-compose down
docker-compose up -d
echo

# 5. Wait for containers to start
echo "5. Waiting for containers to start (10 seconds)..."
sleep 10
echo

# 6. Check container status
echo "6. Container status:"
docker-compose ps
echo

# 7. Test health endpoint
echo "7. Testing health endpoint..."
curl -s http://localhost:3002/health | jq . || echo "Health check failed"
echo
echo

# 8. Make a test request to trigger logs
echo "8. Making test API request to trigger logs..."
curl -s http://localhost:3002/api | jq . || echo "API check failed"
echo
echo

# 9. Show recent logs
echo "9. Recent logs (last 50 lines):"
docker-compose logs --tail=50 app
echo
echo

echo "=== Diagnostic Complete ==="
echo
echo "Now try the OAuth flow again and run:"
echo "  docker-compose logs -f app"
echo
echo "You should see detailed logging including:"
echo "  - 'OAuth authorize request'"
echo "  - 'Setting session cookies'"
echo "  - Cookie values and authentication status"
