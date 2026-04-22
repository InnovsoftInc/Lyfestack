# Lyfestack

> Stack your days. Build your lyfe.

Lyfestack is a guided goal execution app that combines structured goal templates with an AI agent to help users plan, execute, and stay accountable to their goals.

## Architecture

```
Lyfestack/
├── apps/
│   ├── mobile/     # React Native (Expo) — iOS & Android
│   └── server/     # Node.js/TypeScript REST API
├── packages/
│   └── shared/     # Shared types, enums, constants (@lyfestack/shared)
└── supabase/       # DB migrations & local dev config
```

### Core Loop

```
User selects goal template
  → AI generates personalized plan
    → Daily loop produces brief
      → User approves/executes tasks
        → System scores progress
          → Repeat
```

### Design Language

- **Colors:** Black `#000000` · White `#FFFFFF` · Sky Blue `#0EA5E9`
- **Font:** Outfit (Google Fonts)
- **Aesthetic:** Stripe/Vercel — clean, spacious, professional

### Backend Layers

```
HTTP Request → Controller → Service → Repository → Supabase
```

- Controllers validate input (Zod) and format responses
- Services own business logic — no DB knowledge
- Repositories own data access — no business logic
- Cross-cutting concerns live in middleware

## Getting Started

### Prerequisites

- Node.js 20 LTS (`nvm use`)
- npm 10+

### Setup

```bash
# Install all workspace dependencies
npm install

# Copy and fill environment variables
cp .env.example apps/server/.env

# Start backend in dev mode
cd apps/server && npm run dev

# Start mobile in dev mode
cd apps/mobile && npx expo start
```

### Build

```bash
# Build all workspaces
npm run build

# Typecheck all workspaces
npm run typecheck

# Lint all workspaces
npm run lint
```

## Workspaces

| Package | Description | Key deps |
|---------|-------------|----------|
| `@lyfestack/shared` | Shared types, enums, constants | TypeScript |
| `@lyfestack/server` | REST API + AI agent engine | Express, pino, zod, Supabase |
| `@lyfestack/mobile` | iOS/Android app | Expo, React Native, Zustand |

## Environment Variables

See `.env.example` for the full list. Required for server startup:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENROUTER_API_KEY`

## License

Private — InnovsoftInc
