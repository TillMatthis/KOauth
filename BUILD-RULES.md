
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
- [ ] POST /auth/signup, /auth/login
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
