"use client";

import { useSyncExternalStore } from "react";
import { faviconUrl } from "./constants";
import type {
  ActionPlan,
  Brand,
  CaptureRecord,
  JourneyAnalysis,
  JourneyType,
  Project,
  DesignReview,
  VocAnalysis,
} from "./types";

/** Legacy localStorage key — read once for the one-time server migration. */
const LEGACY_KEY = "playerscope.projects.v2";
const MIGRATED_FLAG = "playerscope.migrated.v1";

/* In-memory store hydrated from the server. undefined = not loaded yet. */
let projects: Project[] | undefined;
let storeError: string | null = null;
let loadPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  void ensureLoaded();
  return () => {
    listeners.delete(callback);
  };
}

async function migrateLegacyProjects(): Promise<void> {
  try {
    if (window.localStorage.getItem(MIGRATED_FLAG)) return;
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      window.localStorage.setItem(MIGRATED_FLAG, "1");
      return;
    }
    const legacy = JSON.parse(raw) as Project[];
    if (legacy.length > 0) {
      const res = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: legacy }),
      });
      if (!res.ok) return; // retry next load — flag stays unset
    }
    window.localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    // Migration failure must not block the app; it retries next load.
  }
}

async function loadFromServer(): Promise<void> {
  try {
    await migrateLegacyProjects();
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `failed to load projects (${res.status})`);
    }
    projects = data.projects as Project[];
    storeError = null;
  } catch (e) {
    storeError = e instanceof Error ? e.message : "failed to load projects";
    // Fall back to legacy local data so the app stays usable offline.
    try {
      const raw = window.localStorage.getItem(LEGACY_KEY);
      projects = raw ? (JSON.parse(raw) as Project[]) : [];
    } catch {
      projects = [];
    }
  }
  emit();
}

function ensureLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!loadPromise) loadPromise = loadFromServer();
  return loadPromise;
}

/** Re-fetch from the server (e.g. after another tab/agent wrote data). */
export function refreshProjects(): Promise<void> {
  loadPromise = loadFromServer();
  return loadPromise;
}

/** All projects. Returns undefined during server render/initial load. */
export function useProjects(): Project[] | undefined {
  return useSyncExternalStore(
    subscribe,
    () => projects,
    () => undefined
  );
}

/** Store-level failure (e.g. Supabase not configured). Null when healthy. */
export function useProjectStoreError(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => storeError,
    () => null
  );
}

/** One project by id. undefined = still loading, null = not found. */
export function useProject(id: string): Project | null | undefined {
  const all = useProjects();
  if (all === undefined) return undefined;
  return all.find((p) => p.id === id) ?? null;
}

export function getProject(id: string): Project | undefined {
  return projects?.find((p) => p.id === id);
}

export interface NewProjectInput {
  name: string;
  ownBrandName: string;
  ownBrandUrl: string;
  competitors: { name: string; url: string }[];
  market: string;
  products: string[];
  journeys: JourneyType[];
  analysisMode: string;
}

function hostToName(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    const base = host.replace(/^www\./, "").split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return url;
  }
}

function normalizeUrl(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

/** Thrown when the account's plan doesn't allow another report. */
export class LimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitError";
  }
}

/** Thrown when another report is still active — archive it first. */
export class ActiveReportError extends Error {
  activeProjectId: string | null;
  constructor(message: string, activeProjectId: string | null) {
    super(message);
    this.name = "ActiveReportError";
    this.activeProjectId = activeProjectId;
  }
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data.error ?? `request failed (${res.status})`;
    if (data.code === "active_report_exists") {
      throw new ActiveReportError(message, data.activeProjectId ?? null);
    }
    if (res.status === 402 || data.code === "limit_reached") {
      throw new LimitError(message);
    }
    throw new Error(message);
  }
}

function mutateLocal(id: string, mutate: (p: Project) => Project) {
  if (!projects) return;
  projects = projects.map((p) => (p.id === id ? mutate(p) : p));
  emit();
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  const id = `proj-${Date.now().toString(36)}`;

  const makeBrand = (
    brandId: string,
    name: string,
    url: string,
    role: Brand["role"]
  ): Brand => ({
    id: brandId,
    name: name || hostToName(url),
    url: normalizeUrl(url),
    favicon: faviconUrl(url),
    role,
    analyses: {},
  });

  const brands: Brand[] = [
    makeBrand(`${id}-own`, input.ownBrandName, input.ownBrandUrl, "own_brand"),
    ...input.competitors
      .slice(0, 4)
      .map((c, i) =>
        makeBrand(`${id}-comp-${i}`, c.name, c.url, "competitor")
      ),
  ];

  const project: Project = {
    id,
    name: input.name,
    market: input.market,
    products: input.products,
    journeys: input.journeys,
    analysisMode: input.analysisMode,
    brands,
    sessions: [],
    status: "analyzing",
    createdAt: new Date().toISOString(),
  };

  await ensureLoaded();
  await post("/api/projects", { project });
  projects = [project, ...(projects ?? [])];
  emit();
  return project;
}

/** Pause a report: it stays readable but nothing runs or updates. */
export async function archiveProject(id: string): Promise<void> {
  await post(`/api/projects/${id}/archive`, { archived: true });
  mutateLocal(id, (p) => ({ ...p, status: "archived" }));
}

/** Reactivate an archived report. Fails with ActiveReportError when
 * another report is still active — only one may run at a time. */
export async function unarchiveProject(id: string): Promise<void> {
  await post(`/api/projects/${id}/archive`, { archived: false });
  mutateLocal(id, (p) => ({
    ...p,
    status: p.analysedAt ? "complete" : "draft",
  }));
}

/** Permanently delete a report and all of its evidence. */
export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `request failed (${res.status})`);
  }
  projects = (projects ?? []).filter((p) => p.id !== id);
  emit();
}

/** Store the result of a real analysis run against a brand. */
export function saveAnalysis(
  projectId: string,
  brandId: string,
  analysis: JourneyAnalysis
) {
  mutateLocal(projectId, (p) => ({
    ...p,
    brands: p.brands.map((b) =>
      b.id === brandId
        ? { ...b, analyses: { ...b.analyses, [analysis.area]: analysis } }
        : b
    ),
  }));
  post(`/api/projects/${projectId}/analysis`, { brandId, analysis }).catch(
    (e) => console.error("[store] analysis sync failed:", e.message)
  );
}

/** Scrape + analyse a brand's public reviews server-side, then reflect the
 * result locally. Throws with a readable message on failure. */
export async function runVoc(
  projectId: string,
  brandId: string
): Promise<VocAnalysis> {
  const res = await fetch("/api/voc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, brandId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `request failed (${res.status})`);
  }
  const voc = data.voc as VocAnalysis;
  mutateLocal(projectId, (p) => ({
    ...p,
    brands: p.brands.map((b) => (b.id === brandId ? { ...b, voc } : b)),
  }));
  return voc;
}

/** Measure a brand's live rendered code + build the design review
 * server-side, then reflect the result locally. */
export async function runDesignReview(
  projectId: string,
  brandId: string
): Promise<DesignReview> {
  const res = await fetch("/api/design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, brandId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `request failed (${res.status})`);
  }
  const design = data.design as DesignReview;
  mutateLocal(projectId, (p) => ({
    ...p,
    brands: p.brands.map((b) => (b.id === brandId ? { ...b, design } : b)),
  }));
  return design;
}

/** Store a saved live capture session. */
export function saveCapture(projectId: string, record: CaptureRecord) {
  mutateLocal(projectId, (p) => ({
    ...p,
    sessions: [record, ...p.sessions],
  }));
  post(`/api/projects/${projectId}/sessions`, { record }).catch((e) =>
    console.error("[store] session sync failed:", e.message)
  );
}

/** Ask the server to (re)build the prioritised action plan from all real
 * analyses, then reflect it in the local cache. */
export async function generateActionPlan(projectId: string): Promise<ActionPlan> {
  const res = await fetch(`/api/projects/${projectId}/action-plan`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `request failed (${res.status})`);
  }
  const plan = data.plan as ActionPlan;
  mutateLocal(projectId, (p) => ({ ...p, actionPlan: plan }));
  return plan;
}

export function markProjectComplete(id: string) {
  mutateLocal(id, (p) => ({
    ...p,
    status: "complete",
    analysedAt: new Date().toISOString(),
  }));
  post(`/api/projects/${id}/complete`, {}).catch((e) =>
    console.error("[store] complete sync failed:", e.message)
  );
}

export function markProjectDraft(id: string) {
  mutateLocal(id, (p) => ({
    ...p,
    status: "draft",
    analysedAt: undefined,
  }));
  post(`/api/projects/${id}/abort`, {}).catch((e) =>
    console.error("[store] abort sync failed:", e.message)
  );
}
