# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Gilberto Pro Painting Manager** — multi-tenant SaaS for painting company management.
Company: Gilberto Pro Painting | 857-505-6448 | gilbertopropainting.com

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces (`shared/`, `server/`, `client/`) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v3 + TanStack Router (file-based) + TanStack Query |
| Forms | React Hook Form + Zod + `@hookform/resolvers` |
| Backend | Node.js + TypeScript + Hono + `@hono/node-server` |
| ORM | Drizzle ORM + `drizzle-kit` (migrations only — never ALTER TABLE manually) |
| Database | PostgreSQL 16 |
| Auth | bcryptjs (12 rounds) + `jose` (JWT) — access token 15min in-memory + refresh token 7d httpOnly cookie |
| Billing | Stripe (subscriptions, webhooks, Customer Portal) |
| PDF | `@react-pdf/renderer` (client-side) |
| Icons | `lucide-react` |

## Commands

```bash
# Development
docker-compose up -d          # start PostgreSQL
pnpm install                  # install all workspaces
pnpm dev                      # start server (3000) + client (5173)

# Database
pnpm db:generate              # generate migration from schema changes
pnpm db:migrate               # run pending migrations
pnpm db:studio                # open Drizzle Studio

# Individual packages
pnpm --filter server dev      # server only
pnpm --filter client dev      # client only

# Quality
pnpm typecheck                # typecheck all packages
pnpm test                     # run all tests
pnpm build                    # production build (shared → server → client)
```

## Architecture

### Multi-Tenancy
Every resource table has `organization_id`. The JWT payload includes `{ sub, orgId, role, plan }`. Every route handler reads `orgId` from `c.get('orgId')` — never from request body. This enforces tenant isolation automatically.

### Roles
`owner` > `admin` > `employee`. Owners manage billing. Admins manage team. Employees can CRUD resources but not delete clients/projects.

### Subscription Plans
`free_trial` (14d, 3 clients, 5 projects, 1 member) → `basic` ($29/mo) → `pro` ($59/mo, +audit logs, 5 members) → `team` ($99/mo, unlimited members).

### Token Flow
- Access token: 15min, stored in-memory on client (never localStorage)
- Refresh token: 7d, httpOnly cookie, rotated on every use
- Logout invalidates refresh token in DB

### File Uploads
Photos stored at `server/uploads/{orgId}/{projectId}/{uuid}.{ext}`. Only the relative path is in the DB. Served via authenticated `/files/` endpoint. Swap `server/src/lib/storage.ts` to migrate to S3/Supabase later.

### API Response Shape
```typescript
{ data: T }                                    // single resource
{ data: T[], meta: { page, limit, total } }    // paginated list
{ error: string }                              // all errors
```

### Shared Types
Zod schemas in `shared/src/schemas/` are the single source of truth. Both server validators and client form schemas import from `@painting/shared`.

### PDF Documents
Proposals, contracts, and invoices each have an `@react-pdf/renderer` template in `client/src/lib/pdf/`. Preview route: `/proposals/:id/preview`. Download via `<PDFDownloadLink>`.

## Key Conventions

- `organization_id` — never `tenant_id`, never `user_id` alone on resource tables
- Proposal and Contract are **separate modules** — never merge them
- Audit log every write: `createAuditLog(db, { orgId, userId, action, resourceType, resourceId, diff })`
- Plan limits checked before writes: `enforceLimit(plan, 'clients', currentCount)`
- No stack traces in production error responses
- `bcryptjs` not `bcrypt` (no native module compile issues)
- drizzle migrations folder: `server/drizzle/`
- Uploads folder: `server/uploads/` (gitignored)

## Environment

Copy `.env.example` → `.env` at project root. Server loads it via `dotenv` with `path: '../.env'`.

## Git Manager Protocol (Claude Code role)

Claude Code acts as Git manager for this repo. GLM-5.2 also contributes. **Never commit directly to `master`.**

### Branch Map
| Branch | Owner | Purpose |
|---|---|---|
| `master` | Protected | Stable production — Railway deploys from here |
| `glm-dev` | GLM-5.2 | All GLM changes land here |
| `claude-review` | Claude Code | Review, fixes, then merge to master |

### Workflow — every task starts with:
```bash
git fetch --all
git pull origin <current-branch>
```

### Merging GLM changes (run in order):
```bash
git checkout claude-review
git merge glm-dev                  # review conflicts here
pnpm typecheck                     # must pass
pnpm build                         # must pass
# if all green:
git checkout master
git merge claude-review
git push origin master
# deploy to Railway only after push succeeds
```

### Rules
- If `pnpm typecheck` or `pnpm build` fails → fix on `claude-review`, never force-merge
- If a conflict cannot be resolved safely → stop and explain; do NOT guess
- Never overwrite working code without a backup commit first
- Railway deploy only after `master` is stable and pushed
