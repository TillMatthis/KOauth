# Docker Setup Guide

## Database Configuration

This project supports both SQLite (development) and PostgreSQL (production).

### Using SQLite (Development)

1. **Update `.env`:**
   ```bash
   NODE_ENV=development
   DATABASE_URL=file:/data/db/koauth.db
   ```

2. **Update `prisma/schema.prisma`:**
   ```prisma
   datasource db {
     provider = "sqlite"  // Change from "postgresql" to "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

3. **Update `docker-compose.yml`:**
   - Postgres dependency is already commented out
   - SQLite volume is mounted at `./data/db:/data/db`

4. **Run:**
   ```bash
   docker-compose up -d --build
   ```

### Using PostgreSQL (Production)

1. **Update `.env`:**
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://koauth:koauth_dev_password@postgres:5432/koauth?schema=public
   ```

2. **Update `prisma/schema.prisma`:**
   ```prisma
   datasource db {
     provider = "postgresql"  // Keep as "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. **Update `docker-compose.yml`:**
   - Uncomment the `depends_on` block for postgres

4. **Run:**
   ```bash
   docker-compose up -d --build
   ```

## Environment Variables

All environment variables are loaded from the `.env` file via `env_file: .env` in docker-compose.yml.

Docker-specific overrides:
- `PORT=3000` - App always listens on 3000 inside container
- `HOST=0.0.0.0` - Binds to all interfaces
- `HOST_PORT` - Port to expose on host machine (default: 3002)

## Volumes

- `./data/db:/data/db` - SQLite database persistence
- `./keys:/app/keys` - RSA keys persistence
