# Docker Setup Guide

## Simple Setup (Best Practice)

This Docker setup uses **PostgreSQL for all environments** (development and production).

### Why PostgreSQL everywhere?
- ✅ No database differences between dev and prod
- ✅ No manual schema file editing required
- ✅ Standard Docker + Prisma pattern
- ✅ Simple and maintainable

## Quick Start

1. **Create your `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. **Edit your secrets** (SESSION_SECRET, etc.)

3. **Start everything**:
   ```bash
   docker-compose up -d
   ```

That's it! The app will:
- Start PostgreSQL container
- Load your `.env` variables
- Override DATABASE_URL to use the postgres container
- Run migrations
- Start the application on port 3002 (configurable via HOST_PORT)

## Environment Variables

All environment variables from your `.env` file are loaded into the container via `env_file: .env`.

**Docker overrides** (these are set by docker-compose.yml):
- `PORT=3000` - App always listens on 3000 inside container
- `HOST=0.0.0.0` - Binds to all interfaces
- `DATABASE_URL=postgresql://koauth:koauth_dev_password@postgres:5432/koauth?schema=public`

**Port mapping**:
- The app listens on port 3000 inside the container
- Set `HOST_PORT` in your `.env` to expose on a different host port (default: 3002)
- Example: `HOST_PORT=8080` maps host:8080 → container:3000

## Accessing the Database

**Using Adminer** (Database Web UI):
```bash
docker-compose --profile tools up -d adminer
```
Then visit: http://localhost:8080

**Using psql**:
```bash
docker exec -it koauth-postgres psql -U koauth -d koauth
```

## Logs

```bash
# All logs
docker-compose logs -f

# Just app logs
docker-compose logs -f app

# Just database logs
docker-compose logs -f postgres
```

## Troubleshooting

**Container won't start?**
```bash
docker-compose down
docker-compose up -d --build
```

**Database issues?**
```bash
# Check postgres health
docker-compose ps

# View migrations
docker exec -it koauth-app npx prisma migrate status
```

**Reset everything** (⚠️ deletes data):
```bash
docker-compose down -v
docker-compose up -d --build
```
