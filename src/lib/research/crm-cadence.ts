/**
 * Days 1–14 CRM lens. Every email a brand sends after signup, laid out per
 * day, where its links really go, and a deterministic comparison across
 * competitors (volume, cadence, first-touch speed, destinations).
 * Client-safe — pure functions over the project store.
 */
import { classifyDestination, destinationLabel } from "./post-deposit";
import type {
  EmailWatchItem,
  PlayerDestination,
  ResearchProject,
} from "./types";

export const CRM_WINDOW_DAYS = 14;

const DAY_MS = 86_400_000;

function localMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** When the brand's account was created — Day 1 starts on this calendar day. */
export function brandSignupAt(
  project: ResearchProject,
  brandId: string,
): string | null {
  const runs = project.runs
    .filter((r) => r.brandId === brandId)
    .sort((a, b) => a.dateTested.localeCompare(b.dateTested));
  for (const r of runs) {
    const reg = r.stages.find((s) => s.stageId === "registration");
    if (reg?.endedAt) return reg.endedAt;
    if (reg?.startedAt) return reg.startedAt;
  }
  const first = [...project.emails]
    .filter((e) => e.brandId === brandId)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
  if (first) return first.receivedAt;
  return runs[0]?.dateTested ?? null;
}

/** 1-based calendar day since signup (Day 1 = signup day). 0 = before signup. */
export function crmDay(receivedAt: string, signupAt: string): number {
  const r = new Date(receivedAt);
  const s = new Date(signupAt);
  if (Number.isNaN(r.getTime()) || Number.isNaN(s.getTime())) return 0;
  return Math.floor((localMidnight(r) - localMidnight(s)) / DAY_MS) + 1;
}

export interface EmailLinkDestination {
  url: string;
  resolved: string | null;
  destination: PlayerDestination | null;
}

/** Where an email's links point — resolved targets when we have them. */
export function emailDestinations(e: EmailWatchItem): EmailLinkDestination[] {
  const resolved = new Map(
    (e.resolvedLinks ?? []).map((r) => [r.url, r] as const),
  );
  const out: EmailLinkDestination[] = [];
  for (const url of (e.links ?? []).slice(0, 6)) {
    const r = resolved.get(url);
    const target = r?.resolved ?? url;
    out.push({
      url,
      resolved: r?.resolved ?? null,
      destination:
        r?.destination ??
        classifyDestination(target, `${e.subject} ${e.summary ?? ""}`),
    });
  }
  return out;
}

/** Single headline destination for an email (most player-relevant link). */
export function emailPrimaryDestination(
  e: EmailWatchItem,
): PlayerDestination | null {
  const order: PlayerDestination[] = [
    "casino",
    "sportsbook",
    "cashier",
    "bonus",
    "account",
    "lobby",
    "other",
  ];
  const ds = emailDestinations(e)
    .map((d) => d.destination)
    .filter((d): d is PlayerDestination => Boolean(d));
  for (const o of order) if (ds.includes(o)) return o;
  return null;
}

export interface CrmDay {
  day: number;
  /** Local date (yyyy-mm-dd) this day maps to. */
  date: string;
  emails: EmailWatchItem[];
  isToday: boolean;
  isFuture: boolean;
}

export interface BrandCrmTimeline {
  brandId: string;
  signupAt: string | null;
  /** How many of the window's days have elapsed (1..days), 0 if no signup. */
  daysElapsed: number;
  days: CrmDay[];
  /** Emails that arrived after the window (kept for the list, not the grid). */
  overflow: EmailWatchItem[];
}

export function brandCrmTimeline(
  project: ResearchProject,
  brandId: string,
  windowDays = CRM_WINDOW_DAYS,
): BrandCrmTimeline {
  const signupAt = brandSignupAt(project, brandId);
  const mine = project.emails
    .filter((e) => e.brandId === brandId)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  if (!signupAt) {
    return { brandId, signupAt, daysElapsed: 0, days: [], overflow: mine };
  }
  const start = localMidnight(new Date(signupAt));
  const todayDay = Math.floor((localMidnight(new Date()) - start) / DAY_MS) + 1;
  const days: CrmDay[] = [];
  for (let d = 1; d <= windowDays; d++) {
    const date = new Date(start + (d - 1) * DAY_MS);
    days.push({
      day: d,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      emails: [],
      isToday: d === todayDay,
      isFuture: d > todayDay,
    });
  }
  const overflow: EmailWatchItem[] = [];
  for (const e of mine) {
    const d = crmDay(e.receivedAt, signupAt);
    if (d >= 1 && d <= windowDays) days[d - 1]!.emails.push(e);
    else if (d < 1) days[0]!.emails.push(e); // pre-signup verify mail → Day 1
    else overflow.push(e);
  }
  return {
    brandId,
    signupAt,
    daysElapsed: Math.max(0, Math.min(windowDays, todayDay)),
    days,
    overflow,
  };
}

export interface BrandCrmStats {
  brandId: string;
  brandName: string;
  ownBrand: boolean;
  signupAt: string | null;
  daysElapsed: number;
  complete: boolean;
  total: number;
  /** Excludes verification / OTP mail — the CRM programme proper. */
  crmTotal: number;
  activeDays: number;
  perActiveDay: number;
  perDay: number;
  /** Minutes from signup to the first non-verification email. */
  firstCrmMinutes: number | null;
  /** Days with at least one email, e.g. [1,1,2,4,7]. */
  cadence: number[];
  longestGapDays: number;
  /** Day of the last email inside the window. */
  lastDay: number | null;
  categories: Record<string, number>;
  destinations: Record<string, number>;
  bonusShare: number;
}

export function brandCrmStats(
  project: ResearchProject,
  brandId: string,
  windowDays = CRM_WINDOW_DAYS,
): BrandCrmStats {
  const brand = project.brands.find((b) => b.id === brandId);
  const tl = brandCrmTimeline(project, brandId, windowDays);
  const inWindow = tl.days.flatMap((d) => d.emails);
  const crm = inWindow.filter((e) => e.category !== "verify");
  const categories: Record<string, number> = {};
  const destinations: Record<string, number> = {};
  for (const e of crm) {
    categories[e.category] = (categories[e.category] ?? 0) + 1;
    const d = emailPrimaryDestination(e);
    if (d) destinations[d] = (destinations[d] ?? 0) + 1;
  }
  const activeDayNums = tl.days
    .filter((d) => d.emails.some((e) => e.category !== "verify"))
    .map((d) => d.day);
  const elapsed = tl.daysElapsed;
  let longestGap = 0;
  {
    const marks = [0, ...activeDayNums, elapsed + 1];
    for (let i = 1; i < marks.length; i++) {
      longestGap = Math.max(longestGap, marks[i]! - marks[i - 1]! - 1);
    }
  }
  let firstCrmMinutes: number | null = null;
  if (tl.signupAt && crm[0]) {
    firstCrmMinutes = Math.max(
      0,
      Math.round(
        (new Date(crm[0].receivedAt).getTime() -
          new Date(tl.signupAt).getTime()) /
          60_000,
      ),
    );
  }
  const cadence = crm.map((e) => crmDay(e.receivedAt, tl.signupAt!)).map((d) => Math.max(1, d));
  const bonusish = crm.filter((e) =>
    ["bonus", "vip", "deposit_nudge"].includes(e.category),
  ).length;
  return {
    brandId,
    brandName: brand?.name ?? brandId,
    ownBrand: brand?.role === "own_brand",
    signupAt: tl.signupAt,
    daysElapsed: elapsed,
    complete: elapsed >= windowDays,
    total: inWindow.length,
    crmTotal: crm.length,
    activeDays: activeDayNums.length,
    perActiveDay: activeDayNums.length ? crm.length / activeDayNums.length : 0,
    perDay: elapsed ? crm.length / elapsed : 0,
    firstCrmMinutes,
    cadence,
    longestGapDays: longestGap,
    lastDay: cadence.length ? Math.max(...cadence) : null,
    categories,
    destinations,
    bonusShare: crm.length ? bonusish / crm.length : 0,
  };
}

export function cadenceLabel(cadence: number[]): string {
  if (!cadence.length) return "—";
  const counts = new Map<number, number>();
  for (const d of cadence) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, n]) => (n > 1 ? `D${d}×${n}` : `D${d}`))
    .join(" · ");
}

export function formatFirstTouch(min: number | null): string {
  if (min == null) return "—";
  if (min < 1) return "instant";
  if (min < 60) return `${min} min`;
  if (min < 60 * 48) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}

export function topDestination(stats: BrandCrmStats): string {
  const e = Object.entries(stats.destinations).sort((a, b) => b[1] - a[1])[0];
  return e ? `${destinationLabel(e[0] as PlayerDestination)} (${e[1]})` : "—";
}

export interface CrmComparison {
  stats: BrandCrmStats[];
  /** Minimum elapsed days across brands — the comparison is only as far as the youngest signup. */
  daysElapsed: number;
  complete: boolean;
  insights: string[];
}

/** Deterministic read of who does what — no LLM, reproducible in the report. */
export function crmComparison(
  project: ResearchProject,
  windowDays = CRM_WINDOW_DAYS,
): CrmComparison {
  const stats = project.brands
    .map((b) => brandCrmStats(project, b.id, windowDays))
    .filter((s) => s.signupAt);
  const insights: string[] = [];
  if (!stats.length) {
    return { stats, daysElapsed: 0, complete: false, insights };
  }
  const daysElapsed = Math.min(...stats.map((s) => s.daysElapsed));
  const complete = daysElapsed >= windowDays;
  const own = stats.find((s) => s.ownBrand) ?? null;
  const rivals = stats.filter((s) => !s.ownBrand);
  const name = (s: BrandCrmStats) => s.brandName;
  const scope = complete
    ? `over ${windowDays} days`
    : `so far (day ${daysElapsed} of ${windowDays})`;

  const byVolume = [...stats].sort((a, b) => b.crmTotal - a.crmTotal);
  if (byVolume[0] && byVolume[0].crmTotal > 0) {
    const top = byVolume[0];
    const quiet = byVolume.filter((s) => s.crmTotal === 0);
    insights.push(
      `${name(top)} sends the most CRM mail ${scope}: ${top.crmTotal} email${top.crmTotal === 1 ? "" : "s"} across ${top.activeDays} day${top.activeDays === 1 ? "" : "s"} (${cadenceLabel(top.cadence)}).${
        quiet.length
          ? ` ${quiet.map(name).join(", ")} ${quiet.length === 1 ? "has" : "have"} sent nothing beyond verification.`
          : ""
      }`,
    );
  } else {
    insights.push(`No brand has sent CRM mail beyond verification ${scope}.`);
  }

  const withFirst = stats.filter((s) => s.firstCrmMinutes != null);
  if (withFirst.length) {
    const fastest = [...withFirst].sort(
      (a, b) => a.firstCrmMinutes! - b.firstCrmMinutes!,
    )[0]!;
    const slowest = [...withFirst].sort(
      (a, b) => b.firstCrmMinutes! - a.firstCrmMinutes!,
    )[0]!;
    insights.push(
      fastest.brandId === slowest.brandId
        ? `First CRM touch from ${name(fastest)} lands ${formatFirstTouch(fastest.firstCrmMinutes)} after signup.`
        : `Fastest first touch: ${name(fastest)} (${formatFirstTouch(fastest.firstCrmMinutes)} after signup); slowest: ${name(slowest)} (${formatFirstTouch(slowest.firstCrmMinutes)}).`,
    );
  }

  const gappy = stats
    .filter((s) => s.crmTotal > 0 && s.longestGapDays >= 3)
    .sort((a, b) => b.longestGapDays - a.longestGapDays);
  if (gappy[0]) {
    insights.push(
      `${name(gappy[0])} goes quiet for ${gappy[0].longestGapDays} days at a stretch — the longest silence in the set.`,
    );
  }

  const destSummary = (s: BrandCrmStats) => {
    const e = Object.entries(s.destinations).sort((a, b) => b[1] - a[1]);
    if (!e.length) return null;
    return e
      .slice(0, 2)
      .map(([d, n]) => `${destinationLabel(d as PlayerDestination).toLowerCase()} ×${n}`)
      .join(", ");
  };
  const casinoLed = stats.filter(
    (s) => (s.destinations.casino ?? 0) > (s.destinations.sportsbook ?? 0),
  );
  const sportLed = stats.filter(
    (s) => (s.destinations.sportsbook ?? 0) > (s.destinations.casino ?? 0),
  );
  if (casinoLed.length || sportLed.length) {
    insights.push(
      `Link destinations: ${
        casinoLed.length
          ? `${casinoLed.map(name).join(", ")} route mail to casino`
          : "nobody routes mail to casino"
      }${
        sportLed.length
          ? `; ${sportLed.map(name).join(", ")} push sportsbook`
          : ""
      }.` +
        (own && destSummary(own) ? ` ${name(own)}: ${destSummary(own)}.` : ""),
    );
  }

  const heavyBonus = stats.filter((s) => s.crmTotal >= 2 && s.bonusShare >= 0.6);
  if (heavyBonus.length) {
    insights.push(
      `${heavyBonus.map(name).join(", ")} lead with offers — ${Math.round(
        Math.max(...heavyBonus.map((s) => s.bonusShare)) * 100,
      )}% of their mail is bonus / reload / deposit nudges.`,
    );
  }

  if (own && rivals.length) {
    const rivalAvg =
      rivals.reduce((a, s) => a + s.crmTotal, 0) / Math.max(1, rivals.length);
    if (own.crmTotal < rivalAvg * 0.6) {
      insights.push(
        `${name(own)} is under-mailing: ${own.crmTotal} vs a competitor average of ${rivalAvg.toFixed(1)} ${scope}.`,
      );
    } else if (own.crmTotal > rivalAvg * 1.6 && own.crmTotal >= 3) {
      insights.push(
        `${name(own)} mails ${(own.crmTotal / Math.max(0.5, rivalAvg)).toFixed(1)}× the competitor average — watch unsubscribe pressure.`,
      );
    }
  }

  if (!complete) {
    insights.push(
      `Inbox is re-checked every visit and daily in the background; the final 14-day comparison locks after day ${windowDays}.`,
    );
  }
  return { stats, daysElapsed, complete, insights };
}

/** How far back to pull the shared inbox for this project (hours, capped). */
export function inboxHoursFor(
  project: Pick<ResearchProject, "createdAt">,
  windowDays = CRM_WINDOW_DAYS,
): number {
  const ageH = Math.ceil((Date.now() - Date.parse(project.createdAt)) / 3_600_000);
  return Math.min((windowDays + 2) * 24, Math.max(1, ageH || 1));
}
