# KOauth Setup Guide

**KOauth** – The authentication server that KOs auth forever. A production-ready, self-hosted auth server with session cookies, API keys, and JWT Bearer tokens.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Server](#running-the-server)
- [Authentication Methods](#authentication-methods)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Claude MCP Integration](#claude-mcp-integration)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Git**
- **PostgreSQL** (production) or **SQLite** (development)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/TillMatthis/KOauth.git
cd KOauth

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Edit .env and set required values
nano .env  # or your preferred editor

# 5. Generate Prisma client
npm run prisma:generate

# 6. Run database migrations
npm run prisma:migrate:dev

# 7. Start the development server
npm run dev

# 8. Server running at http://localhost:3000
```

---

## Environment Configuration

### Required Environment Variables

Edit your `.env` file with the following **required** values:

```bash
# Database (choose one)
DATABASE_URL=file:./dev.db                    # SQLite (development)
# DATABASE_URL=postgresql://user:pass@localhost:5432/koauth  # PostgreSQL (production)

# Session secret (REQUIRED - generate a strong random string)
SESSION_SECRET=your-session-secret-here-change-in-production

# JWT secret (REQUIRED - generate a strong random string)
JWT_SECRET=your-jwt-secret-here-change-in-production
```

**Generate strong secrets with:**
```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Generate JWT_SECRET
openssl rand -base64 32
```

### Optional Configuration

```bash
# Server
NODE_ENV=development                          # development | production | test
PORT=3000                                     # Server port
HOST=0.0.0.0                                  # Server host
LOG_LEVEL=debug                               # error | warn | info | debug | trace

# JWT Settings
JWT_EXPIRES_IN=15m                            # JWT token expiration (15 minutes)
REFRESH_TOKEN_EXPIRES_IN=7d                   # Refresh token expiration (7 days)

# CORS
CORS_ORIGIN=*                                 # Allowed origins (use specific domains in production)

# OAuth Providers (optional, only if using social login)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback

# API Keys
MAX_API_KEYS_PER_USER=10                      # Maximum API keys per user
API_KEY_DEFAULT_EXPIRY_DAYS=365               # Default API key expiration (0 = no expiration)
```

---

## Database Setup

### SQLite (Development)

SQLite is configured by default for development:

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate:dev

# (Optional) Open Prisma Studio to view/edit data
npm run prisma:studio
```

### PostgreSQL (Production)

1. Install PostgreSQL
2. Create a database:
   ```bash
   createdb koauth
   ```
3. Update `.env`:
   ```bash
   DATABASE_URL=postgresql://username:password@localhost:5432/koauth?schema=public
   ```
4. Run migrations:
   ```bash
   npm run prisma:migrate:deploy
   ```

---

## Running the Server

### Development Mode (with hot reload)

```bash
npm run dev
```

Server starts at: `http://localhost:3000`

### Production Mode

```bash
# Build the project
npm run build

# Start the server
npm start
```

### Docker

```bash
# Build and run with Docker Compose
npm run docker:up

# Stop containers
npm run docker:down

# Build Docker image
npm run docker:build
```

---

## Authentication Methods

KOauth supports **three authentication methods** that work seamlessly together:

### 1. **Session Cookies** (Traditional)

- HTTP-only secure cookies
- 7-day expiration (configurable)
- Automatic refresh token rotation
- Best for: Browser-based applications

### 2. **API Keys** (Long-lived)

- Personal long-lived tokens
- Format: `koa_PREFIX_SECRET`
- Optional expiration (default: 365 days)
- Best for: Server-to-server, CLI tools, automations

### 3. **JWT Bearer Tokens** (Short-lived)

- Short-lived access tokens (15 minutes)
- OAuth 2.0 standard format
- Stateless authentication
- Best for: Mobile apps, SPAs, Claude MCP

---

## API Endpoints

### Authentication Endpoints

#### `POST /auth/signup`

Create a new user account.

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!@#"
  }'
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "emailVerified": false,
    "createdAt": "2025-11-21T12:00:00.000Z"
  }
}
```

---

#### `POST /auth/login`

Login with email and password. Returns session cookies **and** JWT access token.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!@#"
  }' \
  -c cookies.txt
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "emailVerified": false,
    "createdAt": "2025-11-21T12:00:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

---

#### `POST /auth/token`

Exchange credentials for JWT token (no cookies). Perfect for programmatic access.

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!@#"
  }'
```

**Response:**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

---

#### `POST /auth/logout`

Logout and invalidate session.

```bash
curl -X POST http://localhost:3000/auth/logout \
  -b cookies.txt
```

---

### OAuth Endpoints

#### `GET /auth/google`

Redirect to Google OAuth consent screen.

```bash
curl http://localhost:3000/auth/google
```

#### `GET /auth/google/callback`

OAuth callback (handled automatically by OAuth flow).

#### `GET /auth/github`

Redirect to GitHub OAuth authorization.

```bash
curl http://localhost:3000/auth/github
```

#### `GET /auth/github/callback`

OAuth callback (handled automatically by OAuth flow).

---

### API Key Management

#### `POST /api/me/api-keys`

Create a new API key (requires authentication).

```bash
# Using session cookie
curl -X POST http://localhost:3000/api/me/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "My CLI Tool",
    "expiresInDays": 365
  }'

# Using JWT Bearer token
curl -X POST http://localhost:3000/api/me/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "My CLI Tool",
    "expiresInDays": 365
  }'
```

**Response (full key shown ONLY ONCE):**
```json
{
  "success": true,
  "message": "API key created successfully. Save it now - you won't see it again!",
  "apiKey": {
    "id": "key_123",
    "name": "My CLI Tool",
    "prefix": "abc123",
    "key": "koa_abc123_XyZ789...",
    "expiresAt": "2026-11-21T12:00:00.000Z",
    "createdAt": "2025-11-21T12:00:00.000Z"
  }
}
```

---

#### `GET /api/me/api-keys`

List all API keys (without full keys).

```bash
curl http://localhost:3000/api/me/api-keys \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "apiKeys": [
    {
      "id": "key_123",
      "name": "My CLI Tool",
      "prefix": "abc123",
      "expiresAt": "2026-11-21T12:00:00.000Z",
      "lastUsedAt": "2025-11-21T14:30:00.000Z",
      "createdAt": "2025-11-21T12:00:00.000Z"
    }
  ]
}
```

---

#### `DELETE /api/me/api-keys/:id`

Revoke (delete) an API key.

```bash
curl -X DELETE http://localhost:3000/api/me/api-keys/key_123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### User Info Endpoint

#### `GET /api/me`

Get current authenticated user info. Works with **all three auth methods**.

```bash
# Using JWT Bearer token
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Using API key
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer koa_abc123_XyZ789..."

# Using session cookie
curl http://localhost:3000/api/me \
  -b cookies.txt
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com"
  }
}
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
# Auth tests (signup, login, logout)
npm test -- auth.test.ts

# API keys tests
npm test -- api-keys.test.ts

# JWT Bearer tests
npm test -- jwt.test.ts

# OAuth tests (Google, GitHub)
npm test -- oauth.test.ts
```

### Run Tests with UI

```bash
npm run test:ui
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

---

## Claude MCP Integration

KOauth is designed to work seamlessly with **Claude Desktop MCP** (Model Context Protocol).

### Step 1: Obtain JWT Token

MCP should authenticate once and obtain a JWT token:

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mcp@example.com",
    "password": "SecurePass123!@#"
  }' \
  | jq -r '.access_token'
```

**Response:**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

### Step 2: Use JWT for All API Calls

MCP should include the JWT token in the `Authorization` header:

```bash
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Step 3: Refresh Token Before Expiry

JWT tokens expire after 15 minutes. MCP should:
- Monitor token expiration (`expires_in: 900` seconds)
- Request a new token before expiry
- Or use API keys for long-lived connections

### MCP Configuration Example

```json
{
  "auth": {
    "type": "bearer",
    "token_url": "http://localhost:3000/auth/token",
    "credentials": {
      "email": "mcp@example.com",
      "password": "SecurePass123!@#"
    },
    "token_expiry": 900,
    "auto_refresh": true
  }
}
```

---

## Production Deployment

### Environment Variables (Production)

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@db.example.com:5432/koauth
SESSION_SECRET=<strong-random-secret-64-chars>
JWT_SECRET=<strong-random-secret-64-chars>
CORS_ORIGIN=https://yourapp.com
```

### Security Checklist

- ✅ Use PostgreSQL (not SQLite)
- ✅ Set strong `SESSION_SECRET` and `JWT_SECRET` (64+ characters)
- ✅ Enable HTTPS (set `COOKIE_SECURE=true`)
- ✅ Restrict CORS origins (set `CORS_ORIGIN` to your domain)
- ✅ Use environment-specific secrets (rotate regularly)
- ✅ Enable rate limiting (configured by default)
- ✅ Monitor logs for suspicious activity
- ✅ Run database backups regularly

### Docker Deployment

```bash
# Build production image
docker build -t koauth:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  -e SESSION_SECRET=... \
  -e JWT_SECRET=... \
  --name koauth \
  koauth:latest
```

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  koauth:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://koauth:${DB_PASSWORD}@postgres:5432/koauth
      SESSION_SECRET: ${SESSION_SECRET}
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: https://yourapp.com
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: koauth
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: koauth
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## Troubleshooting

### Issue: "Prisma Client not initialized"

**Solution:**
```bash
npm run prisma:generate
```

### Issue: "Port 3000 already in use"

**Solution:**
Change the port in `.env`:
```bash
PORT=3001
```

### Issue: "Database connection failed"

**Solution:**
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running (if using PostgreSQL)
- Run migrations: `npm run prisma:migrate:dev`

### Issue: "JWT signature verification failed"

**Solution:**
- Ensure `JWT_SECRET` is set in `.env`
- Don't change `JWT_SECRET` after issuing tokens (invalidates all tokens)
- Generate a new secret if needed: `openssl rand -base64 32`

### Issue: "Session cookie not working"

**Solution:**
- Ensure `SESSION_SECRET` is set in `.env`
- Check that cookies are enabled in your client
- For HTTPS, set `COOKIE_SECURE=true` in `.env`

### Issue: "OAuth redirect not working"

**Solution:**
- Verify OAuth client ID and secret in `.env`
- Check redirect URIs match in OAuth provider settings
- For Google: `GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback`
- For GitHub: `GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback`

---

## Support & Documentation

- **GitHub:** https://github.com/TillMatthis/KOauth
- **Issues:** https://github.com/TillMatthis/KOauth/issues
- **Build Checklist:** [BUILD-CHECKLIST.md](./BUILD-CHECKLIST.md)

---

## License

MIT License - See [LICENSE](./LICENSE) file for details.

---

**🎉 You're all set! KOauth is ready to KO auth forever.**

For questions or contributions, please open an issue on GitHub.
