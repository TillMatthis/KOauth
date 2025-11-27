# KOauth – Technical Architecture
Stack: Fastify + TypeScript + Prisma + SQLite/Postgres + Docker

Key Decisions:
- NO SuperTokens dependency → we own everything
- Dual auth: session cookies OR personal API keys (hashed with scrypt)
- JWT only for short-lived access tokens (not primary auth)
- All passwords: Argon2id
- All secrets: libsodium where possible
- Client SDK works with any Fastify/Express app
- Login UI: React + Vite served from root (/)
- API routes: All auth endpoints under /api/auth/*
