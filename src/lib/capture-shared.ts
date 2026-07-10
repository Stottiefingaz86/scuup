/** Helpers shared by the capture popup (client) and the capture API
 * (server). Must stay free of Node-only imports. */

export const MONEY_RE =
  /(?:[$£€]\s?\d[\d,]*(?:\.\d+)?)|(?:\d+\.\d{2,}\s?(?:USDT|BTC|ETH|SOL|LTC))/gi;

/** URL → journey classification, most specific first ("deposit" must win
 * over "casino" when both appear in a cashier URL). */
const JOURNEY_URL_PATTERNS: [string, RegExp][] = [
  ["withdraw", /withdraw|cash-?out|payout/],
  ["deposit", /deposit|cashier|top-?up|wallet/],
  ["loyalty_rewards", /reward|vip|loyal|rakeback|rebate|bonus|promo/],
  ["signup", /sign-?up|register|registration|join/],
  ["support", /support|help|faq|contact/],
  ["my_account", /account|profile|settings|verification|kyc/],
  ["sports_betslip", /sport|betslip/],
  ["casino", /casino|game|slot|live-?dealer|play/],
];

export function classifyUrl(url: string): string | null {
  const u = url.toLowerCase();
  for (const [journey, re] of JOURNEY_URL_PATTERNS) {
    if (re.test(u)) return journey;
  }
  return null;
}

/** Human label + kind for a balance change, based on where it happened. */
export function classifyMoneyChange(url: string): {
  kind: "money" | "reward";
  label: string;
} {
  const at = url.toLowerCase();
  if (/withdraw|cash.?out|payout/.test(at)) {
    return { kind: "money", label: "Withdrawal activity detected" };
  }
  if (/deposit|cashier|top.?up|wallet/.test(at)) {
    return { kind: "money", label: "Deposit / cashier activity detected" };
  }
  if (/reward|vip|loyal|rakeback|rebate/.test(at)) {
    return { kind: "reward", label: "Reward value change detected" };
  }
  if (/casino|game|slot|sport|bet|play/.test(at)) {
    return { kind: "money", label: "Stake / balance change while playing" };
  }
  return { kind: "money", label: "Balance / amount change detected" };
}

/** A screenshot reference accumulated by the popup during a session. */
export interface SessionShotRef {
  /** Seconds since session start. */
  at: number;
  /** Page URL when the shot was taken. */
  url: string;
  /** Where the persisted jpeg lives (public URL or /api/evidence path). */
  storedUrl: string;
}
