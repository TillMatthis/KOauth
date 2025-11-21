# KOauth – Build Checklist
**Repo:** https://github.com/TillMatthis/koauth
**Main branch:** main
**Task branches:** task/001-setup, task/002-email-password etc.

---

### Phase 1 – Core Auth Server (Week 1)

#### Task 1.1 – Project Foundation
- [x] npx create-fastify-app@latest koauth --typescript
- [x] Add Prisma + SQLite (dev) / Postgres (prod)
- [x] Docker + docker-compose with health checks
- [x] Winston structured logging
- [x] .env.example complete

**Status:** ✅ Completed
**Started:** 2025-11-21
**Completed:** 2025-11-21
**Notes:**
- Created complete Fastify + TypeScript project structure
- Configured Prisma with stub User model (supports both SQLite dev & Postgres prod)
- Added Docker multi-stage build with health checks
- Implemented Winston logger (JSON prod + console dev)
- Created exhaustive .env.example with all future variables
- Added ESLint, Prettier, .gitignore, .dockerignore
- Updated README.md with comprehensive setup instructions

---

#### Task 1.2 – Email/Password Auth
- [x] users table (id, email, password_hash, email_verified, created_at)
- [x] sessions table (id, user_id, expires_at, ip, user_agent, refresh_token)
- [x] POST /auth/signup, /auth/login, /auth/refresh, /auth/logout
- [x] Secure HTTP-only cookie sessions with SameSite=Lax
- [x] Refresh token rotation for enhanced security
- [x] Argon2id password hashing (OWASP recommended)
- [x] Scrypt-based refresh token hashing
- [x] Rate limiting (5 requests per 15 min on auth endpoints)
- [x] Zod input validation with strong password requirements
- [x] Winston structured logging
- [x] Comprehensive Vitest test suite
- [x] Prisma migrations

**Status:** ✅ Completed
**Started:** 2025-11-21
**Completed:** 2025-11-21
**Notes:**
- Implemented secure email/password authentication with industry best practices
- Password hashing: Argon2id with memory cost 19456, time cost 2
- Session management: HTTP-only cookies, 7-day expiration, automatic cleanup
- Refresh token rotation: Old tokens invalidated on refresh, detects reuse attacks
- Rate limiting: 5 requests/15min on auth endpoints, 100 requests/min globally
- Validation: Passwords require 8+ chars, uppercase, lowercase, number, special char
- Database: Users + Sessions tables with proper indexes and foreign keys
- Tests: 12 comprehensive test cases covering signup, login, refresh, logout, rate limiting
- Security features: Timing-safe token comparison, IP/User-Agent tracking
- All authentication routes registered with proper error handling

---

#### Task 1.3 – Personal API Keys (Critical for Kura legacy)
- [x] user_api_keys table (id, user_id, name, prefix, key_hash, expires_at, last_used)
- [x] POST /api/me/api-keys (generate new key - return full key ONCE)
- [x] GET /api/me/api-keys (list all keys without full keys)
- [x] DELETE /api/me/api-keys/:id (revoke key)
- [x] Middleware: accept Bearer = valid API key OR valid session
- [x] Scrypt hashing for API keys (same params as refresh tokens)
- [x] Rate limiting on API key generation (10 req/min)
- [x] Maximum 10 API keys per user enforced
- [x] Comprehensive test suite with 20+ test cases
- [x] API key format: koa_PREFIX_SECRET (6-char prefix for lookup)
- [x] lastUsedAt tracking for monitoring

**Status:** ✅ Completed
**Started:** 2025-11-21
**Completed:** 2025-11-21
**Notes:**
- Implemented full API key management system for long-lived authentication
- API keys work as Bearer tokens alongside existing session cookie auth
- Format: `koa_PREFIX_SECRET` where PREFIX is 6 chars for fast DB lookup
- Keys are hashed with scrypt before storage (never stored in plaintext)
- Full key returned ONLY ONCE on creation - cannot be retrieved later
- Supports optional expiration (configurable in days, default none)
- Automatic lastUsedAt timestamp update on each use
- Middleware checks Bearer token first, then falls back to session cookie
- Rate limiting: 10 requests/minute per user on API routes
- Maximum 10 API keys per user (configurable)
- Test suite: 20+ comprehensive tests covering:
  - Key creation with/without expiration
  - Key listing (without exposing full keys)
  - Key revocation with authorization check
  - Bearer token authentication (valid, invalid, expired, malformed)
  - Parallel auth (Bearer takes precedence over cookies)
  - Rate limiting enforcement
  - Maximum keys limit
  - lastUsedAt tracking
  - Security: Users cannot revoke other users' keys
- Ready for Kura migration and iOS Shortcuts integration

---

#### Task 1.4 – Social Logins (Google + GitHub)
- [x] OAuth2 callbacks for both (Google + GitHub)
- [x] Upsert user on first login
- [x] Configurable client IDs/secrets per provider
- [x] Database schema: provider + providerId fields on User model
- [x] GET /auth/google → redirect to Google OAuth consent
- [x] GET /auth/google/callback → exchange code, create/login user, set session
- [x] GET /auth/github → redirect to GitHub OAuth authorization
- [x] GET /auth/github/callback → exchange code, create/login user, set session
- [x] Account linking: OAuth login with existing email merges accounts
- [x] Security: Random password hash for OAuth users (prevents email/password login)
- [x] Email verification: OAuth users auto-verified (emailVerified = true)
- [x] Rate limiting: Callbacks protected by 5 req/15min auth endpoint limit
- [x] Error handling: All OAuth errors redirect to /?error=error_code
- [x] Comprehensive test suite: 17 test cases covering both providers

**Status:** ✅ Completed
**Started:** 2025-11-21
**Completed:** 2025-11-21
**Notes:**
- Implemented complete OAuth 2.0 flow for Google and GitHub authentication
- Database changes: Added nullable `provider` and `provider_id` columns to User model
- Prisma migration: Created with unique constraint on (provider, provider_id)
- Pure fetch implementation (no heavy OAuth libraries) for clean, maintainable code
- Account linking: If user signs up with email/password then logs in with Google (same email), accounts are merged
- Security features:
  - OAuth users get random 32-byte password hash → email/password login impossible
  - All OAuth users automatically email verified
  - Rate limiting inherited from auth route scope (5 requests/15 minutes)
  - Secure cookie-based sessions (same as email/password auth)
- Error handling: All errors redirect to homepage with query param (e.g., /?error=oauth_not_configured)
- Routes implemented:
  - GET /auth/google → builds OAuth URL, redirects to Google consent screen
  - GET /auth/google/callback → validates code, exchanges for token, fetches user info, upserts user, creates session
  - GET /auth/github → builds OAuth URL, redirects to GitHub authorization
  - GET /auth/github/callback → validates code, exchanges for token, fetches user info (profile + emails), upserts user, creates session
- Helper module (lib/auth/oauth.ts):
  - findOrCreateOAuthUser: Smart upsert logic with account linking
  - fetchGoogleUserInfo: Fetches from google.com/oauth2/v2/userinfo
  - fetchGitHubUserInfo: Fetches from api.github.com/user + /user/emails
- Test suite: 17 comprehensive tests
  - Google OAuth: 6 tests (redirect, callback success, existing user, account linking, errors)
  - GitHub OAuth: 6 tests (redirect, callback success, existing user, account linking, errors)
  - Configuration tests: Missing client ID/secret handling
  - Rate limiting: OAuth callback rate limit enforcement
  - All external API calls mocked with Vitest for reliable testing
- Environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI
- Ready for production use with any Google Cloud or GitHub OAuth app

---

#### Task 1.5 – JWT Bearer Strategy (for MCP)
- [x] Issue short-lived access JWT on login (15min)
- [x] Verify JWT OR API key in middleware
- [x] attach request.user = { id, email }
- [x] JWT_SECRET loaded from .env with validation
- [x] POST /auth/token endpoint for token exchange (no session cookies)
- [x] POST /auth/login now returns access_token, token_type, expires_in
- [x] GET /auth/google/callback redirects with JWT in query param
- [x] GET /auth/github/callback redirects with JWT in query param
- [x] GET /api/me endpoint protected by all three auth methods
- [x] Helper functions: protectRoute(), getUser(req)
- [x] Comprehensive test suite with 16 test cases

**Status:** ✅ Completed
**Started:** 2025-11-21
**Completed:** 2025-11-21
**Notes:**
- Implemented complete JWT Bearer token authentication for Claude Desktop MCP integration
- JWT access tokens are short-lived (15 minutes by default, configurable via JWT_EXPIRES_IN)
- JWT format: HS256 algorithm, payload includes { sub: userId, email, iat, exp }
- Token response follows OAuth 2.0 standard: { access_token, token_type: "bearer", expires_in: 900 }
- Enhanced authentication middleware with three-tier fallback:
  1. Bearer token → tries JWT first, then API key
  2. Session cookie → traditional session-based auth
  3. If no valid auth found → 401 Unauthorized
- New endpoints:
  - POST /auth/token: Token exchange endpoint (email/password → JWT, no cookies)
  - GET /api/me: Returns current user { id, email }, works with all three auth methods
- Updated existing endpoints to issue JWTs:
  - POST /auth/login: Now returns JWT access token + sets session cookies
  - OAuth callbacks (Google/GitHub): Redirect with access_token in query param
- Helper functions added to middleware.ts:
  - protectRoute(): Returns authenticate middleware for route protection
  - getUser(req): Alias for requireUser, extracts authenticated user from request
- JWT utilities (lib/auth/jwt.ts):
  - generateAccessToken(): Creates signed JWT with configurable expiration
  - verifyAccessToken(): Validates JWT signature and expiration
  - parseExpiresIn(): Converts time strings (15m, 1h, 7d) to seconds
  - createTokenResponse(): Formats OAuth 2.0 standard token response
- Test suite: 16 comprehensive tests covering:
  - Login flow → JWT issuance → Bearer auth → success (✅)
  - JWT signature verification (valid, tampered, wrong secret) (✅)
  - Token exchange endpoint (success, no cookies, invalid credentials) (✅)
  - /api/me authentication (JWT, expired, tampered, malformed, missing) (✅)
  - Dual auth: JWT vs session vs API key (all three work independently) (✅)
  - Bearer token priority over session cookies (✅)
  - JWT expiration time validation (15 minutes = 900 seconds) (✅)
- Security features:
  - JWT tokens signed with HS256 and JWT_SECRET from environment
  - Short 15-minute expiration minimizes exposure if token is compromised
  - Signature verification prevents tampering
  - Expired tokens automatically rejected by middleware
  - Bearer tokens take precedence over cookies (prevents session fixation attacks)
- Ready for Claude Desktop MCP integration - MCP can use POST /auth/token to get JWT, then use Bearer header for all API calls

---

#### Task 1.6 – Client SDK
- [ ] Publish @tillmatthis/koauth-client (private repo for now)
- [ ] initKOauth(fastify, { baseUrl })
- [ ] protectRoute(), getUser(req), requireUser(req)

**Status:** Not Started
**Started:**
**Completed:**
**Notes:**

---

#### Task 1.7 – Built-in Auth UI
- [ ] Static /auth route serving React/Vite login pages
- [ ] Beautiful forms (Tailwind or shadcn/ui)

**Status:** Not Started
**Started:**
**Completed:**
**Notes:**

---

### Phase 2 – Polish & Admin (Week 2)

#### Task 2.1 – Admin Dashboard
**Status:** Not Started

#### Task 2.2 – Email Service (Resend.com or Postal)
**Status:** Not Started

#### Task 2.3 – Deploy to auth.tillmaissen.com
**Status:** Not Started

#### Task 2.4 – Migrate Kura to use KOauth
**Status:** Not Started
