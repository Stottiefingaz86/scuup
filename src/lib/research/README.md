# Research (internal product tool)

Timed journey teardowns, competitor matrices, and CRM email watch for the
product team.

## Local

- Landing: http://localhost:3000/research
- Projects: http://localhost:3000/research/projects

## Production subdomain

Point `research.scuup.io` at the same Vercel project. `src/proxy.ts` rewrites that host into `/research/*`.

## Layout

| Path | Role |
|------|------|
| `src/app/research/` | UI only |
| `src/lib/research/` | Types, journey templates, client store |
| `localStorage` key `scuup-research-projects-v1` | Draft data |

## Flows

1. **Sign up all brands** — accounts + OTP per competitor
2. **Deposit all brands** — each address in Notifications; pay separately, mark paid each
3. Agent continues with timed stages: deposit confirm → casino lobby → game launch → first bet
4. All stages recorded: time, clicks, wait, fields (DOM count), redirects, errors, friction type/severity, owner
5. Top 3 friction ranked from measured time + effort + wait + severity
6. Benchmark tab: teardown totals + own vs best-competitor gap ratios
7. Returning login is a separate timed map

## Trust model

**Hard (instrumented):** stage start/end, time, wait, field count, click counts, IMAP wait, deposit→bet deltas, error banners.
**Observed (model, grounded in screen):** friction text, impact, type, qualitative feature cells.
**Human:** CAPTCHA, sending crypto, workshop notes.

## Strategy lens

Research supports journey audit + competitor stopwatch teardown:

1. **Where we want to go** — widest bet, most rewarding play, straightest fund/payout
2. **How** — own activation end-to-end; first casino stake the moment funds clear; Time to stake ≤12 min
3. **Gaps** — where peers are faster on onboarding, and where they win on reward frequency

OKRs live in `okrs.ts`; strategy pillars / hypotheses in `strategy.ts`.

## Verification inbox

Uses `GMAIL_IMAP_USER` / `GMAIL_IMAP_APP_PASSWORD`. Default persona: `scuup678@gmail.com`.

Peek: `GET /api/research/inbox?peek=1`  
Teardown: `POST /api/research/teardown` → poll `GET /api/research/teardown?jobId=`
