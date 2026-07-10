const API = "https://api.browserbase.com/v1";

function browserbaseError(action: string, status: number, body: string): Error {
  if (status === 402 || /browser minutes limit|payment required/i.test(body)) {
    return new Error(
      "Browserbase free plan browser minutes limit reached — upgrade at browserbase.com/plans or wait for the monthly reset."
    );
  }
  return new Error(`Browserbase ${action} failed: ${status} ${body}`);
}

function headers() {
  const key = process.env.BROWSERBASE_API_KEY;
  if (!key) throw new Error("BROWSERBASE_API_KEY is not set");
  return { "X-BB-API-Key": key, "Content-Type": "application/json" };
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Which location a session's browser should appear from. Regional routing
 * is enabled by setting BROWSERBASE_PROXY_COUNTRY (needs a Browserbase plan
 * with residential proxies); a market-specific geo code then overrides that
 * default. Returns undefined when proxies aren't enabled — sessions run
 * from the datacenter region as before.
 */
export function proxyCountryFor(requested?: string | null): string | undefined {
  const fallback = process.env.BROWSERBASE_PROXY_COUNTRY;
  if (!fallback) return undefined;
  return requested ?? fallback;
}

/** "GB" → { country: "GB" }; "US-NJ" → { country: "US", state: "NJ" }.
 * US iGaming is licensed per state, so state-level routing matters there.
 * Browserbase's state field is US-only; other subdivisions map to a city
 * (CA-ON → Toronto) so session creation never fails on an invalid combo. */
export function proxyGeolocation(code: string): {
  country: string;
  state?: string;
  city?: string;
} {
  const [country, region] = code.split("-");
  if (!region) return { country };
  if (country === "US") return { country, state: region };
  if (code === "CA-ON") return { country: "CA", city: "TORONTO" };
  if (code === "CA-BC") return { country: "CA", city: "VANCOUVER" };
  return { country };
}

/** The proxies array for a Browserbase session create, or {} when routing
 * is disabled. Shared by every session-creating runtime. */
export function proxyConfig(requested?: string | null): {
  proxies?: {
    type: "browserbase";
    geolocation: { country: string; state?: string; city?: string };
  }[];
} {
  const code = proxyCountryFor(requested);
  if (!code) return {};
  return {
    proxies: [{ type: "browserbase", geolocation: proxyGeolocation(code) }],
  };
}

/** A persistent browser context: cookies/auth state that survives across
 * sessions. One per brand — this is how agents stay logged in. */
export async function createContext(): Promise<string> {
  const res = await fetch(`${API}/contexts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ projectId: process.env.BROWSERBASE_PROJECT_ID }),
  });
  if (!res.ok) {
    throw browserbaseError("context create", res.status, await res.text());
  }
  const data = await res.json();
  return data.id as string;
}

/** Browserbase burst limit is 5 session creates per minute. When a create
 * hits 429, wait the time the API suggests and retry instead of failing the
 * whole journey run. */
export async function withSessionRetry<T>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const rateLimited = /429|too many requests|rate limit/i.test(msg);
      if (!rateLimited || attempt >= attempts) throw e;
      const suggested = /try again in (\d+) seconds/i.exec(msg);
      const waitSec = Math.min(90, suggested ? Number(suggested[1]) + 3 : 62);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    }
  }
}

export async function createSession(
  viewport?: Viewport,
  contextId?: string,
  requestedProxyCountry?: string | null,
  keepAlive = false
): Promise<{
  id: string;
  connectUrl: string;
}> {
  return withSessionRetry(() =>
    createSessionOnce(viewport, contextId, requestedProxyCountry, keepAlive)
  );
}

async function createSessionOnce(
  viewport?: Viewport,
  contextId?: string,
  requestedProxyCountry?: string | null,
  keepAlive = false
): Promise<{
  id: string;
  connectUrl: string;
}> {
  // Datacenter IPs are US-based and iGaming sites geo-block US traffic
  // (licensing). Residential proxies fix that but need a paid Browserbase
  // plan, so only enable when configured (e.g. BROWSERBASE_PROXY_COUNTRY=GB).
  // The project's market can request a specific location per session.
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      // Sessions default to us-west-2 (Oregon); live-view interactivity is
      // round-trip-bound, so run the browser near the user. Frankfurt for now.
      region: process.env.BROWSERBASE_REGION ?? "eu-central-1",
      // Long enough for a real play session; falls back to plan max if lower.
      timeout: 1800,
      // Live capture sessions must survive serverless disconnects — each
      // poll reconnects to the same remote browser.
      ...(keepAlive ? { keepAlive: true } : {}),
      // Match the browser's resolution to the embedding container so the
      // live view renders 1:1 instead of scaling a 1920x1080 desktop down.
      // Attaching a context resumes the brand's logged-in state; persist
      // writes cookie changes (fresh logins) back to it.
      ...(viewport || contextId
        ? {
            browserSettings: {
              ...(viewport
                ? {
                    viewport: {
                      width: Math.min(1920, Math.max(320, Math.round(viewport.width))),
                      height: Math.min(1080, Math.max(320, Math.round(viewport.height))),
                    },
                  }
                : {}),
              ...(contextId
                ? { context: { id: contextId, persist: true } }
                : {}),
            },
          }
        : {}),
      ...proxyConfig(requestedProxyCountry),
    }),
  });
  if (!res.ok) {
    throw browserbaseError("create", res.status, await res.text());
  }
  const data = await res.json();
  return { id: data.id, connectUrl: data.connectUrl };
}

/** Connect URL for an already-running session — how a fresh serverless
 * instance re-attaches to a keepAlive capture session. */
export async function getConnectUrl(id: string): Promise<string> {
  const res = await fetch(`${API}/sessions/${id}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(
      `Browserbase session lookup failed: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  if (data.status && data.status !== "RUNNING") {
    throw new Error(`session ${id} is ${data.status}`);
  }
  return data.connectUrl as string;
}

/** The embeddable, interactive live view of the remote browser. */
export async function getLiveViewUrl(id: string): Promise<string> {
  const res = await fetch(`${API}/sessions/${id}/debug`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(
      `Browserbase debug failed: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  return data.debuggerFullscreenUrl as string;
}

export async function releaseSession(id: string): Promise<void> {
  await fetch(`${API}/sessions/${id}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      status: "REQUEST_RELEASE",
    }),
  }).catch(() => {});
}
