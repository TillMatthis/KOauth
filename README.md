# KOauth

**Reusable self-hosted TypeScript auth server** – the one that finally KOs auth forever.

KOauth is a modern, TypeScript-native authentication server built on Fastify that provides drop-in auth for any Node.js application. No vendor lock-in, no Java bloat, just clean, secure authentication you own completely.

## Features (MVP)

- ✅ Email + Password authentication with Argon2id hashing
- ✅ Session management with HTTP-only secure cookies
- ✅ Personal long-lived API keys for programmatic access
- ✅ Google + GitHub social login (OAuth2)
- ✅ JWT bearer tokens (compatible with Claude Desktop MCP)
- ✅ Dual authentication middleware (session OR API key)
- ✅ Email verification + password reset via magic links
- ✅ Built-in login UI (/auth) – beautiful and mobile-ready
- ✅ Reusable client SDK: `@tillmatthis/koauth-client`
- ✅ Docker + docker-compose ready

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose (optional)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/TillMatthis/koauth.git
   cd koauth
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Generate Prisma client**
   ```bash
   npm run prisma:generate
   ```

5. **Run database migrations**
   ```bash
   # For SQLite (development)
   npm run prisma:migrate:dev

   # For PostgreSQL (production)
   npm run prisma:migrate:deploy
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

   Server will start at `http://localhost:3000`

### Docker Deployment

1. **Production (PostgreSQL)**
   ```bash
   docker-compose up -d
   ```

2. **Development (PostgreSQL + Adminer)**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

   - App: `http://localhost:3000`
   - Adminer (DB UI): `http://localhost:8080`

## Project Structure

```
koauth/
├── src/
│   ├── app.ts              # Main Fastify application
│   ├── server.ts           # Server entry point
│   ├── config/
│   │   └── env.ts          # Environment configuration
│   ├── lib/
│   │   ├── logger.ts       # Winston logger
│   │   └── prisma.ts       # Prisma client
│   ├── plugins/            # Fastify plugins
│   └── routes/             # API routes
├── prisma/
│   └── schema.prisma       # Database schema
├── Dockerfile              # Production Docker image
├── docker-compose.yml      # Production compose
└── docker-compose.dev.yml  # Development compose
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests with Vitest
- `npm run lint` - Lint with ESLint
- `npm run format` - Format with Prettier
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate:dev` - Run migrations (dev)
- `npm run prisma:studio` - Open Prisma Studio

## Tech Stack

- **Framework**: Fastify 4
- **Language**: TypeScript 5
- **Database**: Prisma + PostgreSQL (prod) / SQLite (dev)
- **Authentication**: Argon2id, JWT, OAuth2
- **Logging**: Winston
- **Testing**: Vitest
- **Container**: Docker + Docker Compose

## Development Roadmap

See [BUILD-CHECKLIST.md](./BUILD-CHECKLIST.md) for the complete development roadmap.

### Phase 1 – Core Auth Server (Week 1)
- [x] Task 1.1 – Project Foundation
- [ ] Task 1.2 – Email/Password Auth
- [ ] Task 1.3 – Personal API Keys
- [ ] Task 1.4 – Social Logins (Google + GitHub)
- [ ] Task 1.5 – JWT Bearer Strategy (for MCP)
- [ ] Task 1.6 – Client SDK
- [ ] Task 1.7 – Built-in Auth UI

### Phase 2 – Polish & Admin (Week 2)
- [ ] Admin Dashboard
- [ ] Email Service Integration
- [ ] Production Deployment
- [ ] Migration Support

## License

MIT License - See [LICENSE](./LICENSE)

## Author

Till Matthis – [GitHub](https://github.com/TillMatthis)
