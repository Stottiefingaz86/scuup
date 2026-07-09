# PlayerScope AI — AI Competitor CX Intelligence for iGaming

## Product Vision

Build an AI competitor intelligence platform for iGaming brands.

The platform allows a client to enter their own brand URL and competitor URLs, choose a market, select player journeys, and run an AI-powered CX analysis.

The product should answer one core question:

> Where are competitors beating us in the player journey, why does it matter, and what should we do next?

This is not just a website crawler. It is an AI CX researcher and mystery shopper for iGaming.

The platform should analyse key player journeys such as sign up, deposit, withdraw, casino play, sports betslip, loyalty/rewards, support and My Account. It should capture screenshots and videos as evidence, score the journeys using iGaming-specific heuristics, compare the brand against competitors, identify strategic positioning, and produce a simple but powerful report.

The final output should help a CEO, CPO, Casino Director, Sportsbook Director, Product Lead or CX Lead understand:

* What competitors are doing better
* What features competitors have
* Where the player experience is weaker
* Where retention loops are stronger
* Where money journeys create more trust
* What should be fixed now
* What should be improved next
* What strategic direction the brand should take

---

# Core Product Promise

> We show where competitors beat you in the player journey, why they win, and what your brand should do next.

Alternative positioning lines:

* See your competitors through your player's eyes.
* AI mystery shopping for iGaming brands.
* Know why competitors convert and retain better.
* Turn competitor journeys into product direction.
* Understand what to copy, improve, avoid and own.

---

# Target Market

Initial vertical: **iGaming**

Primary users:

* CEO
* CPO
* Casino Director
* Sportsbook Director
* Head of Product
* Head of CX
* Head of UX
* Head of Retention
* Head of CRM
* Head of Payments
* Head of Support
* Research / Insights teams

Initial competitor examples:

* Stake
* Rainbet
* bet365
* BetMGM
* DraftKings
* FanDuel
* Betway
* LeoVegas
* PokerStars
* Paddy Power
* William Hill
* Unibet

---

# Product Structure

The product has three main layers:

1. **Dashboard**

   * Brand overview cards
   * Competitor strategy read
   * Journey scores
   * Feature matrix
   * Retention loop comparison
   * Money journey trust score
   * Evidence library

2. **Deep-Dive Analysis**

   * Journey-by-journey breakdown
   * Screenshots
   * Video replay
   * AI findings
   * Heuristic scores
   * Competitor comparison
   * Recommendations

3. **Report**

   * Executive summary
   * Competitor positioning
   * Journey scorecard
   * Feature matrix
   * Retention loop analysis
   * Money journey trust index
   * What competitors are doing better
   * What the brand should do next
   * Roadmap and action plan

---

# Key User Flow

## Client Journey

1. Client lands on the platform
2. Creates a project
3. Enters their brand URL
4. Adds competitor URLs
5. Selects market/country
6. Selects products to audit:

   * Casino
   * Sports
   * Poker
   * Payments
   * Rewards
   * Support
7. Selects journeys:

   * Sign up
   * Deposit
   * Withdraw
   * Casino game journey
   * Sports betslip journey
   * Loyalty/rewards
   * Support
   * My Account
8. Optional: adds login credentials for their own brand and/or competitor test accounts
9. Clicks **Analyze**
10. System runs AI research workflow
11. Client sees:

* Progress state
* Access status per brand
* Evidence captured
* Journey scores
* Feature matrix
* Strategy read
* Final report

---

# Important Compliance and Safety Rules

This product must be positioned as compliant competitor research and authorised mystery shopping.

Do not build, market or describe the product as bypassing Cloudflare, CAPTCHAs, legal restrictions, age gates, KYC, geoblocking or security controls.

The product should support:

* Public-page analysis
* Logged-in analysis using approved test accounts
* Assisted mode for manual steps
* Manual capture mode
* Market/geo testing where legally allowed
* Own-site deep analysis with full permission

The product must stop or pause at:

* CAPTCHA
* OTP
* KYC
* Age verification
* Payment confirmation
* Real deposit confirmation
* Real bet placement
* Real withdrawal submission
* Geo/legal block
* Any access-control barrier

The default rule:

> The agent can navigate up to the point of money movement or wagering, but it should not deposit, withdraw or place a real bet unless explicitly configured in a legally approved test environment.

For competitor sites, the system should support manual/assisted capture where automation cannot continue.

---

# Analysis Modes

## 1. Public Audit Mode

Use for public pages only.

Covers:

* Homepage
* Navigation
* Promotions
* Casino lobby if public
* Sports pages if public
* Help centre
* Payment information
* Responsible gaming
* Terms
* App pages
* Speed/performance
* Visible reward pages

## 2. Logged-In Audit Mode

Uses approved credentials.

Covers:

* Login
* My Account
* Rewards area
* Deposit journey
* Withdraw journey
* Game launch
* Betslip creation
* Transaction history
* Support while logged in

## 3. Assisted Audit Mode

Agent runs the journey but pauses when human input is needed.

Examples:

* OTP
* CAPTCHA
* Email verification
* KYC screen
* Payment screen
* Legal/geo restriction

## 4. Manual Capture Mode

The user performs the journey manually while the system records screenshots/video and analyses afterwards.

This is useful when competitor sites block automation or require manual verification.

---

# Core iGaming Journeys

## 1. Sign-Up Journey

Questions to answer:

* Is sign-up easy to find?
* Is the welcome offer clear?
* How many steps are required?
* How many fields are required?
* Is the form mobile friendly?
* Are errors clear?
* Is verification explained?
* Does the brand explain why personal data is needed?
* Does the player understand what happens next?
* Does the journey build trust?

Output:

* Sign-up score
* Screenshot evidence
* Journey friction
* Competitor comparison
* Recommended improvements

---

## 2. Deposit Journey

Questions to answer:

* Is Deposit easy to find?
* Are payment methods visible?
* Are minimum deposits clear?
* Are fees clear?
* Are limits clear?
* Are processing times clear?
* Does the page feel secure?
* Is balance visible?
* Are bonus prompts helpful or distracting?
* Is the journey simple on mobile?
* Is support available if the player has an issue?

Output:

* Deposit CX score
* Money trust notes
* Friction points
* Competitor comparison
* Recommendations

Default behaviour:

> Stop before real payment confirmation.

---

## 3. Withdraw Journey

Questions to answer:

* Is Withdraw easy to find?
* Are withdrawal methods clear?
* Are limits clear?
* Are timeframes clear?
* Are fees clear?
* Is KYC explained before the player gets blocked?
* Can the player track withdrawal status?
* Is reversal/cancel withdrawal pushed too aggressively?
* Is support easy to access?
* Does the journey feel trustworthy?

Output:

* Withdraw score
* Trust risk analysis
* KYC clarity score
* Competitor comparison
* Recommendations

Default behaviour:

> Stop before real withdrawal submission.

---

## 4. Casino Game Journey

Questions to answer:

* Can the player find casino easily?
* Is the lobby clear?
* Are games grouped well?
* Is search useful?
* Are filters useful?
* Are new/popular games visible?
* Is demo mode available?
* Does the game load quickly?
* Is balance visible?
* Is switching games easy?
* Is mobile play smooth?

Output:

* Casino journey score
* Lobby usability notes
* Search/filter score
* Game launch evidence
* Competitor comparison

Default behaviour:

> Do not wager real money automatically.

---

## 5. Sports Betslip Journey

Questions to answer:

* Can the player find a sport/event quickly?
* Are live and pre-match clear?
* Are markets understandable?
* Can selections be added easily?
* Is the betslip visible?
* Is stake input easy?
* Are odds and returns clear?
* Are odds changes explained?
* Are bet builder / SGP options easy to find?
* Is cashout or bet history easy to locate?

Output:

* Sports betslip score
* Market clarity notes
* Betslip friction
* Competitor comparison

Default behaviour:

> Stop before placing a real bet.

---

## 6. Loyalty and Rewards Journey

This is a flagship part of the product.

Questions to answer:

* Is loyalty visible?
* Are rewards easy to find?
* Are VIP levels clear?
* Is progress shown?
* Is there a clear next reward?
* Are rakeback/cashback/rewards explained?
* Are daily/weekly/monthly rewards visible?
* Are missions, streaks, races or tournaments used?
* Are rewards connected to account, cashier and play?
* Does the system create a reason to return?
* Is it a true retention loop or just a list of promotions?

Output:

* Retention Loop Score
* Loyalty strategy read
* Reward visibility score
* Progress clarity score
* Value-back clarity score
* Competitor comparison
* Recommendations

---

## 7. Support Journey

Questions to answer:

* Is support easy to find?
* Is live chat visible?
* Is the help centre searchable?
* Is support visible from cashier/account pages?
* Are common issues covered?
* Can the player find help for:

  * Deposit issue
  * Withdrawal issue
  * Bonus issue
  * Bet settlement issue
  * Account verification
* Is chatbot helpful or frustrating?
* Is escalation clear?
* Is support available 24/7?

Output:

* Support score
* Resolution confidence
* Friction points
* Competitor comparison
* Recommendations

---

## 8. My Account Journey

Questions to answer:

* Is balance clear?
* Is bonus status clear?
* Is KYC/verification status visible?
* Is transaction history easy to find?
* Are open bets and settled bets easy to find?
* Is casino history easy to find?
* Can the player update details?
* Are responsible gaming tools visible?
* Is account security visible?
* Is logout easy to find?
* Does My Account feel like a control centre?

Output:

* My Account clarity score
* Account visibility score
* Player control score
* Competitor comparison
* Recommendations

---

# Flagship Metrics

## 1. Player CX Score

Overall score out of 100.

Suggested weighting:

| Category           | Weight |
| ------------------ | -----: |
| Sign up            |     15 |
| Deposit / Withdraw |     20 |
| Casino journey     |     15 |
| Sports betslip     |     15 |
| Loyalty / Rewards  |     15 |
| My Account         |     10 |
| Support            |     10 |

The Player CX Score should summarise how strong the brand is across the full player journey.

---

## 2. Retention Loop Score

This should be a flagship metric.

It measures how well a brand gives players a reason to come back tomorrow, next week and next month.

Suggested weighting:

| Area                 | Weight |
| -------------------- | -----: |
| Reward visibility    |     15 |
| Reward clarity       |     15 |
| Progress mechanics   |     15 |
| Frequency loop       |     15 |
| Value-back mechanics |     15 |
| Personalisation      |     10 |
| Emotional pull       |     10 |
| Account integration  |      5 |

### Retention Loop Questions

* Why would a player return tomorrow?
* What progress are they making?
* What value are they earning back?
* What is the next reward moment?
* Does the player feel recognised?
* Are rewards visible during play, deposit and account journeys?
* Is the system always-on or campaign-based?
* Does the experience feel like a habit loop?

### Promo-Led vs Retention-Loop-Led

| Promo-Led                         | Retention-Loop-Led                    |
| --------------------------------- | ------------------------------------- |
| One-off offers                    | Always-on value                       |
| Deposit bonus focused             | Progress and return focused           |
| Campaign-led                      | Behaviour-led                         |
| Hidden in promo page              | Visible across product                |
| Player asks "what offer is live?" | Player asks "what can I unlock next?" |
| Acquisition focused               | Habit and loyalty focused             |

### Example Output

```text
Rainbet Retention Loop Score: 88/100
Type: Casino-first, rewards-led
Why it wins: Rewards, rakeback, rank progression and recurring bonuses create a strong reason to return.

Stake Retention Loop Score: 84/100
Type: VIP/value-back-led
Why it wins: VIP progress and value-back mechanics make every play feel connected to reward.

bet365 Retention Loop Score: 61/100
Type: Traditional promo-led
Why it wins: Strong sportsbook promotions and familiar offers, but less obvious loyalty loop.

Your Brand Retention Loop Score: 48/100
Type: Fragmented rewards
Main issue: Rewards exist, but the player does not have a clear next reward moment.
```

---

## 3. Money Journey Trust Index

Measures how much confidence the player has during deposit, withdraw and account/payment journeys.

Suggested areas:

* Deposit visibility
* Withdrawal visibility
* Payment method clarity
* Fee clarity
* Limit clarity
* Processing time clarity
* KYC clarity
* Balance clarity
* Transaction history clarity
* Support visibility during cashier journeys
* Responsible gaming visibility
* Security/trust messaging

Example output:

```text
Money Journey Trust Index: 62/100

The cashier journey is functional, but competitors create more confidence before the player commits money. Payment methods, limits and withdrawal expectations need to be clearer earlier in the journey.
```

---

## 4. Player Promise Gap

This is a strategic metric.

It asks:

> What does the player believe this brand is best at?

Possible player promises:

* Best rewards
* Easiest to deposit
* Fastest withdrawals
* Best sportsbook
* Best casino discovery
* Most trusted brand
* Best VIP experience
* Best mobile experience
* Best support
* Best crypto experience
* Best poker experience

Example output:

```text
Stake appears to own payment ease and VIP value.
Rainbet appears to own casino rewards and repeat-play momentum.
bet365 appears to own sportsbook trust and traditional promotions.
Your brand has product depth, but the player promise is not clear enough.
```

---

## 5. First 5 Minutes Score

Measures the first-time player experience.

Questions:

* Do I understand what the brand offers?
* Do I know what to do next?
* Do I trust the site?
* Can I sign up easily?
* Do I understand the welcome offer?
* Can I find casino/sports quickly?
* Can I deposit without anxiety?
* Is the experience exciting?

Example output:

```text
First 5 Minutes Score: 58/100

The brand shows many products, but does not create a clear first impression. Competitors are stronger at communicating why the player should join and what value they will get next.
```

---

# Brand Overview Cards

The dashboard homepage should show a card for each brand.

Each card should include:

* Brand logo
* Overall Player CX Score
* Retention Loop Score
* Money Journey Trust Index
* Strategic archetype
* Strongest journey
* Weakest journey
* Biggest threat
* Access status
* Last analysed date
* View details button

Example:

```text
Stake
Player CX Score: 84/100
Retention Loop Score: 84/100
Money Journey Trust: 86/100
Strategy: Payment/VIP-led
Strongest journey: Deposit
Weakest journey: Support clarity
Biggest threat: Makes funding and rewards feel effortless
```

```text
Rainbet
Player CX Score: 81/100
Retention Loop Score: 88/100
Money Journey Trust: 78/100
Strategy: Casino-first, loyalty-led
Strongest journey: Rewards
Weakest journey: Sports depth
Biggest threat: Strong habit loop through rewards and rakeback
```

```text
bet365
Player CX Score: 78/100
Retention Loop Score: 61/100
Money Journey Trust: 82/100
Strategy: Sportsbook trust / promo-led
Strongest journey: Sports betslip
Weakest journey: Modern loyalty
Biggest threat: Trust, familiarity and sports promotional strength
```

```text
Your Brand
Player CX Score: 69/100
Retention Loop Score: 48/100
Money Journey Trust: 62/100
Strategy: Mixed / unclear
Strongest journey: Casino lobby
Weakest journey: Withdraw and rewards clarity
Biggest gap: No obvious player retention story
```

---

# Competitor Strategy Read

The report must include a strategy interpretation section.

It should not only list features. It should explain what each competitor is trying to own.

Example:

## Stake

**Strategy:** Payment/VIP-led, crypto-native, friction-light.

Stake appears to compete through fast funding, wallet ease, VIP progression and ongoing value-back mechanics. The experience makes players feel that deposits, play and rewards are connected.

## Rainbet

**Strategy:** Casino-first, rewards-led, habit-loop driven.

Rainbet appears to compete through a casino-first retention loop. Rewards, ranks, rakeback, calendar-style bonuses and recurring incentives make repeat play feel more valuable and habit-forming.

## bet365

**Strategy:** Traditional sportsbook, trust-led, promotion-led.

bet365 appears to compete through familiarity, sports depth and traditional promotional mechanics. Its strength is trust, sportsbook confidence and recognisable offers.

## Your Brand

**Strategy:** Mixed / fragmented.

Your brand has product depth, but the player promise is less clear. The experience does not yet strongly own one position such as easiest to fund, best rewards, most trusted sportsbook or best casino discovery.

---

# Feature Matrix

The platform must generate a feature matrix comparing brand and competitors.

Example feature categories:

## Acquisition

* Welcome offer
* First deposit bonus
* First bet offer
* Free spins
* Bonus code
* No-deposit offer
* Referral offer

## Casino

* Casino lobby
* Search
* Filters
* Provider filters
* New games
* Popular games
* Live casino
* Game favourites
* Recently played
* Demo mode
* Jackpot games
* Originals

## Sports

* Sportsbook
* Live betting
* Pre-match
* Bet builder
* Same game parlay
* Acca boost
* Odds boost
* Cashout
* Live score
* Bet history
* Market search

## Loyalty / Rewards

* VIP levels
* Rakeback
* Cashback
* Daily bonus
* Weekly bonus
* Monthly bonus
* Missions
* Streaks
* Reward wallet
* Loyalty points
* Progress bar
* Races
* Tournaments
* Personalised offers

## Payments

* Deposit
* Withdraw
* Crypto
* Apple Pay
* Card
* Bank transfer
* E-wallets
* Minimum deposit visibility
* Fee visibility
* Processing time visibility
* Withdrawal tracking

## Support

* Live chat
* Help centre
* Searchable FAQs
* Email support
* Support from cashier
* Support from account
* Escalation path
* 24/7 messaging

## My Account

* Balance
* Bonus status
* KYC status
* Transaction history
* Betting history
* Casino history
* Responsible gaming tools
* Account settings
* Security settings
* Logout

Example output:

| Feature                 | Your Brand | Stake  | Rainbet | bet365    | Priority |
| ----------------------- | ---------- | ------ | ------- | --------- | -------- |
| VIP levels              | Partial    | Strong | Strong  | Medium    | High     |
| Rakeback                | No         | Yes    | Yes     | No        | High     |
| Daily rewards           | No         | Yes    | Yes     | Promo-led | High     |
| Clear deposit methods   | Partial    | Strong | Strong  | Strong    | Critical |
| Withdrawal status       | Weak       | Medium | Medium  | Strong    | Critical |
| Bet builder             | Partial    | Strong | Weak    | Strong    | Medium   |
| Live chat visible       | Hidden     | Medium | Medium  | Strong    | High     |
| Bonus status in account | Weak       | Strong | Strong  | Medium    | High     |

---

# Copy / Improve / Avoid Engine

The product should not tell users to blindly copy competitors.

It should classify competitor findings into:

## Copy

Good competitor patterns worth adopting.

Example:

* Clear reward progress
* Better payment method visibility
* Easy access to support from cashier
* Clear next reward moment

## Improve

Good idea, but the brand can do it better.

Example:

* Competitor has VIP levels, but explanation is confusing.
* Competitor has rewards, but terms are hidden.
* Competitor has bet builder, but discovery is weak.

## Avoid

Competitor patterns that create friction or risk.

Example:

* Too many promo interruptions during deposit.
* Hidden withdrawal requirements.
* Unclear wagering terms.
* Rewards that look exciting but are hard to understand.

## Differentiate

Areas where the brand can own a clearer position.

Example:

* Own the clearest player value hub.
* Own fastest and most transparent cashier.
* Own easiest My Account control centre.
* Own best support for payment issues.

Example output:

```text
Copy: Rainbet's visible reward progress and recurring value loop.
Improve: Stake's VIP/value-back model, but make it clearer for mainstream users.
Avoid: Promo clutter during cashier journeys.
Differentiate: Build the clearest player value hub across casino, sports, poker, cashier and account.
```

---

# Recommendation Roadmap

The report should turn findings into action.

Split actions into:

## Fix Now

Low/medium effort, high impact.

Examples:

* Make Deposit and Withdraw easier to find.
* Show payment methods earlier.
* Clarify limits, fees and processing times.
* Make Rewards visible in main navigation.
* Add bonus/reward status inside My Account.
* Make live chat visible from cashier and account pages.
* Add "next reward" messaging.

## Improve Next

Requires product/design/dev effort.

Examples:

* Build a proper Rewards Hub.
* Redesign My Account as a player control centre.
* Improve sports betslip clarity.
* Improve casino lobby search and filters.
* Add better reward progress mechanics.
* Add support journeys for payment/bonus/bet issues.

## Strategic Bet

Bigger directional opportunities.

Examples:

* Move from promo-led to player-value-led.
* Own the trusted cashier experience.
* Own the clearest rewards loop.
* Own best casino discovery.
* Own mainstream trust with modern UX.
* Build a unified player value dashboard.

Each recommendation should include:

* Title
* Journey affected
* Business impact
* Player impact
* Effort
* Confidence
* Competitor evidence
* Screenshot/video evidence
* Suggested owner
* Suggested priority

---

# Report Packaging

The report is extremely important. It should feel clear, premium and board-ready.

## Report Title

**Player Journey Competitor Report**

Subtitle:

**How your brand compares across sign up, deposit, withdraw, play, rewards, support and account clarity.**

## Report Structure

1. Executive Summary
2. Competitor Ranking
3. Competitor Strategy Read
4. Overall Player CX Score
5. Journey Scorecard
6. Retention Loop Analysis
7. Money Journey Trust Index
8. Feature Gap Matrix
9. Deposit / Withdraw Friction
10. Casino Journey Review
11. Sports Betslip Review
12. Support & My Account Review
13. Copy / Improve / Avoid
14. Strategic Direction
15. Recommended Roadmap
16. Screenshot & Video Evidence

---

# Executive Summary Format

The executive summary should be short and powerful.

Example:

```text
Stake is strongest on payment ease and VIP value. Rainbet is strongest on casino rewards and repeat-play momentum. bet365 is strongest on sportsbook trust and traditional promotional mechanics.

Your brand has solid product depth, but the player experience is fragmented across rewards, cashier, account and support. The biggest strategic gap is retention: competitors give players a clearer reason to come back.

Recommended direction: build a clearer player value loop, improve cashier trust, and turn My Account into the control centre for balance, bonuses, rewards, verification, limits, history and support.
```

---

# Strategic Direction Section

This is the most important C-level output.

It should answer:

* What are competitors doing better?
* Why does it matter?
* What position should our brand own?
* What should we stop copying?
* What should we build next?
* What vision should guide product direction?

Example:

```text
Current position:
Your brand has product depth, but the player experience feels fragmented across rewards, cashier, account and support.

Competitor pressure:
Stake is stronger on payment/VIP ease. Rainbet is stronger on loyalty and repeat-play momentum. bet365 is stronger on traditional sportsbook trust and promotion familiarity.

Recommended direction:
Own the position of clear, trusted player value. Make rewards easier to understand, make cashier journeys more confidence-building, and turn My Account into the player's control centre for balance, bonuses, verification, limits, history and support.

Strategic vision:
Every player should understand what they have, what they can do next, what they can unlock, and why they should return.
```

---

# Dashboard Navigation

Main navigation:

* Overview
* Brands
* Journeys
* Features
* Retention
* Money Journey
* Support
* Evidence
* Report
* Action Plan

---

# Overview Page

The overview should include:

1. Brand cards
2. Overall comparison chart
3. Journey scorecard
4. Retention Loop ranking
5. Money Journey Trust ranking
6. Strategic archetype tags
7. Top 5 opportunities
8. Access status
9. Generate report button

---

# Journey Deep-Dive Page

Each journey page should show:

* Journey name
* Score
* Competitor benchmark
* Key finding
* Journey step timeline
* Screenshots
* Video replay
* Heuristic breakdown
* Friction points
* Strengths
* Weaknesses
* Competitor comparison
* Recommendation

Example:

```text
Deposit Journey

Your Brand: 65/100
Competitor benchmark:
Stake: 90
Rainbet: 82
bet365: 76

Key finding:
Your deposit journey is functional, but competitors create more confidence before the player commits money.

Evidence:
- Deposit CTA is less visible.
- Payment method details are not clear enough.
- Processing times are hidden.
- Bonus prompts distract from completing the deposit.
- Trust messaging is weaker than bet365.

Recommendation:
Make deposit easier to find, show payment methods earlier, clarify limits/fees/timing, and reduce distractions during the funding moment.
```

---

# Technical Stack

Recommended stack:

## Frontend

* Next.js
* React
* Tailwind CSS
* shadcn/ui
* Recharts for charts
* Framer Motion for polished transitions

## Auth / Database

* Supabase Auth
* Supabase Postgres

## Storage

* Supabase Storage or S3

Use storage for:

* Screenshots
* Videos
* HTML snapshots
* Report PDFs
* Export files

## Content / Research Framework

* Sanity

Sanity stores:

* Heuristics
* Journey templates
* Feature definitions
* Scoring weights
* Report templates
* Recommendation rules
* Competitor archetypes
* Industry frameworks

Do not store client report results in Sanity.

Use:

```text
Sanity = reusable research framework
Supabase = customer/project/report data
```

## Agent Orchestration

* LangGraph

LangGraph controls:

* Workflow state
* Journey planning
* Browser execution
* Retry logic
* Human-in-the-loop pauses
* Feature extraction
* Heuristic scoring
* Report generation

## Browser Automation

Use:

* Browserbase
* Playwright
* Browser Use where agentic browsing is useful

Browserbase/Playwright should handle:

* Browser sessions
* Screenshots
* Video recording/session replay
* Page navigation
* Deterministic journey execution

Browser Use can be used for:

* More flexible exploratory journeys
* Finding pages where the structure is unknown
* AI-controlled browser tasks

## Speed / Performance

Use:

* PageSpeed Insights API
* Lighthouse where needed

## AI Models

Use LLMs and vision-capable models for:

* Screenshot analysis
* UX critique
* Feature extraction
* Heuristic scoring
* Competitor strategy read
* Report generation
* Recommendation generation

## Jobs / Background Processing

Use:

* Inngest
* Trigger.dev
* QStash
* or a custom Supabase queue

The analysis will be long-running, so it should run as a background job with progress updates.

---

# High-Level Architecture

```text
Client enters brand + competitors
        ↓
Create project in Supabase
        ↓
Queue analysis job
        ↓
LangGraph starts workflow
        ↓
Load iGaming framework from Sanity
        ↓
Run preflight checks
        ↓
Create journey plan per brand
        ↓
Start Browserbase/Playwright sessions
        ↓
Run journey agents
        ↓
Capture screenshots + videos
        ↓
Store evidence in Storage
        ↓
Run PageSpeed/performance checks
        ↓
Extract features
        ↓
Score heuristics
        ↓
Generate strategy read
        ↓
Generate recommendations
        ↓
Save report data in Supabase
        ↓
Render dashboard + PDF report
```

---

# LangGraph Workflow

Suggested graph nodes:

1. `create_project_state`
2. `load_framework_from_sanity`
3. `preflight_access_check`
4. `build_journey_plan`
5. `start_browser_session`
6. `run_public_scan`
7. `run_signup_journey`
8. `run_login_journey`
9. `run_deposit_journey`
10. `run_withdraw_journey`
11. `run_casino_journey`
12. `run_sports_betslip_journey`
13. `run_rewards_journey`
14. `run_support_journey`
15. `run_my_account_journey`
16. `capture_evidence`
17. `extract_features`
18. `score_heuristics`
19. `generate_competitor_strategy_read`
20. `generate_recommendations`
21. `generate_report`
22. `save_results`
23. `complete_job`

Human pause nodes:

* `requires_otp`
* `requires_captcha`
* `requires_kyc`
* `requires_payment_confirmation`
* `requires_bet_confirmation`
* `requires_manual_capture`
* `access_blocked`
* `geo_restricted`

---

# Data Model

## users

```text
id
email
name
company
role
created_at
```

## projects

```text
id
user_id
name
industry
market
created_at
updated_at
status
```

## brands

```text
id
project_id
name
url
type // own_brand or competitor
market
access_status
logo_url
created_at
```

## credentials

Store securely. Never store plain text passwords.

```text
id
brand_id
credential_type
encrypted_username
encrypted_password
notes
requires_manual_otp
created_at
```

## analysis_jobs

```text
id
project_id
status
current_step
progress
error_message
created_at
started_at
completed_at
```

## journeys

```text
id
project_id
brand_id
journey_type
status
score
summary
created_at
```

Journey types:

```text
signup
login
deposit
withdraw
casino
sports_betslip
loyalty_rewards
support
my_account
responsible_gaming
```

## journey_steps

```text
id
journey_id
step_name
step_order
url
screenshot_url
video_url
video_timestamp
html_snapshot_url
visible_text
observations
friction_points
created_at
```

## heuristic_scores

```text
id
journey_id
heuristic_id
heuristic_name
category
score
weight
reasoning
evidence_step_id
created_at
```

## features_detected

```text
id
brand_id
feature_name
category
status // yes, no, partial, unknown
strength // weak, medium, strong
evidence
journey_step_id
created_at
```

## brand_scores

```text
id
brand_id
player_cx_score
retention_loop_score
money_journey_trust_score
first_5_minutes_score
support_score
account_clarity_score
created_at
```

## strategy_reads

```text
id
brand_id
archetype
summary
strengths
weaknesses
biggest_threat
created_at
```

## recommendations

```text
id
project_id
title
description
category
journey_type
priority
impact
effort
confidence
recommendation_type // fix_now, improve_next, strategic_bet
competitor_evidence
created_at
```

## reports

```text
id
project_id
title
executive_summary
report_json
pdf_url
created_at
updated_at
```

---

# Sanity Content Model

## industry_framework

Fields:

```text
name
slug
description
journeys[]
features[]
heuristics[]
report_template
```

## journey_template

Fields:

```text
name
slug
industry
description
steps[]
default_weight
```

## heuristic

Fields:

```text
name
slug
journey
category
question
weight
scoring_guide
good_examples
bad_examples
evidence_required
```

Example:

```text
Name: Deposit clarity
Journey: Deposit
Question: Are payment methods, fees, limits and processing times clear before the player commits?
Weight: 10
Scoring guide:
1–3 = hidden or confusing
4–6 = partially explained
7–8 = mostly clear
9–10 = very clear and confidence-building
```

## feature_definition

Fields:

```text
name
slug
category
description
detection_prompt
related_journeys
```

Example:

```text
Feature: Rakeback
Category: Loyalty
Description: A value-back mechanic where players receive a percentage of wagering activity back as rewards.
Detection prompt: Look for rakeback, cashback, VIP rewards, reward wallet or similar terminology.
```

## competitor_archetype

Fields:

```text
name
description
signals
example_brands
strategic_risk
recommendation_angle
```

Examples:

* Payment/VIP-led
* Casino loyalty-led
* Traditional sportsbook promo-led
* Trust/compliance-led
* Crypto-first
* Bonus-led
* Product-depth-led
* Fragmented / unclear

## report_template

Fields:

```text
name
industry
sections[]
prompt_instructions
tone
```

## recommendation_rule

Fields:

```text
name
condition
recommendation
priority
journey
impact
effort
```

Example:

```text
If Deposit Clarity score is below 6:
Recommend improving payment method visibility, limits, fees and processing-time messaging before the player reaches confirmation.
```

---

# Evidence Capture

Every journey should capture:

* Screenshot
* Video recording
* URL
* Timestamp
* Step name
* Visible text
* AI observations
* Detected features
* Friction points
* Access issues
* Manual pause points

Evidence object example:

```json
{
  "brand": "Stake",
  "journey": "Deposit",
  "step": "Payment method selection",
  "url": "https://example.com/deposit",
  "screenshot": "storage/path/image.png",
  "videoTimestamp": "00:01:34",
  "observations": [
    "Deposit CTA is visible from account menu",
    "Payment options are prominent",
    "Fees are not immediately clear"
  ],
  "frictionPoints": [
    "Processing time is not shown before method selection"
  ]
}
```

---

# AI Analysis Principles

The AI should write like a senior CX researcher and product strategist.

Avoid generic output.

Bad:

```text
The deposit page could be improved.
```

Good:

```text
The deposit journey is easy to start, but it does not create enough confidence before the player commits money. Competitors show payment methods, limits and processing expectations earlier, which makes the funding moment feel safer and more predictable.
```

Bad:

```text
Rainbet has rewards.
```

Good:

```text
Rainbet appears to use rewards as a central retention mechanic. Rakeback, rank progress and recurring bonuses create a visible value loop that gives players a reason to return beyond one-off promotions.
```

---

# Tone of Voice

The product should sound:

* Sharp
* Clear
* Strategic
* Evidence-led
* Commercial
* Senior
* Practical
* Non-technical for executives
* Detailed enough for product teams

Avoid:

* AI fluff
* Generic UX language
* Long academic explanations
* Overly technical crawler language
* Legal-risk wording like "bypass"
* Weak recommendations

Use phrases like:

* "The player promise is unclear."
* "This creates friction at a money moment."
* "Competitors make the next reward more visible."
* "This is a retention gap, not just a UI issue."
* "The brand has features, but not a clear loop."
* "Copy the principle, not the execution."
* "This should be treated as a strategic product opportunity."

---

# MVP Scope

## MVP Version 1

Build:

* Project creation
* Add own brand URL
* Add up to 3 competitor URLs
* Select market
* Select journeys
* Public audit mode
* Browser screenshots
* Basic video capture
* PageSpeed integration
* Feature extraction
* Heuristic scoring
* Brand overview cards
* Journey scorecard
* Retention Loop Score
* Money Journey Trust Index
* Feature matrix
* Executive report page
* PDF export

Do not build full automation for real deposits, withdrawals or real bets in MVP.

## MVP Version 2

Add:

* Logged-in audit mode
* Secure credential vault
* Assisted mode
* Manual capture mode
* Video replay library
* More detailed report builder
* Action roadmap
* Copy / Improve / Avoid engine
* Jira/CSV/Notion export

## MVP Version 3

Add:

* Scheduled monitoring
* Monthly competitor reports
* Market comparison
* Multi-geo analysis
* AI search visibility
* CRM/rewards benchmarking
* App store review integration
* Trustpilot/reputation analysis
* Slack/email alerts
* Advanced strategic direction module

---

# Example Final Report Output

## Executive Summary

```text
Stake is strongest on payment ease and VIP value. Rainbet is strongest on casino rewards and repeat-play momentum. bet365 is strongest on sportsbook trust and traditional promotional mechanics.

Your brand has solid product depth, but the player experience is fragmented across rewards, cashier, account and support. The biggest strategic gap is retention: competitors give players a clearer reason to come back.

Recommended direction: build a clearer player value loop, improve cashier trust, and turn My Account into the control centre for balance, bonuses, rewards, verification, limits, history and support.
```

## Top Opportunities

```text
1. Build a visible Rewards Hub with progress, value earned and next reward.
2. Improve deposit and withdrawal clarity before the player commits money.
3. Make support visible during cashier and account journeys.
4. Turn My Account into a player control centre.
5. Decide whether the brand wants to own rewards, trust, sportsbook depth, casino discovery or cashier simplicity.
```

## Strategic Direction

```text
Your competitors are not only competing on games, odds or bonuses. They are competing on retention loops.

Rainbet makes rewards feel constant. Stake makes value-back and VIP feel connected to every play. bet365 makes sportsbook promotions feel familiar and trustworthy.

Your brand needs a clearer player value system that shows players what they have earned, what they can unlock next, and why they should return.
```

---

# Cursor Build Instructions

Build this as a modern SaaS application.

Prioritise:

1. Clear dashboard UX
2. Strong data model
3. Simple project creation
4. Brand overview cards
5. Evidence capture structure
6. Heuristic scoring framework
7. Retention Loop Score
8. Report generation

Use placeholder/mock data first if needed, but design the architecture so real browser sessions and AI analysis can be added cleanly.

The first working demo should allow a user to:

1. Create a project
2. Add their brand and 3 competitors
3. Select iGaming journeys
4. Click Analyze
5. See a loading/progress state
6. View brand cards
7. View journey scorecard
8. View Retention Loop Score
9. View feature matrix
10. Generate a simple report

The demo can initially use mocked analysis data for Stake, Rainbet, bet365 and "Your Brand", but the system should be structured for real analysis jobs later.

---

# Design Direction

The UI should feel premium, strategic and modern.

Use:

* Dark mode first
* Clean cards
* Strong hierarchy
* Subtle glow
* Clear charts
* Brand comparison cards
* Score badges
* Journey timelines
* Evidence thumbnails
* Report-style layouts
* Simple executive summaries

Avoid:

* Generic SaaS look
* Overly playful UI
* Too many charts
* Dense research walls
* Developer/debug UI

The product should feel like:

> A premium competitor intelligence command centre for iGaming executives.

---

# Initial Pages to Build

## `/`

Landing page.

Sections:

* Hero
* Product promise
* How it works
* Key metrics
* Example dashboard preview
* Report preview
* CTA

## `/dashboard`

Project list and recent reports.

## `/projects/new`

Create new analysis project.

Fields:

* Project name
* Own brand URL
* Competitor URLs
* Market
* Products
* Journeys
* Analysis mode

## `/projects/[id]/overview`

Main dashboard.

Includes:

* Brand cards
* Overall scores
* Retention Loop Score
* Money Journey Trust Index
* Strategy read
* Top opportunities

## `/projects/[id]/journeys`

Journey scorecard and deep dives.

## `/projects/[id]/features`

Feature matrix.

## `/projects/[id]/retention`

Retention Loop analysis.

## `/projects/[id]/money-journey`

Deposit/withdraw/payment trust analysis.

## `/projects/[id]/evidence`

Screenshots and videos.

## `/projects/[id]/report`

Executive report.

## `/projects/[id]/action-plan`

Roadmap and recommendations.

---

# Example Mock Brands

Use these for the first demo:

## Stake

```text
Player CX Score: 84
Retention Loop Score: 84
Money Journey Trust Index: 86
Strategy: Payment/VIP-led
Strongest journey: Deposit
Weakest journey: Support clarity
Biggest threat: Makes funding and rewards feel effortless
```

## Rainbet

```text
Player CX Score: 81
Retention Loop Score: 88
Money Journey Trust Index: 78
Strategy: Casino-first, loyalty-led
Strongest journey: Rewards
Weakest journey: Sports depth
Biggest threat: Strong habit loop through rewards and rakeback
```

## bet365

```text
Player CX Score: 78
Retention Loop Score: 61
Money Journey Trust Index: 82
Strategy: Sportsbook trust / promo-led
Strongest journey: Sports betslip
Weakest journey: Modern loyalty
Biggest threat: Trust, familiarity and sports promotional strength
```

## Your Brand

```text
Player CX Score: 69
Retention Loop Score: 48
Money Journey Trust Index: 62
Strategy: Mixed / unclear
Strongest journey: Casino lobby
Weakest journey: Withdraw and rewards clarity
Biggest gap: No obvious player retention story
```

---

# Success Criteria

The product is successful when a client can clearly understand:

* Where they stand against competitors
* Which competitor is strongest at each journey
* Whether their retention loop is strong or weak
* Whether their money journeys create trust
* What features competitors have
* What competitor patterns are worth copying
* What competitor patterns should be avoided
* What to fix now
* What to improve next
* What strategic direction the brand should take

The final report should feel like something a Head of Product or CEO would forward internally.

The most important output is not the score.

The most important output is this:

> Here is what competitors are doing better, what it means commercially, and what we should do next.

---

# Build Priority

Start with a mocked but polished version.

Phase 1:

* UI
* Dashboard
* Mock data
* Report layout

Phase 2:

* Supabase data model
* Project creation
* Real saved projects
* Real report objects

Phase 3:

* Sanity heuristics
* Scoring engine
* Feature matrix engine

Phase 4:

* Browserbase/Playwright capture
* Screenshots
* Videos
* Evidence storage

Phase 5:

* LangGraph orchestration
* AI scoring
* AI report generation

Phase 6:

* Assisted mode
* Manual capture
* Logged-in analysis
* Exports and scheduled reports

---

# Final North Star

Build a platform that helps iGaming brands stop guessing.

It should show:

* Why players may choose competitors
* Why competitors retain better
* Where trust is breaking
* Where rewards are weak
* Where product journeys are unclear
* What the brand should become next

North star statement:

> PlayerScope AI helps iGaming brands see exactly where competitors outperform them across player journeys, retention loops and money moments, then turns those insights into a clear product direction and action plan.
