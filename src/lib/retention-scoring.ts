/** How much evidence a retention mechanic needs before we show a score. */
export type RetentionEvidence = "public" | "login" | "tracked_play";

export interface RetentionMechanicMeta {
  key: string;
  label: string;
  requires: RetentionEvidence;
  /** Short plain-language description for the "i" tooltip. */
  explanation: string;
  /** Shown when the cell is N/A — tells the user what to do. */
  gapReason: string;
}

export const RETENTION_MECHANIC_META: RetentionMechanicMeta[] = [
  {
    key: "reward_visibility",
    label: "Reward visibility",
    requires: "public",
    explanation:
      "How easy rewards are to find — gift/VIP icon in the header, Rewards hub, Bonus Center, or buried in footer/menus. Stake/Rainbet-class = one click from anywhere.",
    gapReason: "Not visible on the captured loyalty visit.",
  },
  {
    key: "reward_clarity",
    label: "Reward clarity",
    requires: "public",
    explanation:
      "Whether a player instantly understands what they can earn and how — rakeback %, daily/weekly/monthly tiles, tier perks with numbers. Vague 'VIP benefits' copy scores low.",
    gapReason: "Could not assess earning rules from this visit.",
  },
  {
    key: "progress_mechanics",
    label: "Progress mechanics",
    requires: "login",
    explanation:
      "Personal progress toward the next tier — meters, points, rank path, 'X to Silver'. Almost always behind login; scored only when the agent (or you) is signed in.",
    gapReason:
      "Progress meters, tier status, and your level are almost always behind login — we won't score or advise on this until you're signed in.",
  },
  {
    key: "frequency_loop",
    label: "Frequency loop",
    requires: "public",
    explanation:
      "Recurring reward rhythm — daily, weekly, monthly bonuses, reloads, races, raffles. Documented claim tiles and cadence on the rewards hub count; we don't wait weeks of play to score the design.",
    gapReason:
      "No daily/weekly/monthly cadence or recurring claim tiles were visible on the loyalty visit.",
  },
  {
    key: "value_back",
    label: "Value-back mechanics",
    requires: "public",
    explanation:
      "Ongoing return of value — rakeback, cashback, lossback, rebate. A clear rakeback tile beats a one-off welcome bonus dressed as loyalty.",
    gapReason: "Rakeback/rebate mechanics not described on the captured visit.",
  },
  {
    key: "personalisation",
    label: "Personalisation",
    requires: "login",
    explanation:
      "Offers tailored to this player — VIP host, 'for you' reloads, claimable balances. Needs a logged-in session to score honestly.",
    gapReason:
      "Personalisation (your offers, VIP host, tailored reloads) requires a logged-in session.",
  },
  {
    key: "emotional_pull",
    label: "Emotional pull",
    requires: "public",
    explanation:
      "Aspiration and celebration — locked higher tiers with previewed perks, rank-up rewards, races, raffles, trophy VIP pages. Opaque 'invite only' with no path scores low.",
    gapReason: "Aspiration / celebration mechanics not observed.",
  },
  {
    key: "account_integration",
    label: "Account integration",
    requires: "login",
    explanation:
      "Whether rewards connect to account, cashier and play — claim from wallet, VIP progress in account, bonuses next to balance. Needs login.",
    gapReason:
      "Whether rewards connect to account, cashier and play needs login to verify.",
  },
];

export const RETENTION_MECHANICS = RETENTION_MECHANIC_META.map((m) => ({
  key: m.key,
  label: m.label,
}));

export interface RetentionContext {
  /** True when screenshots show an authenticated session (avatar, balance, etc.). */
  loggedIn: boolean;
  /** True when scored from a user-recorded live session, not a one-shot agent visit. */
  fromSession: boolean;
}

/** Strip scores the evidence doesn't support — applied on save and on display. */
export function applyRetentionGates(
  retention: Record<string, number | null> | undefined,
  ctx: RetentionContext
): Record<string, number | null> | undefined {
  if (!retention) return retention;
  const out = { ...retention };
  for (const meta of RETENTION_MECHANIC_META) {
    if (meta.requires === "login" && !ctx.loggedIn) {
      out[meta.key] = null;
    }
    if (meta.requires === "tracked_play" && !ctx.fromSession) {
      out[meta.key] = null;
    }
  }
  return out;
}

export function mechanicGapReason(
  key: string,
  ctx: RetentionContext | undefined
): string {
  const meta = RETENTION_MECHANIC_META.find((m) => m.key === key);
  if (!meta) return "Not observed on this visit.";
  if (meta.requires === "login" && !ctx?.loggedIn) {
    return meta.gapReason;
  }
  if (meta.requires === "tracked_play" && !ctx?.fromSession) {
    return meta.gapReason;
  }
  return meta.gapReason;
}

/** True when we have enough evidence to recommend product changes. */
export function canAdviseOnMechanic(
  key: string,
  ctx: RetentionContext | undefined
): boolean {
  const meta = RETENTION_MECHANIC_META.find((m) => m.key === key);
  if (!meta) return false;
  if (meta.requires === "login" && !ctx?.loggedIn) return false;
  if (meta.requires === "tracked_play" && !ctx?.fromSession) return false;
  return true;
}

/** Drop notes for mechanics we can't honestly score — avoids stale logged-out advice. */
export function sanitizeRetentionNotes(
  retention: Record<string, number | null> | undefined,
  ctx: RetentionContext,
  existing: { key: string; note: string; shot: number | null; improve: string }[] = []
): { key: string; note: string; shot: number | null; improve: string }[] {
  const gated = applyRetentionGates(retention, ctx);
  return existing.filter((n) => {
    const meta = RETENTION_MECHANIC_META.find((m) => m.key === n.key);
    if (!meta) return true;
    if (!canAdviseOnMechanic(n.key, ctx) && gated?.[n.key] == null) {
      return false;
    }
    return true;
  });
}

/** Notes for gated N/A mechanics so the UI still explains what's missing. */
export function fillGatedRetentionNotes(
  retention: Record<string, number | null> | undefined,
  ctx: RetentionContext,
  existing: { key: string; note: string; shot: number | null; improve: string }[] = []
): { key: string; note: string; shot: number | null; improve: string }[] {
  const sanitized = sanitizeRetentionNotes(retention, ctx, existing);
  const byKey = new Map(sanitized.map((n) => [n.key, n]));
  for (const meta of RETENTION_MECHANIC_META) {
    if (retention?.[meta.key] != null) continue;
    if (meta.requires === "login" && !ctx.loggedIn) {
      byKey.set(meta.key, {
        key: meta.key,
        note: `Not scored — visit was logged out. ${meta.gapReason}`,
        shot: null,
        improve:
          "Launch the site, sign in, and capture the logged-in rewards hub — many brands hide progress meters and tier status until login.",
      });
    } else if (meta.requires === "tracked_play" && !ctx.fromSession) {
      byKey.set(meta.key, {
        key: meta.key,
        note: `Not scored — cadence needs tracked play over time. ${meta.gapReason}`,
        shot: null,
        improve:
          "Record multiple play sessions over days/weeks — track claims, reloads, and outbound comms.",
      });
    }
  }
  return [...byKey.values()];
}
