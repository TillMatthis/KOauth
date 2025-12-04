#!/bin/sh
# Auto-configure Prisma provider based on DATABASE_URL

set -e

echo "[Setup] Configuring Prisma provider based on DATABASE_URL..."

if [ -z "$DATABASE_URL" ]; then
  echo "[Setup] ERROR: DATABASE_URL is not set"
  exit 1
fi

# Detect database provider from DATABASE_URL
if echo "$DATABASE_URL" | grep -q "^file:"; then
  PROVIDER="sqlite"
  echo "[Setup] Detected SQLite database"
elif echo "$DATABASE_URL" | grep -qE "^postgres(ql)?://"; then
  PROVIDER="postgresql"
  echo "[Setup] Detected PostgreSQL database"
else
  echo "[Setup] ERROR: Unknown DATABASE_URL format: $DATABASE_URL"
  exit 1
fi

# Update Prisma schema provider
echo "[Setup] Setting Prisma provider to: $PROVIDER"
sed -i "s/provider = \".*\"/provider = \"$PROVIDER\"/" /app/prisma/schema.prisma

# Verify the change
CURRENT_PROVIDER=$(grep -E '^\s*provider\s*=' /app/prisma/schema.prisma | head -1)
echo "[Setup] Prisma schema updated: $CURRENT_PROVIDER"

echo "[Setup] Prisma configuration complete!"
