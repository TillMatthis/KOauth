# Docker Setup Guide

## Database Configuration

This project **automatically** supports both SQLite (development) and PostgreSQL (production).

The Prisma provider is automatically configured based on your `DATABASE_URL` environment variable at container startup.

### Using SQLite (Development)

1. **Update `.env`:**
   ```bash
   NODE_ENV=development
   DATABASE_URL=file:/data/db/koauth.db
   ```

2. **Run:**
   ```bash
   docker-compose up -d --build
   ```

   The container will automatically:
   - Detect SQLite from the `DATABASE_URL`
   - Update Prisma schema to use `provider = "sqlite"`
   - Run migrations
   - Start the application

### Using PostgreSQL (Production)

1. **Update `.env`:**
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://koauth:koauth_dev_password@postgres:5432/koauth?schema=public
   ```

2. **Uncomment postgres dependency in `docker-compose.yml`:**
   ```yaml
   depends_on:
     postgres:
       condition: service_healthy
   ```

3. **Run:**
   ```bash
   docker-compose up -d --build
   ```

   The container will automatically:
   - Detect PostgreSQL from the `DATABASE_URL`
   - Update Prisma schema to use `provider = "postgresql"`
   - Run migrations
   - Start the application

## Environment Variables

All environment variables are loaded from the `.env` file via `env_file: .env` in docker-compose.yml.

Docker-specific overrides:
- `PORT=3000` - App always listens on 3000 inside container
- `HOST=0.0.0.0` - Binds to all interfaces
- `HOST_PORT` - Port to expose on host machine (default: 3002)

## Volumes

- `./data/db:/data/db` - SQLite database persistence
- `./keys:/app/keys` - RSA keys persistence
