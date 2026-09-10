/** Client-safe credential status from GET /api/brands/[id]/credentials. */
export interface CredentialStatus {
  brandId: string;
  email: string | null;
  username: string | null;
  hasPassword: boolean;
  hasPersona: boolean;
  notes: string | null;
  hasContext: boolean;
  loggedInAt: string | null;
}

export type DepositMode = "cashier_only" | "prefunded";

export interface CredentialFormMeta {
  depositMode: DepositMode;
  preferredCrypto: string;
  userNotes: string;
}

const META_PREFIX = "---scuup-meta---";

function parseMeta(notes: string | null): CredentialFormMeta {
  if (!notes?.includes(META_PREFIX)) {
    return {
      depositMode: "cashier_only",
      preferredCrypto: "",
      userNotes: notes?.trim() ?? "",
    };
  }
  const [metaBlock, ...rest] = notes.split(META_PREFIX);
  void metaBlock;
  const metaLine = rest[0]?.trim() ?? "";
  const userNotes = rest.slice(1).join(META_PREFIX).trim();
  const depositMode: DepositMode = metaLine.includes("prefunded")
    ? "prefunded"
    : "cashier_only";
  const cryptoMatch = metaLine.match(/crypto=([^;]+)/);
  return {
    depositMode,
    preferredCrypto: cryptoMatch?.[1]?.trim() ?? "",
    userNotes,
  };
}

function serializeMeta(meta: CredentialFormMeta): string | null {
  const parts = [`mode=${meta.depositMode}`];
  if (meta.preferredCrypto.trim()) {
    parts.push(`crypto=${meta.preferredCrypto.trim()}`);
  }
  const block = `${META_PREFIX}${parts.join(";")}${META_PREFIX}`;
  const notes = meta.userNotes.trim();
  if (!notes) return block;
  return `${block}\n${notes}`;
}

export function credentialMetaFromNotes(
  notes: string | null
): CredentialFormMeta {
  return parseMeta(notes);
}

export async function fetchCredentialStatus(
  brandId: string
): Promise<CredentialStatus> {
  const res = await fetch(`/api/brands/${brandId}/credentials`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load credentials");
  }
  return data as CredentialStatus;
}

export async function saveBrandCredentials(
  brandId: string,
  input: {
    email?: string;
    username?: string;
    password?: string;
    meta?: CredentialFormMeta;
  }
): Promise<CredentialStatus> {
  const body: Record<string, string | undefined> = {};
  if (input.email !== undefined) body.email = input.email;
  if (input.username !== undefined) body.username = input.username;
  if (input.password !== undefined) body.password = input.password;
  if (input.meta !== undefined) body.notes = serializeMeta(input.meta) ?? "";
  const res = await fetch(`/api/brands/${brandId}/credentials`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to save credentials");
  }
  return data as CredentialStatus;
}

export type LoginJobStatus =
  | "none"
  | "starting"
  | "running"
  | "success"
  | "failed";

export interface LoginJobResponse {
  status: LoginJobStatus;
  liveViewUrl?: string | null;
  steps?: string[];
  error?: string | null;
}

export async function startBrandLogin(
  brandId: string,
  url: string,
  market: string
): Promise<LoginJobResponse> {
  const res = await fetch(`/api/brands/${brandId}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, market }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Login failed to start");
  }
  return data as LoginJobResponse;
}

export async function pollBrandLogin(
  brandId: string
): Promise<LoginJobResponse> {
  const res = await fetch(`/api/brands/${brandId}/login`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to check login status");
  }
  return data as LoginJobResponse;
}
