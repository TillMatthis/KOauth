# OAuth Client Auto-Registration Hardening & Cleanup Plan

## Executive Summary

This plan addresses the issue of automatic OAuth client registration creating "sparky lists" of unused clients by implementing:
- **Phase 1**: Rate limiting on registration endpoint + Manual cleanup script
- **Phase 2**: Automatic cleanup cron job + Enhanced admin UI filters

Both phases maintain Claude Custom Connector compatibility (which requires public dynamic client registration).

---

## Current State Analysis

### Issues Identified
1. **No rate limiting** on `/oauth/register` endpoint (currently uses global 100 req/min limit)
2. **No cleanup mechanism** for unused/stale clients
3. **No UI filtering** to hide inactive clients
4. **Bot/crawler abuse** possible via publicly advertised registration endpoint

### Architecture Review
- ✅ `@fastify/rate-limit` v9.1.0 already installed
- ✅ Admin UI (`AdminClients.tsx`) shows client stats (_count)
- ✅ Prisma schema supports cascade deletion of related records
- ✅ Database tracks `authorizationCodes` and `refreshTokens` counts

---

## Phase 1: Rate Limiting + Manual Cleanup Script

### Goals
1. Prevent registration abuse (bots, crawlers, repeated attempts)
2. Provide admin script to bulk-delete unused clients
3. Keep Claude Custom Connector working

### 1.1 Rate Limiting on `/oauth/register`

**Implementation:**

**File:** `src/routes/oauth/index.ts`

Add stricter rate limiting to the OAuth registration route:

```typescript
export async function registerOAuthRoutes(app: FastifyInstance) {
  // Apply stricter rate limit to registration endpoint
  await app.register(async (registrationScope) => {
    await registrationScope.register(fastifyRateLimit, {
      max: 5, // 5 registrations per hour per IP
      timeWindow: '1 hour',
      cache: 10000,
      keyGenerator: (request) => {
        // Rate limit by IP address
        return request.ip
      },
      errorResponseBuilder: () => ({
        error: 'too_many_requests',
        error_description: 'Too many client registration attempts. Please try again later.'
      })
    })

    await registerRoute(registrationScope)
  })

  // Other routes (authorize, token, userinfo) - no rate limit changes
  await authorizeRoute(app)
  await tokenRoute(app)
  await userinfoRoute(app)
}
```

**Why 5/hour?**
- Claude typically registers 1-3 clients during connection setup
- Allows retries for legitimate testing
- Blocks bot/crawler abuse

**Testing:**
- Verify Claude Custom Connector still works
- Test rate limit by making 6+ registration requests
- Check error response format matches RFC 7591

---

### 1.2 Manual Cleanup Script

**File:** `scripts/cleanup-unused-oauth-clients.ts`

**Features:**
- Delete clients with 0 authorization codes AND 0 refresh tokens
- Optional: Delete clients older than N days with no activity
- Dry-run mode (preview before deletion)
- Detailed logging

**Implementation:**

```typescript
#!/usr/bin/env tsx
/**
 * Cleanup unused OAuth clients
 * Usage:
 *   npm run oauth:cleanup          # Dry run (preview only)
 *   npm run oauth:cleanup -- --yes # Actually delete
 *   npm run oauth:cleanup -- --yes --days 7  # Delete clients older than 7 days with no codes/tokens
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Options {
  dryRun: boolean
  daysOld: number | null
}

async function main() {
  const args = process.argv.slice(2)
  const options: Options = {
    dryRun: !args.includes('--yes'),
    daysOld: null
  }

  // Parse --days argument
  const daysIndex = args.indexOf('--days')
  if (daysIndex !== -1 && args[daysIndex + 1]) {
    options.daysOld = parseInt(args[daysIndex + 1], 10)
  }

  console.log('\n🧹 OAuth Client Cleanup Tool\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log('   Run with --yes to actually delete clients\n')
  } else {
    console.log('⚠️  LIVE MODE - Clients will be permanently deleted\n')
  }

  // Build query filters
  const dateFilter = options.daysOld
    ? { createdAt: { lte: new Date(Date.now() - options.daysOld * 24 * 60 * 60 * 1000) } }
    : {}

  // Find unused clients
  const unusedClients = await prisma.oAuthClient.findMany({
    where: {
      ...dateFilter
    },
    include: {
      _count: {
        select: {
          authorizationCodes: true,
          refreshTokens: true
        }
      }
    }
  })

  // Filter to clients with 0 codes AND 0 tokens
  const clientsToDelete = unusedClients.filter(
    client => client._count.authorizationCodes === 0 && client._count.refreshTokens === 0
  )

  if (clientsToDelete.length === 0) {
    console.log('✅ No unused clients found')
    if (options.daysOld) {
      console.log(`   (checked clients older than ${options.daysOld} days)`)
    }
    console.log('\n')
    return
  }

  console.log(`Found ${clientsToDelete.length} unused client(s):\n`)

  // Display clients to be deleted
  clientsToDelete.forEach((client, index) => {
    console.log(`${index + 1}. ${client.name}`)
    console.log(`   Client ID: ${client.clientId}`)
    console.log(`   Created:   ${client.createdAt.toISOString()}`)
    console.log(`   Age:       ${Math.floor((Date.now() - client.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days`)
    console.log(`   Codes:     ${client._count.authorizationCodes}`)
    console.log(`   Tokens:    ${client._count.refreshTokens}`)
    console.log('')
  })

  // Delete clients if not dry run
  if (!options.dryRun) {
    console.log('🗑️  Deleting clients...\n')

    let deleted = 0
    for (const client of clientsToDelete) {
      try {
        await prisma.oAuthClient.delete({
          where: { clientId: client.clientId }
        })
        console.log(`   ✓ Deleted: ${client.name}`)
        deleted++
      } catch (error) {
        console.error(`   ✗ Failed to delete ${client.name}:`, error instanceof Error ? error.message : String(error))
      }
    }

    console.log(`\n✅ Deleted ${deleted} of ${clientsToDelete.length} clients\n`)
  } else {
    console.log(`\nTo delete these clients, run:\n`)
    console.log(`  npm run oauth:cleanup -- --yes`)
    if (options.daysOld) {
      console.log(`  npm run oauth:cleanup -- --yes --days ${options.daysOld}`)
    }
    console.log('\n')
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
```

**Add to `package.json`:**

```json
{
  "scripts": {
    "oauth:cleanup": "tsx scripts/cleanup-unused-oauth-clients.ts"
  }
}
```

**Usage Examples:**

```bash
# Preview what would be deleted
npm run oauth:cleanup

# Delete all unused clients
npm run oauth:cleanup -- --yes

# Delete unused clients older than 7 days
npm run oauth:cleanup -- --yes --days 7
```

---

### Phase 1 Testing Checklist

- [ ] Rate limiting works (6th request in 1 hour gets 429 error)
- [ ] Claude Custom Connector still works (can register and authorize)
- [ ] Cleanup script dry-run shows correct clients
- [ ] Cleanup script with --yes actually deletes clients
- [ ] Cleanup script with --days filters correctly
- [ ] Error responses match RFC 7591 format

---

## Phase 2: Auto-Cleanup Cron + Enhanced Admin UI

### Goals
1. Automatically clean up stale clients (no manual intervention)
2. Add UI filters to show/hide inactive clients
3. Add "bulk delete" UI action
4. Improve admin visibility into client usage

### 2.1 Auto-Cleanup Cron Job

**Install Dependencies:**

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

**File:** `src/lib/cron/cleanup-oauth-clients.ts`

**Implementation:**

```typescript
import cron from 'node-cron'
import { prisma } from '../prisma'
import type { FastifyInstance } from 'fastify'

/**
 * Cleanup unused OAuth clients automatically
 * Runs daily at 2 AM server time
 */
export function scheduleOAuthClientCleanup(app: FastifyInstance) {
  const DAYS_BEFORE_CLEANUP = 7 // Delete clients with no activity after 7 days

  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      app.log.info('Running OAuth client cleanup cron job')

      const cutoffDate = new Date(Date.now() - DAYS_BEFORE_CLEANUP * 24 * 60 * 60 * 1000)

      // Find unused clients older than cutoff
      const unusedClients = await prisma.oAuthClient.findMany({
        where: {
          createdAt: { lte: cutoffDate }
        },
        include: {
          _count: {
            select: {
              authorizationCodes: true,
              refreshTokens: true
            }
          }
        }
      })

      // Filter to clients with 0 codes AND 0 tokens
      const clientsToDelete = unusedClients.filter(
        client => client._count.authorizationCodes === 0 && client._count.refreshTokens === 0
      )

      if (clientsToDelete.length === 0) {
        app.log.info('OAuth client cleanup: No unused clients found')
        return
      }

      app.log.info({
        msg: 'OAuth client cleanup: Found unused clients',
        count: clientsToDelete.length,
        clients: clientsToDelete.map(c => ({
          clientId: c.clientId,
          name: c.name,
          createdAt: c.createdAt
        }))
      })

      // Delete clients
      let deleted = 0
      for (const client of clientsToDelete) {
        try {
          await prisma.oAuthClient.delete({
            where: { clientId: client.clientId }
          })
          deleted++

          app.log.info({
            msg: 'OAuth client deleted by cleanup job',
            clientId: client.clientId,
            name: client.name,
            ageInDays: Math.floor((Date.now() - client.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          })
        } catch (error) {
          app.log.error({
            msg: 'Failed to delete OAuth client',
            clientId: client.clientId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      app.log.info({
        msg: 'OAuth client cleanup completed',
        deleted,
        total: clientsToDelete.length
      })

    } catch (error) {
      app.log.error({
        msg: 'Error running OAuth client cleanup cron',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  })

  app.log.info('OAuth client cleanup cron job scheduled (daily at 2 AM)')
}
```

**Register in App:**

**File:** `src/app.ts`

Add near the end of `buildApp()` function:

```typescript
export async function buildApp(opts = {}): Promise<FastifyInstance> {
  // ... existing code ...

  // Register cron jobs (only if not in test environment)
  if (app.config.NODE_ENV !== 'test') {
    const { scheduleOAuthClientCleanup } = await import('./lib/cron/cleanup-oauth-clients')
    scheduleOAuthClientCleanup(app)
  }

  return app
}
```

**Configuration (optional):**

Add to `.env.example` and `src/config/env.ts`:

```bash
# OAuth Client Cleanup
OAUTH_CLIENT_CLEANUP_DAYS=7  # Delete unused clients after N days (default: 7)
```

---

### 2.2 Enhanced Admin UI Filters

**File:** `client/src/pages/AdminClients.tsx`

**Features to Add:**

1. **Filter toggle buttons:**
   - "All Clients"
   - "Active Clients" (has codes or tokens)
   - "Unused Clients" (0 codes and 0 tokens)

2. **Bulk delete button:**
   - "Delete All Unused" (confirmation required)

3. **Search/filter by name**

4. **Sort options:**
   - By creation date (newest/oldest)
   - By usage (most/least used)

**Implementation Highlights:**

```typescript
// Add state for filters
const [filter, setFilter] = useState<'all' | 'active' | 'unused'>('all')
const [searchQuery, setSearchQuery] = useState('')

// Filter clients based on selected filter
const filteredClients = clients.filter(client => {
  // Search filter
  if (searchQuery && !client.name.toLowerCase().includes(searchQuery.toLowerCase())) {
    return false
  }

  // Activity filter
  if (filter === 'active') {
    return client._count.authorizationCodes > 0 || client._count.refreshTokens > 0
  }

  if (filter === 'unused') {
    return client._count.authorizationCodes === 0 && client._count.refreshTokens === 0
  }

  return true // 'all'
})

// Bulk delete unused clients
const handleBulkDeleteUnused = async () => {
  const unusedClients = clients.filter(
    c => c._count.authorizationCodes === 0 && c._count.refreshTokens === 0
  )

  if (unusedClients.length === 0) {
    alert('No unused clients to delete')
    return
  }

  if (!confirm(`Delete ${unusedClients.length} unused client(s)? This cannot be undone.`)) {
    return
  }

  // Delete each client
  for (const client of unusedClients) {
    await fetch(`/api/admin/clients/${client.clientId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
  }

  loadClients()
}
```

**UI Layout:**

```tsx
{/* Filter Bar */}
<div className="mb-4 flex gap-4 items-center">
  {/* Filter Buttons */}
  <div className="flex gap-2">
    <button
      onClick={() => setFilter('all')}
      className={filter === 'all' ? 'btn-primary' : 'btn-secondary'}
    >
      All ({clients.length})
    </button>
    <button
      onClick={() => setFilter('active')}
      className={filter === 'active' ? 'btn-primary' : 'btn-secondary'}
    >
      Active ({clients.filter(c => c._count.authorizationCodes > 0 || c._count.refreshTokens > 0).length})
    </button>
    <button
      onClick={() => setFilter('unused')}
      className={filter === 'unused' ? 'btn-primary' : 'btn-secondary'}
    >
      Unused ({clients.filter(c => c._count.authorizationCodes === 0 && c._count.refreshTokens === 0).length})
    </button>
  </div>

  {/* Search */}
  <input
    type="text"
    placeholder="Search clients..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="input-field flex-1"
  />

  {/* Bulk Actions */}
  <button
    onClick={handleBulkDeleteUnused}
    className="btn-danger"
  >
    Delete All Unused
  </button>
</div>
```

---

### 2.3 New Backend Endpoint for Bulk Delete

**File:** `src/routes/api/admin/clients.ts`

Add new endpoint:

```typescript
// POST /api/admin/clients/bulk-delete-unused - Delete all unused clients
app.post(
  '/clients/bulk-delete-unused',
  {
    preHandler: protectAdminRoute()
  },
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Find unused clients
      const unusedClients = await prisma.oAuthClient.findMany({
        where: {},
        include: {
          _count: {
            select: {
              authorizationCodes: true,
              refreshTokens: true
            }
          }
        }
      })

      const clientsToDelete = unusedClients.filter(
        client => client._count.authorizationCodes === 0 && client._count.refreshTokens === 0
      )

      // Delete them
      const deletedIds = []
      for (const client of clientsToDelete) {
        await prisma.oAuthClient.delete({
          where: { clientId: client.clientId }
        })
        deletedIds.push(client.clientId)

        request.log.info({
          msg: 'Unused OAuth client deleted',
          clientId: client.clientId,
          name: client.name
        })
      }

      return reply.status(200).send({
        success: true,
        deleted: deletedIds.length,
        message: `Deleted ${deletedIds.length} unused client(s)`
      })
    } catch (error) {
      request.log.error(error, 'Error bulk deleting unused clients')
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete unused clients'
      })
    }
  }
)
```

---

### Phase 2 Testing Checklist

- [ ] Cron job runs daily at 2 AM (test with shorter interval for dev)
- [ ] Cron job correctly identifies unused clients
- [ ] Cron job deletes clients older than configured days
- [ ] Cron job logs all actions
- [ ] UI filter buttons work correctly
- [ ] UI search works
- [ ] UI bulk delete works
- [ ] Backend bulk-delete endpoint works
- [ ] Cron job doesn't run in test environment

---

## Configuration Summary

### Environment Variables

Add to `.env.example` and `src/config/env.ts`:

```bash
# OAuth Client Rate Limiting
OAUTH_REGISTER_RATE_LIMIT_MAX=5           # Max registrations per hour per IP (default: 5)
OAUTH_REGISTER_RATE_LIMIT_WINDOW=3600000  # Time window in ms (default: 1 hour)

# OAuth Client Auto-Cleanup
OAUTH_CLIENT_CLEANUP_ENABLED=true         # Enable/disable auto-cleanup (default: true)
OAUTH_CLIENT_CLEANUP_DAYS=7               # Delete unused clients after N days (default: 7)
OAUTH_CLIENT_CLEANUP_SCHEDULE="0 2 * * *" # Cron schedule (default: 2 AM daily)
```

### Package.json Scripts

```json
{
  "scripts": {
    "oauth:cleanup": "tsx scripts/cleanup-unused-oauth-clients.ts"
  }
}
```

### Dependencies to Install

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

---

## Security Considerations

### Rate Limiting
- ✅ Per-IP rate limiting prevents single attacker
- ⚠️ Distributed attacks (botnet) could still register up to 5 clients per IP
- 💡 **Future enhancement**: Add CAPTCHA for public registration endpoint

### Data Retention
- ✅ 7-day retention prevents accidental deletion of recently-registered clients
- ✅ Clients with any codes/tokens are never auto-deleted
- ⚠️ Clients that completed OAuth flow but revoked tokens will be kept forever
- 💡 **Future enhancement**: Add "lastUsedAt" timestamp to track actual usage

### Admin Access
- ✅ Bulk delete requires admin authentication
- ✅ All deletions are logged
- ⚠️ No audit trail for who deleted what
- 💡 **Future enhancement**: Add audit log table

---

## Rollout Plan

### Step 1: Phase 1 Implementation (1-2 hours)
1. Add rate limiting to `/oauth/register` route
2. Create cleanup script
3. Test with Claude Custom Connector
4. Run cleanup script to remove existing unused clients

### Step 2: Phase 1 Deployment
1. Deploy to production
2. Monitor rate limit errors (ensure no false positives)
3. Run cleanup script weekly via manual cron job

### Step 3: Phase 2 Implementation (2-3 hours)
1. Install node-cron dependency
2. Implement auto-cleanup cron job
3. Add UI filters and bulk delete
4. Add backend bulk-delete endpoint
5. Test all features

### Step 4: Phase 2 Deployment
1. Deploy to production
2. Monitor cron job logs
3. Verify UI filters work
4. Validate auto-cleanup after 7 days

---

## Success Metrics

### Phase 1
- ✅ Rate limit reduces new client registrations by >90%
- ✅ Manual cleanup removes 10+ unused clients
- ✅ Claude Custom Connector continues to work

### Phase 2
- ✅ Auto-cleanup runs successfully daily
- ✅ Unused clients are deleted after 7 days
- ✅ UI filters reduce visual clutter
- ✅ Admin can quickly identify and remove unused clients

---

## Maintenance

### Weekly Tasks
- Review cron job logs
- Check for rate limit false positives

### Monthly Tasks
- Review auto-cleanup effectiveness
- Adjust retention period if needed

### Quarterly Tasks
- Review rate limit thresholds
- Consider CAPTCHA implementation

---

## Alternative Approaches Considered

### ❌ Initial Access Tokens (RFC 7591)
- **Why not**: Claude Custom Connector doesn't support providing tokens for registration
- **Would solve**: Completely prevents unauthorized registration
- **Breaks**: Claude auto-discovery flow

### ❌ Disable Public Registration
- **Why not**: Breaks Claude Custom Connector
- **Would solve**: Eliminates all abuse
- **Breaks**: Core product feature

### ❌ Client Deduplication (reuse existing clients)
- **Why not**: Complex to implement, may break OAuth flows
- **Would solve**: Reduces duplicate registrations
- **Risk**: Redirect URI mismatches

### ✅ Chosen Approach: Rate Limiting + Auto-Cleanup
- **Why yes**: Balances security with functionality
- **Solves**: Abuse prevention + database hygiene
- **Maintains**: Claude Custom Connector compatibility

---

## Files to Create/Modify

### Phase 1
- [ ] Modify: `src/routes/oauth/index.ts` (rate limiting)
- [ ] Create: `scripts/cleanup-unused-oauth-clients.ts` (cleanup script)
- [ ] Modify: `package.json` (add cleanup script)

### Phase 2
- [ ] Create: `src/lib/cron/cleanup-oauth-clients.ts` (cron job)
- [ ] Modify: `src/app.ts` (register cron job)
- [ ] Modify: `client/src/pages/AdminClients.tsx` (UI filters)
- [ ] Modify: `src/routes/api/admin/clients.ts` (bulk delete endpoint)
- [ ] Modify: `.env.example` (config options)
- [ ] Modify: `src/config/env.ts` (config validation)
- [ ] Modify: `package.json` (add node-cron dependency)

---

## Estimated Timeline

- **Phase 1**: 2-3 hours implementation + 1 hour testing = **3-4 hours total**
- **Phase 2**: 3-4 hours implementation + 2 hours testing = **5-6 hours total**
- **Total**: **8-10 hours** for both phases

---

## Questions for Review

1. **Rate limit threshold**: Is 5 registrations/hour per IP too strict? (Can adjust)
2. **Retention period**: Is 7 days appropriate, or should it be longer? (Can configure)
3. **Cron schedule**: Is 2 AM daily good, or prefer different time/frequency?
4. **Bulk delete**: Should it require admin to type "DELETE" for confirmation?

---

## Next Steps

Ready to implement? Run:

```bash
# Phase 1 Only
npm run implement -- phase1

# Both Phases
npm run implement -- all
```

Or I can start implementing Phase 1 now if you approve this plan!
