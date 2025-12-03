#!/bin/sh
# Docker entrypoint script for KOauth
# Verifies directory structure before starting the application

set -e

echo "[Entrypoint] Starting KOauth initialization..."

# Check current user
echo "[Entrypoint] Running as user: $(whoami) (UID: $(id -u), GID: $(id -g))"

# Verify keys directory exists (should be created during build)
if [ ! -d "/app/keys" ]; then
    echo "[Entrypoint] ✗ ERROR: /app/keys directory does not exist!"
    echo "[Entrypoint] This should have been created during Docker build"
    exit 1
fi

# Verify we can write to the keys directory
if [ ! -w "/app/keys" ]; then
    echo "[Entrypoint] ✗ ERROR: /app/keys is not writable!"
    echo "[Entrypoint] Current permissions:"
    ls -la /app | grep keys
    exit 1
fi

echo "[Entrypoint] ✓ /app/keys is ready (writable)"
echo "[Entrypoint] Initialization complete. Starting application..."
echo ""

# Execute the command passed to the entrypoint
exec "$@"
