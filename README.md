# PlayerScope AI

AI competitor CX intelligence for iGaming. PlayerScope shows where competitors beat you in the player journey, why they win, and what your brand should do next.

Full product spec: [`PLAYERSCOPE_SPEC.md`](./PLAYERSCOPE_SPEC.md)

## Status: Phase 1 (mocked demo)

This is the Phase 1 build from the spec: a polished UI running on mocked analysis data for Stake, Rainbet, bet365 and "Your Brand". The architecture (types, data layer, analysis pipeline steps) is structured so real Supabase persistence, Sanity heuristics, Browserbase/Playwright capture and LangGraph orchestration can be added in later phases without reshaping the UI.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What works

- **Landing page** (`/`) — product promise, how it works, flagship metrics
- **Dashboard** (`/dashboard`) — project list, seeded with a demo project
- **New project** (`/projects/new`) — brand + competitor URLs, market, products, journeys, analysis mode; created projects persist in `localStorage`
- **Analysis progress** (`/projects/[id]/analyzing`) — simulated pipeline mirroring the real LangGraph workflow steps
- **Project dashboard** (`/projects/[id]/…`):
  - `overview` — brand cards, journey radar, Retention Loop and Cashier Trust rankings, strategy read, top opportunities
  - `journeys` — journey scorecard plus deep dives (findings, step timelines, heuristic scores)
  - `features` — feature matrix with category filters and priorities
  - `retention` — Retention Loop Score breakdown and promo-led vs loop-led read
  - `cashier` — Cashier Trust Index breakdown with gap-to-best
  - `evidence` — evidence library (placeholder captures in demo mode)
  - `report` — board-ready executive report with print/PDF export
  - `action-plan` — recommendations grouped into fix now / improve next / strategic bets

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (Base UI primitives, dark-mode-first theme)
- Recharts via the shadcn Chart component
- Mock data layer in `src/lib/mock-data.ts`, client store in `src/lib/project-store.ts`

## Compliance posture

The product is positioned as compliant competitor research and authorised mystery shopping. Analysis stops at CAPTCHAs, OTP, KYC, age verification, payment confirmation and any access-control barrier. No real deposits, withdrawals or bets are placed.

## Next phases (see spec)

2. Supabase data model + real saved projects
3. Sanity heuristics + scoring engine
4. Browserbase/Playwright evidence capture
5. LangGraph orchestration + AI scoring and report generation
6. Assisted/manual/logged-in modes, exports, scheduled reports
