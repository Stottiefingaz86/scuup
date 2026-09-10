import type { ResearchAction, ResearchActionStatus } from "./types";

const store = globalThis as unknown as {
  __researchActions?: Map<string, ResearchAction>;
};
const actions = (store.__researchActions ??= new Map<string, ResearchAction>());

export function listResearchActions(projectId?: string): ResearchAction[] {
  const all = [...actions.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  if (!projectId) return all;
  return all.filter((a) => a.projectId === projectId);
}

export function getResearchAction(id: string): ResearchAction | undefined {
  return actions.get(id);
}

/**
 * The deposit request a human paid for this brand, whichever job created it.
 * Resumed runs get a fresh job id, so the watch that finally sees the funds
 * land must find the request by brand rather than by job.
 */
export function getOpenDepositActionForBrand(
  projectId: string,
  brandId: string,
): ResearchAction | undefined {
  return [...actions.values()]
    .filter(
      (a) =>
        a.kind === "manual_deposit" &&
        a.projectId === projectId &&
        a.brandId === brandId &&
        (a.status === "pending" ||
          a.status === "payment_sent" ||
          a.status === "confirming"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Hard-delete a request the human no longer wants to see. */
export function removeResearchAction(id: string): boolean {
  return actions.delete(id);
}

export function getResearchActionByJobId(
  jobId: string,
): ResearchAction | undefined {
  return [...actions.values()].find((a) => a.jobId === jobId);
}

export function countPendingActions(projectId?: string): number {
  return listResearchActions(projectId).filter((a) =>
    ["pending", "payment_sent", "code_submitted", "confirming"].includes(
      a.status,
    ),
  ).length;
}

export function createDepositAction(input: {
  projectId: string;
  brandId: string;
  brandName: string;
  brandUrl: string;
  jobId: string;
  liveViewUrl?: string | null;
  depositAddress?: string | null;
  network?: string | null;
  currency?: string | null;
  amountHint?: string | null;
  /** Cropped screenshot of the site's QR for this address. */
  qrUrl?: string | null;
}): ResearchAction {
  const address = input.depositAddress?.trim() || null;
  if (
    !address ||
    !/^(?:bc1[ac-hj-np-z02-9]{25,87}|BC1[AC-HJ-NP-Z02-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(
      address,
    )
  ) {
    throw new Error(
      "Refusing to create deposit notification — no valid Bitcoin address",
    );
  }
  const now = new Date().toISOString();
  // One live deposit request per brand+project: a re-run supersedes the old one
  // so Notifications never shows two addresses for the same brand.
  for (const existing of actions.values()) {
    if (
      existing.kind === "manual_deposit" &&
      existing.status === "pending" &&
      existing.projectId === input.projectId &&
      existing.brandId === input.brandId &&
      existing.jobId !== input.jobId
    ) {
      actions.set(existing.id, {
        ...existing,
        status: "cancelled",
        notes: "Superseded by a newer run",
        updatedAt: now,
      });
    }
  }
  const action: ResearchAction = {
    id: `rsa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    projectId: input.projectId,
    brandId: input.brandId,
    brandName: input.brandName,
    brandUrl: input.brandUrl,
    kind: "manual_deposit",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    jobId: input.jobId,
    liveViewUrl: input.liveViewUrl ?? null,
    depositAddress: address,
    network: input.network ?? null,
    currency: input.currency ?? "BTC",
    amountHint: input.amountHint ?? null,
    qrUrl: input.qrUrl ?? null,
  };
  actions.set(action.id, action);
  return action;
}

/** Pause for human: site sent an SMS OTP to the persona mobile. */
export function createSmsAssistAction(input: {
  projectId: string;
  brandId: string;
  brandName: string;
  brandUrl: string;
  jobId: string;
  liveViewUrl?: string | null;
  phoneHint?: string | null;
  smsPrompt?: string | null;
}): ResearchAction {
  const now = new Date().toISOString();
  const action: ResearchAction = {
    id: `rsa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    projectId: input.projectId,
    brandId: input.brandId,
    brandName: input.brandName,
    brandUrl: input.brandUrl,
    kind: "sms_assist",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    jobId: input.jobId,
    liveViewUrl: input.liveViewUrl ?? null,
    phoneHint: input.phoneHint ?? null,
    smsPrompt:
      input.smsPrompt ??
      "Check your phone for an SMS code and paste it here so the agent can continue.",
  };
  actions.set(action.id, action);
  return action;
}

export function patchResearchAction(
  id: string,
  patch: Partial<ResearchAction>,
): ResearchAction | null {
  const existing = actions.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };
  actions.set(id, updated);
  return updated;
}

/** Human dismissed a pending request (or its report was deleted). */
export function cancelResearchAction(
  id: string,
  note = "Dismissed",
): ResearchAction | null {
  const existing = actions.get(id);
  if (!existing) return null;
  if (existing.status !== "pending") return existing;
  return patchResearchAction(id, { status: "cancelled", notes: note });
}

export function setActionStatus(
  id: string,
  status: ResearchActionStatus,
  extra: Partial<ResearchAction> = {},
): ResearchAction | null {
  return patchResearchAction(id, { status, ...extra });
}
