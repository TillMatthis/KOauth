#!/bin/sh
# Docker entrypoint script for KOauth
# Ensures the keys directory (volume mount) is writable

set -e

echo "[Entrypoint] Starting KOauth initialization..."
echo "[Entrypoint] Running as user: $(whoami) (UID: $(id -u), GID: $(id -g))"

# The /app/keys directory is mounted as a Docker volume
# Verify it's accessible and writable
if [ ! -d "/app/keys" ]; then
    echo "[Entrypoint] ⚠ /app/keys directory not found, creating it..."
    mkdir -p /app/keys || {
        echo "[Entrypoint] ✗ ERROR: Cannot create /app/keys directory"
        exit 1
    }
fi

if [ ! -w "/app/keys" ]; then
    echo "[Entrypoint] ✗ ERROR: /app/keys is not writable"
    echo "[Entrypoint] Directory permissions:"
    ls -la /app | grep -E "(keys|total)"
    exit 1
fi

echo "[Entrypoint] ✓ /app/keys is ready (writable)"
echo "[Entrypoint] Initialization complete"
echo ""

# Execute the command passed to the entrypoint
exec "$@"
