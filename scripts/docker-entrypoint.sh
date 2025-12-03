#!/bin/sh
# Docker entrypoint script for KOauth
# Fixes volume permissions and switches to non-root user

set -e

echo "[Entrypoint] Starting KOauth initialization..."
echo "[Entrypoint] Running as: $(whoami) (UID: $(id -u), GID: $(id -g))"

# Ensure /app/keys directory exists (Docker volume mount point)
if [ ! -d "/app/keys" ]; then
    echo "[Entrypoint] Creating /app/keys directory..."
    mkdir -p /app/keys
fi

# Fix ownership of /app/keys for the koauth user
# This is necessary because Docker volumes are often created with root ownership
echo "[Entrypoint] Ensuring correct ownership of /app/keys..."
chown -R koauth:nodejs /app/keys
chmod 755 /app/keys

echo "[Entrypoint] ✓ /app/keys is ready (owned by koauth:nodejs)"
echo "[Entrypoint] Switching to koauth user and starting application..."
echo ""

# Switch to koauth user and execute the command
# Using 'su -s' to run the command as the koauth user
exec su -s /bin/sh koauth -c "exec $*"
