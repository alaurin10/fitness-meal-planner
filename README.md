# Fitness Tracker + Meal Planner

Two personal web apps in a single pnpm workspace, sharing a user identity via Clerk and talking to each other over Railway's private network.

| App | Subdomain | Purpose |
|---|---|---|
| Fitness Tracker | `fit.andrewlaurin.com` | Workout planning, progress tracking, progressive overload |
| Meal Planner | `meals.andrewlaurin.com` | Meal planning, nutrition targets, categorized grocery list |

Each app has a static client (`apps/<app>/client`) and an Express API (`apps/<app>/server`). Prisma schemas for both apps live in `packages/db`.

---

## Local development

### Prerequisites
- Node 20+
- pnpm 10+ (`brew install pnpm`)
- Docker Desktop (for local Postgres)

### Setup
```bash
# 1. Install deps
pnpm install

# 2. Copy env template and fill in Clerk + Anthropic keys
cp .env.example .env
cp apps/fit/client/.env.example apps/fit/client/.env
cp apps/meals/client/.env.example apps/meals/client/.env

# 3. Start Postgres (creates both databases on first boot)
docker compose up -d postgres

# 4. Generate Prisma clients and apply migrations for both schemas
pnpm db:generate
pnpm db:migrate:dev

# 5. Run all four services in parallel
pnpm dev
```

Dev URLs:
- Fit client: http://localhost:5173
- Fit API:    http://localhost:3001
- Meals client: http://localhost:5174
- Meals API:  http://localhost:3002

### Useful scripts
```bash
pnpm build              # builds every package
pnpm typecheck          # typecheck every package
pnpm db:migrate:dev     # applies pending migrations to both databases
pnpm db:generate        # regenerates both Prisma clients

# Target one service:
pnpm --filter fit-server dev
pnpm --filter meals-client build
```

---

## Architecture

```
┌──────────────────────┐        ┌────────────────────────┐
│  fit.andrewlaurin    │        │  meals.andrewlaurin    │
│  (React client)      │        │  (React client)        │
└──────────┬───────────┘        └──────────┬─────────────┘
           │ HTTPS                         │ HTTPS
           ▼                               ▼
┌──────────────────────┐        ┌────────────────────────┐
│  api.fit.andrewlaur. │        │  api.meals.andrewlaur. │
│  (Express server)    │◀───────│  (Express server)      │
│                      │ internal│                        │
└──────────┬───────────┘        └──────────┬─────────────┘
           │                               │
           ▼                               ▼
    fitness_tracker_db             meal_planner_db
        (Postgres)                      (Postgres)
```

- Cross-app data is fetched over Railway's private network via `/internal/*` endpoints, guarded by `INTERNAL_API_SECRET`.
- Both clients use the **same Clerk application** so a sign-in on one subdomain is recognized on the other.
- All Anthropic calls happen server-side. The API key is never shipped to the browser.

---

## Database

Two Prisma schemas in `packages/db/prisma/`:
- `fit.prisma` → generates into `packages/db/generated/fit`, exported as `fitPrisma`.
- `meals.prisma` → generates into `packages/db/generated/meals`, exported as `mealsPrisma`.

Each server imports only the client it needs:
```typescript
import { fitPrisma } from "@platform/db";
```

### Running migrations
```bash
pnpm db:migrate:dev                     # both schemas, interactive (prompts for names)
pnpm --filter @platform/db migrate:dev:fit
pnpm --filter @platform/db migrate:dev:meals
```

In production, Railway runs `pnpm --filter @platform/db migrate:deploy:<app>` as part of each server's build command.

---

## Deployment — Railway checklist

1. Create a Railway project called `fitness-meal-planner`.
2. Add a **Postgres** service. Connect to it via `psql` and run `scripts/init-db.sql` to create both databases.
3. Add four GitHub services, each pointing to this repo with the **Root Directory** set accordingly:
   - `fitness-tracker-server` → `apps/fit/server`
   - `fitness-tracker-client` → `apps/fit/client`
   - `meal-planner-server` → `apps/meals/server`
   - `meal-planner-client` → `apps/meals/client`
4. Copy build + start commands from `railway.toml`.
5. Set environment variables per service (see `.env.example` and `railway.toml`).
6. In Railway project settings → Shared Variables, add `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `INTERNAL_API_SECRET`.
7. Add custom domains:
   - `fit.andrewlaurin.com` → fit client
   - `api.fit.andrewlaurin.com` → fit server
   - `meals.andrewlaurin.com` → meals client
   - `api.meals.andrewlaurin.com` → meals server
8. In Cloudflare DNS, add CNAME records pointing each subdomain to the Railway-provided target (proxied / orange cloud).
9. In Clerk dashboard, add all four custom domains to **Allowed origins**.

---

## iOS Shortcut (optional)

The Meals app has a fully functional in-app grocery list, so this is only needed if you want groceries to also land in iOS Reminders.

1. In Shortcuts, create a new shortcut called **"Pull Groceries"**.
2. Stored variables:
   - `API_BASE` = `https://api.meals.andrewlaurin.com`
   - `CLERK_SESSION_TOKEN` (refresh periodically from a signed-in browser session)
3. Actions:
   - **Get Contents of URL** → `{API_BASE}/api/groceries/pending`
     Headers: `Authorization: Bearer {CLERK_SESSION_TOKEN}`
   - **Get Dictionary from Input** → parse JSON
   - **Get Dictionary Value** → `items`
   - **Repeat with Each** item:
     - **Add New Reminder** → name = dictionary value `name`; list = "Groceries"
   - **Get Contents of URL** → `POST {API_BASE}/api/groceries/confirm-push`
     Method: POST, Headers as above

---

## Directory map

```
fitness-meal-planner/
├── apps/
│   ├── fit/
│   │   ├── client/           # React + Vite + Tailwind
│   │   └── server/           # Express + Clerk + Anthropic
│   └── meals/
│       ├── client/
│       └── server/
├── packages/
│   └── db/                   # Prisma schemas + generated clients
├── scripts/
│   └── init-db.sql
├── docker-compose.yml
├── railway.toml
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json
```
