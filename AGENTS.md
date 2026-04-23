# AGENTS.md

## Purpose
Lyfestack is a guided goal-execution app: users pick a goal template, Lyfestack builds a plan, the server generates daily briefs/tasks, and the mobile app drives execution and approvals.

This file is for Codex and other repo agents. Treat it as the fastest accurate entry point into the codebase.

## Repo Shape
- `apps/mobile` — Expo Router React Native app
- `apps/server` — Express + TypeScript API, planning engine, daily loop, OpenClaw bridge
- `packages/shared` — shared enums, constants, and API/domain types (`@lyfestack/shared`)
- `supabase` — schema and migrations
- `docs` — design docs and roadmap; useful, but some sections are stale
- `MEMORY.md` — project memory / decisions snapshot

## Actual Current Architecture
- Mobile auth root is `apps/mobile/app/_layout.tsx`.
- Unauthenticated users land in `/onboarding`; authenticated users redirect to `/(auth)/(drawer)/dashboard`.
- Main app nav is a **drawer**, not tabs. See `apps/mobile/app/(auth)/(drawer)/_layout.tsx`.
- Mobile discovers the backend/OpenClaw bridge through `GET /api/openclaw/status`.
- Server entry point is `apps/server/src/index.ts`.
- Server exposes a mix of legacy non-`/api` routes and newer `/api/*` routes.
- `templateService.getAll/getById/getByCategory` are **async** and return promises.

## Key Files
- `apps/server/src/index.ts` — route registration, plan preview SSE, startup hooks
- `apps/server/src/services/goal-builder.service.ts` — AI-guided goal builder sessions
- `apps/server/src/services/guided-setup.service.ts` — guided question flow + plan generation SSE
- `apps/server/src/services/goal.service.ts` — goal creation and template-based task generation
- `apps/server/src/integrations/openclaw/openclaw.service.ts` — OpenClaw CLI/config bridge
- `apps/server/src/services/routines.service.ts` — hook/heartbeat routine management
- `apps/mobile/app/(auth)/(drawer)/dashboard/index.tsx` — current main user dashboard
- `apps/mobile/services/api.ts` — general API/auth base handling
- `apps/mobile/services/openclaw.api.ts` — OpenClaw-specific client/discovery logic

## Commands
From repo root:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm test`

Package-level commands often give better signal than root Turbo commands when debugging:
- `cd apps/server && npm run dev`
- `cd apps/server && npm run typecheck`
- `cd apps/server && npm run test -- --runInBand`
- `cd apps/mobile && npm run start`
- `cd apps/mobile && npm run typecheck`
- `cd apps/mobile && npm run lint`

## Working Rules
- Verify behavior against live code before trusting `docs/PROJECT_PLAN.md` or `docs/SYSTEM_DESIGN.md`.
- Preserve user changes. As of 2026-04-23, the repo had an uncommitted modification in `apps/mobile/services/openclaw.api.ts`.
- Keep client/server contract changes aligned through `@lyfestack/shared` where possible.
- OpenClaw is a first-class integration path in the current product. Do not assume older OpenRouter-only flows are the source of truth.
- Read `MEMORY.md` before large changes; it contains product and architecture decisions not all reflected in README/docs.

## Audit Snapshot (2026-04-23)
These are current high-signal issues worth knowing before any major work:
1. `apps/server/src/services/goal-builder.service.ts` approves a goal using only title/summary and ignores `modifications`; then `apps/server/src/services/goal.service.ts` regenerates tasks from the template/planning engine. The AI-generated plan preview and user edits are effectively discarded on save.
2. `templateService.getById()` is async, but several server call sites treat it like a synchronous value (`apps/server/src/index.ts`, `apps/server/src/services/guided-setup.service.ts`, `apps/server/src/services/goal.service.ts`). This currently breaks typecheck and likely breaks runtime plan generation paths.
3. `apps/server/src/routes/routines.routes.ts` calls `updateRoutine`, `runNow`, and `getRunHistory`, but `apps/server/src/services/routines.service.ts` does not implement them. The route also calls `toggleRoutine` with the wrong signature.
4. `apps/server/src/integrations/openclaw/openclaw.service.ts` imports `usageTracker`, but `apps/server/src/integrations/openclaw/usage-tracker.ts` exports standalone functions, not that object.
5. Both `apps/server` and `apps/mobile` currently fail `tsc --noEmit`.

## Verification Notes
- Root `turbo run ...` commands can fail in restricted environments because Turbo wants to write log/cache files.
- Jest may fail in restricted environments because Watchman tries to touch protected paths. If that happens, rerun with Watchman disabled or from an environment with normal filesystem access.
