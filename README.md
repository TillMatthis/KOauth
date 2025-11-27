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
   http://localhost:3000/
   ```

   The built-in auth UI provides:
   - 🎨 Beautiful, responsive design with dark mode
   - 📱 Mobile-optimized login and signup forms
   - 🔐 Social login buttons (Google + GitHub)
   - ✨ Smooth animations and modern UX
   - 🎯 Zero configuration needed!
   - 📊 User dashboard with account information

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

3. **Deploying Updates (VPS)**

   When you push changes to your VPS, use the deployment script:

   ```bash
   # SSH into your VPS
   ssh your-server

   # Navigate to the project directory
   cd /path/to/koauth

   # Run the deployment script
   ./deploy.sh
   ```

   The script will:
   - Pull the latest code from Git
   - Rebuild the Docker image (including the client UI)
   - Restart the containers with zero downtime
   - Show recent logs for verification

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

- **`/`** - Login page with email/password and social login
- **`/signup`** - User registration with password validation
- **`/forgot`** - Password reset (Phase 2 preview)
- **`/dashboard`** - User dashboard (requires authentication)

### Features

- ✨ **Zero Configuration** - Just visit `/` and you're done
- 🎨 **Beautiful Design** - Modern UI inspired by Clerk and Auth0
- 🌓 **Dark Mode** - Automatic theme detection with manual toggle
- 📱 **Fully Responsive** - Works perfectly on mobile, tablet, and desktop
- 🔐 **Social Login** - Integrated Google and GitHub OAuth buttons
- ⚡ **Fast** - Built with React + Vite, optimized production builds
- 🎯 **Smart Redirects** - Supports `?redirect=/dashboard` after login
- 🚨 **Error Handling** - Beautiful error messages from query params
- 📊 **User Dashboard** - View account details and manage sessions

### User Dashboard

After successful login, users are redirected to `/dashboard` which displays:

- **Account Information**
  - Email address
  - Verification status (verified/not verified)
  - Member since date
- **Session Management**
  - Sign out button to end current session

The dashboard automatically checks authentication on load and redirects unauthenticated users to the login page.

### Development

The Auth UI is automatically served in production. For development:

```bash
# Terminal 1: Start the auth server
npm run dev

# Terminal 2: Start the Vite dev server (optional, for UI development)
cd client
npm run dev
```

In production, the UI is built and served as static files.

## API Key Authentication

KOauth provides secure, long-lived API keys for programmatic access. Perfect for:
- 🤖 MCP servers (Model Context Protocol)
- 📱 iOS Shortcuts and mobile apps
- 🖥️ CLI tools
- 🔧 Legacy systems and automation

### Generating API Keys

1. **Log in to KOauth dashboard**
   ```
   https://your-koauth-server.com/dashboard
   ```

2. **Navigate to API Keys**
   - Click the "API Keys" button from your dashboard

3. **Generate a new key**
   - Click "New Key"
   - Enter a descriptive name (e.g., "MCP Server", "iOS Shortcut")
   - Click "Generate"
   - **Copy the key immediately** - you won't see it again!

### Using API Keys

Include the API key in the `Authorization` header:

```bash
# Example: Fetch user info
curl https://kura.tillmaessen.de/api/me \
  -H "Authorization: Bearer koa_abc123_YOUR-API-KEY"
```

### API Key Format

Keys have the format: `koa_PREFIX_SECRET`
- **Prefix**: `koa_` (identifies the key type)
- **Visible part**: 6-character prefix for display
- **Secret part**: 32-character random string
- **Example**: `koa_abc123_a1b2c3d4e5f67890a1b2c3d4e5f67890`

### Security Best Practices

✅ **DO:**
- Store keys in environment variables
- Use different keys for different applications
- Revoke compromised keys immediately
- Monitor "Last Used" timestamps to detect unauthorized access
- Keep max 10 keys per user

❌ **DON'T:**
- Commit keys to git repositories
- Share keys in plain text (Slack, email)
- Log API keys
- Hard-code keys in your source code

### Validation Endpoint (For Service Integration)

If you're building a service that needs to validate API keys (like KURA Notes), use the public validation endpoint:

**Endpoint**: `POST /api/validate-key`

**Request:**
```json
{
  "apiKey": "koa_abc123_a1b2c3d4e5f67890a1b2c3d4e5f67890"
}
```

**Response (Valid Key):**
```json
{
  "valid": true,
  "userId": "clh123456789",
  "email": "user@example.com"
}
```

**Response (Invalid Key):**
```json
{
  "valid": false,
  "error": "Invalid or revoked API key"
}
```

**Rate Limit**: 100 requests/minute per IP

### API Endpoints

All endpoints require session authentication (except `/api/validate-key`):

- **POST** `/api/me/api-keys` - Generate new API key
- **GET** `/api/me/api-keys` - List all your API keys
- **DELETE** `/api/me/api-keys/:id` - Revoke an API key

See detailed API documentation in [`docs/API_KEYS.md`](./docs/API_KEYS.md)

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
