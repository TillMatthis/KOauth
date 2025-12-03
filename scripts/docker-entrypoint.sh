#!/bin/sh
# Docker entrypoint script for KOauth
# Ensures proper permissions and directory structure before starting the application

set -e

echo "[Entrypoint] Starting KOauth initialization..."

# Check current user
echo "[Entrypoint] Running as user: $(whoami)"
echo "[Entrypoint] User ID: $(id -u)"
echo "[Entrypoint] Group ID: $(id -g)"

# Check /app directory permissions
echo "[Entrypoint] /app directory permissions:"
ls -la / | grep "app"

# Ensure keys directory exists with proper permissions
if [ ! -d "/app/keys" ]; then
    echo "[Entrypoint] Creating /app/keys directory..."
    mkdir -p /app/keys
    echo "[Entrypoint] Created /app/keys successfully"
else
    echo "[Entrypoint] /app/keys directory already exists"
fi

# Verify we can write to the keys directory
if [ -w "/app/keys" ]; then
    echo "[Entrypoint] ✓ /app/keys is writable"
else
    echo "[Entrypoint] ✗ ERROR: /app/keys is not writable!"
    exit 1
fi

echo "[Entrypoint] Initialization complete. Starting application..."
echo ""

# Execute the command passed to the entrypoint
exec "$@"
