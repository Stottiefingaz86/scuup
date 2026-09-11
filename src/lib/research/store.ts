"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { emptyStagesFor } from "./journeys";
import { defaultResearchPersona } from "./persona-address";
import { teardownFromRun } from "./teardown-summary";
import { reconcilePostDeposit } from "./post-deposit";
import { emptyPostSignup, knownSignupLanding } from "./post-signup";
import { researchSignupEmail } from "./signup-email";
import { extractUsernameFromEmails } from "./account-username";
import {
  bodyLooksLikeBrand,
  brandWatchSlugs,
  isForeignResearchAlias,
  plusTagMatchesProjectBrand,
  senderLooksLikeBrand,
} from "./email-brand";
import {
  dedupeWatchEmails,
  isLoginAlertEmail,
  isRacesEmail,
  isRetentionCrmEmail,
  isVipProgramEmail,
} from "./email-format";
import { autoMarketForBrands } from "../brand-markets";
import { isProductionDeployPublic } from "@/lib/prod-locks";
import type {
  EmailWatchItem,
  JourneyKind,
  JourneyMetrics,
  JourneyRun,
  JourneyStageResult,
  PlayerVoice,
  PostDepositObservation,
  ResearchBrand,
  ResearchPersona,
  ResearchProject,
} from "./types";

const STORAGE_KEY = "scuup-research-projects-v1";

function emptyMetrics(): JourneyMetrics {
  return {
    totalTimeSec: null,
    totalActions: null,
    totalScreens: null,
    totalFormFields: null,
    totalWaitSec: null,
    redirects: null,
    errors: null,
    depositToFirstBetSec: null,
    depositToFirstBetClicks: null,
  };
}

function hostToName(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname;
    const raw = host.replace(/^www\./, "").split(".")[0] ?? "Brand";
    const known: Record<string, string> = {
      betonline: "BetOnline",
      stake: "Stake",
      rainbet: "Rainbet",
      bovada: "Bovada",
      winna: "Winna",
    };
    return (
      known[raw.toLowerCase()] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
    );
  } catch {
    return "Brand";
  }
}

function faviconFor(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}

/** Same set as localhost: BetOnline vs Rainbet, Bovada, Winna (mobile). */
function defaultResearchProject(): ResearchProject {
  const ownBrandUrl = "https://www.betonline.ag";
  const competitorUrls = [
    "https://rainbet.com",
    "https://www.bovada.lv",
    "https://winna.com",
  ];
  const market = autoMarketForBrands([ownBrandUrl, ...competitorUrls]);
  const makeBrand = (
    url: string,
    role: ResearchBrand["role"],
  ): ResearchBrand => {
    const name = hostToName(url);
    return {
      id: crypto.randomUUID(),
      role,
      name,
      url,
      favicon: faviconFor(url),
      accountEmail: researchSignupEmail(name),
      accountPassword: null,
      accountReady: false,
    };
  };
  return {
    id: "rs-betonline-teardown",
    name: "Betonline first-bet teardown",
    market,
    device: "mobile",
    createdAt: new Date().toISOString(),
    brands: [
      makeBrand(ownBrandUrl, "own_brand"),
      ...competitorUrls.map((u) => makeBrand(u, "competitor")),
    ],
    persona: defaultResearchPersona(market),
    runs: [],
    teardowns: [],
    emails: [],
    emailWatchDays: 14,
  };
}

function load(): ResearchProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const projects = JSON.parse(raw) as ResearchProject[];
    if (!Array.isArray(projects)) return [];
    // Older runs stored a nav-word guess for "landed on"; re-derive it from
    // the evidence on the record so the report states what happened.
    for (const p of projects) {
      for (const r of p.runs ?? []) {
        if (r.postDeposit) r.postDeposit = reconcilePostDeposit(r.postDeposit);
        const brand =
          p.brands.find((b) => b.id === r.brandId)?.name ?? "";
        const known = knownSignupLanding(brand);
        if (known) {
          r.postSignup = {
            ...(r.postSignup ?? emptyPostSignup()),
            landedOn: known.landedOn,
            clicksToWallet: known.clicksToWallet,
          };
        }
      }
    }
    return projects;
  } catch {
    return [];
  }
}

function runCount(projects: ResearchProject[]): number {
  return projects.reduce((n, p) => n + (p.runs?.length ?? 0), 0);
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let readyToPush = false;

function queuePush(projects: ResearchProject[]) {
  if (typeof window === "undefined" || !readyToPush) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void fetch("/api/research/workspace", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projects }),
    }).catch(() => {});
  }, 400);
}

function save(projects: ResearchProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  emit();
  queuePush(projects);
}

let hydrated = false;

/** Apply the server workspace. Never let an empty local seed hide real runs. */
export function adoptRemoteProjects(remote: ResearchProject[]): void {
  if (typeof window === "undefined") return;
  const local = getSnapshot();
  if (runCount(remote) > 0 && runCount(remote) >= runCount(local)) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
    } catch {
      cache = remote;
      emit();
      readyToPush = true;
      hydrated = true;
      return;
    }
    emit();
  }
  readyToPush = true;
  hydrated = true;
}

async function hydrateFromSupabase(): Promise<void> {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const res = await fetch("/api/research/workspace", {
      credentials: "same-origin",
    });
    if (!res.ok) {
      readyToPush = true;
      return;
    }
    const data = (await res.json()) as { projects?: ResearchProject[] };
    const remote = Array.isArray(data.projects) ? data.projects : [];
    adoptRemoteProjects(remote);
    if (runCount(remote) === 0 && runCount(getSnapshot()) > 0) {
      queuePush(getSnapshot());
    }
  } catch {
    readyToPush = true;
  }
}

let cache: ResearchProject[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  cache = null;
  for (const l of listeners) l();
}

function getSnapshot(): ResearchProject[] {
  if (cache) return cache;
  cache = load();
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY_PROJECTS: ResearchProject[] = [];

export const ResearchServerProjects = createContext<ResearchProject[]>([]);

export function useResearchProjects(): ResearchProject[] {
  const server = useContext(ResearchServerProjects);
  const projects = useSyncExternalStore(subscribe, getSnapshot, () => server);
  useEffect(() => {
    void hydrateFromSupabase();
  }, []);
  return runCount(projects) > 0
    ? projects
    : server.length > 0
      ? server
      : projects;
}

export function useResearchProject(id: string): ResearchProject | null {
  const all = useResearchProjects();
  return all.find((p) => p.id === id) ?? null;
}

export function getResearchProject(id: string): ResearchProject | null {
  return getSnapshot().find((p) => p.id === id) ?? null;
}

export function createResearchProject(input: {
  name: string;
  market: string;
  device: ResearchProject["device"];
  ownBrandUrl: string;
  competitorUrls: string[];
}): ResearchProject {
  if (isProductionDeployPublic()) {
    throw new Error("New reports are paused. Existing reports stay readable.");
  }
  const brands: ResearchBrand[] = [
    {
      id: crypto.randomUUID(),
      role: "own_brand" as const,
      name: hostToName(input.ownBrandUrl),
      url: input.ownBrandUrl.startsWith("http")
        ? input.ownBrandUrl
        : `https://${input.ownBrandUrl}`,
      favicon: faviconFor(input.ownBrandUrl),
      accountEmail: researchSignupEmail(hostToName(input.ownBrandUrl)),
      accountPassword: null,
      accountReady: false,
    },
    ...input.competitorUrls
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => {
        const name = hostToName(url);
        return {
          id: crypto.randomUUID(),
          role: "competitor" as const,
          name,
          url: url.startsWith("http") ? url : `https://${url}`,
          favicon: faviconFor(url),
          accountEmail: researchSignupEmail(name),
          accountPassword: null,
          accountReady: false,
        };
      }),
  ];

  const project: ResearchProject = {
    id: `rs-${Date.now().toString(36)}`,
    name: input.name,
    market: input.market,
    device: input.device,
    createdAt: new Date().toISOString(),
    brands,
    persona: defaultResearchPersona(input.market),
    runs: [],
    teardowns: [],
    emails: [],
    emailWatchDays: 14,
  };

  const next = [project, ...getSnapshot()];
  save(next);
  return project;
}

/** Write a project the UI is showing — even if localStorage only has a seed. */
function writeResearchProject(project: ResearchProject): ResearchProject {
  const all = getSnapshot();
  const idx = all.findIndex((p) => p.id === project.id);
  const next =
    idx < 0 ? [project, ...all] : all.map((p, i) => (i === idx ? project : p));
  save(next);
  return project;
}

export function updateResearchProject(
  id: string,
  patch: Partial<ResearchProject>,
): ResearchProject | null {
  const existing = getSnapshot().find((p) => p.id === id);
  if (!existing) return null;
  return writeResearchProject({ ...existing, ...patch, id });
}

export function markInboxSwept(projectId: string): void {
  updateResearchProject(projectId, {
    lastInboxSweepAt: new Date().toISOString(),
  });
}

export function saveResearchPersona(
  projectId: string,
  persona: ResearchPersona,
): void {
  updateResearchProject(projectId, { persona });
}

/** Persist the signup address used for a brand (login/deposit reuse). */
export function saveBrandAccountEmail(
  projectId: string,
  brandId: string,
  accountEmail: string,
): void {
  const project = getResearchProject(projectId);
  if (!project) return;
  updateResearchProject(projectId, {
    brands: project.brands.map((b) =>
      b.id === brandId ? { ...b, accountEmail } : b,
    ),
  });
}

/** Store the Voice of Player synthesis for a brand (null clears it).
 * Themes already carry their evidence reviews inline — if localStorage is
 * full we drop the duplicate top-level corpus and keep those. */
export function saveBrandPlayerVoice(
  projectId: string,
  brandId: string,
  playerVoice: PlayerVoice | null,
): void {
  const project = getResearchProject(projectId);
  if (!project) return;
  const apply = (voice: PlayerVoice | null) => {
    updateResearchProject(projectId, {
      brands: project.brands.map((b) =>
        b.id === brandId ? { ...b, playerVoice: voice } : b,
      ),
    });
  };
  try {
    apply(playerVoice);
  } catch (e) {
    const quota =
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.code === 22);
    if (!quota || !playerVoice) throw e;
    // Drop the bulk corpus; each theme still has `evidence`.
    const { reviews: _drop, ...rest } = playerVoice;
    void _drop;
    apply({ ...rest, reviews: undefined });
  }
}

/** Persist the brand-issued username / account id used at login. */
export function saveBrandAccountUsername(
  projectId: string,
  brandId: string,
  accountUsername: string,
): void {
  const project = getResearchProject(projectId);
  if (!project) return;
  const name = accountUsername.trim();
  if (!name) return;
  updateResearchProject(projectId, {
    brands: project.brands.map((b) =>
      b.id === brandId ? { ...b, accountUsername: name } : b,
    ),
  });
}

export function resolveBrandAccountUsername(
  project: ResearchProject,
  brandId: string,
): string {
  const brand = project.brands.find((b) => b.id === brandId);
  const saved = brand?.accountUsername?.trim() ?? "";
  if (saved) return saved;
  const fromMail = extractUsernameFromEmails(
    project.emails.filter((e) => e.brandId === brandId),
  );
  return fromMail ?? "";
}

export { extractUsernameFromEmails };

/** Persist the password used at signup — login must reuse this exact value. */
export function saveBrandAccountPassword(
  projectId: string,
  brandId: string,
  accountPassword: string,
): void {
  const project = getResearchProject(projectId);
  if (!project) return;
  const pw = accountPassword.trim();
  if (!pw) return;
  updateResearchProject(projectId, {
    brands: project.brands.map((b) =>
      b.id === brandId ? { ...b, accountPassword: pw } : b,
    ),
  });
}

/** Password for this brand: saved at signup, else current persona. */
export function resolveBrandAccountPassword(
  project: ResearchProject,
  brandId: string,
): string {
  const brand = project.brands.find((b) => b.id === brandId);
  return (
    brand?.accountPassword?.trim() || project.persona?.password?.trim() || ""
  );
}

/** Mark that registration finished — only then may we login instead of signup. */
export function markBrandAccountReady(
  projectId: string,
  brandId: string,
  ready = true,
): void {
  const project = getResearchProject(projectId);
  if (!project) return;
  updateResearchProject(projectId, {
    brands: project.brands.map((b) =>
      b.id === brandId ? { ...b, accountReady: ready } : b,
    ),
  });
}

/** Merge monitored emails from a teardown job into the project store. */
export function mergeResearchEmails(
  projectId: string,
  emails: import("./types").EmailWatchItem[],
): void {
  if (!emails.length) return;
  const project = getResearchProject(projectId);
  if (!project) return;
  let scoped = scopeEmailsToProject(project, emails);
  const seen = new Set(scoped.map((e) => e.id));
  for (const e of emails) {
    if (seen.has(e.id) || isLoginAlertEmail(e)) continue;
    const brand = project.brands.find(
      (b) =>
        senderLooksLikeBrand(e.from, b.url) ||
        plusTagMatchesProjectBrand(`${e.to ?? ""}\n${e.subject}`, b),
    );
    if (!brand) continue;
    scoped.push({ ...e, brandId: brand.id });
    seen.add(e.id);
  }
  if (!scoped.length) return;

  const byId = new Map(project.emails.map((e) => [e.id, e]));
  for (const e of scoped) {
    const prev = byId.get(e.id);
    if (
      prev &&
      isProjectBrandId(project, prev.brandId) &&
      isProjectBrandId(project, e.brandId) &&
      prev.brandId !== e.brandId
    ) {
      // Keep the original brand attribution — don't reassign Winna ↔ Bovada.
      continue;
    }
    if (prev) {
      byId.set(e.id, {
        ...prev,
        ...e,
        brandId: isProjectBrandId(project, prev.brandId)
          ? prev.brandId
          : e.brandId,
        to: e.to || prev.to,
        html: e.html || prev.html,
        // The agent tags mail with the journey stage it arrived in; a later
        // generic inbox sync ("inbox") must not erase that.
        stageId:
          prev.stageId && prev.stageId !== "inbox" ? prev.stageId : e.stageId,
        resolvedLinks: e.resolvedLinks?.length
          ? e.resolvedLinks
          : prev.resolvedLinks,
        screenshotUrls: [
          ...new Set([
            ...(prev.screenshotUrls ?? []),
            ...(e.screenshotUrls ?? []),
          ]),
        ],
      });
    } else {
      byId.set(e.id, e);
    }
  }
  updateResearchProject(projectId, {
    emails: dedupeWatchEmails([...byId.values()]).sort((a, b) =>
      b.receivedAt.localeCompare(a.receivedAt),
    ),
  });
}

/** Attach resolved link destinations to stored emails (by email id). */
export function patchResearchEmailLinks(
  projectId: string,
  patches: {
    emailId: string;
    resolvedLinks: EmailWatchItem["resolvedLinks"];
  }[],
): void {
  if (!patches.length) return;
  const project = getResearchProject(projectId);
  if (!project) return;
  const byId = new Map(patches.map((p) => [p.emailId, p.resolvedLinks]));
  updateResearchProject(projectId, {
    emails: project.emails.map((e) =>
      byId.has(e.id) ? { ...e, resolvedLinks: byId.get(e.id) ?? [] } : e,
    ),
  });
}

function isProjectBrandId(project: ResearchProject, brandId: string): boolean {
  return project.brands.some((b) => b.id === brandId);
}

function plusRsTag(hay: string): string | null {
  return hay.toLowerCase().match(/\+rs([a-z0-9]+)(?:@|$)/)?.[1] ?? null;
}

function greetedUsername(text: string): string | null {
  const m = /\bhi[,]?\s+([a-z0-9._-]{4,24})\b/i.exec(text);
  if (!m?.[1] || /there|friend|player|user|team/i.test(m[1])) return null;
  return m[1].toLowerCase();
}

/** When this brand's real account started getting mail (not older +rs mints). */
function brandAccountAnchorMs(
  project: ResearchProject,
  brand: ResearchBrand,
): number | null {
  const alias = brand.accountEmail?.trim().toLowerCase() ?? "";
  const user = (
    brand.accountUsername?.trim() ||
    extractUsernameFromEmails(
      project.emails.filter((e) => e.brandId === brand.id),
    ) ||
    ""
  ).toLowerCase();
  let earliest: number | null = null;
  const consider = (iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t)) return;
    earliest = earliest == null ? t : Math.min(earliest, t);
  };
  for (const e of project.emails) {
    const to = (e.to ?? "").toLowerCase();
    const hay =
      `${to}\n${e.subject}\n${e.summary}\n${e.body ?? ""}`.toLowerCase();
    const greeted = greetedUsername(hay);
    const hit =
      (alias && (to.includes(alias) || hay.includes(alias))) ||
      (user.length >= 4 && hay.includes(user)) ||
      (greeted && user && greeted === user) ||
      (greeted && alias && plusRsTag(alias) === plusRsTag(to));
    if (hit) consider(e.receivedAt);
  }
  const run = [...project.runs]
    .filter((r) => r.brandId === brand.id && !r.archived)
    .at(-1);
  consider(run?.startedAt ?? null);
  consider(
    run?.stages.find((s) => s.stageId === "registration")?.startedAt ?? null,
  );
  return earliest;
}

function mailBelongsToBrandAccount(
  project: ResearchProject,
  brand: ResearchBrand,
  email: EmailWatchItem,
): boolean {
  const alias = brand.accountEmail?.trim().toLowerCase() ?? "";
  const to = (email.to ?? "").toLowerCase();
  const hay =
    `${to}\n${email.subject}\n${email.summary}\n${email.body ?? ""}`.toLowerCase();
  const user = (
    brand.accountUsername?.trim() ||
    extractUsernameFromEmails(
      project.emails.filter((e) => e.brandId === brand.id),
    ) ||
    ""
  ).toLowerCase();
  if (alias && (to.includes(alias) || hay.includes(alias))) return true;
  if (user.length >= 4 && hay.includes(user)) return true;
  const greeted = greetedUsername(hay);
  if (greeted && user && greeted === user) return true;

  // VIP / races from this operator stay on the brand even when To: is a
  // sibling +rs mint. Timeline sort puts them after confirm/welcome/deposit.
  if (
    isRetentionCrmEmail(email) &&
    (senderLooksLikeBrand(email.from, brand.url) ||
      plusTagMatchesProjectBrand(to, brand) ||
      plusTagMatchesProjectBrand(hay, brand))
  ) {
    const received = Date.parse(email.receivedAt) || 0;
    const since = Date.parse(project.createdAt) || 0;
    const watchMs = (project.emailWatchDays || 14) * 86_400_000;
    if (!since || !received || received >= since - watchMs) return true;
  }

  const storedTag = plusRsTag(alias);
  const incomingTag = plusRsTag(to);
  if (storedTag && incomingTag && incomingTag === storedTag) return true;

  const received = Date.parse(email.receivedAt) || 0;
  const anchor = brandAccountAnchorMs(project, brand);
  const afterAccount =
    !anchor || (received > 0 && received >= anchor - 2 * 3_600_000);

  // Other +rs nonce or sender-only CRM: keep only after this account exists
  // (BetOnline contests) — drop older Winna VIP to failed signups.
  if (storedTag && incomingTag && incomingTag !== storedTag) {
    return afterAccount && plusTagMatchesProjectBrand(to, brand);
  }
  if (!incomingTag && senderLooksLikeBrand(email.from, brand.url)) {
    return afterAccount;
  }
  if (!alias) return true;
  return false;
}

/**
 * Only keep mail that belongs to this project's current +aliases and arrived
 * after the project was created. Never pull sibling-brand / prior-run inbox noise.
 */
export function scopeEmailsToProject(
  project: ResearchProject,
  emails: EmailWatchItem[],
): EmailWatchItem[] {
  const aliases = project.brands
    .map((b) => b.accountEmail?.trim().toLowerCase())
    .filter((a): a is string => Boolean(a));

  const sinceMs = Date.parse(project.createdAt) || 0;
  const watchMs = (project.emailWatchDays || 14) * 86_400_000;
  const extraSlugs = project.brands.flatMap((b) => brandWatchSlugs(b));

  return emails.flatMap((m) => {
    const receivedMs = Date.parse(m.receivedAt) || 0;
    if (sinceMs && receivedMs && receivedMs < sinceMs - watchMs) return [];
    if (isLoginAlertEmail(m)) return [];

    const brandId = matchEmailToProjectBrand(project, m, aliases, extraSlugs);
    if (!brandId) return [];
    const brand = project.brands.find((b) => b.id === brandId);
    if (brand && !mailBelongsToBrandAccount(project, brand, m)) return [];
    return [{ ...m, brandId }];
  });
}

/** Re-attribute stored mail for the timeline — one account per brand. */
export function emailsForDisplay(project: ResearchProject): EmailWatchItem[] {
  return capRetentionCrm(
    project,
    dedupeWatchEmails(scopeEmailsToProject(project, project.emails)),
  );
}

/**
 * Sibling +rs mints get the same VIP / races blast. One VIP Program
 * card (this account, else newest) and one Races — after confirm /
 * welcome / deposit.
 */
function capRetentionCrm(
  project: ResearchProject,
  emails: EmailWatchItem[],
): EmailWatchItem[] {
  const out: EmailWatchItem[] = [];
  const vips = new Map<string, EmailWatchItem[]>();
  const races = new Map<string, EmailWatchItem[]>();
  for (const e of emails) {
    if (isVipProgramEmail(e)) {
      const list = vips.get(e.brandId) ?? [];
      list.push(e);
      vips.set(e.brandId, list);
      continue;
    }
    if (isRacesEmail(e)) {
      const list = races.get(e.brandId) ?? [];
      list.push(e);
      races.set(e.brandId, list);
      continue;
    }
    out.push(e);
  }
  for (const brand of project.brands) {
    const alias = brand.accountEmail?.trim().toLowerCase() ?? "";
    const brandVips = (vips.get(brand.id) ?? []).sort((a, b) =>
      a.receivedAt.localeCompare(b.receivedAt),
    );
    const vip =
      brandVips.findLast((e) => (e.to ?? "").toLowerCase().includes(alias)) ??
      brandVips.at(-1);
    if (vip) out.push(vip);

    const brandRaces = (races.get(brand.id) ?? []).sort((a, b) =>
      a.receivedAt.localeCompare(b.receivedAt),
    );
    const race =
      brandRaces.find((e) => (e.to ?? "").toLowerCase().includes(alias)) ??
      brandRaces[0];
    if (race) out.push(race);
  }
  return out;
}

function matchEmailToProjectBrand(
  project: ResearchProject,
  email: EmailWatchItem,
  aliases: string[],
  extraSlugs: string[],
): string | null {
  const to = (email.to ?? "").toLowerCase();
  const hay =
    `${to}\n${email.from}\n${email.subject}\n${email.summary}\n${email.body ?? ""}`.toLowerCase();

  // From: support@winna.com is Winna — even when To is a later +rswinna mint.
  for (const b of project.brands) {
    if (!senderLooksLikeBrand(email.from, b.url)) continue;
    if (
      isForeignResearchAlias(to, aliases, extraSlugs) &&
      !plusTagMatchesProjectBrand(to, b) &&
      !plusTagMatchesProjectBrand(hay, b)
    ) {
      continue;
    }
    return b.id;
  }

  for (const b of project.brands) {
    const alias = b.accountEmail?.trim().toLowerCase();
    if (alias && (to.includes(alias) || hay.includes(alias))) return b.id;
  }

  for (const b of project.brands) {
    if (plusTagMatchesProjectBrand(to, b) || plusTagMatchesProjectBrand(hay, b)) {
      return b.id;
    }
  }

  for (const b of project.brands) {
    if (bodyLooksLikeBrand(hay, b) && !isForeignResearchAlias(to, aliases, extraSlugs)) {
      return b.id;
    }
  }

  if (isProjectBrandId(project, email.brandId)) {
    const brand = project.brands.find((b) => b.id === email.brandId);
    if (brand && senderLooksLikeBrand(email.from, brand.url)) return email.brandId;
    if (!to) return email.brandId;
  }

  return null;
}

/** Drop inbox noise that doesn't belong to current aliases / project window. */
export function pruneProjectEmails(projectId: string): void {
  const project = getResearchProject(projectId);
  if (!project || project.emails.length === 0) return;
  const kept = scopeEmailsToProject(project, project.emails);
  if (kept.length === project.emails.length) {
    // Still rewrite brandIds if scope remapped any.
    const same = kept.every(
      (e, i) =>
        e.id === project.emails[i]?.id &&
        e.brandId === project.emails[i]?.brandId,
    );
    if (same) return;
  }
  updateResearchProject(projectId, {
    emails: dedupeWatchEmails(kept).sort((a, b) =>
      b.receivedAt.localeCompare(a.receivedAt),
    ),
  });
}

/**
 * Strong inbox proof only: welcome/verify mail for this brand (or exact +alias).
 * Reserved aliases and marketing mail do NOT count — that was inventing accounts.
 */
export function brandHasSignupEvidence(
  project: ResearchProject,
  brandId: string,
): boolean {
  const brand = project.brands.find((b) => b.id === brandId);
  if (!brand) return false;
  const alias = brand.accountEmail?.trim().toLowerCase() ?? "";

  return project.emails.some((e) => {
    if (e.category !== "verify" && e.category !== "welcome") return false;
    if (e.brandId === brandId) return true;
    if (!alias) return false;
    const hay =
      `${e.from} ${e.subject} ${e.summary} ${e.body ?? ""}`.toLowerCase();
    return hay.includes(alias);
  });
}

/**
 * Promote brands to accountReady only on welcome/verify evidence.
 * Never clears ready — only resetBrandFresh does.
 */
export function syncBrandAccountsFromEmails(projectId: string): void {
  const project = getResearchProject(projectId);
  if (!project || project.emails.length === 0) return;

  const emails = project.emails.map((e) => {
    const inferred = inferEmailBrandId(project, e);
    return inferred && inferred !== e.brandId ? { ...e, brandId: inferred } : e;
  });

  const brands = project.brands.map((b) => {
    if (b.accountReady) return b;
    if (!brandHasSignupEvidence({ ...project, emails }, b.id)) return b;
    return { ...b, accountReady: true };
  });

  const changed =
    JSON.stringify(emails) !== JSON.stringify(project.emails) ||
    brands.some((b, i) => b.accountReady !== project.brands[i]?.accountReady);
  if (!changed) return;

  updateResearchProject(projectId, { emails, brands });
}

function inferEmailBrandId(
  project: ResearchProject,
  email: EmailWatchItem,
): string | null {
  if (project.brands.some((b) => b.id === email.brandId)) return email.brandId;

  const hay =
    `${email.from} ${email.subject} ${email.summary} ${email.body ?? ""}`.toLowerCase();

  for (const b of project.brands) {
    const alias = b.accountEmail?.trim().toLowerCase() ?? "";
    // Exact alias only — never guess from brand domain alone (false "exists").
    if (alias && hay.includes(alias)) return b.id;
  }
  for (const b of project.brands) {
    if (senderLooksLikeBrand(email.from, b.url)) return b.id;
  }
  return null;
}

/**
 * Source of truth: explicit accountReady + saved email.
 * Failed runs never clear this — only resetBrandFresh does.
 */
export function brandHasTestAccount(
  project: ResearchProject,
  brandId: string,
): boolean {
  const brand = project.brands.find((b) => b.id === brandId);
  return Boolean(brand?.accountReady && brand?.accountEmail?.trim());
}

export function brandHasCompletedSignup(
  project: ResearchProject,
  brandId: string,
): boolean {
  return brandHasTestAccount(project, brandId);
}

/** Email reserved but not marked registered. */
export function brandHasReservedEmailOnly(
  project: ResearchProject,
  brandId: string,
): boolean {
  const brand = project.brands.find((b) => b.id === brandId);
  return Boolean(
    brand?.accountEmail?.trim() && !brandHasTestAccount(project, brandId),
  );
}

const PRE_DEPOSIT_STAGE_IDS = new Set([
  "landing",
  "registration",
  "verification",
]);

/** Signup stages from a finished walk — deposit/play get a fresh stopwatch. */
export function seedClockStagesFrom(run: JourneyRun): JourneyStageResult[] {
  const blank = emptyStagesFor(run.kind);
  return blank.map((st) => {
    if (!PRE_DEPOSIT_STAGE_IDS.has(st.stageId)) return st;
    const kept = run.stages.find((s) => s.stageId === st.stageId);
    return kept?.endedAt ? { ...kept } : st;
  });
}

/**
 * Hide this brand's walks without wiping the account. The next deposit
 * redo keeps the same login. Returns seed data from the newest complete run.
 */
export function archiveBrandJourneyRuns(
  projectId: string,
  brandId: string,
): {
  seedStages: JourneyStageResult[];
  postSignup: JourneyRun["postSignup"];
  features: JourneyRun["features"];
  lobby: JourneyRun["lobby"];
} | null {
  const project = getResearchProject(projectId);
  if (!project) return null;
  const source =
    [...project.runs]
      .reverse()
      .find(
        (r) =>
          r.brandId === brandId &&
          r.kind === "new_player_first_bet" &&
          (r.status === "complete" ||
            r.stages.some(
              (s) => PRE_DEPOSIT_STAGE_IDS.has(s.stageId) && s.endedAt,
            )),
      ) ?? null;
  updateResearchProject(projectId, {
    runs: project.runs.map((r) =>
      r.brandId === brandId && !r.archived ? { ...r, archived: true } : r,
    ),
  });
  if (!source) return null;
  return {
    seedStages: seedClockStagesFrom(source),
    postSignup: source.postSignup ?? null,
    features: source.features ?? null,
    lobby: source.lobby ?? null,
  };
}

/**
 * Clean slate for one brand: new +alias, not registered, wipe that brand's
 * runs / emails / teardowns so Overview stops showing stale failures.
 */
export function resetBrandFresh(
  projectId: string,
  brandId: string,
): string | null {
  const project = getResearchProject(projectId);
  if (!project) return null;
  const brand = project.brands.find((b) => b.id === brandId);
  if (!brand) return null;

  const accountEmail = researchSignupEmail(brand.name);
  updateResearchProject(projectId, {
    brands: project.brands.map((b) =>
      b.id === brandId
        ? {
            ...b,
            accountEmail,
            accountPassword: null,
            accountUsername: null,
            accountReady: false,
          }
        : b,
    ),
    runs: project.runs.filter((r) => r.brandId !== brandId),
    teardowns: project.teardowns.filter((t) => t.brandId !== brandId),
    emails: project.emails.filter((e) => e.brandId !== brandId),
  });
  return accountEmail;
}

/** Fresh emails for every brand that is not marked registered. */
export function resetUnregisteredBrandsFresh(projectId: string): number {
  const project = getResearchProject(projectId);
  if (!project) return 0;
  const ids = project.brands
    .filter((b) => !brandHasTestAccount(project, b.id))
    .map((b) => b.id);
  for (const id of ids) resetBrandFresh(projectId, id);
  return ids.length;
}

/** Nuclear: new emails + clear ready for all brands. */
export function resetAllBrandsFresh(projectId: string): number {
  const project = getResearchProject(projectId);
  if (!project) return 0;
  for (const b of project.brands) {
    resetBrandFresh(projectId, b.id);
  }
  return project.brands.length;
}

function normalizeBrandUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function brandHostKey(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Add a competitor to an existing project (e.g. stake.com). */
export function addResearchCompetitor(
  live: ResearchProject,
  rawUrl: string,
): ResearchBrand | { error: string } {
  if (isProductionDeployPublic()) {
    return { error: "Adding brands is paused on production." };
  }
  const url = normalizeBrandUrl(rawUrl);
  if (!url) return { error: "Enter a site like stake.com" };
  const host = brandHostKey(url);
  if (live.brands.some((b) => brandHostKey(b.url) === host)) {
    return { error: `${hostToName(url)} is already on this report` };
  }
  if (live.brands.filter((b) => b.role === "competitor").length >= 8) {
    return { error: "This report already has eight competitors" };
  }
  const name = hostToName(url);
  const brand: ResearchBrand = {
    id: crypto.randomUUID(),
    role: "competitor",
    name,
    url,
    favicon: faviconFor(url),
    accountEmail: researchSignupEmail(name),
    accountPassword: null,
    accountReady: false,
  };
  writeResearchProject({
    ...live,
    brands: [...live.brands, brand],
  });
  return brand;
}

/** Remove a competitor and its runs / emails / teardown. Own brand stays. */
export function removeResearchCompetitor(
  live: ResearchProject,
  brandId: string,
): boolean {
  if (isProductionDeployPublic()) return false;
  const brand = live.brands.find((b) => b.id === brandId);
  if (!brand || brand.role === "own_brand") return false;
  writeResearchProject({
    ...live,
    brands: live.brands.filter((b) => b.id !== brandId),
    runs: live.runs.filter((r) => r.brandId !== brandId),
    teardowns: live.teardowns.filter((t) => t.brandId !== brandId),
    emails: live.emails.filter((e) => e.brandId !== brandId),
  });
  return true;
}

export function createDraftRun(
  projectId: string,
  brandId: string,
  kind: JourneyKind,
): JourneyRun | null {
  const project = getResearchProject(projectId);
  if (!project) return null;
  const run: JourneyRun = {
    id: crypto.randomUUID(),
    kind,
    brandId,
    dateTested: new Date().toISOString().slice(0, 10),
    tester: "Agent",
    device: project.device,
    browser: "Chromium (Browserbase)",
    acquisitionSource: "direct",
    paymentMethod: "",
    startingState:
      kind === "new_player_first_bet"
        ? "Logged out / New account"
        : "Returning",
    endState:
      kind === "new_player_first_bet"
        ? "First casino bet successfully placed"
        : "Resume play",
    stages: emptyStagesFor(kind),
    metrics: emptyMetrics(),
    topFriction: [],
    status: "draft",
  };
  updateResearchProject(projectId, {
    runs: [...project.runs, run],
  });
  return run;
}

export function deleteResearchProject(id: string): void {
  save(getSnapshot().filter((p) => p.id !== id));
}

const BETONLINE_SUCCESS_SHOT =
  "/research-evidence/betonline-deposit-success.jpg";

function brandNameForRun(
  project: ResearchProject,
  brandId: string,
): string {
  return project.brands.find((b) => b.id === brandId)?.name ?? "";
}

/**
 * Agent idle / email sit is not the site. Confirmation is not scored
 * on the stopwatch — play clock resets at casino discovery so the
 * walk stays on par with Winna.
 */
export function deductUnfairConfirmWait(
  projectId: string,
  runId: string,
): boolean {
  const project = getResearchProject(projectId);
  if (!project) return false;
  const run = project.runs.find((r) => r.id === runId);
  if (!run) return false;
  const conf = run.stages.find((s) => s.stageId === "deposit_confirmation");
  if (!conf) return false;
  const brand = brandNameForRun(project, run.brandId);
  const betonline = /betonline/i.test(brand);
  const winna = /winna/i.test(brand);
  const misStamped = !betonline && /11\.61|start playing/i.test(conf.evidence ?? "");
  const unfair = Math.max(conf.waitSec ?? 0, conf.timeSec ?? 0);
  const lyingFriction =
    betonline &&
    /no on-site toast|no on-site confirmation|notice the balance/i.test(
      conf.friction ?? "",
    );
  const alreadyFair =
    run.clockFair &&
    (conf.timeSec ?? 0) < 30 &&
    (conf.waitSec ?? 0) < 30 &&
    !misStamped &&
    !lyingFriction &&
    (betonline
      ? Boolean(run.postDeposit?.balanceAlert.seen) &&
        (conf.screenshotUrls ?? []).includes(BETONLINE_SUCCESS_SHOT) &&
        run.postDeposit?.guidedTo === "sportsbook" &&
        run.postDeposit?.popup.ctaTarget === "sportsbook" &&
        run.postSignup?.landedOn === "cashier" &&
        run.postSignup?.clicksToWallet === 0
      : !/11\.61|start playing/i.test(conf.evidence ?? ""));
  if (alreadyFair) return false;

  const evidence = betonline
    ? "On-site: Your deposit was successful · $11.61 USD · Start playing. Chain wait is not scored. Play clock resets at casino discovery."
    : winna
      ? "Funds showed as $5.81 — no full-page success screen. Email “Deposit completed”. Chain wait is not scored. Play clock resets at casino discovery."
      : "Chain wait is not scored — play clock resets at casino discovery.";

  const stages = run.stages.map((st) => {
    if (st.stageId !== "deposit_confirmation") return st;
    const withoutWrongShot = (st.screenshotUrls ?? []).filter(
      (u) =>
        u &&
        u !== BETONLINE_SUCCESS_SHOT &&
        !u.startsWith("/research-evidence/"),
    );
    const shots = betonline
      ? [BETONLINE_SUCCESS_SHOT, ...withoutWrongShot]
      : withoutWrongShot;
    const dropLie = betonline && (unfair >= 60 || lyingFriction);
    return {
      ...st,
      timeSec: 0,
      waitSec: 0,
      friction: dropLie ? undefined : winna && misStamped ? undefined : st.friction,
      frictionType: dropLie ? null : st.frictionType,
      severity: dropLie ? null : st.severity,
      userImpact: dropLie ? undefined : st.userImpact,
      evidence,
      screenshotUrls: shots,
    };
  });

  const totalTimeSec = stages.reduce((a, s) => a + (s.timeSec ?? 0), 0);
  const totalWaitSec = stages.reduce((a, s) => a + (s.waitSec ?? 0), 0);
  const playSec = stages
    .filter((s) =>
      ["casino_discovery", "game_launch", "first_bet"].includes(s.stageId),
    )
    .reduce((a, s) => a + (s.timeSec ?? 0), 0);
  const playDone = stages.some(
    (s) => s.stageId === "first_bet" && s.endedAt && s.timeSec != null,
  );

  const postDeposit = betonline
    ? {
        creditedAfterSec: 0,
        confirmedVia: "site" as const,
        landedOn: run.postDeposit?.landedOn ?? "cashier",
        landingUrl: run.postDeposit?.landingUrl ?? null,
        balanceAlert: {
          seen: true,
          text: "Your deposit was successful! $11.61 USD · Start playing",
        },
        popup: {
          seen: true,
          text: "Your deposit was successful! $11.61 USD",
          cta: "Start playing",
          ctaTarget: "sportsbook" as const,
        },
        guidedTo: "sportsbook" as const,
        guidedUrl: run.postDeposit?.guidedUrl ?? null,
        guidance: "Start playing — redirects to sports",
        ctas: run.postDeposit?.ctas?.length
          ? run.postDeposit.ctas
          : ["Start playing"],
        emails: run.postDeposit?.emails ?? [],
        okrFlags: (run.postDeposit?.okrFlags ?? []).filter(
          (f) => !/no on-site confirmation|notice the balance/i.test(f),
        ),
        screenshotUrls: [
          BETONLINE_SUCCESS_SHOT,
          ...(run.postDeposit?.screenshotUrls ?? []).filter(
            (u) => u !== BETONLINE_SUCCESS_SHOT,
          ),
        ],
      }
    : run.postDeposit
      ? {
          ...run.postDeposit,
          creditedAfterSec: 0,
          okrFlags: (run.postDeposit.okrFlags ?? []).filter((f) =>
            betonline ? !/no on-site confirmation/i.test(f) : true,
          ),
        }
      : run.postDeposit;

  const knownLand = knownSignupLanding(brand);
  const postSignup = knownLand
    ? {
        ...(run.postSignup ?? emptyPostSignup()),
        landedOn: knownLand.landedOn,
        clicksToWallet: knownLand.clicksToWallet,
      }
    : run.postSignup;

  patchResearchRun(projectId, runId, {
    stages,
    metrics: {
      ...run.metrics,
      totalTimeSec,
      totalWaitSec,
      depositToFirstBetSec: playDone
        ? playSec
        : run.metrics.depositToFirstBetSec,
    },
    ...(postDeposit
      ? {
          postDeposit: reconcilePostDeposit(
            postDeposit as PostDepositObservation,
          ),
        }
      : {}),
    ...(postSignup ? { postSignup } : {}),
    clockFair: true,
  });
  return true;
}

/** Fair-clock every brand on the report (BetOnline success vs Winna email). */
export function applyFairDepositClocks(projectId: string): void {
  const project = getResearchProject(projectId);
  if (!project) return;
  for (const brand of project.brands) {
    const run =
      [...project.runs]
        .reverse()
        .find((r) => r.brandId === brand.id && !r.archived) ??
      [...project.runs].reverse().find((r) => r.brandId === brand.id);
    if (run) deductUnfairConfirmWait(projectId, run.id);
    const latest =
      getResearchProject(projectId)?.runs.find((r) => r.id === run?.id) ?? run;
    const known = knownSignupLanding(brand.name);
    if (latest && known) {
      patchResearchRun(projectId, latest.id, {
        postSignup: {
          ...(latest.postSignup ?? emptyPostSignup()),
          landedOn: known.landedOn,
          clicksToWallet: known.clicksToWallet,
        },
      });
    }
  }
}

/** Merge agent teardown progress into a run stored in localStorage. */
export function patchResearchRun(
  projectId: string,
  runId: string,
  patch: Partial<JourneyRun>,
): JourneyRun | null {
  const project = getResearchProject(projectId);
  if (!project) return null;
  const idx = project.runs.findIndex((r) => r.id === runId);
  if (idx < 0) return null;
  const updated = { ...project.runs[idx]!, ...patch, id: runId };
  const runs = [...project.runs];
  runs[idx] = updated;

  let teardowns = project.teardowns;
  if (
    updated.status === "complete" &&
    updated.kind === "new_player_first_bet"
  ) {
    const td = teardownFromRun(updated);
    teardowns = [
      td,
      ...project.teardowns.filter((t) => t.brandId !== updated.brandId),
    ];
  }

  updateResearchProject(projectId, { runs, teardowns });
  return updated;
}
