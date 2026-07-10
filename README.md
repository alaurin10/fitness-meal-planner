# Fitness Tracker + Meal Planner

A single personal web app combining workout planning, meal planning, nutrition targets, hydration/progress tracking, and a categorized grocery list. One React client, one Express API, one Postgres database.

| Service | Domain | Purpose |
|---|---|---|
| `app-client` | `app.andrewlaurin.com` | React + Vite + Tailwind client |
| `app-server` | `api.app.andrewlaurin.com` | Express API (Clerk auth, Prisma, Gemini) |

The Prisma schema lives in `packages/db`; shared week/date utilities in `packages/shared`. All Gemini calls happen server-side — the API key is never shipped to the browser.

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

# 2. Copy the env template and fill in Clerk + Gemini keys.
#    There is ONE env file at the repo root: the server reads it via
#    `tsx --env-file=../../.env`, and Vite reads it via `envDir: "../../"`.
cp .env.example .env

# 3. Start Postgres (creates the database on first boot)
docker compose up -d postgres

# 4. Generate the Prisma client and apply migrations
pnpm db:generate
pnpm db:migrate:dev

# 5. Run client + server in parallel
pnpm dev
```

Dev URLs:
- Client: http://localhost:5173
- API:    http://localhost:3001

### Useful scripts
```bash
pnpm build              # builds every package
pnpm typecheck          # typecheck every package
pnpm test               # run all tests (vitest in apps/server)
pnpm db:generate        # regenerate the Prisma client
pnpm db:migrate:dev     # apply pending migrations (interactive)

# Target one package:
pnpm --filter @app/server dev
pnpm --filter @app/client build
```

---

## Architecture

```
┌────────────────────────────┐
│  app.andrewlaurin.com      │
│  (React client, Vite)      │
└────────────┬───────────────┘
             │ HTTPS (Clerk bearer token)
             ▼
┌────────────────────────────┐
│  api.app.andrewlaurin.com  │
│  (Express + Clerk + Gemini)│
└────────────┬───────────────┘
             │
             ▼
   fitness_meal_planner_db
         (Postgres)
```

---

## Database

One Prisma schema: `packages/db/prisma/schema.prisma`, generated into `packages/db/generated/` (gitignored — run `pnpm db:generate` after install).

```typescript
import { prisma } from "@platform/db";
```

### Running migrations
```bash
pnpm db:migrate:dev      # interactive, prompts for a migration name
pnpm db:migrate:deploy   # applies committed migrations (used in deploys)
```

In production, Railway runs `pnpm --filter @platform/db migrate:deploy` as part of the server's build command.

---

## Deployment — Railway

Service configuration is documented in `railway.toml` (Railway doesn't consume it directly for multi-service monorepos; configure each service in the dashboard).

1. Railway project with a **Postgres** service (database `fitness_meal_planner_db`, created via `scripts/init-db.sql`).
2. Two GitHub services pointing at this repo:
   - `app-server` → root directory `apps/server`
   - `app-client` → root directory `apps/client`
3. Copy build + start commands from `railway.toml`.
4. Set environment variables per service (see `.env.example` and `railway.toml`).
5. Custom domains: `app.andrewlaurin.com` → client, `api.app.andrewlaurin.com` → server (Cloudflare CNAMEs to the Railway targets, proxied).
6. In the Clerk dashboard, add both domains to **Allowed origins**.

---

## AI generation environment variables (server)

All optional except `GEMINI_API_KEY`; sensible defaults are baked in.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | **Required.** Google Gemini API key. |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Primary generation model. |
| `GEMINI_FALLBACK_MODELS` | built-in list | Comma-separated fallback models, tried in order. |
| `GEMINI_TIMEOUT_MS` | `90000` | Per-call wall-clock timeout. |
| `GEMINI_RETRIES` | `2` | Attempts per model (incl. first) before falling back. |
| `GEMINI_MACRO_CHECK` | `true` | Set `false` to disable post-generation macro verification. |
| `GEMINI_MACRO_CALORIE_TOLERANCE_PCT` | `12` | Allowed ± calorie deviation per day before a corrective pass. |
| `GEMINI_MACRO_PROTEIN_TOLERANCE_PCT` | `15` | Allowed protein shortfall per day before a corrective pass. |
| `GEMINI_MACRO_MAX_DAYS` | `3` | Max days fixed in a single corrective pass (bounds cost). |
| `GENERATION_RATE_MAX` | `15` | Max generation requests per user per window. |
| `GENERATION_RATE_WINDOW_MS` | `300000` | Rate-limit window length (5 min). |

---

## Garmin integration (optional)

Link a Garmin account from **Profile → Settings → Connections** to sync watch data into the app and push workouts back to the watch:

- **Daily wellness** — steps, total/active calories burned, resting heart rate, and sleep land in `DailyWellness` and appear on the Dashboard ("From your watch") and Progress week stats.
- **Activity import** — recorded activities (runs, rides, gym sessions) flow into the Activity Log with a Garmin badge, deduped by Garmin activity id.
- **Weight sync** — Garmin weigh-ins import into Progress (and recompute suggested calorie/protein targets); weights logged in the app push back to Garmin.
- **Send week to watch** — the Workouts page can convert the AI-generated week into Garmin structured strength workouts scheduled on the Garmin calendar.

How it works, and the caveats to know:

- Garmin's official Connect Developer Program is currently **closed to new applicants**, so this uses the **unofficial Garmin Connect API** via the [`garmin-connect`](https://github.com/Pythe1337N/garmin-connect) library. Endpoints may change without notice; all Garmin HTTP is isolated in `apps/server/src/services/garmin/client.ts`.
- You sign in once with your Garmin username/password; the server stores only the resulting OAuth tokens, encrypted with AES-256-GCM (`GARMIN_TOKEN_ENC_KEY`, generate with `openssl rand -base64 32`). The password is never persisted or logged. Garmin accounts with MFA enabled are not supported.
- Sync is pull-based: automatic on app load when data is >6 h stale, or via **Sync now**, with a 15-minute server-side cooldown and a 30-day backfill cap.
- The integration is fully optional — without a linked account (or without `GARMIN_TOKEN_ENC_KEY`) the app behaves exactly as before; the only visible addition is the Connections card in Settings.

---

## iOS Shortcut (optional)

The app has a fully functional in-app grocery list, so this is only needed if you want groceries to also land in iOS Reminders.

1. In Shortcuts, create a new shortcut called **"Pull Groceries"**.
2. Stored variables:
   - `API_BASE` = `https://api.app.andrewlaurin.com`
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
│   ├── client/               # React + Vite + Tailwind
│   └── server/               # Express + Clerk + Prisma + Gemini
├── packages/
│   ├── db/                   # Prisma schema + generated client
│   └── shared/               # Week/date utilities shared by client & server
├── scripts/
│   └── init-db.sql
├── docker-compose.yml
├── railway.toml              # Railway service docs (single source of truth)
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json
```
