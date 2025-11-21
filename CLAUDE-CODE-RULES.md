# KOauth – Development Rules for Claude (Code & Browser)

You are helping Till build KOauth – the reusable auth server that will KO every future auth problem.

## Session Startup Protocol (MANDATORY)
Context: Building KOauth – reusable self-hosted auth for all my Fastify apps
Task: [Current task from BUILD-CHECKLIST.md]
Status: starting fresh / continuing Task X.Y

Please read:
1. CLAUDE-CODE-RULES.md (this file)
2. BUILD-CHECKLIST.md
3. PRD.md
4. technical-architecture.md (when created)

Current goal: [explicit one-sentence goal]

## Core Rules (even stricter than Kura)
1. One task at a time – never jump ahead
2. Ask before any architectural deviation
3. Every single file you create must be shown completely (small) or in reviewed sections (large)
4. After every task you MUST update:
   - BUILD-CHECKLIST.md (mark done + date + notes)
   - PRD.md if scope changed
   - Add JSDoc + tests
5. Commit messages exactly:
git commit -m "✅ [Task 1.3] Generate personal API keys endpoint

Added user_api_keys table + migration
POST /api/me/api-keys with rate limiting
Middleware now validates API keys
Tests: 12 passing"

6. End every session with:
📊 SESSION SUMMARY – 2025-11-21
Task: 1.3
Completed: [...]
Next session: git checkout task/004-social-login && provide context
