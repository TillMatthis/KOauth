# KOauth – Product Requirements Document
**Current Date:** 2025-11-21  
**Owner:** Till Matthis  
**Status:** Ready for development

## Why KOauth Exists
Every new project I start needs proper auth (Kura, future SaaS, Claude MCP, etc.).  
I want one single, beautiful, TypeScript-native, self-hosted auth server I own completely – no vendor lock-in, no Java bloat, no compromises.

## Core Value Proposition
“Drop-in auth for any of my Fastify/Node.js apps that just works with Claude Desktop MCP and future multi-user SaaS – with 5 lines of code.”

## MVP Scope (Phase 1 – 10–14 days)

### Must-Have Features
1. Email + Password login/signup (Argon2id hashing)
2. Session management (HTTP-only secure cookies + refresh token rotation)
3. Personal long-lived API keys (for iOS shortcuts & legacy Kura)
4. Google + GitHub social login (Apple later)
5. JWT bearer token support (Claude Desktop MCP compatible)
6. Dual auth middleware (session OR valid API key)
7. Email verification + password reset via magic link
8. Simple built-in login UI (/auth) – beautiful, mobile-ready
9. Reusable client SDK: @tillmatthis/koauth-client
   ```ts
   initKOauth(app, { url: "https://auth.tillmaissen.com" })
   protectRoute() // automatically accepts session or API key

Docker + docker-compose out of the box

## Phase 2 (post-MVP)

Admin dashboard (React/Vite)
Apple + Microsoft login
MFA (TOTP + WebAuthn/passkeys)
Multi-tenant / organizations
Rate limiting & audit log
Billing-ready user metadata

### Non-Goals (explicitly out of scope for MVP)

Full OIDC server with dynamic client registration (we don’t need it yet)
SAML, LDAP, enterprise SSO
Hosted version (self-hosted only)
Built-in user profile editing (can be done in consuming apps)

### Success Metrics

Kura MCP works natively with Claude Desktop on day 1 after migration
Any new Fastify project gets full auth in <10 minutes
Zero auth-related bugs in production
I never have to think about auth again

### 2. KOauth – Build Checklist (Detailed)

```markdown
# KOauth – Build Checklist
**Repo:** https://github.com/TillMatthis/koauth
**Main branch:** main
**Task branches:** task/001-setup, task/002-email-password etc.

### Phase 1 – Core Auth Server (Week 1)

Task 1.1 – Project Foundation
- [ ] npx create-fastify-app@latest koauth --typescript
- [ ] Add Prisma + SQLite (dev) / Postgres (prod)
- [ ] Docker + docker-compose with health checks
- [ ] Winston structured logging
- [ ] .env.example complete

Task 1.2 – Email/Password Auth
- [ ] users table (id, email, password_hash, email_verified, created_at)
- [ ] sessions table (id, user_id, expires_at, ip, user_agent)
- [ ] POST /api/auth/signup, /auth/login
- [ ] Secure cookie session + refresh endpoint

Task 1.3 – Personal API Keys (Critical for Kura legacy)
- [ ] user_api_keys table (id, user_id, name, key_hash, expires_at, last_used)
- [ ] GET/POST/DELETE /api/me/api-keys
- [ ] Middleware: accept Bearer = valid API key OR valid session

Task 1.4 – Social Logins (Google + GitHub)
- [ ] OAuth2 callbacks for both
- [ ] Upsert user on first login
- [ ] Configurable client IDs/secrets per provider

Task 1.5 – JWT Bearer Strategy (for MCP)
- [ ] Issue short-lived access JWT on login (15min)
- [ ] Verify JWT OR API key in middleware
- [ ] attach request.user = { id, email }

Task 1.6 – Client SDK
- [ ] Publish @tillmatthis/koauth-client (private repo for now)
- [ ] initKOauth(fastify, { baseUrl })
- [ ] protectRoute(), getUser(req), requireUser(req)

Task 1.7 – Built-in Auth UI
- [ ] Static /auth route serving React/Vite login pages
- [ ] Beautiful forms (Tailwind or shadcn/ui)

### Phase 2 – Polish & Admin (Week 2)
Task 2.1 – Admin Dashboard
Task 2.2 – Email Service (Resend.com or Postal)
Task 2.3 – Deploy to auth.tillmaissen.com
Task 2.4 – Migrate Kura to use KOauth
