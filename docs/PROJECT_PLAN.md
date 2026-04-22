# Lyfestack — Guided Goal Execution App

## Project Plan v1.0

**Last Updated:** 2026-04-21
**Organization:** innovsoftconsult (GitHub)
**Repository:** Monorepo — `lyfestack`

---

## Table of Contents

1. [Vision & Summary](#vision--summary)
2. [Architecture Decisions](#architecture-decisions)
3. [Dependency Graph & Critical Path](#dependency-graph--critical-path)
4. [Phase 1: Foundation (Week 1–2)](#phase-1-foundation-week-12)
5. [Phase 2: Core Engine (Week 3–4)](#phase-2-core-engine-week-34)
6. [Phase 3: Agent System (Week 5–6)](#phase-3-agent-system-week-56)
7. [Phase 4: Mobile App (Week 5–8)](#phase-4-mobile-app-week-58)
8. [Phase 5: Integrations (Week 7–8)](#phase-5-integrations-week-78)
9. [Phase 6: Polish & Launch (Week 8–9)](#phase-6-polish--launch-week-89)
10. [Appendix: Effort Summary](#appendix-effort-summary)

---

## Vision & Summary

Lyfestack is a guided goal execution app that combines structured goal templates with an AI agent to help users plan, execute, and stay accountable to their goals. The app generates daily briefs, manages tasks with tiered approval, and integrates with calendars, health trackers, and social media.

**Core Loop:** User selects a goal template → AI generates a personalized plan → Server-side daily loop produces a brief → User approves/executes tasks → System scores progress → Repeat.

**Design Language:** Stripe/Vercel aesthetic — black (#000000), white (#FFFFFF), sky blue (#0EA5E9). Font: Outfit. Clean, spacious, professional.

---

## Architecture Decisions

### AD-1: Monorepo Folder Structure

```
lyfestack/
├── apps/
│   ├── mobile/                    # React Native (Expo) app
│   │   ├── app/                   # Expo Router file-based routing
│   │   │   ├── (auth)/            # Auth-guarded screens
│   │   │   │   ├── (tabs)/        # Bottom tab navigator
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── goals/
│   │   │   │   │   ├── approvals/
│   │   │   │   │   └── profile/
│   │   │   │   └── _layout.tsx
│   │   │   ├── onboarding/
│   │   │   ├── _layout.tsx        # Root layout
│   │   │   └── index.tsx          # Entry redirect
│   │   ├── components/            # Shared UI components
│   │   │   ├── ui/                # Primitives (Button, Card, Input)
│   │   │   ├── goals/             # Goal-specific components
│   │   │   ├── brief/             # Daily brief components
│   │   │   └── approvals/         # Approval components
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── services/              # API client, storage
│   │   ├── stores/                # Zustand stores
│   │   ├── theme/                 # Colors, typography, spacing
│   │   ├── utils/                 # Helpers, formatters
│   │   └── assets/                # Images, fonts
│   └── server/                    # Node.js/TypeScript backend
│       ├── src/
│       │   ├── controllers/       # Route handlers (thin)
│       │   ├── services/          # Business logic
│       │   ├── repositories/      # Data access layer
│       │   ├── models/            # TypeScript interfaces/types
│       │   ├── middleware/         # Auth, error handling, logging
│       │   ├── jobs/              # Cron jobs (daily loop)
│       │   ├── integrations/      # Third-party service adapters
│       │   │   ├── openrouter/
│       │   │   ├── google-calendar/
│       │   │   ├── buffer/
│       │   │   └── health/
│       │   ├── templates/         # Goal template definitions
│       │   ├── config/            # Environment, constants
│       │   ├── utils/             # Shared helpers
│       │   └── index.ts           # Entry point
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── fixtures/
│       └── scripts/               # DB migrations, seeds
├── packages/
│   └── shared/                    # Shared types, enums, constants
│       ├── src/
│       │   ├── types/             # TypeScript interfaces
│       │   ├── enums/             # Status codes, categories
│       │   ├── constants/         # App-wide constants
│       │   └── validators/        # Zod schemas (shared validation)
│       └── package.json
├── supabase/
│   ├── migrations/                # SQL migration files
│   ├── seed.sql                   # Development seed data
│   └── config.toml                # Supabase local dev config
├── .github/
│   └── workflows/                 # CI/CD pipelines
├── turbo.json                     # Turborepo config
├── package.json                   # Root workspace config
├── tsconfig.base.json             # Shared TypeScript config
└── .env.example
```

**Rationale:** Turborepo monorepo gives us shared types between mobile and server, unified CI, and a single source of truth. The `packages/shared` workspace is imported by both `apps/mobile` and `apps/server`.

### AD-2: Backend Layered Architecture

```
HTTP Request
    │
    ▼
┌──────────────┐
│  Controller   │  ← Validates input (Zod), calls service, formats response
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Service     │  ← Business logic, orchestration, no DB knowledge
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Repository   │  ← Data access only; Supabase client queries
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Supabase    │  ← PostgreSQL + Storage + Auth
└──────────────┘
```

**Rules:**
- Controllers never import repositories directly.
- Services receive repository instances via constructor injection (Dependency Inversion).
- Repositories return typed domain objects, never raw DB rows.
- Cross-cutting concerns (auth, logging, errors) live in middleware.

### AD-3: Mobile Architecture

```
Screen (Expo Router page)
    │
    ├── reads from ──► Zustand Store (state + derived selectors)
    │                       │
    │                       ├── calls ──► API Service (fetch wrapper)
    │                       │                  │
    │                       │                  └── ──► Server API
    │                       │
    │                       └── calls ──► Local Storage Service
    │
    └── uses ──► Custom Hooks (useGoals, useBrief, useApprovals)
                     │
                     └── composes Store + Side Effects
```

**Rules:**
- Screens are thin — they render components and connect hooks.
- Hooks encapsulate store access + side effects (API calls, navigation).
- Components under `components/ui/` are pure and reusable (no store access).
- Domain components (e.g., `GoalCard`) may read from stores via hooks.

### AD-4: Shared Types Strategy

The `packages/shared` package contains:
- **TypeScript interfaces** for all API request/response shapes.
- **Zod schemas** that validate at both server (controller input) and client (form submission).
- **Enums** for goal status, task status, approval tier, template category.
- **Constants** for scoring weights, trust levels, template IDs.

Both `apps/mobile` and `apps/server` import from `@lyfestack/shared`. This eliminates type drift between client and server.

### AD-5: Error Handling Pattern

**Server:** All errors extend a base `AppError` class with `statusCode`, `code`, and `message`. A global error-handling middleware catches these and returns consistent JSON. Unhandled errors are caught by a fallback handler that logs the stack trace and returns a generic 500.

```typescript
// Error hierarchy
AppError (base)
├── ValidationError    (400)
├── AuthenticationError (401)
├── AuthorizationError  (403)
├── NotFoundError       (404)
├── ConflictError       (409)
└── ExternalServiceError (502)  // OpenRouter, Buffer, etc.
```

**Mobile:** API service wraps all fetch calls in a `Result<T, AppError>` type. Screens handle errors via a global error boundary (fatal) and per-component error states (recoverable). Network errors trigger a retry banner.

### AD-6: Logging Strategy

**Server:** Structured JSON logging via `pino`. Every log entry includes: `timestamp`, `level`, `requestId` (from middleware), `userId` (from auth), `service` (which service class), `action`, and `metadata`. Log levels: `error` (alerts), `warn` (degraded), `info` (business events), `debug` (development).

**Critical events logged at `info`:** user signup, goal created, daily brief generated, task approved, task completed, integration connected.

**Mobile:** Minimal logging to console in dev. Crash reporting via Sentry in production.

### AD-7: Environment Configuration

Three environments: `development`, `staging`, `production`.

```
# .env structure (server)
NODE_ENV=development
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=         # e.g., anthropic/claude-sonnet-4
BUFFER_CLIENT_ID=
BUFFER_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SENTRY_DSN=
LOG_LEVEL=debug
```

Server reads env vars via a typed `config.ts` module that validates all required vars at startup and fails fast if any are missing. Mobile uses Expo's `app.config.ts` with `extra` fields for runtime config.

---

## Dependency Graph & Critical Path

```
PHASE 1 (Foundation)
  E1: Project Setup ──────────────────────────────────────┐
  E2: Auth & User Mgmt ───────── depends on E1 ──────────┤
  E3: Core Data Models ───────── depends on E1 ──────────┘
                                                          │
PHASE 2 (Core Engine)                                     │
  E4: Goal Template System ──── depends on E3 ────────────┤
  E5: Planning Engine ────────── depends on E4 ───────────┤
  E6: Task & Daily Brief ─────── depends on E5 ──────────┘
                                                          │
PHASE 3 (Agent System)                                    │
  E7: Agent Framework ────────── depends on E5 ───────────┤
  E8: Trust & Approval ────────── depends on E6, E7 ──────┤
  E9: Daily Loop Engine ────────── depends on E8 ─────────┘
                                                          │
PHASE 4 (Mobile — parallel with Phase 3)                  │
  E10: App Shell ──────────────── depends on E1, E2 ──────┤
  E11: Onboarding ──────────────── depends on E10, E4 ────┤
  E12: Dashboard & Brief UI ───── depends on E10, E6 ─────┤
  E13: Goal Management ────────── depends on E10, E5 ─────┤
  E14: Approval & Task UI ─────── depends on E12, E8 ─────┘
                                                          │
PHASE 5 (Integrations)                                    │
  E15: Google Calendar ────────── depends on E6 ──────────┤
  E16: Buffer ──────────────────── depends on E8 ─────────┤
  E17: Apple Health / Google Fit ── depends on E6 ────────┤
  E18: Push Notifications ──────── depends on E9, E10 ────┘
                                                          │
PHASE 6 (Polish & Launch)                                 │
  E19: Testing & Bug Fixes ────── depends on all above ───┤
  E20: App Store Submission ───── depends on E19 ─────────┘
```

### Critical Path (longest dependency chain):

```
E1 → E3 → E4 → E5 → E7 → E8 → E9 → E18 → E19 → E20
```

This is the sequence that determines the earliest possible launch date. Any delay on this path delays the entire project. Phases 4 and 5 run in parallel and have slack as long as they complete before Phase 6.

---

## Phase 1: Foundation (Week 1–2)

### Epic 1: Project Setup & Architecture

#### T1.1 — Initialize Monorepo with Turborepo

**Description:** Create the root monorepo structure using Turborepo. Set up workspaces for `apps/mobile`, `apps/server`, and `packages/shared`. Configure TypeScript with a base `tsconfig` that all packages extend. Add `.gitignore`, `.nvmrc` (Node 20 LTS), and root `package.json` with workspace definitions. Initialize the Git repository and push to `innovsoftconsult/lyfestack` on GitHub.

**Dependencies:** None
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Running `npm install` at root installs all workspace dependencies.
- `apps/server` can import from `@lyfestack/shared` and TypeScript resolves types.
- `apps/mobile` can import from `@lyfestack/shared` and TypeScript resolves types.
- `turbo run build` succeeds across all workspaces.
- Repo is live on GitHub under `innovsoftconsult` org.

**Testing Requirements:**
- Verify workspace resolution: write a trivial shared type, import it in both apps, run `tsc --noEmit`.
- Verify Turbo pipeline: `turbo run build` and `turbo run lint` complete without errors.

**SOLID/Pattern Notes:**
- **Single Responsibility:** Each workspace has one concern (mobile app, server, shared types).
- **Dependency Inversion:** Shared package defines interfaces; apps depend on abstractions.

---

#### T1.2 — Configure Supabase Project & Local Dev

**Description:** Create a Supabase project (or configure local Supabase via CLI). Set up the `supabase/` directory with `config.toml`. Create the initial migration file that sets up extensions (`uuid-ossp`, `pgcrypto`). Add Supabase environment variables to `.env.example`. Write a `scripts/setup-db.sh` script that runs migrations locally.

**Dependencies:** T1.1
**Priority:** P0
**Effort:** 2 hours

**Acceptance Criteria:**
- `supabase start` launches local Supabase (DB, Auth, Storage).
- Migration runs without errors and extensions are enabled.
- `.env.example` documents all Supabase-related vars.
- `setup-db.sh` is idempotent (can run multiple times safely).

**Testing Requirements:**
- Run migrations on a clean local Supabase instance.
- Verify extensions exist: `SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto')`.

**SOLID/Pattern Notes:**
- **Infrastructure as Code:** All DB changes are versioned migrations, never manual.

---

#### T1.3 — Server Boilerplate & Layered Architecture

**Description:** Set up the Express.js server in `apps/server` with TypeScript. Create the folder structure: `controllers/`, `services/`, `repositories/`, `models/`, `middleware/`, `config/`, `utils/`. Implement the typed config loader that reads and validates environment variables at startup (fail-fast on missing vars). Add a health check endpoint (`GET /health`). Set up `pino` for structured JSON logging. Create the base `AppError` class hierarchy and the global error-handling middleware. Add CORS configuration.

**Dependencies:** T1.1
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- `npm run dev` in `apps/server` starts the server on the configured port.
- `GET /health` returns `{ "status": "ok", "timestamp": "..." }`.
- Missing required env vars cause the server to exit with a clear error message.
- All responses include `requestId` header.
- Throwing any `AppError` subclass returns the correct status code and JSON body.
- Logs are structured JSON with `timestamp`, `level`, `requestId`.

**Testing Requirements:**
- Unit test: config loader throws on missing required vars, passes on valid config.
- Unit test: each `AppError` subclass produces correct `statusCode` and `code`.
- Unit test: error middleware formats errors correctly, hides stack in production.
- Integration test: `GET /health` returns 200.

**SOLID/Pattern Notes:**
- **Single Responsibility:** Config module only handles configuration; error module only handles errors.
- **Open/Closed:** `AppError` base class is extended without modification for new error types.
- **Dependency Inversion:** Services will receive dependencies via constructor injection (set up the pattern here with a simple DI container or factory).
- **Pattern: Factory** — Error factory function to create typed errors from external service failures.
- **Pattern: Chain of Responsibility** — Express middleware pipeline for cross-cutting concerns.

---

#### T1.4 — Mobile Boilerplate & Expo Setup

**Description:** Initialize the Expo project in `apps/mobile` using Expo Router for file-based routing. Install and configure: `expo-router`, `expo-font` (load Outfit font family), `react-native-safe-area-context`, `react-native-screens`, `expo-status-bar`. Create the theme module with the Lyfestack palette (black, white, sky blue #0EA5E9) and Outfit typography scale. Set up the root `_layout.tsx` with theme provider. Create a placeholder home screen. Configure `app.config.ts` with environment variable support via `extra`.

**Dependencies:** T1.1
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- `npx expo start` launches the dev server; app opens in iOS Simulator and Android Emulator.
- Outfit font loads correctly and renders on the placeholder screen.
- Theme values (colors, spacing, typography) are accessible throughout the app.
- Expo Router navigates between at least two placeholder screens.
- `app.config.ts` reads API URL from environment.

**Testing Requirements:**
- Visual verification: Outfit font renders, sky blue (#0EA5E9) appears correctly.
- Verify Expo Router: navigate between two screens, confirm URL-based routing works.

**SOLID/Pattern Notes:**
- **Single Responsibility:** Theme module is isolated; no business logic in layout files.
- **Pattern: Provider** — React context for theme distribution.

---

#### T1.5 — CI Pipeline (GitHub Actions)

**Description:** Create GitHub Actions workflows: (1) `ci.yml` — runs on every PR: lint, type-check, and test for all workspaces. (2) `deploy-server.yml` — deploys server to Railway on merge to `main`. Configure caching for `node_modules` and Turbo cache. Add branch protection rules requiring CI to pass before merge.

**Dependencies:** T1.1, T1.3, T1.4
**Priority:** P1
**Effort:** 3 hours

**Acceptance Criteria:**
- Pushing a PR triggers `ci.yml`; it runs lint + typecheck + tests in under 5 minutes.
- Merging to `main` triggers `deploy-server.yml` and deploys to Railway.
- Failed checks block PR merge.
- Turbo remote caching reduces build times on cache hits.

**Testing Requirements:**
- Push a PR with a deliberate type error; confirm CI fails.
- Push a clean PR; confirm CI passes.
- Merge to `main`; confirm Railway deployment succeeds.

**SOLID/Pattern Notes:**
- **Infrastructure as Code:** CI/CD is versioned alongside application code.

---

#### T1.6 — Railway Deployment Configuration

**Description:** Configure Railway project for the server app. Set up the `Procfile` or `railway.toml` with build and start commands. Configure environment variables in Railway dashboard. Set up custom domain or use Railway-provided URL. Verify the health endpoint is accessible from the public internet.

**Dependencies:** T1.3
**Priority:** P1
**Effort:** 2 hours

**Acceptance Criteria:**
- Server is deployed and `GET <railway-url>/health` returns 200.
- Environment variables are configured (not hardcoded).
- Deployment logs are accessible in Railway dashboard.
- Auto-deploy on push to `main` is configured.

**Testing Requirements:**
- `curl` the health endpoint from a local machine.
- Verify logs appear in Railway.

**SOLID/Pattern Notes:**
- **Twelve-Factor App:** Environment-based configuration, stateless processes.

---

### Epic 2: Authentication & User Management

#### T2.1 — Supabase Auth Configuration

**Description:** Configure Supabase Auth providers: Google OAuth, Apple Sign-In, and email/password. Set up OAuth redirect URLs for both mobile deep links (`lyfestack://auth/callback`) and local development (`http://localhost:3000/auth/callback`). Configure session settings for persistent sessions (long-lived refresh tokens). Set password requirements and email templates for verification and password reset.

**Dependencies:** T1.2
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Google OAuth flow completes end-to-end in a test client (returns access token).
- Apple Sign-In is configured (full testing requires iOS device, but config is verified).
- Email/password signup sends verification email.
- Refresh token TTL is set to 30 days (configurable).
- Deep link `lyfestack://auth/callback` is registered.

**Testing Requirements:**
- Manual test: Google OAuth flow via Supabase Auth UI test page.
- Verify email template renders correctly by signing up a test user.
- Verify refresh token is returned and has expected expiry.

**SOLID/Pattern Notes:**
- **Single Responsibility:** Auth configuration is isolated to Supabase; server only validates tokens.

---

#### T2.2 — Server Auth Middleware

**Description:** Create an Express middleware that extracts the JWT from the `Authorization: Bearer <token>` header, verifies it against Supabase, and attaches the authenticated user to `req.user`. Create a `UserContext` type with `id`, `email`, `role`. Handle expired tokens by returning 401 with a clear error code (`TOKEN_EXPIRED`) so the mobile app knows to refresh. Create a `requireAuth` middleware wrapper and an `optionalAuth` variant for public endpoints.

**Dependencies:** T1.3, T2.1
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Requests with valid JWT pass through and `req.user` is populated.
- Requests with no token to protected routes return 401 `AUTHENTICATION_REQUIRED`.
- Requests with expired token return 401 `TOKEN_EXPIRED`.
- Requests with malformed token return 401 `INVALID_TOKEN`.
- `optionalAuth` allows unauthenticated access but still populates `req.user` if token is present.

**Testing Requirements:**
- Unit test: valid JWT → user context attached.
- Unit test: missing token → 401 `AUTHENTICATION_REQUIRED`.
- Unit test: expired token → 401 `TOKEN_EXPIRED`.
- Unit test: malformed token → 401 `INVALID_TOKEN`.
- Unit test: `optionalAuth` with no token → passes, `req.user` is null.

**SOLID/Pattern Notes:**
- **Single Responsibility:** Middleware only does auth; doesn't check permissions.
- **Open/Closed:** Can add new auth strategies (API keys) without changing existing middleware.
- **Pattern: Decorator** — `requireAuth` wraps route handlers without modifying them.

---

#### T2.3 — User Profile Table & Repository

**Description:** Create a `user_profiles` table migration with fields: `id` (UUID, FK to `auth.users`), `display_name`, `avatar_url`, `timezone` (string, e.g., `America/New_York`), `onboarding_completed` (boolean), `created_at`, `updated_at`. Create the `UserProfileRepository` with methods: `findById`, `create`, `update`, `updateTimezone`. Add a Supabase database trigger that auto-creates a profile row when a new auth user is created.

**Dependencies:** T1.2, T1.3
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Migration creates `user_profiles` table with all fields and correct types.
- DB trigger fires on new `auth.users` insert and creates a profile row.
- `UserProfileRepository.findById(userId)` returns typed `UserProfile` or null.
- `UserProfileRepository.update(userId, data)` updates only provided fields.
- `updateTimezone` validates the timezone string against the IANA database.

**Testing Requirements:**
- Integration test: create auth user → verify profile auto-created.
- Unit test: `findById` returns correct shape.
- Unit test: `update` with partial data only modifies those fields.
- Unit test: `updateTimezone` rejects invalid timezone strings.

**SOLID/Pattern Notes:**
- **Repository Pattern:** Data access is encapsulated; service layer never touches Supabase directly.
- **Single Responsibility:** Repository handles CRUD only; no business logic.

---

#### T2.4 — User Profile API Endpoints

**Description:** Create the `UserProfileController` with routes: `GET /api/users/me` (get current user profile), `PATCH /api/users/me` (update profile), `POST /api/users/me/timezone` (auto-detect and set timezone). Create `UserProfileService` that sits between controller and repository. The timezone endpoint accepts a timezone string from the client (detected via `Intl.DateTimeFormat().resolvedOptions().timeZone` on mobile) and validates it.

**Dependencies:** T2.2, T2.3
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- `GET /api/users/me` returns the authenticated user's profile.
- `PATCH /api/users/me` updates `display_name`, `avatar_url` — returns updated profile.
- `POST /api/users/me/timezone` sets the user's timezone — returns confirmation.
- All endpoints require authentication (401 without token).
- Invalid timezone strings return 400 with descriptive error.

**Testing Requirements:**
- Integration test: full CRUD flow (get → update → get → verify changes).
- Unit test: service validates timezone before passing to repository.
- Unit test: controller rejects invalid input shapes (Zod validation).

**SOLID/Pattern Notes:**
- **Dependency Inversion:** Controller depends on `IUserProfileService` interface, not concrete implementation.
- **Single Responsibility:** Controller: HTTP concerns. Service: business rules. Repository: data access.

---

#### T2.5 — Auto-Detect Timezone Logic

**Description:** Implement timezone auto-detection. On the server, create a utility that determines the user's timezone from their IP address as a fallback (using a free GeoIP service). On the mobile side (implemented later in E10), the app will send the device timezone on first launch and on every app foreground event. The server stores the timezone and uses it for all time-based calculations (daily loop scheduling, brief delivery time).

**Dependencies:** T2.4
**Priority:** P1
**Effort:** 2 hours

**Acceptance Criteria:**
- Server utility resolves IP → timezone with >90% accuracy for common regions.
- Fallback to UTC if GeoIP fails.
- User's explicit timezone setting always overrides auto-detected value.
- Timezone is used in all date/time calculations (no hardcoded UTC assumptions).

**Testing Requirements:**
- Unit test: known IP addresses resolve to expected timezones.
- Unit test: invalid/private IPs fall back to UTC.
- Unit test: explicit timezone overrides auto-detected.

**SOLID/Pattern Notes:**
- **Strategy Pattern:** Timezone resolution uses a strategy (client-sent > GeoIP > UTC fallback).
- **Single Responsibility:** Timezone utility is standalone, used by multiple services.

---

### Epic 3: Core Data Models & Database

#### T3.1 — Goal & Milestone Tables

**Description:** Create migration for: `goals` table (`id` UUID PK, `user_id` FK, `template_id`, `title`, `description`, `status` enum [active, paused, completed, abandoned], `target_date`, `created_at`, `updated_at`) and `milestones` table (`id` UUID PK, `goal_id` FK, `title`, `description`, `order` integer, `status` enum [pending, in_progress, completed], `target_date`, `created_at`, `updated_at`). Add indexes on `user_id` and `goal_id`. Enable Row Level Security (RLS): users can only access their own goals and milestones.

**Dependencies:** T1.2
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Migration creates both tables with correct column types, constraints, and indexes.
- RLS policies enforce user-scoped access (user A cannot read user B's goals).
- Foreign key cascade: deleting a goal deletes its milestones.
- Status enum is stored as a Postgres enum type.

**Testing Requirements:**
- Integration test: create goal → create milestones → read back → verify structure.
- Integration test: RLS — authenticated as user A, cannot select user B's goals.
- Integration test: cascade delete — delete goal → milestones gone.

**SOLID/Pattern Notes:**
- **Data Integrity:** Enforced at the database level (FK constraints, RLS, enums).

---

#### T3.2 — Task & Subtask Tables

**Description:** Create migration for: `tasks` table (`id` UUID PK, `milestone_id` FK, `user_id` FK, `title`, `description`, `status` enum [pending, approved, in_progress, completed, skipped], `scheduled_date` date, `scheduled_time` time nullable, `effort_minutes` integer, `approval_tier` enum [auto, manual], `approval_status` enum [pending, approved, rejected] nullable, `category` varchar, `created_at`, `updated_at`). Create `subtasks` table (`id`, `task_id` FK, `title`, `completed` boolean, `order` integer). Add indexes on `milestone_id`, `user_id`, `scheduled_date`. Enable RLS.

**Dependencies:** T3.1
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Migration creates both tables with correct types, constraints, and indexes.
- RLS policies enforce user-scoped access.
- Tasks link to milestones; subtasks link to tasks.
- `scheduled_date` index supports efficient daily queries.

**Testing Requirements:**
- Integration test: create task with subtasks → read back → verify structure.
- Integration test: query tasks by `scheduled_date` and `user_id` — verify index is used (EXPLAIN).
- Integration test: RLS enforcement.

**SOLID/Pattern Notes:**
- **Data Integrity:** Normalized schema avoids data duplication.

---

#### T3.3 — Daily Brief & Score Tables

**Description:** Create migration for: `daily_briefs` table (`id` UUID PK, `user_id` FK, `brief_date` date, `content` JSONB, `score` decimal nullable, `generated_at` timestamptz, `viewed_at` timestamptz nullable). Create `daily_scores` table (`id`, `user_id` FK, `score_date` date, `tasks_completed` integer, `tasks_total` integer, `score` decimal, `streak_count` integer). Add unique constraint on (`user_id`, `brief_date`) and (`user_id`, `score_date`). Enable RLS.

**Dependencies:** T1.2
**Priority:** P0
**Effort:** 2 hours

**Acceptance Criteria:**
- Migration creates both tables with correct types and constraints.
- Unique constraint prevents duplicate briefs/scores per user per day.
- `content` JSONB field can store arbitrary brief structure.
- RLS enforced.

**Testing Requirements:**
- Integration test: create brief → attempt duplicate → verify unique constraint error.
- Integration test: score calculation fields store correctly.

**SOLID/Pattern Notes:**
- **JSONB Flexibility:** Brief content stored as JSONB allows schema evolution without migrations.

---

#### T3.4 — Approval Log Table

**Description:** Create migration for: `approval_logs` table (`id` UUID PK, `task_id` FK, `user_id` FK, `action` enum [approved, rejected, auto_approved], `reason` text nullable, `metadata` JSONB nullable, `created_at` timestamptz). This provides a full audit trail of every approval decision. Enable RLS.

**Dependencies:** T3.2
**Priority:** P1
**Effort:** 1.5 hours

**Acceptance Criteria:**
- Migration creates table with correct types.
- Every approval action is logged with timestamp and user.
- `metadata` JSONB can store context (e.g., what the AI recommended).
- RLS enforced.

**Testing Requirements:**
- Integration test: create approval log entry → read back → verify all fields.

**SOLID/Pattern Notes:**
- **Audit Trail Pattern:** Immutable log of all approval decisions for accountability.

---

#### T3.5 — Integration Connections Table

**Description:** Create migration for: `integration_connections` table (`id` UUID PK, `user_id` FK, `provider` enum [google_calendar, buffer, apple_health, google_fit], `access_token` text encrypted, `refresh_token` text encrypted nullable, `token_expires_at` timestamptz nullable, `metadata` JSONB, `connected_at` timestamptz, `disconnected_at` timestamptz nullable). Add Supabase Vault for token encryption at rest. Unique constraint on (`user_id`, `provider`). Enable RLS.

**Dependencies:** T1.2
**Priority:** P1
**Effort:** 2 hours

**Acceptance Criteria:**
- Migration creates table with encryption for sensitive token fields.
- One connection per provider per user (unique constraint).
- `metadata` stores provider-specific config (calendar ID, Buffer profile, etc.).
- Disconnect sets `disconnected_at` rather than deleting (soft disconnect).

**Testing Requirements:**
- Integration test: create connection → read back → tokens are encrypted at rest.
- Integration test: unique constraint prevents duplicate provider connections.

**SOLID/Pattern Notes:**
- **Security:** Tokens encrypted at rest; never logged or returned in API responses.

---

#### T3.6 — Core Repositories (Goal, Task, Brief)

**Description:** Implement `GoalRepository`, `TaskRepository`, and `DailyBriefRepository` with standard CRUD methods plus domain-specific queries. Each repository uses the Supabase client and returns typed domain objects.

Key methods:
- `GoalRepository`: `findByUserId`, `findById`, `create`, `update`, `updateStatus`, `findActiveByUserId`.
- `TaskRepository`: `findByMilestoneId`, `findByUserIdAndDate`, `create`, `createBatch`, `update`, `updateStatus`, `findPendingApproval`.
- `DailyBriefRepository`: `findByUserIdAndDate`, `create`, `markViewed`.

**Dependencies:** T3.1, T3.2, T3.3, T1.3
**Priority:** P0
**Effort:** 5 hours

**Acceptance Criteria:**
- All repositories implement their defined interfaces.
- All methods return typed domain objects (not raw Supabase rows).
- Batch operations use transactions where appropriate.
- Error handling wraps Supabase errors in `AppError` subclasses.

**Testing Requirements:**
- Unit test: each repository method with mocked Supabase client.
- Integration test: full CRUD cycle for each entity against local Supabase.

**SOLID/Pattern Notes:**
- **Repository Pattern:** Encapsulates all data access logic behind interfaces.
- **Interface Segregation:** Each repository exposes only methods relevant to its entity.
- **Dependency Inversion:** Services depend on repository interfaces, not concrete implementations.

---

## Phase 2: Core Engine (Week 3–4)

### Epic 4: Goal Template System

#### T4.1 — Template Data Schema & Storage

**Description:** Define the template data schema in `packages/shared`. A template includes: `id`, `name`, `category` (Productivity, Self Improvement, Solo Business, Social Media, Fitness), `description`, `icon`, `default_duration_weeks`, `milestones[]` (each with `title`, `description`, `week_offset`, `tasks[]`). Store templates as versioned JSON files in `apps/server/src/templates/`. Create a `TemplateRegistry` class that loads and indexes templates at startup.

**Dependencies:** T3.1
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- Template schema is defined in `@lyfestack/shared` with Zod validation.
- At least one template per category exists as a JSON file (can be placeholder content).
- `TemplateRegistry` loads all templates on startup and provides `getById`, `getByCategory`, `getAll`.
- Invalid template files cause startup warning (not crash) with specific error details.

**Testing Requirements:**
- Unit test: Zod schema validates correct templates, rejects malformed ones.
- Unit test: `TemplateRegistry` loads templates and returns correct results for each query method.
- Unit test: missing/malformed template file logs warning but doesn't crash.

**SOLID/Pattern Notes:**
- **Registry Pattern:** Centralized access point for template lookup.
- **Open/Closed:** New templates are added as JSON files — no code changes needed.
- **Single Responsibility:** Registry handles loading/indexing; validation is in Zod schemas.

---

#### T4.2 — Template API Endpoints

**Description:** Create `TemplateController` with routes: `GET /api/templates` (list all, filterable by category), `GET /api/templates/:id` (get single template with full milestone/task structure). These are public endpoints (no auth required) so users can browse templates before signing up. Add pagination support for the list endpoint.

**Dependencies:** T4.1, T1.3
**Priority:** P0
**Effort:** 2 hours

**Acceptance Criteria:**
- `GET /api/templates` returns all templates with `id`, `name`, `category`, `description`, `icon`.
- `GET /api/templates?category=fitness` filters by category.
- `GET /api/templates/:id` returns full template including milestones and task definitions.
- Invalid category filter returns 400.
- Non-existent template ID returns 404.

**Testing Requirements:**
- Integration test: list all templates → verify count and shape.
- Integration test: filter by category → verify only matching templates returned.
- Integration test: get by ID → verify full structure.
- Integration test: invalid category → 400, missing ID → 404.

**SOLID/Pattern Notes:**
- **Controller Pattern:** Thin controller delegates to registry.

---

#### T4.3 — Seed All Five Template Categories

**Description:** Write complete, well-thought-out templates for all five categories. Each template should have 4–8 milestones with 3–5 task definitions per milestone. Tasks should include realistic titles, descriptions, effort estimates, and approval tier hints.

Templates:
1. **Productivity:** "Master Your Workflow" — time blocking, deep work, weekly reviews.
2. **Self Improvement:** "90-Day Transformation" — habits, reading, journaling, skill building.
3. **Solo Business:** "Launch Your Side Business" — validation, MVP, marketing, first sale.
4. **Social Media:** "Grow to 1K Followers" — content calendar, engagement, analytics.
5. **Fitness:** "12-Week Strength Program" — progressive overload, nutrition, recovery.

**Dependencies:** T4.1
**Priority:** P0
**Effort:** 6 hours

**Acceptance Criteria:**
- Five complete templates exist, one per category.
- Each has 4–8 milestones, each milestone has 3–5 tasks.
- Task effort estimates are realistic (15–120 minutes).
- Approval tiers are assigned: social media posts = manual, workouts = auto, financial = manual.
- Templates pass Zod validation.

**Testing Requirements:**
- Unit test: all five templates pass Zod schema validation.
- Manual review: task descriptions are actionable and specific.

**SOLID/Pattern Notes:**
- **Content as Data:** Templates are data files, not code — easy to iterate without deployments.

---

#### T4.4 — Goal Instantiation Service

**Description:** Create `GoalService.createFromTemplate(userId, templateId, customizations)`. This method: (1) loads the template, (2) creates a `goal` row, (3) creates `milestone` rows with calculated target dates based on the user's start date, (4) does NOT pre-create all tasks (tasks are generated dynamically by the planning engine). The `customizations` parameter allows overriding the goal title, target date, and toggling optional milestones.

**Dependencies:** T4.1, T3.6
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- Calling `createFromTemplate` creates a goal and all milestones in a single transaction.
- Milestone target dates are calculated from the user's start date + week offsets.
- Customizations override defaults (title, dates).
- Returns the complete goal with milestones.
- Fails atomically — if milestone creation fails, goal is also rolled back.

**Testing Requirements:**
- Unit test: goal + milestones created with correct dates (mock repositories).
- Unit test: customizations override title and target date.
- Integration test: full flow against local DB — verify rows exist.
- Integration test: simulate milestone creation failure — verify goal is rolled back.

**SOLID/Pattern Notes:**
- **Factory Pattern:** `createFromTemplate` is a factory that constructs a goal graph from a template blueprint.
- **Transaction Pattern:** All-or-nothing creation using Supabase transactions.

---

### Epic 5: Planning Engine

#### T5.1 — Planning Engine Interface & Base Implementation

**Description:** Define the `IPlanningEngine` interface with method: `generateTasksForMilestone(milestone, userContext, existingProgress) → PlannedTask[]`. Create a `BasePlanningEngine` that generates tasks from the template's task definitions, adjusting scheduled dates based on milestone timeline and user timezone. This is the non-AI baseline — it directly maps template tasks to concrete scheduled tasks.

**Dependencies:** T4.4, T3.6
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- Interface is defined in `@lyfestack/shared`.
- `BasePlanningEngine` generates tasks with correct scheduled dates in user's timezone.
- Tasks respect the milestone's date range (no tasks scheduled outside milestone window).
- Tasks are spread across the milestone period (not all on day 1).
- Output includes `title`, `description`, `scheduled_date`, `effort_minutes`, `approval_tier`.

**Testing Requirements:**
- Unit test: generates correct number of tasks for a given milestone.
- Unit test: tasks are distributed across the date range.
- Unit test: respects user timezone for date calculations.
- Unit test: no tasks scheduled on past dates.

**SOLID/Pattern Notes:**
- **Strategy Pattern:** `IPlanningEngine` is the strategy interface; `BasePlanningEngine` and later `AIPlanningEngine` are interchangeable strategies.
- **Dependency Inversion:** Callers depend on `IPlanningEngine`, not concrete classes.
- **Liskov Substitution:** Any `IPlanningEngine` implementation is substitutable.

---

#### T5.2 — AI Planning Engine (OpenRouter)

**Description:** Create `AIPlanningEngine` implementing `IPlanningEngine`. This uses OpenRouter to call an LLM that generates personalized tasks based on the user's goal, progress so far, and preferences. Build the prompt template that includes: goal context, milestone details, completed tasks, user timezone, and scoring history. Parse the LLM response into structured `PlannedTask[]` using a reliable extraction strategy (JSON mode or structured output).

**Dependencies:** T5.1
**Priority:** P0
**Effort:** 6 hours

**Acceptance Criteria:**
- `AIPlanningEngine` calls OpenRouter and returns valid `PlannedTask[]`.
- Prompt includes all relevant context (goal, progress, timezone).
- LLM response is parsed reliably — invalid responses trigger fallback to `BasePlanningEngine`.
- OpenRouter API errors are caught and wrapped in `ExternalServiceError`.
- API call includes timeout (30 seconds) and retry (1 retry with exponential backoff).
- Token usage is logged for cost monitoring.

**Testing Requirements:**
- Unit test: prompt construction includes all context fields.
- Unit test: valid LLM response is parsed into correct `PlannedTask[]` shape.
- Unit test: malformed LLM response triggers fallback to `BasePlanningEngine`.
- Unit test: OpenRouter timeout/error → `ExternalServiceError`.
- Integration test: real OpenRouter call with a test prompt (can be a separate test suite, not run in CI).

**SOLID/Pattern Notes:**
- **Strategy Pattern:** Implements the same interface as `BasePlanningEngine`.
- **Adapter Pattern:** Wraps OpenRouter API into the `IPlanningEngine` contract.
- **Circuit Breaker (informal):** Fallback to base engine on AI failure ensures graceful degradation.

---

#### T5.3 — Planning Engine Factory & Configuration

**Description:** Create `PlanningEngineFactory` that returns the appropriate engine based on configuration and context. Rules: (1) If OpenRouter API key is configured and user has active goals, use `AIPlanningEngine`. (2) If OpenRouter is unavailable or user is in free tier, use `BasePlanningEngine`. (3) Allow per-goal override (e.g., user opts out of AI planning). Wire the factory into the DI container.

**Dependencies:** T5.1, T5.2
**Priority:** P1
**Effort:** 2 hours

**Acceptance Criteria:**
- Factory returns `AIPlanningEngine` when conditions are met.
- Factory returns `BasePlanningEngine` as fallback.
- Per-goal AI opt-out is respected.
- Factory is registered in DI container and injectable into services.

**Testing Requirements:**
- Unit test: factory returns AI engine when API key is present.
- Unit test: factory returns base engine when API key is missing.
- Unit test: per-goal opt-out overrides global setting.

**SOLID/Pattern Notes:**
- **Factory Pattern:** Encapsulates creation logic for engine selection.
- **Open/Closed:** New engine types can be added without modifying the factory's interface.

---

### Epic 6: Task & Daily Brief System

#### T6.1 — Task CRUD API

**Description:** Create `TaskController` with routes: `GET /api/tasks?date=YYYY-MM-DD` (get tasks for a date), `GET /api/tasks/:id`, `PATCH /api/tasks/:id` (update status, mark subtasks complete), `POST /api/tasks/:id/complete` (mark task complete, trigger scoring). Create `TaskService` that validates status transitions (e.g., can't complete a task that isn't approved). All routes require authentication.

**Dependencies:** T3.6, T2.2
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- `GET /api/tasks?date=2026-05-01` returns all tasks for the authenticated user on that date.
- `PATCH /api/tasks/:id` updates allowed fields (status, subtask completion).
- `POST /api/tasks/:id/complete` transitions task to completed state and updates score.
- Invalid status transitions return 400 with a clear error message.
- Users can only access their own tasks (401/403 for others).

**Testing Requirements:**
- Unit test: valid status transitions succeed.
- Unit test: invalid status transitions (e.g., pending → completed, skipping approved) fail.
- Integration test: full task lifecycle: pending → approved → in_progress → completed.
- Integration test: authorization — user A cannot access user B's tasks.

**SOLID/Pattern Notes:**
- **State Pattern:** Task status transitions follow defined rules — consider a state machine.
- **Single Responsibility:** Controller handles HTTP; service handles business rules; repository handles data.

---

#### T6.2 — Daily Brief Generation Service

**Description:** Create `DailyBriefService.generateBrief(userId, date)`. This method: (1) fetches the user's active goals and milestones, (2) gets tasks scheduled for the given date, (3) calculates yesterday's score, (4) calls the AI (via OpenRouter) to generate a motivational brief that includes: greeting, score summary, today's task list with priorities, and a motivational insight. (5) Stores the brief in `daily_briefs` table as JSONB. Includes a non-AI fallback that generates a simple structured brief without motivational content.

**Dependencies:** T3.6, T5.2, T6.1
**Priority:** P0
**Effort:** 5 hours

**Acceptance Criteria:**
- Brief contains: greeting (time-aware, using user's timezone), score from previous day, today's tasks, motivational message.
- Brief is generated and stored in JSONB format.
- If AI fails, fallback generates a functional (non-motivational) brief.
- Brief generation is idempotent — calling twice for the same date returns the existing brief.
- Handles users with no tasks for the day (generates a "rest day" brief).

**Testing Requirements:**
- Unit test: brief includes all required sections (greeting, score, tasks, motivation).
- Unit test: time-aware greeting (morning/afternoon/evening based on user timezone).
- Unit test: AI failure triggers fallback, fallback brief has correct structure.
- Unit test: idempotency — second call returns same brief, no duplicate DB row.
- Unit test: zero-task day generates rest day brief.

**SOLID/Pattern Notes:**
- **Template Method Pattern:** Brief generation follows a fixed sequence of steps; AI/non-AI vary only in the "motivational content" step.
- **Strategy Pattern:** AI vs. fallback brief generation.

---

#### T6.3 — Scoring Engine

**Description:** Create `ScoringService.calculateDailyScore(userId, date)`. Scoring formula: `score = (tasks_completed / tasks_total) * 100`. Additional factors: streak bonus (+5 per consecutive day with score ≥ 70), difficulty weight (manual-approval tasks count 1.5x). Store the score in `daily_scores` table. Create `ScoringService.getStreak(userId)` to calculate current streak count.

**Dependencies:** T3.3, T3.6, T6.1
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Score is a number 0–100 (base) plus streak bonus.
- Manual-approval tasks are weighted 1.5x in the numerator and denominator.
- Streak increments for consecutive days with score ≥ 70, resets on gaps or low scores.
- Score of 0 for days with no scheduled tasks (not counted in streak).
- `getStreak` returns current streak length.

**Testing Requirements:**
- Unit test: 3/5 tasks completed → score = 60.
- Unit test: 3/5 tasks where 2 are manual → weighted score calculation is correct.
- Unit test: streak of 3 consecutive days → bonus = 15.
- Unit test: streak resets after a day with score < 70.
- Unit test: day with no tasks → score = 0, streak unaffected.

**SOLID/Pattern Notes:**
- **Strategy Pattern:** Scoring formula could be swapped (e.g., different formulas for different template categories).
- **Single Responsibility:** Scoring service only calculates scores; doesn't generate briefs or send notifications.

---

#### T6.4 — Daily Brief API Endpoint

**Description:** Create `BriefController` with routes: `GET /api/briefs/today` (get or generate today's brief), `GET /api/briefs/:date` (get brief for a specific date), `POST /api/briefs/today/viewed` (mark today's brief as viewed). The `GET /api/briefs/today` endpoint is smart: if today's brief hasn't been generated yet, it triggers generation on-demand (for users who open the app before the cron runs).

**Dependencies:** T6.2, T2.2
**Priority:** P0
**Effort:** 2 hours

**Acceptance Criteria:**
- `GET /api/briefs/today` returns today's brief (generates if needed).
- `GET /api/briefs/2026-05-01` returns a past brief or 404.
- `POST /api/briefs/today/viewed` sets `viewed_at` timestamp.
- Brief generation on-demand completes in under 10 seconds.
- All endpoints require authentication.

**Testing Requirements:**
- Integration test: first call generates brief, second call returns same brief.
- Integration test: mark viewed → `viewed_at` is set.
- Integration test: past date returns stored brief or 404.

**SOLID/Pattern Notes:**
- **Lazy Initialization:** Brief is generated on first access if not yet available.

---

## Phase 3: Agent System (Week 5–6)

### Epic 7: Agent Framework (OpenRouter Integration)

#### T7.1 — OpenRouter Client Wrapper

**Description:** Create a robust `OpenRouterClient` class in `apps/server/src/integrations/openrouter/`. Features: (1) typed request/response interfaces, (2) configurable model selection (default from env var), (3) automatic retry with exponential backoff (max 3 attempts), (4) request timeout (30s), (5) token usage tracking (log input/output tokens per request), (6) rate limiting (configurable requests per minute), (7) streaming support for long responses. Expose a clean `chat(messages, options)` method.

**Dependencies:** T1.3
**Priority:** P0
**Effort:** 5 hours

**Acceptance Criteria:**
- `chat(messages)` sends a request to OpenRouter and returns the response.
- Retries on 429 (rate limit) and 5xx errors with exponential backoff.
- Does NOT retry on 4xx (client errors).
- Timeout triggers after 30 seconds.
- Token usage is logged at `info` level after each successful request.
- Rate limiter prevents exceeding configured RPM.
- Streaming mode returns an async iterator of chunks.

**Testing Requirements:**
- Unit test: successful request returns parsed response.
- Unit test: 429 response triggers retry, succeeds on second attempt.
- Unit test: 500 response retries up to 3 times, then throws `ExternalServiceError`.
- Unit test: 400 response throws immediately without retry.
- Unit test: timeout triggers `ExternalServiceError`.
- Unit test: token usage is extracted and logged.
- Unit test: rate limiter queues requests exceeding RPM.

**SOLID/Pattern Notes:**
- **Adapter Pattern:** Wraps OpenRouter API behind a clean, typed interface.
- **Single Responsibility:** Only handles HTTP communication with OpenRouter.
- **Decorator Pattern:** Retry, timeout, and rate-limiting are layered decorators on the base HTTP call.

---

#### T7.2 — Agent Prompt Manager

**Description:** Create a `PromptManager` class that constructs prompts for different agent actions: `planTasks`, `generateBrief`, `suggestAdjustment`, `composePost`. Each prompt type has a template with placeholders for dynamic context (user data, goal data, progress data). Prompts are stored as separate template files for easy iteration. The manager handles context window management — truncating history if the context gets too long.

**Dependencies:** T7.1
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- `PromptManager.build('planTasks', context)` returns a complete message array.
- Each prompt type has a system message and user message template.
- Dynamic context (goals, tasks, scores) is injected into placeholders.
- Context exceeding token limit is truncated (oldest history first).
- Prompt templates are loaded from files (not hardcoded strings).

**Testing Requirements:**
- Unit test: each prompt type generates valid message arrays.
- Unit test: all placeholders are replaced (no `{{placeholder}}` in output).
- Unit test: context truncation keeps system message and latest context, trims history.
- Unit test: missing context fields use sensible defaults (not empty strings).

**SOLID/Pattern Notes:**
- **Template Method Pattern:** Each prompt type follows the same build pattern but with different templates.
- **Strategy Pattern:** Different prompt strategies for different agent actions.
- **Single Responsibility:** Only constructs prompts; doesn't call the LLM.

---

#### T7.3 — Agent Service (Orchestrator)

**Description:** Create `AgentService` — the central orchestrator that composes the OpenRouter client, prompt manager, and domain services to execute agent actions. Methods: `planMilestoneTasks(milestoneId)`, `generateDailyBrief(userId, date)`, `suggestGoalAdjustment(goalId)`, `composePost(goalId, platform)`. Each method: builds the prompt, calls the LLM, parses the response, validates the output, and stores the result. All actions are logged with a unique `agentActionId` for traceability.

**Dependencies:** T7.1, T7.2, T5.1, T6.2
**Priority:** P0
**Effort:** 5 hours

**Acceptance Criteria:**
- Each method executes the full pipeline: build prompt → call LLM → parse → validate → store.
- Every action gets a unique `agentActionId` logged with the request.
- Failed LLM calls fall back to non-AI alternatives.
- Parsing failures are logged with the raw LLM response for debugging.
- Agent actions are idempotent where possible (e.g., won't regenerate today's brief if it exists).

**Testing Requirements:**
- Unit test: each method calls prompt manager with correct context.
- Unit test: successful LLM response is parsed and stored.
- Unit test: LLM failure triggers fallback path.
- Unit test: parse failure logs raw response and falls back.
- Integration test: end-to-end `planMilestoneTasks` with mocked OpenRouter.

**SOLID/Pattern Notes:**
- **Facade Pattern:** `AgentService` provides a simplified interface over complex subsystem interactions.
- **Mediator Pattern:** Coordinates between OpenRouter client, prompt manager, and domain services.
- **Single Responsibility:** Orchestration only — delegates all domain logic to respective services.

---

### Epic 8: Trust & Approval System

#### T8.1 — Approval Tier Classification

**Description:** Create `ApprovalClassifier` that determines whether a task requires manual approval or can be auto-approved. Rules: (1) Social media posts → always manual. (2) Financial actions (purchases, subscriptions) → always manual. (3) Calendar events → auto (can be undone). (4) Workouts/habits → auto. (5) Content creation (drafts) → auto. The classifier uses the task's `category` field and optional `tags` to make the determination. Store the rules in a configuration file for easy tuning.

**Dependencies:** T3.2
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- `classify(task) → { tier: 'auto' | 'manual', reason: string }`.
- Social media and financial tasks always return `manual`.
- Exercise and habit tasks always return `auto`.
- Classification rules are loaded from a config file (not hardcoded).
- Unknown categories default to `manual` (fail-safe).

**Testing Requirements:**
- Unit test: social media task → manual.
- Unit test: workout task → auto.
- Unit test: financial task → manual.
- Unit test: unknown category → manual (safe default).
- Unit test: rules loaded from config file.

**SOLID/Pattern Notes:**
- **Strategy Pattern:** Classifiers can be swapped for different rule sets.
- **Open/Closed:** New categories are added to the config file, not the code.
- **Rule Engine Pattern (simplified):** Rules are data-driven, evaluated in order.

---

#### T8.2 — Approval API Endpoints

**Description:** Create `ApprovalController` with routes: `GET /api/approvals/pending` (list tasks awaiting approval), `POST /api/approvals/:taskId/approve` (approve a task), `POST /api/approvals/:taskId/reject` (reject with optional reason), `GET /api/approvals/history` (paginated approval log). Create `ApprovalService` that: validates the task is in `pending` approval state, logs the action to `approval_logs`, updates the task status, and for auto-approved tasks, processes them immediately.

**Dependencies:** T8.1, T6.1, T3.4
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- `GET /api/approvals/pending` returns tasks with `approval_status = pending` for the authenticated user.
- `POST /api/approvals/:taskId/approve` transitions task to `approved` and logs the action.
- `POST /api/approvals/:taskId/reject` transitions task to `rejected` with reason and logs.
- Approving an already-approved task returns 409 Conflict.
- Approval log records user, action, reason, and timestamp.
- History endpoint supports pagination (limit/offset).

**Testing Requirements:**
- Unit test: approve pending task → status changes, log created.
- Unit test: reject pending task → status changes, reason stored.
- Unit test: approve non-pending task → 409.
- Integration test: full approval flow → verify task status and log entry.
- Integration test: history pagination returns correct pages.

**SOLID/Pattern Notes:**
- **Observer Pattern:** Approval events could notify other systems (e.g., schedule the approved task in calendar).
- **State Pattern:** Task approval status follows defined transitions.

---

#### T8.3 — Auto-Approval Processor

**Description:** Create `AutoApprovalProcessor` that runs during task generation (or as a post-processing step). When new tasks are created by the planning engine, the processor: (1) classifies each task using `ApprovalClassifier`, (2) auto-approves tasks with `tier: auto`, (3) leaves `tier: manual` tasks in `pending` state for user review. Logs all auto-approval decisions to `approval_logs` with `action: auto_approved`.

**Dependencies:** T8.1, T8.2
**Priority:** P0
**Effort:** 2 hours

**Acceptance Criteria:**
- Auto-tier tasks are immediately approved without user intervention.
- Manual-tier tasks remain pending.
- Every auto-approval is logged with `action: auto_approved`.
- Processing a batch of 20 tasks completes in under 1 second.
- Processor is idempotent — running twice on the same tasks doesn't create duplicate logs.

**Testing Requirements:**
- Unit test: batch of mixed tasks → auto tasks approved, manual tasks pending.
- Unit test: all auto-approvals logged.
- Unit test: idempotency — second run makes no changes.

**SOLID/Pattern Notes:**
- **Command Pattern:** Each approval action (auto/manual/reject) is a command with consistent logging.
- **Batch Processing Pattern:** Efficient batch handling with transaction support.

---

### Epic 9: Daily Loop Engine

#### T9.1 — Cron Job Infrastructure

**Description:** Set up the cron job system using `node-cron` or `bull` (Redis-backed job queue). Create a `JobRunner` class that: (1) discovers and registers jobs, (2) handles job failures with retries, (3) logs job execution start/end/duration, (4) prevents overlapping runs of the same job (using a distributed lock if needed). Configure a `daily-loop` job that runs every hour (to handle all timezones) and processes users whose local time is the configured brief delivery hour (default: 6 AM).

**Dependencies:** T1.3
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- `JobRunner` registers jobs with cron expressions.
- `daily-loop` job runs every hour.
- Job execution is logged with start time, duration, and outcome.
- Failed jobs are retried up to 3 times with exponential backoff.
- Concurrent runs of the same job are prevented (lock mechanism).
- Job can be triggered manually via an admin API endpoint for testing.

**Testing Requirements:**
- Unit test: job runner registers and triggers jobs on schedule.
- Unit test: failed job is retried up to 3 times.
- Unit test: concurrent run prevention (second run is skipped while first is active).
- Integration test: manual trigger via API fires the job.

**SOLID/Pattern Notes:**
- **Template Method Pattern:** All jobs follow the same lifecycle (acquire lock → execute → release lock → log).
- **Observer Pattern:** Jobs emit events (started, completed, failed) for monitoring.

---

#### T9.2 — Daily Loop Implementation

**Description:** Implement the `DailyLoopJob` that runs hourly and processes users. For each user whose local time matches the brief delivery hour: (1) calculate yesterday's score, (2) check if milestones need new tasks generated, (3) generate tasks for today if not already generated, (4) run auto-approval on new tasks, (5) generate the daily brief, (6) queue push notification. Process users in batches (50 at a time) to avoid overwhelming external services. Track progress so the loop can resume if interrupted.

**Dependencies:** T9.1, T6.2, T6.3, T8.3, T5.1
**Priority:** P0
**Effort:** 6 hours

**Acceptance Criteria:**
- Loop processes only users whose local time matches the delivery hour (±30 minutes).
- Each step is executed in order; failure in one step doesn't skip subsequent users.
- Per-user failures are logged but don't halt the batch.
- New tasks are generated for milestones that are due and have no tasks for today.
- Auto-approval runs on newly generated tasks.
- Brief is generated and stored.
- Push notification is queued (actual sending is in E18).
- Loop completes 1000 users within 30 minutes.

**Testing Requirements:**
- Unit test: user timezone filtering — 6 AM in `America/New_York` → processed when UTC is 11:00.
- Unit test: all steps execute in order for each user.
- Unit test: per-user failure is logged, next user proceeds.
- Unit test: no duplicate task generation (idempotent).
- Integration test: end-to-end loop with 5 test users → verify scores, tasks, briefs created.
- Performance test: 1000 mock users processed within 30 minutes (can be simulated).

**SOLID/Pattern Notes:**
- **Pipeline Pattern:** Each user is processed through a sequential pipeline of steps.
- **Batch Processing:** Users are processed in configurable batch sizes.
- **Idempotency:** Each step checks for existing data before creating.

---

#### T9.3 — Loop Monitoring & Alerting

**Description:** Add observability to the daily loop: (1) track metrics — users processed, tasks generated, briefs created, errors encountered, duration. (2) Log a summary at the end of each loop run. (3) Create a `GET /api/admin/loop-status` endpoint (admin-only) that returns the last run's metrics and status. (4) If error rate exceeds 10%, log at `error` level (future: trigger alert).

**Dependencies:** T9.2
**Priority:** P1
**Effort:** 2 hours

**Acceptance Criteria:**
- End-of-loop summary log includes all key metrics.
- Admin endpoint returns last run status, metrics, and timestamp.
- Error rate above 10% triggers error-level log.
- Metrics are reset at the start of each run.

**Testing Requirements:**
- Unit test: metrics accumulate correctly during a loop run.
- Unit test: error rate calculation is correct.
- Unit test: admin endpoint returns expected shape.

**SOLID/Pattern Notes:**
- **Observer Pattern:** Loop emits metrics events; monitoring service aggregates them.

---

## Phase 4: Mobile App (Week 5–8, parallel with Phase 3)

### Epic 10: App Shell & Navigation

#### T10.1 — Bottom Tab Navigator

**Description:** Implement the bottom tab navigation using Expo Router's tab layout. Four tabs: Dashboard (home icon), Goals (target icon), Approvals (check-circle icon), Profile (user icon). Style with the Lyfestack palette: active tab = sky blue (#0EA5E9), inactive = gray (#6B7280), background = white. Add tab bar badge for pending approvals count.

**Dependencies:** T1.4
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Four tabs render with correct icons and labels.
- Active tab is highlighted in sky blue.
- Tab bar has a clean, Stripe-like appearance (subtle shadow, no harsh borders).
- Badge on Approvals tab shows pending count (hardcoded for now, wired up later).
- Tab persistence — switching tabs preserves scroll position.

**Testing Requirements:**
- Visual verification: tabs match design spec (colors, icons, spacing).
- Navigation test: tapping each tab renders the correct screen.
- Badge renders correctly with counts 0, 1, 9, 99+.

**SOLID/Pattern Notes:**
- **Component Composition:** Tab bar is a composition of reusable icon + label + badge components.

---

#### T10.2 — API Client & Auth Token Management

**Description:** Create the `ApiClient` service in `apps/mobile/services/`. Features: (1) base URL from config, (2) automatic JWT injection from secure storage, (3) automatic token refresh on 401 `TOKEN_EXPIRED`, (4) request/response interceptors for logging in dev, (5) typed request methods (`get<T>`, `post<T>`, `patch<T>`, `delete<T>`), (6) error mapping to `AppError` types. Use `expo-secure-store` for token persistence.

**Dependencies:** T1.4, T2.2
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- `ApiClient.get<UserProfile>('/api/users/me')` returns typed response.
- JWT is automatically included in all requests.
- On 401 `TOKEN_EXPIRED`, token is refreshed and request is retried (once).
- On refresh failure, user is redirected to login.
- All API errors are mapped to `AppError` instances.
- Tokens are stored securely (not AsyncStorage).

**Testing Requirements:**
- Unit test: JWT is included in request headers.
- Unit test: 401 triggers refresh → retry → success.
- Unit test: 401 → refresh fails → redirect to login.
- Unit test: network error → mapped to `AppError`.
- Unit test: typed responses are correctly parsed.

**SOLID/Pattern Notes:**
- **Adapter Pattern:** Wraps fetch API into a typed, app-specific client.
- **Interceptor Pattern:** Request/response interceptors for cross-cutting concerns.
- **Single Responsibility:** Only handles HTTP; auth logic is delegated to auth service.

---

#### T10.3 — Auth Screens (Login/Signup)

**Description:** Build the login and signup screens. Login screen: email input, password input, "Sign In" button, Google OAuth button, Apple Sign-In button, "Forgot password?" link, "Create account" link. Signup screen: name input, email input, password input (with strength indicator), "Create Account" button, OAuth buttons. Both screens use Supabase Auth client. On successful auth, navigate to onboarding (if first time) or dashboard.

**Dependencies:** T10.2, T2.1
**Priority:** P0
**Effort:** 5 hours

**Acceptance Criteria:**
- Login with email/password works end-to-end.
- Login with Google OAuth works (opens browser, returns to app).
- Signup creates account and sends verification email.
- Password strength indicator shows weak/medium/strong.
- Form validation: required fields, email format, password minimum length.
- Error messages are user-friendly (not raw API errors).
- Loading states on all buttons during async operations.

**Testing Requirements:**
- Unit test: form validation rules (email format, password length).
- Unit test: error messages map from API errors to user-friendly strings.
- Manual test: full OAuth flow on iOS and Android.
- Manual test: signup → verification email received.

**SOLID/Pattern Notes:**
- **Form Validation Pattern:** Validation rules are reusable (from `@lyfestack/shared` Zod schemas).

---

#### T10.4 — Global State Management (Zustand)

**Description:** Set up Zustand stores for global state: `useAuthStore` (user, token, isAuthenticated, login/logout actions), `useGoalStore` (goals, activeGoal, CRUD actions), `useBriefStore` (todaysBrief, fetchBrief), `useApprovalStore` (pendingApprovals, approve/reject actions). Each store integrates with the `ApiClient` for data fetching. Add persistence for auth state using `expo-secure-store`.

**Dependencies:** T10.2
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- `useAuthStore` persists login state across app restarts.
- `useGoalStore` fetches and caches user's goals.
- `useBriefStore` fetches today's brief with loading/error states.
- `useApprovalStore` maintains pending approval count (for tab badge).
- All stores expose loading and error states.
- Stores are typed (TypeScript infers action parameters and return types).

**Testing Requirements:**
- Unit test: auth store login action stores token and sets isAuthenticated.
- Unit test: auth store logout clears all state.
- Unit test: goal store fetch populates goals array.
- Unit test: error states are set correctly on API failure.

**SOLID/Pattern Notes:**
- **State Management Pattern:** Zustand stores follow flux-like unidirectional data flow.
- **Single Responsibility:** Each store manages one domain's state.
- **Interface Segregation:** Components subscribe only to the slices they need.

---

#### T10.5 — Timezone Sync on App Foreground

**Description:** Implement a hook `useTimezoneSync` that: (1) reads the device timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`, (2) compares it to the stored timezone, (3) if different, sends the new timezone to `POST /api/users/me/timezone`. Trigger this on app foreground (using `AppState` listener) and on first launch. This ensures the server always has the correct timezone for daily loop scheduling.

**Dependencies:** T10.2, T2.5
**Priority:** P1
**Effort:** 1.5 hours

**Acceptance Criteria:**
- Timezone is sent on first app launch after login.
- Timezone is checked on every app foreground event.
- Only sends update if timezone changed (avoids unnecessary API calls).
- Handles API failure silently (non-blocking).

**Testing Requirements:**
- Unit test: timezone change triggers API call.
- Unit test: same timezone does not trigger API call.
- Unit test: API failure is caught and does not crash the app.

**SOLID/Pattern Notes:**
- **Observer Pattern:** Listens to AppState changes.

---

### Epic 11: Onboarding Flow

#### T11.1 — Onboarding Screen Sequence

**Description:** Build a multi-step onboarding flow (4 screens): (1) Welcome — "Hi {name}, let's set up your Lyfestack" with animated illustration. (2) Choose Category — grid of five template categories with icons and descriptions. (3) Select Template — list of templates within the chosen category, each showing title, description, and duration. (4) Customize Goal — set goal title (pre-filled from template), start date (default: today), target date (default: calculated from template duration), toggle optional milestones. On completion, call `GoalService.createFromTemplate` and navigate to dashboard.

**Dependencies:** T10.1, T4.2, T4.4
**Priority:** P0
**Effort:** 6 hours

**Acceptance Criteria:**
- Four-screen flow with forward/back navigation and progress indicator.
- Category selection shows all five categories with icons.
- Template selection loads from API and shows template details.
- Customization screen pre-fills from template defaults.
- Completing onboarding creates the goal and milestones server-side.
- Sets `onboarding_completed = true` on user profile.
- Animations are smooth (60fps on mid-range devices).

**Testing Requirements:**
- Unit test: onboarding state machine transitions correctly (forward/back).
- Unit test: customization defaults are populated from template.
- Integration test: completing onboarding creates goal via API.
- Manual test: smooth animations on iOS and Android.

**SOLID/Pattern Notes:**
- **State Machine Pattern:** Onboarding flow is a finite state machine with well-defined transitions.
- **Factory Pattern:** Goal creation from template (reusing T4.4).

---

#### T11.2 — Template Category Cards

**Description:** Create a reusable `CategoryCard` component for the onboarding category selection screen. Each card shows: icon (e.g., Briefcase for Productivity, Brain for Self Improvement, Rocket for Solo Business, Share for Social Media, Dumbbell for Fitness), category name, short tagline, gradient accent. Cards are in a 2-column grid with the 5th card centered. Selected state shows a sky blue border.

**Dependencies:** T1.4
**Priority:** P1
**Effort:** 2 hours

**Acceptance Criteria:**
- Five cards render in a responsive 2-column grid.
- Each card has a distinct icon and tagline.
- Selected card shows sky blue border with subtle scale animation.
- Cards are accessible (screen reader labels).

**Testing Requirements:**
- Visual verification: matches design spec.
- Accessibility: VoiceOver/TalkBack reads card content correctly.

**SOLID/Pattern Notes:**
- **Component Composition:** Card is a pure component accepting props.

---

### Epic 12: Dashboard & Daily Brief UI

#### T12.1 — Dashboard Screen Layout

**Description:** Build the main dashboard screen with sections: (1) Header — greeting + date + score badge. (2) Daily Brief card (expandable) — shows brief summary, tap to expand full brief. (3) Today's Tasks — list of tasks with status indicators. (4) Active Goals — horizontal scroll of goal progress cards. (5) Streak counter — flame icon + count. Pull-to-refresh triggers brief re-fetch.

**Dependencies:** T10.1, T10.4
**Priority:** P0
**Effort:** 5 hours

**Acceptance Criteria:**
- Dashboard loads and displays all sections with data from stores.
- Daily brief card shows summary and expands to full content on tap.
- Task list shows today's tasks with status (pending/approved/completed) color coding.
- Goal progress cards show percentage and milestone count.
- Streak counter shows current streak with flame animation at streak ≥ 7.
- Pull-to-refresh updates brief and tasks.
- Loading skeletons shown during data fetch.

**Testing Requirements:**
- Unit test: all sections render with mock data.
- Unit test: empty states (no tasks, no brief, no goals) show appropriate messages.
- Unit test: pull-to-refresh triggers store fetch actions.
- Manual test: smooth scrolling on iOS and Android.

**SOLID/Pattern Notes:**
- **Container/Presenter Pattern:** Dashboard screen (container) composes pure display components (presenters).
- **Observer Pattern:** Screen reactively updates when Zustand stores change.

---

#### T12.2 — Daily Brief Expansion Card

**Description:** Build the expandable daily brief component. Collapsed state: one-line summary ("You have 5 tasks today. Yesterday's score: 85."). Expanded state: full brief with sections — greeting, score breakdown, task preview list, motivational insight. Animate expansion/collapse with `react-native-reanimated`. Markdown-like rendering for the AI-generated motivational text.

**Dependencies:** T12.1, T6.4
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Collapsed brief shows one-line summary.
- Tapping expands smoothly (spring animation, ~300ms).
- Expanded brief shows all sections with clear visual hierarchy.
- Motivational text renders bold, italic, and emoji correctly.
- "Mark as read" action (hidden for now, wired later).

**Testing Requirements:**
- Unit test: collapsed and expanded states render correct content.
- Unit test: animation doesn't jank (test animation config values).
- Manual test: expansion animation is smooth on both platforms.

**SOLID/Pattern Notes:**
- **Component Composition:** Brief sections are separate components composed in the card.

---

#### T12.3 — Task List Item Component

**Description:** Create a `TaskListItem` component showing: checkbox (tap to complete), task title, effort badge ("30 min"), approval status badge (if pending approval), time indicator (if scheduled for a specific time). Status-based styling: pending = gray, approved = black, in_progress = sky blue, completed = green with strikethrough, skipped = light gray. Swipe actions: swipe right to complete, swipe left to skip.

**Dependencies:** T10.4
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- All five statuses render with correct visual treatment.
- Checkbox tap completes the task (with optimistic update).
- Swipe right completes, swipe left skips (with haptic feedback).
- Effort badge and time indicator display correctly.
- Pending approval badge shows "Needs Approval" in amber.
- Completing a task triggers score recalculation.

**Testing Requirements:**
- Unit test: each status renders correct style.
- Unit test: checkbox tap calls complete action.
- Unit test: swipe actions trigger correct callbacks.
- Manual test: haptic feedback works on physical devices.

**SOLID/Pattern Notes:**
- **Component Composition:** Item composes checkbox, badge, and swipe handler components.

---

### Epic 13: Goal Management Screens

#### T13.1 — Goals List Screen

**Description:** Build the Goals tab screen showing all user goals. Each goal card shows: title, template category badge, progress percentage (circular progress indicator), milestone count (completed/total), status badge (active/paused/completed), target date. Tapping a goal navigates to the goal detail screen. Floating action button (+) to add a new goal (starts the template selection flow from onboarding T11.1, reusable).

**Dependencies:** T10.1, T10.4, T4.4
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- All active goals display in a scrollable list.
- Each card shows progress, milestones, status, and target date.
- Tapping navigates to goal detail.
- FAB opens template selection flow.
- Empty state: "No goals yet — let's create one!" with CTA button.
- Filter/sort: active, completed, all (tab bar at top).

**Testing Requirements:**
- Unit test: goals list renders correct number of cards.
- Unit test: empty state renders when no goals.
- Unit test: filter tabs show correct subsets.
- Navigation test: tap goal → detail screen, tap FAB → template flow.

**SOLID/Pattern Notes:**
- **Container/Presenter:** Screen fetches data; cards are pure presenters.

---

#### T13.2 — Goal Detail Screen

**Description:** Build the goal detail screen with sections: (1) Header — goal title, category badge, overall progress bar. (2) Milestone timeline — vertical timeline showing milestones in order, each with title, date range, and progress. (3) Upcoming tasks — next 5 tasks across all milestones. (4) Score history — line chart of daily scores for this goal. (5) Actions — Pause Goal, Edit Goal, Abandon Goal (with confirmation dialog).

**Dependencies:** T13.1, T6.3
**Priority:** P0
**Effort:** 5 hours

**Acceptance Criteria:**
- All sections render with correct data.
- Milestone timeline visually shows progress (completed milestones filled, current highlighted).
- Tapping a milestone expands to show its tasks.
- Score chart shows last 30 days of scores.
- Pause/Abandon actions require confirmation and call the API.
- Loading and error states handled for all data fetches.

**Testing Requirements:**
- Unit test: milestone timeline renders in correct order with statuses.
- Unit test: score chart renders with mock data.
- Unit test: pause action shows confirmation, calls API on confirm.
- Integration test: abandon goal → API call → navigates back to goals list.

**SOLID/Pattern Notes:**
- **Component Composition:** Timeline, chart, and task list are independent components.

---

### Epic 14: Approval & Task Interaction UI

#### T14.1 — Approvals Screen

**Description:** Build the Approvals tab screen. Shows all tasks requiring manual approval, grouped by goal. Each approval card shows: task title, description, goal name, why it needs approval (category tag), scheduled date, effort estimate. Two action buttons: Approve (sky blue) and Reject (with reason input modal). Swipe right to approve. Badge count on tab updates in real-time.

**Dependencies:** T10.1, T8.2, T10.4
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- Pending approvals load and display grouped by goal.
- Approve button sends approval and removes the card (with animation).
- Reject opens a modal for entering a reason, then sends rejection.
- Swipe-to-approve works with haptic feedback.
- Tab badge count decrements on approval/rejection.
- Empty state: "All caught up! No pending approvals." with checkmark animation.
- Optimistic updates — UI updates immediately, rolls back on API failure.

**Testing Requirements:**
- Unit test: approvals render grouped by goal.
- Unit test: approve action calls API and removes card.
- Unit test: reject action opens modal, sends reason.
- Unit test: empty state shows when no pending approvals.
- Unit test: optimistic update rolls back on error.

**SOLID/Pattern Notes:**
- **Optimistic Update Pattern:** UI updates immediately for responsiveness.
- **Command Pattern:** Approve/reject actions are discrete commands.

---

#### T14.2 — Task Detail Modal

**Description:** Build a bottom sheet modal that shows full task details when a task is tapped from any screen (dashboard, goals, approvals). Content: title, description, goal & milestone context, scheduled date/time, effort estimate, subtask checklist (if any), status history, action buttons (complete, skip, approve/reject if pending). The modal slides up from the bottom with a drag handle.

**Dependencies:** T12.3, T8.2
**Priority:** P1
**Effort:** 3 hours

**Acceptance Criteria:**
- Bottom sheet opens smoothly from any task tap.
- All task details display correctly.
- Subtask checklist is interactive (tap to toggle).
- Action buttons match the task's current state.
- Drag handle allows dismiss by swiping down.
- Background is dimmed and tapping it dismisses the modal.

**Testing Requirements:**
- Unit test: modal renders all task fields.
- Unit test: subtask toggle calls update API.
- Unit test: action buttons match task status.
- Manual test: smooth animation on both platforms.

**SOLID/Pattern Notes:**
- **Component Composition:** Modal composes reusable detail and action components.

---

## Phase 5: Integrations (Week 7–8)

### Epic 15: Google Calendar Integration

#### T15.1 — Google Calendar OAuth & Token Storage

**Description:** Implement Google Calendar OAuth 2.0 flow. Create a `GoogleCalendarAdapter` in `apps/server/src/integrations/google-calendar/`. Handle: (1) OAuth consent redirect URL generation, (2) authorization code exchange for tokens, (3) token storage in `integration_connections` table, (4) automatic token refresh when access token expires. Create API endpoints: `GET /api/integrations/google-calendar/connect` (start OAuth), `GET /api/integrations/google-calendar/callback` (handle redirect), `DELETE /api/integrations/google-calendar/disconnect`.

**Dependencies:** T3.5, T2.2
**Priority:** P1
**Effort:** 4 hours

**Acceptance Criteria:**
- Connect endpoint redirects to Google consent screen with correct scopes (calendar.events).
- Callback exchanges code for tokens and stores them encrypted.
- Token refresh happens automatically before expiry.
- Disconnect revokes Google token and soft-deletes the connection.
- Invalid/revoked tokens are detected and user is prompted to reconnect.

**Testing Requirements:**
- Unit test: OAuth URL is constructed with correct scopes and redirect URI.
- Unit test: token exchange stores tokens in repository.
- Unit test: expired token triggers refresh flow.
- Unit test: revoked token returns appropriate error.
- Integration test: full OAuth flow (manual, requires Google account).

**SOLID/Pattern Notes:**
- **Adapter Pattern:** `GoogleCalendarAdapter` wraps the Google API behind an integration interface.
- **Template Method:** OAuth flow follows a fixed sequence (redirect → callback → store).

---

#### T15.2 — Calendar Event Sync

**Description:** Add methods to `GoogleCalendarAdapter`: `createEvent(task)`, `updateEvent(task)`, `deleteEvent(task)`. When a task with a scheduled time is approved, automatically create a calendar event. Map task fields to calendar event fields: title → summary, description → description, scheduled_date + scheduled_time → start/end (use effort_minutes for duration), goal name → calendar name. Store the Google event ID on the task for future updates/deletes.

**Dependencies:** T15.1, T8.2
**Priority:** P1
**Effort:** 3 hours

**Acceptance Criteria:**
- Approved task with scheduled time creates a Google Calendar event.
- Task title and description appear in the event.
- Event duration matches task effort_minutes.
- Completing or skipping a task updates/removes the event.
- Google event ID is stored on the task record.
- Calendar API failures are logged but don't block task approval.

**Testing Requirements:**
- Unit test: task fields map to correct calendar event fields.
- Unit test: complete task → event is deleted.
- Unit test: API failure is caught and doesn't affect task status.
- Integration test: create/update/delete cycle with Google Calendar API (manual).

**SOLID/Pattern Notes:**
- **Adapter Pattern:** Calendar API is abstracted behind an interface.
- **Observer Pattern:** Task status changes trigger calendar sync as a side effect.

---

### Epic 16: Buffer (Social Media) Integration

#### T16.1 — Buffer OAuth & Connection

**Description:** Implement Buffer OAuth 2.0 flow, following the same pattern as Google Calendar. Create `BufferAdapter` in `apps/server/src/integrations/buffer/`. Endpoints: connect, callback, disconnect. Store tokens in `integration_connections`. After connection, fetch the user's Buffer profiles (linked social accounts) and store in connection metadata.

**Dependencies:** T3.5, T2.2
**Priority:** P1
**Effort:** 3 hours

**Acceptance Criteria:**
- OAuth flow connects to Buffer and stores tokens.
- User's Buffer profiles (social accounts) are fetched and stored in metadata.
- Disconnect revokes and removes connection.
- Connection status is queryable via API.

**Testing Requirements:**
- Unit test: OAuth URL construction with correct scopes.
- Unit test: profile fetch and metadata storage.
- Integration test: full OAuth flow (manual, requires Buffer account).

**SOLID/Pattern Notes:**
- **Adapter Pattern:** Same integration interface as Google Calendar.

---

#### T16.2 — Social Media Post Scheduling

**Description:** Add methods to `BufferAdapter`: `schedulePost(content, profileIds, scheduledTime)`, `getQueue(profileId)`, `cancelPost(postId)`. When the agent composes a social media post (via `AgentService.composePost`) and the user approves it, the post is scheduled via Buffer. The approval flow for social media tasks includes a preview of the post content.

**Dependencies:** T16.1, T8.2, T7.3
**Priority:** P1
**Effort:** 3 hours

**Acceptance Criteria:**
- Approved social media task schedules a post via Buffer.
- Post content, profile, and time are sent to Buffer API.
- Scheduled post ID is stored for future cancellation.
- Rejecting a social media task cancels the scheduled post (if already scheduled).
- Buffer API failures are logged and surface as user-visible errors.

**Testing Requirements:**
- Unit test: approved social task → Buffer schedule call.
- Unit test: rejected task → Buffer cancel call.
- Unit test: API failure → error surfaced to approval flow.
- Integration test: schedule and cancel a post (manual, requires Buffer).

**SOLID/Pattern Notes:**
- **Observer Pattern:** Approval events trigger Buffer actions.
- **Adapter Pattern:** Buffer API behind integration interface.

---

### Epic 17: Apple Health / Google Fit Integration

#### T17.1 — Health Data Adapter

**Description:** Create `HealthAdapter` that reads fitness data on the mobile side using `react-native-health` (iOS/HealthKit) and `react-native-google-fit` (Android). Implement a unified interface: `getSteps(date)`, `getWorkouts(date)`, `getCalories(date)`, `getSleep(date)`. Data is read locally on the device and sent to the server as part of daily score calculation. Request permissions on the integrations settings screen.

**Dependencies:** T10.2, T6.3
**Priority:** P2
**Effort:** 5 hours

**Acceptance Criteria:**
- iOS: HealthKit permissions requested and data read successfully.
- Android: Google Fit permissions requested and data read successfully.
- Unified interface returns consistent data shape across platforms.
- Data is sent to server daily (during brief generation or on app open).
- Permissions denied gracefully — feature disabled without affecting rest of app.

**Testing Requirements:**
- Unit test: unified interface returns correct shape from mock platform data.
- Unit test: permission denied → graceful fallback.
- Manual test: data reads on physical iOS and Android devices.

**SOLID/Pattern Notes:**
- **Adapter Pattern:** Platform-specific health APIs behind a unified interface.
- **Strategy Pattern:** iOS strategy (HealthKit) vs. Android strategy (Google Fit).
- **Liskov Substitution:** Both platform adapters are interchangeable.

---

#### T17.2 — Fitness Task Auto-Completion

**Description:** Create a `FitnessTaskMatcher` service that checks health data against fitness tasks. If a user has a "Run 5K" task and their health data shows a 5K+ run that day, auto-complete the task. Matching rules: steps count tasks match if steps ≥ target, workout tasks match by type and duration, sleep tasks match by hours. Runs as part of the daily loop or on-demand when the user opens the app.

**Dependencies:** T17.1, T6.1
**Priority:** P2
**Effort:** 3 hours

**Acceptance Criteria:**
- Matching identifies fitness tasks that health data satisfies.
- Auto-completion is suggested (not forced) — user sees a "Did you complete this?" prompt.
- Matching rules are configurable per task type.
- Partial matches are noted (e.g., "You ran 3K out of 5K target").

**Testing Requirements:**
- Unit test: 5K run data matches "Run 5K" task.
- Unit test: 3K run data partially matches with note.
- Unit test: sleep data matches sleep task by hours.
- Unit test: no matching data → no auto-completion suggested.

**SOLID/Pattern Notes:**
- **Strategy Pattern:** Different matching strategies for different fitness metrics.
- **Rule Engine Pattern:** Matching rules are data-driven.

---

### Epic 18: Push Notifications

#### T18.1 — Push Token Registration

**Description:** Implement push notification token management. Mobile side: use `expo-notifications` to request permission and get the push token. Send the token to `POST /api/users/me/push-token`. Server side: store the token in a new `push_tokens` table (`user_id`, `token`, `platform`, `created_at`). Handle token updates (device token can change).

**Dependencies:** T10.2, T1.2
**Priority:** P1
**Effort:** 2 hours

**Acceptance Criteria:**
- Permission is requested on first app launch (after onboarding).
- Token is sent to server and stored.
- Token update replaces old token (not duplicates).
- Permission denied is handled gracefully.
- Supports both iOS (APNs) and Android (FCM).

**Testing Requirements:**
- Unit test: token registration API stores token.
- Unit test: duplicate token is updated, not duplicated.
- Manual test: permission flow on iOS and Android.

**SOLID/Pattern Notes:**
- **Repository Pattern:** Push token storage via `PushTokenRepository`.

---

#### T18.2 — Notification Delivery Service

**Description:** Create `NotificationService` that sends push notifications via Expo's push service. Notification types: (1) Daily brief ready ("Your daily brief is ready! You have 5 tasks today."), (2) Approval needed ("A new task needs your approval."), (3) Streak at risk ("Complete one more task to keep your 7-day streak!"), (4) Goal milestone reached ("You completed the 'Launch MVP' milestone!"). Each type has a template. The service is called by the daily loop and approval system.

**Dependencies:** T18.1, T9.2
**Priority:** P1
**Effort:** 3 hours

**Acceptance Criteria:**
- Each notification type sends with correct title, body, and data payload.
- Tapping a notification deep-links to the relevant screen (brief, approvals, goals).
- Notifications are sent via Expo Push API.
- Failed sends are logged, not retried (push is best-effort).
- Users can opt out of specific notification types (stored in user profile).

**Testing Requirements:**
- Unit test: each notification type generates correct payload.
- Unit test: deep link data is included for each type.
- Unit test: opted-out notification types are not sent.
- Manual test: notifications arrive on physical devices; tapping opens correct screen.

**SOLID/Pattern Notes:**
- **Template Method Pattern:** All notifications follow: build payload → check opt-out → send.
- **Observer Pattern:** System events (brief generated, approval needed) trigger notifications.
- **Strategy Pattern:** Different notification strategies for different event types.

---

## Phase 6: Polish & Launch (Week 8–9)

### Epic 19: Testing & Bug Fixes

#### T19.1 — Server Integration Test Suite

**Description:** Write comprehensive integration tests for all critical server paths: (1) Auth flow — signup → login → access protected route → refresh token → access again. (2) Goal creation — select template → create goal → verify milestones. (3) Daily loop — create test user → run loop → verify tasks, brief, scores. (4) Approval flow — generate task → auto-classify → approve/reject → verify state. Use Supabase local instance for tests. Target: 80% code coverage on services and repositories.

**Dependencies:** All server epics (E1–E9)
**Priority:** P0
**Effort:** 8 hours

**Acceptance Criteria:**
- Test suite runs against local Supabase in CI.
- All four critical paths have end-to-end integration tests.
- Code coverage ≥ 80% on `services/` and `repositories/`.
- Tests are isolated — each test starts with clean state.
- Test suite completes in under 3 minutes.

**Testing Requirements:**
- This IS the testing task. Verify coverage with `jest --coverage`.

**SOLID/Pattern Notes:**
- **Test Fixture Pattern:** Reusable fixtures for users, goals, tasks.
- **Builder Pattern:** Test data builders for complex objects.

---

#### T19.2 — Mobile Component & Screen Tests

**Description:** Write tests for critical mobile components and screens using React Native Testing Library. Test: (1) Auth screens — form validation, error display, loading states. (2) Dashboard — renders all sections with mock data, empty states. (3) Approval cards — approve/reject actions, optimistic updates. (4) Onboarding — flow navigation, goal creation. Target: all interactive components have at least one test.

**Dependencies:** All mobile epics (E10–E14)
**Priority:** P0
**Effort:** 6 hours

**Acceptance Criteria:**
- All interactive components have at least one test.
- Form validation tests cover edge cases.
- Optimistic update and rollback behavior is tested.
- Tests run in CI without device/simulator.

**Testing Requirements:**
- This IS the testing task. Verify with `jest --coverage`.

**SOLID/Pattern Notes:**
- **Test-per-component Pattern:** Each component has a co-located `.test.tsx` file.

---

#### T19.3 — End-to-End Critical Path Testing

**Description:** Write E2E tests using Detox (or Maestro) for the three most critical user flows: (1) New user: signup → onboarding → select template → see dashboard with brief. (2) Daily use: open app → view brief → complete task → see score update. (3) Approval: receive pending task → approve → task appears in today's list. These tests run on a CI simulator.

**Dependencies:** T19.1, T19.2
**Priority:** P1
**Effort:** 6 hours

**Acceptance Criteria:**
- Three E2E tests pass on iOS simulator in CI.
- Tests use a test Supabase environment with seed data.
- Each test completes in under 60 seconds.
- Screenshots are captured on failure for debugging.

**Testing Requirements:**
- This IS the testing task. Verify in CI pipeline.

**SOLID/Pattern Notes:**
- **Page Object Pattern:** Screen interactions are encapsulated in page objects for reuse.

---

#### T19.4 — Performance & Load Testing

**Description:** Test server performance: (1) Daily loop processing 1000 users — measure duration and identify bottlenecks. (2) API endpoint latency — p50 and p95 for all endpoints under 50 concurrent users. (3) OpenRouter integration — measure response times and token costs for each agent action. Use `k6` or `autocannon` for load testing. Document results and optimize any endpoints exceeding 500ms p95.

**Dependencies:** T19.1
**Priority:** P1
**Effort:** 4 hours

**Acceptance Criteria:**
- Daily loop processes 1000 users in under 30 minutes.
- All API endpoints < 200ms p50, < 500ms p95.
- OpenRouter calls < 10 seconds p95.
- No memory leaks during sustained load (30-minute soak test).
- Results documented in a performance report.

**Testing Requirements:**
- Load test scripts committed to `apps/server/tests/load/`.
- Results saved as JSON artifacts in CI.

**SOLID/Pattern Notes:**
- **Profiling Pattern:** Identify and optimize hot paths.

---

#### T19.5 — Bug Fix Sprint & Regression

**Description:** Dedicated time for fixing bugs discovered during testing. Priority: (1) P0 — any auth or data loss bugs. (2) P1 — daily loop failures, incorrect scoring. (3) P2 — UI polish, edge cases. Re-run the full test suite after each fix to catch regressions. All fixes must include a regression test.

**Dependencies:** T19.1, T19.2, T19.3
**Priority:** P0
**Effort:** 8 hours

**Acceptance Criteria:**
- All P0 bugs fixed with regression tests.
- All P1 bugs fixed with regression tests.
- P2 bugs triaged — fix or defer with documentation.
- Full test suite passes after all fixes.

**Testing Requirements:**
- Every bug fix includes a test that reproduces the bug before the fix and passes after.

**SOLID/Pattern Notes:**
- **Regression Testing Pattern:** Bug → test → fix → verify test passes → full suite green.

---

### Epic 20: App Store Submission

#### T20.1 — App Store Assets & Metadata

**Description:** Prepare App Store (iOS) and Google Play assets: (1) App icon (1024×1024) following Lyfestack palette. (2) Screenshots — 6.7" and 5.5" for iOS, phone and tablet for Android. Create at least 5 screenshots showing: onboarding, dashboard, goals, approvals, brief. (3) App description (short and long). (4) Keywords/tags. (5) Privacy policy URL. (6) Category selection (Productivity).

**Dependencies:** T19.5
**Priority:** P0
**Effort:** 4 hours

**Acceptance Criteria:**
- App icon renders correctly at all required sizes.
- Screenshots are high quality and show key features.
- Description is compelling and includes key features.
- Privacy policy is hosted and accessible.
- All App Store Connect and Google Play Console fields are populated.

**Testing Requirements:**
- Visual review: icon and screenshots on device and in store listing preview.
- Link verification: privacy policy URL resolves.

**SOLID/Pattern Notes:**
- N/A (marketing/ops task).

---

#### T20.2 — Production Environment Setup

**Description:** Set up production infrastructure: (1) Supabase production project with production database. (2) Railway production deployment with production env vars. (3) Sentry production DSN for error tracking. (4) Verify all production environment variables are set. (5) Run migrations on production database. (6) Configure production domain and SSL. (7) Set up monitoring dashboard (Railway metrics + Sentry alerts).

**Dependencies:** T1.6, T19.5
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Production Supabase instance is running with all migrations applied.
- Server is deployed on Railway production and health check passes.
- Sentry captures errors in production.
- All env vars are set (verified by config loader).
- HTTPS is enforced.
- Monitoring dashboard shows server health metrics.

**Testing Requirements:**
- Smoke test: hit production health endpoint.
- Smoke test: signup → login → create goal on production.
- Verify Sentry captures a test error.

**SOLID/Pattern Notes:**
- **Infrastructure as Code:** All config is reproducible and documented.

---

#### T20.3 — iOS App Store Submission

**Description:** Build the production iOS binary using EAS Build (`eas build --platform ios --profile production`). Submit to App Store Connect. Complete the app review questionnaire (no IDFA tracking, no third-party login-only). Submit for review. Address any review rejections promptly.

**Dependencies:** T20.1, T20.2
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Production IPA is built with correct signing and provisioning.
- App is submitted to App Store Connect with all metadata.
- Encryption compliance questionnaire is completed.
- App passes Apple review (may require iteration).

**Testing Requirements:**
- TestFlight: install production build on physical device, run critical path manually.
- Verify: deep links, push notifications, OAuth redirects work in production binary.

**SOLID/Pattern Notes:**
- N/A (release ops task).

---

#### T20.4 — Google Play Store Submission

**Description:** Build the production Android AAB using EAS Build (`eas build --platform android --profile production`). Create the Google Play listing. Upload the AAB. Complete the content rating questionnaire. Set up a closed testing track first, then promote to production.

**Dependencies:** T20.1, T20.2
**Priority:** P0
**Effort:** 3 hours

**Acceptance Criteria:**
- Production AAB is built and signed.
- Google Play listing is complete with all assets and metadata.
- Content rating questionnaire is completed.
- App is published to closed testing track.
- Promoted to production after 24 hours of closed testing.

**Testing Requirements:**
- Internal testing: install from Play Store on physical device, run critical path.
- Verify: deep links, push notifications, OAuth redirects work on production build.

**SOLID/Pattern Notes:**
- N/A (release ops task).

---

## Appendix: Effort Summary

### By Phase

| Phase | Epics | Tasks | Total Hours |
|-------|-------|-------|-------------|
| Phase 1: Foundation | E1–E3 | T1.1–T3.6 | 54.5 |
| Phase 2: Core Engine | E4–E6 | T4.1–T6.4 | 40 |
| Phase 3: Agent System | E7–E9 | T7.1–T9.3 | 35 |
| Phase 4: Mobile App | E10–E14 | T10.1–T14.2 | 51.5 |
| Phase 5: Integrations | E15–E18 | T15.1–T18.2 | 26 |
| Phase 6: Polish & Launch | E19–E20 | T19.1–T20.4 | 45 |
| **Total** | **20** | **50** | **252** |

### By Priority

| Priority | Tasks | Hours | Description |
|----------|-------|-------|-------------|
| P0 | 35 | ~185 | Must-have for launch |
| P1 | 12 | ~52 | Important, can defer briefly |
| P2 | 3 | ~13 | Nice-to-have, can launch without |

### Critical Path Timeline

```
Week 1:  T1.1 → T1.2, T1.3, T1.4 (parallel) → T1.5, T1.6
Week 2:  T2.1 → T2.2 → T2.3 → T2.4 → T2.5 | T3.1 → T3.2 → T3.3 → T3.4 → T3.5 → T3.6
Week 3:  T4.1 → T4.2, T4.3 (parallel) → T4.4 | T5.1 → T5.2 → T5.3
Week 4:  T6.1 → T6.2 → T6.3 → T6.4
Week 5:  T7.1 → T7.2 → T7.3 | T10.1, T10.2, T10.3, T10.4 (parallel start)
Week 6:  T8.1 → T8.2 → T8.3 | T9.1 → T9.2 → T9.3 | T10.5, T11.1, T11.2
Week 7:  T12.1 → T12.2, T12.3 | T13.1 → T13.2 | T15.1 → T15.2 | T16.1 → T16.2
Week 8:  T14.1, T14.2 | T17.1 → T17.2 | T18.1 → T18.2
Week 9:  T19.1 → T19.2 → T19.3 → T19.4 → T19.5 → T20.1 → T20.2 → T20.3, T20.4
```

### Parallelization Opportunities

The following task groups can be worked on simultaneously by different developers:

- **Server + Mobile:** Phase 3 (Agent/backend) and Phase 4 (Mobile UI) run in parallel (Week 5–8).
- **Integrations:** E15 (Calendar), E16 (Buffer), E17 (Health) are independent of each other.
- **Testing:** Server tests (T19.1) and mobile tests (T19.2) can run in parallel.
- **App Store:** iOS (T20.3) and Android (T20.4) submissions are independent.

### Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenRouter rate limits or downtime | Daily loop fails for AI features | Fallback to BasePlanningEngine and non-AI briefs (built into T5.2, T6.2) |
| App Store rejection | Launch delayed | Submit early to closed testing; address feedback iteratively |
| Supabase scaling limits | Performance degradation | Monitor via T9.3; database indexes optimized in T3.x |
| Buffer API changes | Social media integration breaks | Adapter pattern isolates changes; feature flag to disable |
| Scope creep | Timeline slips | P2 tasks are deferrable; strict scope for Phase 1–4 |

---

*This plan is designed to be executed incrementally. Each task can be picked up independently (once dependencies are met), tested in isolation, and merged. The critical path through E1 → E3 → E4 → E5 → E7 → E8 → E9 must be protected — any slippage here delays the entire project.*
