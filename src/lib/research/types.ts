/** Scuup Research — timed journey teardowns + competitor matrices.
 * Isolated from the CX scoring product. */

export type ResearchDevice = "desktop" | "mobile";
export type AcquisitionSource =
  "affiliate" | "paid" | "direct" | "crm" | "other";
export type FrictionSeverity = "critical" | "high" | "medium" | "low";
export type FrictionType =
  | "remove"
  | "simplify"
  | "automate"
  | "clarify"
  | "reassure"
  | "speed_up"
  | "personalise";
export type QualitativeRating =
  "best_in_class" | "strong" | "average" | "weak" | "missing";

export type JourneyKind = "new_player_first_bet" | "returning_player_login";

export interface ResearchPersona {
  email: string;
  password: string;
  dateOfBirth: string;
  country: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  /** Province / state — needed for CA / US forms. */
  state?: string;
  phone?: string;
  notes?: string;
}

export interface ResearchBrand {
  id: string;
  role: "own_brand" | "competitor";
  name: string;
  url: string;
  favicon?: string;
  /**
   * Email used for this brand's signup (usually a Gmail +alias).
   * Login / deposit must reuse the same address.
   */
  accountEmail?: string | null;
  /**
   * Password used when this brand's account was registered.
   * Login must reuse this exact value — not a later persona edit.
   */
  accountPassword?: string | null;
  /**
   * Handle / account id the brand issued (BetOnline logs in with this,
   * not the Gmail +alias).
   */
  accountUsername?: string | null;
  /**
   * True only after signup actually succeeded (logged in / verified).
   * Pre-minted alias emails must NOT set this — or we skip register and
   * try to login on brands that never created an account.
   */
  accountReady?: boolean;
  /** Voice of Player: last-6-months Trustpilot synthesis for this brand. */
  playerVoice?: PlayerVoice | null;
}

/* ---------------- Voice of Player ---------------- */

export type PlayerVoiceVertical =
  | "Sports"
  | "Casino"
  | "Payments"
  | "Account & KYC"
  | "Bonuses & rewards"
  | "Support"
  | "Community"
  | "Platform"
  | "Other";

export type PlayerVoiceKind = "complaint" | "ask" | "stuck" | "praise";

export interface PlayerVoiceQuote {
  text: string;
  rating: number;
  /** ISO date of the review. */
  date: string;
}

/** A review read in the window — the raw evidence a theme points back to. */
export interface PlayerVoiceReview {
  rating: number;
  title: string;
  text: string;
  date: string;
  replied: boolean;
}

/** One theme players raise, tagged by vertical and by what kind of signal it is. */
export interface PlayerVoiceTheme {
  theme: string;
  kind: PlayerVoiceKind;
  vertical: PlayerVoiceVertical;
  /** Reviews in the sample that raise it. */
  mentions: number;
  /** Which journey stage it maps to, when it does (registration, deposit, withdrawal…). */
  stage: string | null;
  /** One sentence a product team can act on. */
  insight: string;
  quotes: PlayerVoiceQuote[];
  /** Indices into `PlayerVoice.reviews` of every review that raises it. */
  reviewIds?: number[];
  /**
   * The actual reviews behind this theme (copied at analysis time). Prefer
   * this over `reviewIds` — localStorage often can't hold the full corpus.
   */
  evidence?: PlayerVoiceReview[];
}

export interface PlayerVoiceMonth {
  /** YYYY-MM */
  month: string;
  count: number;
  positive: number;
  negative: number;
  avgRating: number | null;
}

export interface PlayerVoiceAlignment {
  /** Journey stage or benchmark area the reviews speak to. */
  area: string;
  verdict: "confirms" | "contradicts" | "gap";
  note: string;
}

export interface PlayerVoice {
  source: "trustpilot";
  sourceUrl: string;
  fetchedAt: string;
  /** Review window in months (6). */
  windowMonths: number;
  trustScore: number | null;
  totalReviews: number | null;
  /** Reviews inside the window that were read. */
  sampled: number;
  ratingSplit: { positive: number; neutral: number; negative: number };
  /** Share of sampled reviews the brand replied to (0–1), null if unknown. */
  replyRate: number | null;
  monthly: PlayerVoiceMonth[];
  /** Two-sentence verdict. */
  summary: string;
  /** What players complain about. */
  complaints: PlayerVoiceTheme[];
  /** What players ask for. */
  asks: PlayerVoiceTheme[];
  /** Where players get stuck. */
  stuck: PlayerVoiceTheme[];
  /** What players praise. */
  praise: PlayerVoiceTheme[];
  /** Do they want community, or do we want it for them? */
  community: {
    verdict: "players want it" | "indifferent" | "no signal" | "against";
    note: string;
  };
  /** Where reviews confirm, contradict or extend what the journey measured. */
  alignment: PlayerVoiceAlignment[];
  /** Review-farming / burst warning, when seen. */
  authenticityNote: string | null;
  /** Every review read in the window, so mention counts can be inspected. */
  reviews?: PlayerVoiceReview[];
}

export interface JourneyFriction {
  id: string;
  stageId: string;
  issue: string;
  impact: string;
  severity: FrictionSeverity;
  type: FrictionType;
  evidence?: string;
  owner?: string;
}

export interface JourneyStageResult {
  stageId: string;
  label: string;
  userGoal: string;
  userAction: string;
  screen: string;
  steps: number | null;
  timeSec: number | null;
  waitSec: number | null;
  friction?: string;
  userImpact?: string;
  frictionType?: FrictionType | null;
  severity?: FrictionSeverity | null;
  evidence?: string;
  owner?: string;
  /** ISO timestamps from the agent stopwatch. */
  startedAt?: string | null;
  endedAt?: string | null;
  fieldCount?: number | null;
  redirects?: number | null;
  errorCount?: number | null;
  screenshotUrls?: string[];
}

export interface JourneyMetrics {
  totalTimeSec: number | null;
  totalActions: number | null;
  totalScreens: number | null;
  totalFormFields: number | null;
  totalWaitSec: number | null;
  redirects: number | null;
  errors: number | null;
  depositToFirstBetSec: number | null;
  depositToFirstBetClicks: number | null;
}

export interface TopFriction {
  rank: 1 | 2 | 3;
  friction: string;
  evidence: string;
  impact: string;
  whyItMatters: string;
}

/** Where a page / link / CTA takes the player. */
export type PlayerDestination =
  "casino" | "sportsbook" | "cashier" | "bonus" | "account" | "lobby" | "other";

export interface PostDepositEmail {
  subject: string;
  from: string;
  /** Seconds after "I've sent payment". */
  receivedAfterSec: number;
  /** First brand CTA link in the mail. */
  primaryLink: string | null;
  /** Where that link lands after following redirects. */
  resolvedUrl: string | null;
  linkTarget: PlayerDestination | null;
}

/**
 * What the site does the moment funds land — the answer to "after I deposit,
 * where do they send me, do they tell me, do they upsell me?"
 */
export interface PostDepositObservation {
  /** Seconds from "I've sent payment" to funds visible / email. */
  creditedAfterSec: number | null;
  confirmedVia: "email" | "site" | null;
  /** Page the player is on when funds land. */
  landedOn: PlayerDestination | null;
  landingUrl: string | null;
  /** Toast / banner confirming the deposit on-site. */
  balanceAlert: { seen: boolean; text: string | null };
  /** Modal / popup shown after credit (bonus, cross-sell, next step). */
  popup: {
    seen: boolean;
    text: string | null;
    cta: string | null;
    ctaTarget: PlayerDestination | null;
  };
  /** Where the site's own primary CTA sent the agent when followed. */
  guidedTo: PlayerDestination | null;
  guidedUrl: string | null;
  /** Plain-language: what the site tells the player to do next. */
  guidance: string | null;
  /** Visible calls to action at that moment (labels). */
  ctas: string[];
  emails: PostDepositEmail[];
  /** OKR conflicts / gaps raised from the above. */
  okrFlags: string[];
  screenshotUrls: string[];
}

export interface WelcomeTouch {
  seen: boolean;
  channel: "chat" | "modal" | "toast" | "banner" | null;
  text: string | null;
  /** Human sender shown on a chat greeting ("Paul"). */
  sender: string | null;
  /** Greeting uses the player's own name / handle. */
  personalized: boolean;
  ctas: string[];
  /** Seconds after signup confirmation the greeting appeared. */
  afterSec: number | null;
  /** How we got it out of the way afterwards. */
  dismissed: "clicked" | "hidden" | null;
}

/** One tick of the post-payment watch: what the player could see at T+n. */
export interface DepositWatchEntry {
  afterSec: number;
  /** Header balance text as shown ("$0.00"), null if none found. */
  balance: string | null;
  /** Brand emails received since payment. */
  emails: number;
  alert: string | null;
  screenshotUrl: string | null;
  /**
   * Public chain view of the deposit address — separates "sender hasn't paid
   * yet" (none) from "brand is slow to credit" (confirmed, balance still 0).
   */
  chain?: "none" | "mempool" | "confirmed" | null;
}

/** What the brand does the moment the account exists. */
export interface PostSignupObservation {
  welcome: WelcomeTouch;
  screenshotUrls: string[];
}

export interface JourneyRun {
  id: string;
  kind: JourneyKind;
  brandId: string;
  dateTested: string;
  tester: string;
  device: ResearchDevice;
  browser: string;
  acquisitionSource: AcquisitionSource;
  paymentMethod: string;
  startingState: string;
  endState: string;
  stages: JourneyStageResult[];
  metrics: JourneyMetrics;
  topFriction: TopFriction[];
  status: "draft" | "running" | "paused" | "complete" | "failed";
  trail?: string[];
  error?: string;
  /** Server teardown job — used to poll deposit confirmation after manual pay. */
  agentJobId?: string;
  /** Captured once funds land: redirect, popup, alert, emails, OKR flags. */
  postDeposit?: PostDepositObservation | null;
  /** Captured once the account exists: greeting / welcome touch. */
  postSignup?: PostSignupObservation | null;
  /** Live timeline from "I've paid" until funds land (or we give up). */
  depositWatch?: DepositWatchEntry[];
  /** Verified BTC address the human was asked to pay (resume needs it). */
  depositAddress?: string | null;
  /** When the human pressed "I've paid" (ISO). */
  paidAt?: string | null;
  /** Test run: deposit skipped, nothing scored after it. */
  depositSkipped?: boolean;
  /** Casino lobby affordances (search, favourites, rows) seen during discovery. */
  lobby?: LobbyAffordances | null;
  /** Post-journey feature scan — fills the Feature benchmark. */
  features?: BrandFeatureScan | null;
}

export interface LobbyAffordances {
  hasSearch: boolean;
  hasFavourites: boolean;
  carousels: string[];
  categoryTabs: string[];
  providerFilter: boolean;
  gameTileCount: number;
}

export interface FeatureSignal {
  name: string;
  category:
    | "Casino"
    | "Sports"
    | "Rewards"
    | "Engagement"
    | "Login"
    | "Support"
    | "Acquisition"
    | "Cross-sell"
    | "Other";
  /** Which screen it was seen on (home, rewards, casino, sports, account). */
  area: string;
  /** On-screen words that prove it. */
  evidence: string;
  source: "dom" | "llm";
}

/** What the site offers beyond the funnel — read once the journey is done. */
export interface BrandFeatureScan {
  scannedAt: string;
  navItems: string[];
  /** 1-based position of "Casino" in the nav, null if absent. */
  casinoNavIndex: number | null;
  lobby: LobbyAffordances | null;
  /** Heading / line proving a live wins / latest bets style feed. */
  activityFeed: string | null;
  rewards: {
    areaFound: boolean;
    areaLabel: string | null;
    progressMeter: boolean;
    countdown: boolean;
    claimable: boolean;
    /** VIP / rewards entry visible from the header or main nav. */
    globallyVisible: boolean;
  };
  crossSell: {
    /** Casino promo seen on the sportsbook screen. */
    sportsToCasino: string | null;
    /** Sports promo seen on the casino screen. */
    casinoToSports: string | null;
  };
  login: { twoFactor: boolean; biometrics: boolean; social: boolean };
  features: FeatureSignal[];
  screenshotUrls: string[];
  /** Same shots tagged by the area they show — lets a benchmark cell open
   * only the frames that back it. */
  areaShots?: { area: string; url: string }[];
  areasVisited: string[];
  /** True when we never got an account — public casino / rewards only. */
  loggedOut?: boolean;
}

export interface BenchmarkCell {
  area: string;
  criteria: string;
  /** Qualitative or measurable string value. */
  value: string | number | null;
  rating?: QualitativeRating | null;
}

export interface CompetitorTeardown {
  brandId: string;
  dateTested: string;
  registrationTimeSec: number | null;
  registrationSteps: number | null;
  totalFields: number | null;
  depositTimeSec: number | null;
  depositSteps: number | null;
  depositToFirstBetSec: number | null;
  depositToFirstBetClicks: number | null;
  totalOnboardingTimeSec: number | null;
  totalOnboardingActions: number | null;
  /** "Chat greeting · personalised · from Paul" / "None seen" / null = unknown. */
  welcomeTouch?: string | null;
}

export interface EmailWatchItem {
  id: string;
  brandId: string;
  receivedAt: string;
  from: string;
  subject: string;
  category:
    | "welcome"
    | "verify"
    | "deposit_nudge"
    | "bonus"
    | "vip"
    | "reactivation"
    | "other";
  dayNumber: number;
  summary: string;
  /** Plain-text body (capped) for the deliverable. */
  body?: string;
  /** Sanitized HTML body for inbox-style preview (how the user sees it). */
  html?: string;
  /** Delivered-to header (for +alias attribution). */
  to?: string;
  links?: string[];
  otpPresent?: boolean;
  /** What the agent did with this email. */
  actionTaken?: "otp_entered" | "link_opened" | "noted" | "ignored" | null;
  actionResult?: string | null;
  stageId?: string | null;
  screenshotUrls?: string[];
  runId?: string | null;
  /** Tracking links followed to their landing page + what that page is. */
  resolvedLinks?: {
    url: string;
    resolved: string | null;
    destination: PlayerDestination | null;
  }[];
}

export interface ResearchProject {
  id: string;
  name: string;
  market: string;
  device: ResearchDevice;
  createdAt: string;
  brands: ResearchBrand[];
  persona: ResearchPersona | null;
  runs: JourneyRun[];
  teardowns: CompetitorTeardown[];
  emails: EmailWatchItem[];
  /** Inbox watch window after signup (days). */
  emailWatchDays: number;
  /** Last time we opened IMAP, pulled new mail, and logged out. */
  lastInboxSweepAt?: string;
}

/** Human-in-the-loop item — e.g. send crypto or paste an SMS OTP. */
export type ResearchActionKind =
  "manual_deposit" | "sms_assist" | "signup_blocked";
export type ResearchActionStatus =
  | "pending"
  | "payment_sent"
  | "code_submitted"
  | "confirming"
  | "confirmed"
  | "expired"
  | "cancelled";

export interface ResearchAction {
  id: string;
  projectId: string;
  brandId: string;
  brandName: string;
  brandUrl: string;
  kind: ResearchActionKind;
  status: ResearchActionStatus;
  createdAt: string;
  updatedAt: string;
  /** Linked Browserbase teardown job — resume after manual help. */
  jobId: string;
  liveViewUrl?: string | null;
  depositAddress?: string | null;
  network?: string | null;
  currency?: string | null;
  amountHint?: string | null;
  /** Site's QR code for the deposit address (cropped screenshot). */
  qrUrl?: string | null;
  paymentSentAt?: string | null;
  confirmedAt?: string | null;
  confirmedVia?: "email" | "site" | "manual" | null;
  emailSubject?: string | null;
  balanceSeen?: string | null;
  notes?: string | null;
  /** Mobile number the site should have texted (from persona). */
  phoneHint?: string | null;
  /** Short prompt shown in Notifications (e.g. “Enter SMS code”). */
  smsPrompt?: string | null;
  /** Code the human pasted so the agent can continue. */
  smsCode?: string | null;
}
