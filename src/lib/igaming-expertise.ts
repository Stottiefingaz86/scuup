/**
 * The analyst's iGaming domain expertise, structured per journey.
 *
 * Three layers compose into every scoring prompt via expertiseFor():
 * 1. CORE — how the category leaders win and vertical conventions that
 *    generic UX heuristics mis-score.
 * 2. JOURNEY_EXPERTISE — what an operator-side expert looks for in THIS
 *    specific journey.
 * 3. CALIBRATION — concrete anchors for what 85+ execution looks like,
 *    grounded in the leaders (Stake, Winna, Rollbit, Rainbet, Shuffle).
 */

const CORE = `IGAMING DOMAIN BRIEF — read carefully before scoring. You are judging against the standards of the most successful operators in this vertical, not against generic web-UX conventions.

WHY THE CATEGORY LEADERS WIN (Stake, Rollbit, Winna, Rainbet, Shuffle):
- No traditional welcome bonus. Instead: permanent rakeback — a % of house edge returned on EVERY bet, win or lose, no expiry, no wagering requirements. An intellectually honest model that rewards volume, and players know it.
- Lifetime VIP ladders (e.g. Stake: Bronze $10K wagered → Obsidian $1B across ~16 levels). Progress never resets, every bet counts forever. Transparent thresholds let players model their climb — predictability drives commitment.
- Layered reward cadence: rakeback (continuous) + weekly boosts + monthly bonuses + daily reloads at higher tiers (sized on recent 7-42 day activity, MORE generous after losses) + one-time level-up bonuses + VIP Telegram drops. Multiple overlapping reward moments keep the next payout always near.
- Dedicated VIP hosts at high tiers, bespoke bonuses, fast-tracked withdrawals. Top-tier value-back reaches 12-18% of theoretical loss — industry-leading and a real competitive moat.
- Instant crypto rails: deposit-to-play and withdrawal speed measured in seconds/minutes. Withdrawal speed is THE trust flywheel in this vertical.
- Provably fair in-house originals: trust made mathematical, plus predictable low house edge that fuels VIP volume.

VERTICAL DESIGN CONVENTIONS — deliberate strengths, NEVER penalize as flaws:
- Modal-first UX: cashier, bonus center, and VIP hub open as overlays instead of separate pages. This keeps the player inside their game session — interrupting play is the cardinal sin. A rewards hub in a modal is best practice, not "tucked away".
- Tier-locked reward previews ("Reach Silver", "Reach Gold"): showing locked rewards is the aspiration engine. The visible-but-locked gap is what drives the climb. Locks are only a weakness when the path to unlock is genuinely unexplained.
- Dense game grids, dark themes, live win tickers/feeds: volume, energy and social proof are the category language players expect.
- Status-transfer / VIP-match CTAs ("transfer your status from another casino"): a sophisticated acquisition weapon aimed at poaching competitors' highest-value players. A prominent one is a strength.
- Gamification layers (levels, chests, races, raffles, challenges, streaks): depth here is a retention asset, provided each mechanic communicates its trigger.

LOGGED-OUT CAVEAT: personal progress (rakeback balance, level progress bars, reload sizes) only renders after login. When judging a logged-out view, do not fail the site for missing personal progress — note it as requiring an authenticated session instead.

RETENTION MODELS — score LOOP DEPTH, not whether loyalty exists. Many regulated US/global books (BetOnline, FanDuel, bet365) ARE loyalty- and rewards-led — VIP tiers, points, reloads, cashback — they just execute weaker than crypto leaders. Do NOT label them "promo-only" because the hero shows a welcome offer.

CRYPTO LOOP-LED (Stake, Rollbit, Winna, Rainbet-class) — the benchmark:
- Permanent rakeback/rebate on every bet, lifetime VIP ladder, layered cadence (daily/weekly/monthly/level-up).
- Gamification depth: races, missions, chests, challenges, leaderboards tied to play volume — retention IS the product.
- Modal bonus centers that keep the player in-session; locked tier previews as aspiration engine.

LOYALTY-LED / REGULATED (BetOnline, FanDuel, bet365-class) — same strategic intent, weaker execution:
- Real ongoing rewards: VIP/points programs, tiered benefits, reload bonuses, sports boosts, cashback — often under Promotions, VIP, or Rewards nav.
- Welcome offer may dominate acquisition, but logged-in retention is still rewards-oriented. Score how well the loop works, not whether a loop exists.
- Typical gaps vs Stake: opaque point conversion, tiers that feel cosmetic, campaign cadence instead of systemic value-back, thin gamification, progress hidden until login, WR/bonus-cash opacity.
- Advice should be "deepen the loop" (cadence, transparency, progress, gamification) — NOT "add a loyalty program" when one is already present.

HYBRID: welcome promo surface PLUS a visible VIP/points/reload layer — BetOnline and many regulated brands sit here. Score each half; a promo hero does not mean the brand is promo-only.

PROMO PAGE ONLY (no loop): campaign carousel and T&Cs with no tiers, points, recurring value mechanics, or VIP path — reserve this label for sites that truly lack an ongoing rewards system.`;

/** Journey-specific expert lens. Falls back to landing for unknown areas. */
const JOURNEY_EXPERTISE: Record<string, string> = {
  landing: `LANDING EXPERTISE — first impression is a filtering decision, not a reading exercise:
- Within 3 seconds a player should know: what products (casino/sports), why here (rakeback, VIP, originals), and how to start (one primary CTA).
- Trust cues that count: licence number/regulator seal in footer, RG links, visible payment rails. "Trusted by millions" is noise.
- Live wins feed, jackpot ticker, player counts = category-correct social proof, not clutter.
- Watch for: competing hero promos with no hierarchy, welcome-bonus-first messaging with buried terms, dead nav items, cookie/CTA walls hiding the product. Standard cookie banners are dismissed before capture — only penalise cookie friction if a consent wall still blocks the product in the screenshots.`,
  casino: `CASINO LOBBY EXPERTISE — the lobby is a routing engine for intent:
- A returning player must reach "their" game in ≤2 interactions: recently played row, favourites, working search with fuzzy matching.
- Provider filters, category rows (Originals, Slots, Live, Game Shows), and jackpot/leaderboard sections signal depth.
- Originals section = margin + provably-fair trust; its prominence is strategy, not filler.
- Below the fold matters: live wins feeds, races/leaderboards, promo rows often live at the bottom — judge the WHOLE page.
- Watch for: search that can't handle typos, no recently-played, dead grids without lazy-load, games that open into broken sessions.`,
  sports_betslip: `SPORTSBOOK EXPERTISE — speed from intent to placed bet is everything:
- Odds tap → betslip populated → stake entry → place: every extra step bleeds conversion. Bet builder and cashout presence signal a serious book.
- Live/in-play section with fast-updating odds is table stakes; latency or frozen odds are critical failures.
- Multi-view (list vs match view), popular accumulators, boosted odds rows are leader patterns.
- Watch for: betslip hidden on mobile viewports, stake entry requiring keyboard gymnastics, unclear odds format switching, missing cashout.`,
  signup: `SIGNUP EXPERTISE — the leaders make account creation feel like a 15-second unlock:
- Crypto-native leaders: email + password (or one-click OAuth/Telegram/metamask), NO KYC at signup, deposit address available immediately. Every extra field is measurable drop-off.
- Regulated books need more (age, address, affordability) — judge proportionality to the licence, not absolute field count.
- OFFER TYPE (critical): distinguish a one-time welcome deposit bonus/free bet (traditional) from an ongoing rakeback/VIP promise (crypto loop). Score clarity of terms — wagering, expiry, opt-in — NOT "how big is the promo". A site with no welcome bonus but clear permanent rakeback is leader-class, not a miss.
- Watch for: KYC ambush before first deposit, email verification walls before showing the product, CAPTCHAs stacked on CAPTCHAs, bonus opt-in buried.`,
  deposit: `CASHIER/DEPOSIT EXPERTISE — deposit-to-play latency is the conversion metric:
- Leader pattern: modal cashier over the game, crypto address + QR instantly, network fee guidance, fiat on-ramp options, min/max stated inline.
- Method breadth (BTC/ETH/SOL/USDT + card/Apple Pay via on-ramp) and NO deposit fees are the standard.
- First-deposit bonuses must show wagering terms at the point of decision, not behind a T&C link.
- Watch for: full-page redirects to third-party processors, hidden fees revealed late, unclear pending states, no confirmation feedback.`,
  withdraw: `WITHDRAWAL EXPERTISE — this is where trust is won or destroyed:
- Leaders: withdrawal in the same modal cashier, seconds-to-minutes for crypto, clear pending/processing states, no arbitrary limits ambush.
- KYC timing: requesting docs AT WITHDRAWAL after accepting deposits is the single biggest trust destroyer in the vertical — flag it hard.
- Fee transparency, minimums stated upfront, and visible processing-time promises separate leaders.
- Watch for: wagering locks not explained at deposit, "pending review" black holes, support-gated withdrawals.`,
  loyalty_rewards: `LOYALTY/REWARDS EXPERTISE — judge LOOP DEPTH vs the Stake benchmark, not "promo vs loyalty":
- Regulated loyalty-led brands (BetOnline-class) often HAVE tiers, points, reloads, and VIP — classify them as loyalty-led with weaker execution, not promo-page-only.
- First classify: Promo-page-only (no ongoing rewards system) vs Loyalty-led (tiers/points/reloads present — score depth) vs Crypto loop-led (benchmark). Many regulated sites copy crypto nav labels ("VIP", "Rewards") — judge whether the mechanics behind the label match the promise.
- The hub must answer three questions instantly: what can I earn, how do I earn it, when is my next reward moment.
- Leader stack: visible tier ladder with transparent thresholds, rakeback %s per tier, weekly/monthly cadence explained, level-up bonuses, status transfer offer.
- Gamification depth (crypto): races, missions, chests, streaks, leaderboards — score whether these are integrated into play or absent.
- Tabs and modals ARE the hub — explore them all before judging. A "Bonus Center" modal with claim tiles is leader-class execution.
- Locked previews of higher tiers = aspiration engine (strength). Opaque "VIP by invitation" with no path = weakness.
- Watch for: "Using Bonus & Promotions" style checklists — wagering-heavy welcome offers dressed as loyalty, no cadence signals, promo carousel with no progress mechanics.`,
  support: `SUPPORT EXPERTISE — money questions need human-speed answers:
- Live chat reachable in ≤2 clicks from anywhere, 24/7 claim, visible response-time expectation. Help centre with cashier/KYC/bonus articles that actually answer.
- Leaders surface chat inside the cashier at friction moments (failed deposit, pending withdrawal).
- Watch for: chatbot walls with no human path, support hidden behind login, FAQ dead ends on money topics, ticket-only support in a real-time product.`,
  my_account: `ACCOUNT EXPERTISE — the account area is the player's control room:
- Balance with bonus/real split visible, wagering progress on active bonuses, transaction history with statuses, limits and RG tools discoverable.
- Leaders integrate rewards into the account: VIP progress, claimable balances, session history.
- Watch for: bonus balance opacity (the #1 complaint driver), buried self-exclusion/limits, KYC status invisible until it blocks a withdrawal.`,
};

/** What 85+ looks like — concrete anchors so scores stay calibrated. */
const CALIBRATION: Record<string, string> = {
  landing: `CALIBRATION: 85+ = Stake-class landing — product visible immediately, rakeback/VIP value prop above the fold, one primary CTA, live social proof, licence in footer. 50 = average licensed operator: generic welcome-bonus hero, working nav, product reachable. Below 40 = promo wall obscuring the product or trust signals absent.`,
  casino: `CALIBRATION: 85+ = lobby with working search, recently played, provider filters, originals section, and live wins/races below the fold. 50 = usable grid with categories but no personalisation and weak search. Below 40 = broken search, no structure, dead ends.`,
  sports_betslip: `CALIBRATION: 85+ = one-tap slip population, bet builder, cashout, live section with fresh odds. 50 = functional slip with extra steps. Below 40 = slip failures, stale odds, missing stake clarity.`,
  signup: `CALIBRATION: 85+ = ≤3 fields or social/one-click, instant account, deposit reachable in seconds, offer terms visible. 50 = standard form with reasonable fields and clear offer. Below 40 = KYC before deposit, verification walls, opaque bonus terms.`,
  deposit: `CALIBRATION: 85+ = modal cashier, instant crypto address + QR, fee/min-max transparency, on-ramp breadth. 50 = working deposit with a redirect or unclear fees. Below 40 = late fee reveals, broken methods, no confirmation states.`,
  withdraw: `CALIBRATION: 85+ = same-modal withdrawal, minutes-fast crypto, upfront fees/minimums, clear pending states, KYC expectations set early. 50 = working but slow/ambiguous. Below 40 = KYC ambush, black-hole pending, support-gated payouts.`,
  loyalty_rewards: `CALIBRATION: 85+ = Winna Bonus Center / Stake VIP class — tier ladder with real thresholds, rakeback per tier, claim tiles, cadence explained, status transfer. 50 = BetOnline/FanDuel-class — real VIP/points/reloads but weaker cadence, opaque conversion, thin gamification, progress often login-gated. Below 40 = promo carousel only with no meaningful ongoing rewards mechanics, or terms so opaque the loop fails in practice.`,
  support: `CALIBRATION: 85+ = live chat ≤2 clicks 24/7 + money-topic help articles that answer. 50 = chat exists but buried, or FAQ-first with human path. Below 40 = bot walls, no human path, support requiring login for pre-sales questions.`,
  my_account: `CALIBRATION: 85+ = balance split, bonus wagering progress, VIP progress integrated, RG tools discoverable. 50 = basics present, bonus state unclear. Below 40 = opaque balances, hidden limits, invisible KYC status.`,
};

/** Full expertise brief for one journey — core + lens + calibration. */
export function expertiseFor(journey: string): string {
  const lens = JOURNEY_EXPERTISE[journey] ?? JOURNEY_EXPERTISE.landing;
  const anchors = CALIBRATION[journey] ?? CALIBRATION.landing;
  return `${CORE}\n\n${lens}\n\n${anchors}`;
}

/** Back-compat: the core brief on its own (feature extraction etc.). */
export const IGAMING_EXPERTISE = CORE;
