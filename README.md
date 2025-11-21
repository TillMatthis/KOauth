# KOauth

**Reusable self-hosted TypeScript auth server** – the one that finally KOs auth forever.

KOauth is a modern, TypeScript-native authentication server built on Fastify that provides drop-in auth for any Node.js application. No vendor lock-in, no Java bloat, just clean, secure authentication you own completely.

## Features (MVP - Phase 1 Complete!)

- ✅ Email + Password authentication with Argon2id hashing
- ✅ Session management with HTTP-only secure cookies
- ✅ Personal long-lived API keys for programmatic access
- ✅ Google + GitHub social login (OAuth2)
- ✅ JWT bearer tokens (compatible with Claude Desktop MCP)
- ✅ Dual authentication middleware (session OR API key)
- ✅ **Built-in Auth UI** – Stunning React login/signup at `/auth` (mobile-ready, dark mode)
- ✅ Reusable client SDK: `@tillmatthis/koauth-client`
- ✅ Docker + docker-compose ready
- 🚧 Email verification + password reset via magic links (Phase 2)

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

7. **Access the Auth UI**
   ```bash
   # Open in your browser
   http://localhost:3000/auth
   ```

   The built-in auth UI provides:
   - 🎨 Beautiful, responsive design with dark mode
   - 📱 Mobile-optimized login and signup forms
   - 🔐 Social login buttons (Google + GitHub)
   - ✨ Smooth animations and modern UX
   - 🎯 Zero configuration needed!

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

## Using the Client SDK

Get authentication in **5 lines of code** with `@tillmatthis/koauth-client`:

### Fastify

```typescript
import Fastify from 'fastify'
import { initKOauth, protectRoute, getUser } from '@tillmatthis/koauth-client'

const app = Fastify()

// 1. Initialize KOauth
initKOauth(app, { baseUrl: 'http://localhost:3000' })

// 2. Protect routes (1 line!)
app.get('/api/me', {
  preHandler: protectRoute()
}, async (request) => {
  const user = getUser(request)
  return { user }
})

await app.listen({ port: 4000 })
```

### Express

```typescript
import express from 'express'
import { initKOauth, protectRoute, getUser } from '@tillmatthis/koauth-client'

const app = express()

// 1. Initialize KOauth
initKOauth(app, { baseUrl: 'http://localhost:3000' })

// 2. Protect routes (1 line!)
app.get('/api/me', protectRoute(), (req, res) => {
  const user = getUser(req)
  res.json({ user })
})

app.listen(4000)
```

**The SDK automatically handles:**
- ✅ Session cookies
- ✅ Bearer API keys
- ✅ Bearer JWT tokens
- ✅ Cookie forwarding for server-side requests

See full SDK documentation: [`packages/koauth-client/README.md`](./packages/koauth-client/README.md)

## Using the Auth UI

KOauth includes a beautiful, production-ready authentication UI that works out of the box:

### Available Routes

- **`/auth`** - Login page with email/password and social login
- **`/auth/signup`** - User registration with password validation
- **`/auth/forgot`** - Password reset (Phase 2 preview)

### Features

- ✨ **Zero Configuration** - Just visit `/auth` and you're done
- 🎨 **Beautiful Design** - Modern UI inspired by Clerk and Auth0
- 🌓 **Dark Mode** - Automatic theme detection with manual toggle
- 📱 **Fully Responsive** - Works perfectly on mobile, tablet, and desktop
- 🔐 **Social Login** - Integrated Google and GitHub OAuth buttons
- ⚡ **Fast** - Built with React + Vite, optimized production builds
- 🎯 **Smart Redirects** - Supports `?redirect=/dashboard` after login
- 🚨 **Error Handling** - Beautiful error messages from query params

### Development

The Auth UI is automatically served in production. For development:

```bash
# Terminal 1: Start the auth server
npm run dev

# Terminal 2: Start the Vite dev server (optional, for UI development)
cd client
npm run dev
```

In production, the UI is built and served as static files from `/auth`.

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
│   ├── plugins/
│   │   └── static-ui.ts    # Serves built React client
│   └── routes/             # API routes
├── client/                 # React + Vite auth UI
│   ├── src/
│   │   ├── pages/          # Login, Signup, ForgotPassword
│   │   ├── components/     # Reusable UI components
│   │   └── App.tsx         # Main app with routing
│   └── vite.config.ts      # Vite config (outputs to server/dist/client)
├── prisma/
│   └── schema.prisma       # Database schema
├── Dockerfile              # Production Docker image
├── docker-compose.yml      # Production compose
└── docker-compose.dev.yml  # Development compose
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build server and client for production
- `npm run build:server` - Build TypeScript server
- `npm run build:client` - Build React client
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
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: Prisma + PostgreSQL (prod) / SQLite (dev)
- **Authentication**: Argon2id, JWT, OAuth2
- **Logging**: Winston
- **Testing**: Vitest
- **Container**: Docker + Docker Compose

## Development Roadmap

See [BUILD-CHECKLIST.md](./BUILD-CHECKLIST.md) for the complete development roadmap.

### Phase 1 – Core Auth Server ✅ COMPLETE!
- [x] Task 1.1 – Project Foundation
- [x] Task 1.2 – Email/Password Auth
- [x] Task 1.3 – Personal API Keys
- [x] Task 1.4 – Social Logins (Google + GitHub)
- [x] Task 1.5 – JWT Bearer Strategy (for MCP)
- [x] Task 1.6 – Client SDK
- [x] Task 1.7 – Built-in Auth UI

### Phase 2 – Polish & Admin (Week 2)
- [ ] Admin Dashboard
- [ ] Email Service Integration
- [ ] Production Deployment
- [ ] Migration Support

## License

MIT License - See [LICENSE](./LICENSE)

## Author

Till Matthis – [GitHub](https://github.com/TillMatthis)
