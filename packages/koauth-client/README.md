# @tillmatthis/koauth-client

> Zero-dependency TypeScript client SDK for KOauth authentication

[![npm version](https://badge.fury.io/js/%40tillmatthis%2Fkoauth-client.svg)](https://www.npmjs.com/package/@tillmatthis/koauth-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Get authentication in **5 lines of code** for any Fastify or Express app.

## Features

- **Zero dependencies** – Uses native Node.js fetch
- **Framework agnostic** – Works with Fastify and Express
- **TypeScript native** – Full type safety out of the box
- **Multi-auth support** – Sessions, API keys, JWT tokens (automatic)
- **Cookie forwarding** – Perfect for server-side requests
- **Battle-tested** – Comprehensive test coverage

## Installation

```bash
npm install @tillmatthis/koauth-client
```

## Quick Start

### Fastify

```typescript
import Fastify from 'fastify'
import { initKOauth, protectRoute, getUser } from '@tillmatthis/koauth-client'

const app = Fastify()

// 1. Initialize KOauth
initKOauth(app, { baseUrl: 'https://auth.example.com' })

// 2. Protect routes (1 line!)
app.get('/protected', {
  preHandler: protectRoute()
}, async (request, reply) => {
  const user = getUser(request)
  return { user }
})

await app.listen({ port: 3000 })
```

### Express

```typescript
import express from 'express'
import { initKOauth, protectRoute, getUser } from '@tillmatthis/koauth-client'

const app = express()

// 1. Initialize KOauth
initKOauth(app, { baseUrl: 'https://auth.example.com' })

// 2. Protect routes (1 line!)
app.get('/protected', protectRoute(), (req, res) => {
  const user = getUser(req)
  res.json({ user })
})

app.listen(3000)
```

## API Reference

### `initKOauth(app, options)`

Initialize KOauth client with your auth server URL.

**Parameters:**
- `app` – Fastify or Express app instance
- `options.baseUrl` – Base URL of your KOauth server (e.g., `https://auth.example.com`)
- `options.timeout?` – Request timeout in milliseconds (default: 5000)
- `options.onError?` – Custom error handler

**Example:**

```typescript
initKOauth(app, {
  baseUrl: process.env.AUTH_SERVER_URL,
  timeout: 10000,
  onError: (error) => console.error('Auth error:', error)
})
```

---

### `protectRoute()`

Create middleware that requires authentication. Rejects requests with `401` if not authenticated.

**Supports (automatically):**
- Session cookies (`session_id`)
- Bearer API keys (`Authorization: Bearer koa_...`)
- Bearer JWT tokens (`Authorization: Bearer eyJ...`)

**Example (Fastify):**

```typescript
app.get('/api/me', {
  preHandler: protectRoute()
}, async (request) => {
  const user = getUser(request)
  return { id: user.id, email: user.email }
})
```

**Example (Express):**

```typescript
app.get('/api/me', protectRoute(), (req, res) => {
  const user = getUser(req)
  res.json({ id: user.id, email: user.email })
})
```

---

### `optionalAuth()`

Create middleware for optional authentication. Attaches user if authenticated, but doesn't reject if not.

**Example (Fastify):**

```typescript
app.get('/feed', {
  preHandler: optionalAuth()
}, async (request) => {
  const user = optionalUser(request)

  if (user) {
    return { personalized: true, feed: getPersonalizedFeed(user.id) }
  }

  return { personalized: false, feed: getPublicFeed() }
})
```

**Example (Express):**

```typescript
app.get('/feed', optionalAuth(), (req, res) => {
  const user = optionalUser(req)

  if (user) {
    res.json({ personalized: true, feed: getPersonalizedFeed(user.id) })
  } else {
    res.json({ personalized: false, feed: getPublicFeed() })
  }
})
```

---

### `getUser(request)`

Get authenticated user or throw error. Use in route handlers after `protectRoute()`.

**Returns:** `KOauthUser`

**Throws:** Error if user is not authenticated

**Example:**

```typescript
const user = getUser(request)
console.log(user.id, user.email)
```

---

### `optionalUser(request)`

Get authenticated user or return `null`. Use with `optionalAuth()`.

**Returns:** `KOauthUser | null`

**Example:**

```typescript
const user = optionalUser(request)
if (user) {
  console.log('Logged in:', user.email)
} else {
  console.log('Anonymous user')
}
```

---

## Types

### `KOauthUser`

```typescript
interface KOauthUser {
  id: string
  email: string
  sessionId?: string
}
```

### `KOauthOptions`

```typescript
interface KOauthOptions {
  baseUrl: string
  timeout?: number
  onError?: (error: Error) => void
}
```

---

## Authentication Methods

The SDK automatically handles multiple authentication methods:

### 1. Session Cookies

```bash
curl -H "Cookie: session_id=abc123" http://localhost:3000/protected
```

### 2. Bearer API Keys

```bash
curl -H "Authorization: Bearer koa_prefix_secret" http://localhost:3000/protected
```

### 3. Bearer JWT Tokens

```bash
curl -H "Authorization: Bearer eyJhbGc..." http://localhost:3000/protected
```

All three methods work **automatically** – no configuration needed!

---

## Complete Example

```typescript
import Fastify from 'fastify'
import { initKOauth, protectRoute, optionalAuth, getUser, optionalUser } from '@tillmatthis/koauth-client'

const app = Fastify()

// Initialize
initKOauth(app, {
  baseUrl: process.env.AUTH_SERVER_URL!
})

// Public route
app.get('/', async () => {
  return { message: 'Hello World' }
})

// Protected route (requires auth)
app.get('/api/me', {
  preHandler: protectRoute()
}, async (request) => {
  const user = getUser(request)
  return {
    id: user.id,
    email: user.email
  }
})

// Optional auth (works with or without auth)
app.get('/api/feed', {
  preHandler: optionalAuth()
}, async (request) => {
  const user = optionalUser(request)

  return {
    personalized: !!user,
    feed: user ? await getPersonalizedFeed(user.id) : await getPublicFeed()
  }
})

// Protected with business logic
app.post('/api/posts', {
  preHandler: protectRoute()
}, async (request, reply) => {
  const user = getUser(request)
  const { title, content } = request.body as any

  const post = await createPost({
    title,
    content,
    authorId: user.id
  })

  return reply.status(201).send({ post })
})

await app.listen({ port: 3000 })
console.log('Server running on http://localhost:3000')
```

---

## Testing

```bash
npm test
```

---

## Server-Side Cookie Forwarding

The SDK automatically forwards session cookies when making server-side requests. Perfect for microservices!

```typescript
// Service A → Service B (cookies automatically forwarded)
app.get('/proxy', {
  preHandler: protectRoute()
}, async (request) => {
  const response = await fetch('http://service-b/data', {
    headers: {
      cookie: request.headers.cookie
    }
  })

  return response.json()
})
```

---

## Contributing

Contributions welcome! Please open an issue or PR.

---

## License

MIT © Till Matthis

---

## Links

- [GitHub Repository](https://github.com/TillMatthis/KOauth)
- [npm Package](https://www.npmjs.com/package/@tillmatthis/koauth-client)
- [KOauth Server](https://github.com/TillMatthis/KOauth)

---

**Built with ❤️ by the KOauth team**

> The auth server that KOs auth forever.
