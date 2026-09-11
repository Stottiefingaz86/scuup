import type { JourneyKind, JourneyStageResult } from "./types";

export interface StageTemplate {
  stageId: string;
  label: string;
  userGoal: string;
  userAction: string;
  screen: string;
}

/** New Player → First Casino Bet */
export const NEW_PLAYER_STAGES: StageTemplate[] = [
  {
    stageId: "first_touch",
    label: "First Touch",
    userGoal: "Understand offer",
    userAction: "Click acquisition source",
    screen: "Affiliate / ad / CRM",
  },
  {
    stageId: "landing",
    label: "Landing",
    userGoal: "Decide whether to join",
    userAction: "Click Register",
    screen: "Homepage",
  },
  {
    stageId: "registration",
    label: "Registration",
    userGoal: "Create account",
    userAction: "Complete form",
    screen: "Registration",
  },
  {
    stageId: "verification",
    label: "Verification",
    userGoal: "Become eligible",
    userAction: "Enter OTP / verify email",
    screen: "Verification",
  },
  {
    stageId: "deposit",
    label: "Deposit",
    userGoal: "Fund account",
    userAction: "Select payment method",
    screen: "Cashier",
  },
  {
    stageId: "deposit_confirmation",
    label: "Deposit Confirmation",
    userGoal: "Confirm funds available",
    userAction: "Wait for clear",
    screen: "Cashier / wallet",
  },
  {
    stageId: "casino_discovery",
    label: "Casino Discovery",
    userGoal: "Find a game",
    userAction: "Navigate Casino",
    screen: "Lobby",
  },
  {
    stageId: "game_launch",
    label: "Game Launch",
    userGoal: "Open game",
    userAction: "Select game",
    screen: "Game launcher",
  },
  {
    stageId: "first_bet",
    label: "First Bet",
    userGoal: "Place first casino bet",
    userAction: "Launch + wager",
    screen: "Game",
  },
  {
    stageId: "days_1_14",
    label: "Days 1–14",
    userGoal: "Stay engaged",
    userAction: "Receive CRM / return",
    screen: "Email + site",
  },
];

/** Returning Player → Login → Resume Play */
export const RETURNING_PLAYER_STAGES: StageTemplate[] = [
  {
    stageId: "entry",
    label: "Entry",
    userGoal: "Open site",
    userAction: "Navigate to brand",
    screen: "Homepage",
  },
  {
    stageId: "login",
    label: "Login",
    userGoal: "Enter credentials",
    userAction: "Fill email / password",
    screen: "Login form",
  },
  {
    stageId: "authentication",
    label: "Authentication",
    userGoal: "Pass OTP / 2FA",
    userAction: "Complete security step",
    screen: "OTP / 2FA",
  },
  {
    stageId: "success",
    label: "Success",
    userGoal: "Logged in",
    userAction: "Land in authenticated state",
    screen: "Post-login",
  },
  {
    stageId: "resume",
    label: "Resume Play",
    userGoal: "Return to intended activity",
    userAction: "Navigate to game / lobby",
    screen: "Casino / sports",
  },
];

export const JOURNEY_LABELS: Record<JourneyKind, string> = {
  new_player_first_bet: "New Player → First Casino Bet",
  returning_player_login: "Returning Player → Login → Resume",
};

export function emptyStagesFor(kind: JourneyKind): JourneyStageResult[] {
  const templates =
    kind === "returning_player_login"
      ? RETURNING_PLAYER_STAGES
      : NEW_PLAYER_STAGES;
  return templates.map((t) => ({
    stageId: t.stageId,
    label: t.label,
    userGoal: t.userGoal,
    userAction: t.userAction,
    screen: t.screen,
    steps: null,
    timeSec: null,
    waitSec: null,
    severity: null,
    fieldCount: null,
    redirects: null,
    errorCount: null,
    frictionType: null,
    screenshotUrls: [],
  }));
}

export const STAGE_OWNERS: Record<string, string> = {
  first_touch: "Marketing",
  landing: "Product",
  registration: "Product",
  verification: "Compliance",
  deposit: "Payments",
  deposit_confirmation: "Payments",
  casino_discovery: "Casino",
  game_launch: "Casino",
  first_bet: "Casino",
  days_1_14: "CRM",
  entry: "Product",
  login: "Product",
  authentication: "Compliance",
  success: "Product",
  resume: "Product",
};

export const FRICTION_SEVERITY_HELP: Record<string, string> = {
  critical: "Can prevent completion or cause abandonment",
  high: "Significant delay, confusion or trust issue",
  medium: "Noticeable friction but recoverable",
  low: "Polish or usability issue",
};

export const FEATURE_BENCHMARK_ROWS: { area: string; criteria: string }[] = [
  { area: "Registration", criteria: "Number of steps" },
  { area: "Registration", criteria: "Number of fields" },
  { area: "Registration", criteria: "Social / wallet signup" },
  { area: "Registration", criteria: "Post-signup welcome touch" },
  { area: "Registration", criteria: "Lands on after signup" },
  { area: "Verification", criteria: "When verification occurs" },
  { area: "Login", criteria: "Steps to login" },
  { area: "Login", criteria: "2FA" },
  { area: "Login", criteria: "Biometrics / passkey" },
  { area: "Deposit", criteria: "Number of steps" },
  { area: "Deposit", criteria: "Payment choice clarity" },
  { area: "Deposit", criteria: "Buy crypto (no wallet)" },
  { area: "Deposit", criteria: "Deposit reassurance" },
  { area: "Activation", criteria: "Deposit → first bet time" },
  { area: "Activation", criteria: "Deposit → first bet clicks" },
  { area: "Casino", criteria: "Casino visibility" },
  { area: "Casino", criteria: "Game search" },
  { area: "Casino", criteria: "Categories / filters" },
  { area: "Casino", criteria: "Recommendations" },
  { area: "Casino", criteria: "Recently played" },
  { area: "Casino", criteria: "Favourites" },
  { area: "Cross-sell", criteria: "Sports → casino prompts" },
  { area: "Cross-sell", criteria: "Casino → sports prompts" },
  { area: "Rewards", criteria: "Rewards visible globally" },
  { area: "Rewards", criteria: "Progress meter" },
  { area: "Rewards", criteria: "Claimable rewards" },
  { area: "Rewards", criteria: "Countdown / urgency" },
  { area: "Rewards", criteria: "Daily / weekly / monthly" },
  { area: "Rewards", criteria: "Withdrawable cash" },
  { area: "UX", criteria: "Main nav labels" },
  { area: "UX", criteria: "Perceived speed" },
  { area: "UX", criteria: "Trust / reassurance" },
];
