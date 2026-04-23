# Lyfestack — Project Memory

> Auto-updated incrementally. This file tracks decisions, architecture, and current state.

---

## Product Identity
- **Name:** Lyfestack
- **Tagline:** "Stack your days. Build your lyfe."
- **What it is:** A guided, opinionated goal execution system powered by OpenClaw AI agents
- **Core principle:** Reduce freedom, increase clarity. Don't give users power — give them direction + controlled execution.

## Brand
- **Palette:** Stripe/Vercel — black (#000), white (#EDEDED), accent (#0EA5E9), success (#22C55E), error (#EF4444)
- **Font:** Outfit (Google Fonts)
- **Modes:** Dark (default) + Light
- **Logo:** "LS" in accent-colored square

## Tech Stack
- **Mobile:** React Native (Expo Router), Zustand stores, TypeScript
- **Backend:** Express + TypeScript, layered architecture (Controller → Service → Repository)
- **Database:** Supabase (PostgreSQL + Storage + Auth)
- **Hosting:** Railway (backend), Supabase (DB)
- **AI:** OpenClaw (sole brain — no direct OpenRouter/OpenAI calls from backend)
- **Monorepo:** Turborepo with npm workspaces
- **Repo:** github.com/InnovsoftInc/Lyfestack
- **Primary branch:** `main` (not `master`)

## Architecture Decisions
- **OpenClaw is the only AI layer** — backend is a thin proxy, no built-in agents
- **Server-side daily loop** — all background work on server, mobile is a display layer
- **Auto-detect timezone** from device on every launch
- **Tiered approval** — auto for low-stakes, mandatory for public/financial actions
- **In-memory fallback** — when Supabase is unavailable, goals stored in memory with warning log
- **Templates in DB** — seeded via migration, TemplateService queries Supabase first, falls back to registry
- **Goal Builder** — multi-turn OpenClaw conversation, not static forms

## Supabase Project
- **URL:** tlwutbfmwjuwshziqcpc.supabase.co
- **Auth:** Email + password (Google/Apple planned)
- **RLS:** Service role bypass policies added (migration 010)
- **Tables:** users, goals, goal_templates, plans, tasks, daily_briefs, agent_actions, milestones
- **Migrations:** 001-011 in apps/server/src/db/migrations/

## OpenClaw Integration
- **Gateway:** ws://localhost:18789 (WebSocket RPC)
- **Config:** ~/.openclaw/openclaw.json
- **Agents:** ~/.openclaw/agents/
- **Skills:** ~/.openclaw/skills/ (claude-code, codex-code)
- **Auth profiles:** ~/.openclaw/agents/main/agent/auth-profiles.json
- **Mobile connects via:** Lyfestack backend → OpenClaw gateway (not direct)
- **Auto-discovery:** scans local network IPs in parallel to find the backend

## Goal Templates (in DB)
1. Productivity (tpl-productivity-focus)
2. Self Improvement
3. Solo Business (tpl-solo-business)
4. Social Media
5. Fitness (tpl-fitness-beginner)
6. + 4 more seeded in migration 011

## App Navigation (Mobile)
- Drawer-based navigation (not tabs)
- Screens: Dashboard, Goals, Approvals, Agents, Profile
- Goal Setup: /goal-setup/ (template picker → guided AI questions → editable plan preview → approve)
- Onboarding: /onboarding/ (welcome → goals → diagnostic → preview → auth signup)
- Login: /login (standalone, NOT part of onboarding)
- Connect OpenClaw: /(auth)/connect-openclaw

## Feature Status

### Done
- [x] Monorepo scaffold (T1.1)
- [x] Supabase DB setup with migrations (T1.2)
- [x] Authentication - Supabase Auth (T2.1)
- [x] Core repositories (T3.1)
- [x] Goal template system — 5 templates + DB seeding (T4.1)
- [x] Planning engine — Strategy pattern (T4.2)
- [x] Task scoring algorithm (T5.1)
- [x] Daily loop engine with cron (T5.2)
- [x] OpenClaw agent bridge (gateway WebSocket RPC)
- [x] Mobile app screens (dashboard, goals, approvals, agents, profile)
- [x] API integration (mobile ↔ backend)
- [x] Push notifications (Expo Push API)
- [x] Google Calendar integration (OAuth)
- [x] Buffer integration (OAuth)
- [x] Cron jobs (daily brief, streak check)
- [x] OpenClaw mobile bridge (view, create, chat with agents)
- [x] Connection setup (auto-discover + manual IP)
- [x] Agent chat with history, model selector, fallbacks
- [x] Standalone login screen
- [x] Goal builder service (multi-turn OpenClaw conversation)
- [x] Editable plan preview
- [x] RLS policy fixes for DB persistence
- [x] Templates in DB (seeded via migration)
- [x] OpenClaw refactor (removed built-in AI, all through OpenClaw)
- [x] OpenClaw Settings screen (models, keys, coding tool toggle)
- [x] Usage/Token tracking screen
- [x] Codex-code skill for OpenClaw

### In Progress
- [ ] Skills Manager screen
- [ ] Routines (cron job management from mobile)
- [ ] Activity Feed (real-time OpenClaw activity log)

### Build Recommendations
- [x] **Chat model selector** — now dynamic, fetched from `getConfig().availableModels`
- [x] **Tool usage visibility in chat** — tool activity pill shown during streaming
- [x] **Real SSE streaming** — XHR-based SSE replaces fake POST fallback
- [ ] **Activity Feed** — aggregate hook events, agent messages, automation runs, heartbeat pings into a real-time timeline
- [ ] **System health dashboard** — gateway up/down, last heartbeat, channel connection status (Telegram/Slack), model availability
- [ ] **Hook manager** — view and create webhook mappings from mobile (Gmail, Calendly triggers)
- [ ] **Plugin toggles** — enable/disable OpenClaw plugins from mobile without editing JSON

### Known Issues
- git push from code sessions hangs on InnovsoftInc org — user pushes manually from terminal
- In-memory goal store doesn't persist across server restarts — need Supabase migrations run
- OpenClaw gateway must be running for AI features to work
- OpenRouter key may hit monthly limits — needs credits
- Primary branch is `main`, not `master`

## Key Files
- `apps/server/src/index.ts` — Express server entry, all routes mounted
- `apps/server/src/services/goal-builder.service.ts` — Multi-turn AI goal builder
- `apps/server/src/services/goal.service.ts` — Goal CRUD + plan generation
- `apps/server/src/integrations/openclaw/openclaw.service.ts` — OpenClaw bridge
- `apps/server/src/integrations/openclaw/usage-tracker.ts` — Token/cost tracking
- `apps/server/src/templates/template.service.ts` — Template registry + DB query
- `apps/server/src/engine/` — Planning, scoring, daily loop engines
- `apps/mobile/app/(auth)/(drawer)/` — All main app screens
- `apps/mobile/stores/` — Zustand stores (auth, goals, briefs, openclaw, guided-setup)
- `apps/mobile/services/` — API clients (api, goals, briefs, openclaw, guided-setup)
- `packages/shared/` — Shared TypeScript types, enums, constants

## User (Minte)
- Email: mintetemple@gmail.com
- GitHub: Dwayne01 (personal), InnovsoftInc (org)
- Apple Developer: innovsoftinc
- Prefers: incremental development, SOLID principles, dark premium UI, no one-shotting
- Also runs: FaithNote, ScreenAI, OpenClaw
