import type { Stagehand } from "@browserbasehq/stagehand";

type AgentPage = NonNullable<
  Awaited<ReturnType<Stagehand["context"]["activePage"]>>
>;

const SOLVING_STARTED = "browserbase-solving-started";
const SOLVING_FINISHED = "browserbase-solving-finished";
const SOLVING_ERRORED = "browserbase-solving-errored";

type PageWithCdp = AgentPage & {
  sendCDP?: <T = unknown>(method: string, params?: object) => Promise<T>;
  hover?: (x: number, y: number) => Promise<unknown>;
};

type WidgetRect = { x: number; y: number; w: number; h: number; kind: string };

/** Walk light DOM + open/closed shadow roots (Stagehand V3 piercer). */
const FIND_WIDGET_SCRIPT = `(() => {
  function roots() {
    const out = [document];
    const piercer = window.__stagehandV3__;
    const walk = (node) => {
      if (!node || !node.querySelectorAll) return;
      for (const el of node.querySelectorAll("*")) {
        const open = el.shadowRoot;
        if (open) {
          out.push(open);
          walk(open);
        } else if (piercer && typeof piercer.getClosedRoot === "function") {
          try {
            const closed = piercer.getClosedRoot(el);
            if (closed) {
              out.push(closed);
              walk(closed);
            }
          } catch (_) {}
        }
      }
    };
    walk(document);
    return out;
  }
  function pick(el, kind) {
    const r = el.getBoundingClientRect();
    if (r.width < 50 || r.height < 28) return null;
    if (r.bottom < 0 || r.top > window.innerHeight) {
      try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (_) {}
    }
    const r2 = el.getBoundingClientRect();
    if (r2.width < 50 || r2.height < 28) return null;
    return { x: r2.left, y: r2.top, w: r2.width, h: r2.height, kind };
  }
  function isTurnstileFrame(f) {
    const src = (f.getAttribute("src") || "").toLowerCase();
    const title = (f.getAttribute("title") || "").toLowerCase();
    const name = (f.getAttribute("name") || "").toLowerCase();
    return (
      src.includes("turnstile") ||
      src.includes("challenges.cloudflare") ||
      title.includes("cloudflare") ||
      title.includes("security challenge") ||
      title.includes("verify you are human") ||
      name.includes("cf-chl") ||
      name.includes("turnstile")
    );
  }
  for (const root of roots()) {
    for (const f of root.querySelectorAll("iframe")) {
      const r = f.getBoundingClientRect();
      if (r.width < 50 || r.height < 28) continue;
      if (isTurnstileFrame(f)) {
        const hit = pick(f, "turnstile");
        if (hit) return hit;
      }
      const src = (f.getAttribute("src") || "").toLowerCase();
      const title = (f.getAttribute("title") || "").toLowerCase();
      if (
        (src.includes("recaptcha/api2/anchor") || title.includes("recaptcha") || src.includes("hcaptcha.com/captcha")) &&
        r.width >= 200 && r.height >= 60
      ) {
        const hit = pick(f, "recaptcha");
        if (hit) return hit;
      }
    }
    for (const host of root.querySelectorAll(
      "[class*='turnstile' i], [id*='turnstile' i], [data-sitekey], .cf-turnstile, [name='cf-turnstile-response']"
    )) {
      const owner =
        host.tagName === "INPUT" || host.tagName === "TEXTAREA"
          ? host.parentElement || host
          : host;
      const inner = owner.querySelector?.("iframe");
      if (inner) {
        const hit = pick(inner, "turnstile");
        if (hit) return hit;
      }
      const hit = pick(owner, "turnstile");
      if (hit) return hit;
    }
  }
  return null;
})()`;

/**
 * Find the visible captcha widget box (viewport CSS px) for a CDP click.
 * Tries DOM (+ Stagehand shadow piercer), then CDP pierce.
 */
export async function findCaptchaWidgetRect(
  page: AgentPage,
): Promise<WidgetRect | null> {
  try {
    const fromDom = (await page.evaluate(
      FIND_WIDGET_SCRIPT,
    )) as WidgetRect | null;
    if (fromDom && fromDom.w >= 50) return fromDom;
  } catch {
    /* CDP fallback */
  }
  return findCaptchaWidgetRectViaCdp(page);
}

async function findCaptchaWidgetRectViaCdp(
  page: AgentPage,
): Promise<WidgetRect | null> {
  const cdp = page as PageWithCdp;
  if (typeof cdp.sendCDP !== "function") return null;
  try {
    type DomNode = {
      nodeName?: string;
      localName?: string;
      attributes?: string[];
      backendNodeId?: number;
      children?: DomNode[];
      shadowRoots?: DomNode[];
      contentDocument?: DomNode;
    };
    const doc = await cdp.sendCDP<{ root: DomNode }>("DOM.getDocument", {
      depth: -1,
      pierce: true,
    });
    const matches: { id: number; kind: string }[] = [];
    const walk = (node: DomNode | undefined) => {
      if (!node) return;
      const name = (node.nodeName || node.localName || "").toLowerCase();
      if (name === "iframe" && Array.isArray(node.attributes)) {
        const attrs = node.attributes;
        let src = "";
        let title = "";
        let n = "";
        for (let i = 0; i + 1 < attrs.length; i += 2) {
          if (attrs[i] === "src") src = (attrs[i + 1] || "").toLowerCase();
          if (attrs[i] === "title") title = (attrs[i + 1] || "").toLowerCase();
          if (attrs[i] === "name") n = (attrs[i + 1] || "").toLowerCase();
        }
        const turnstile =
          src.includes("turnstile") ||
          src.includes("challenges.cloudflare") ||
          title.includes("cloudflare") ||
          title.includes("security challenge") ||
          title.includes("verify you are human") ||
          n.includes("cf-chl") ||
          n.includes("turnstile");
        const recaptcha =
          src.includes("recaptcha/api2/anchor") && !src.includes("bframe");
        if ((turnstile || recaptcha) && typeof node.backendNodeId === "number") {
          matches.push({
            id: node.backendNodeId,
            kind: turnstile ? "turnstile" : "recaptcha",
          });
        }
      }
      for (const c of node.children || []) walk(c);
      for (const s of node.shadowRoots || []) walk(s);
      if (node.contentDocument) walk(node.contentDocument);
    };
    walk(doc.root);

    for (const m of matches) {
      try {
        const box = await cdp.sendCDP<{
          model?: { content?: number[]; border?: number[] };
        }>("DOM.getBoxModel", { backendNodeId: m.id });
        const quad = box.model?.content || box.model?.border;
        if (!quad || quad.length < 8) continue;
        const xs = [quad[0], quad[2], quad[4], quad[6]];
        const ys = [quad[1], quad[3], quad[5], quad[7]];
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const w = Math.max(...xs) - x;
        const h = Math.max(...ys) - y;
        if (w < 50 || h < 28) continue;
        return { x, y, w, h, kind: m.kind };
      } catch {
        /* next */
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * True when a real checkbox challenge is on screen (not the tiny reCAPTCHA badge).
 * Uses DOM text + iframe find + CDP pierce — Turnstile text often lives inside
 * a cross-origin iframe so body.innerText alone is not enough.
 */
export async function captchaChallengeVisible(
  page: AgentPage,
): Promise<boolean> {
  if (await recaptchaSolved(page)) return false;
  try {
    const textHit = Boolean(
      await page.evaluate(`(() => {
        const text = (document.body?.innerText || "").slice(0, 12000);
        if (/\\bsuccess!\\b/i.test(text) && /turnstile|cloudflare|verify you are human/i.test(text)) {
          return false;
        }
        return /i'?m not a robot|verify you are human|additional security step|confirm that you'?re not a robot/i.test(text);
      })()`),
    );
    if (textHit) return true;
  } catch {
    /* continue */
  }
  return Boolean(await findCaptchaWidgetRect(page));
}

/** Token present / Success shown — reCAPTCHA, hCaptcha, or Turnstile. */
export async function recaptchaSolved(page: AgentPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const t = document.querySelector("textarea[name='g-recaptcha-response'], textarea#g-recaptcha-response");
        if (t && t.value && String(t.value).length > 20) return true;
        const h = document.querySelector("textarea[name='h-captcha-response']");
        if (h && h.value && String(h.value).length > 20) return true;
        const cf = document.querySelector(
          "input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response'], [name='cf-turnstile-response']"
        );
        if (cf && "value" in cf && cf.value && String(cf.value).length > 20) return true;
        const text = (document.body?.innerText || "").slice(0, 8000);
        if (/\\bsuccess!\\b/i.test(text)) {
          if (document.querySelector(
            "[class*='turnstile' i], iframe[src*='turnstile'], iframe[src*='challenges.cloudflare'], [name='cf-turnstile-response']"
          )) {
            return true;
          }
        }
        return false;
      })()`),
    );
  } catch {
    return false;
  }
}

async function cdpClickAt(
  page: AgentPage,
  x: number,
  y: number,
): Promise<void> {
  const cdp = page as PageWithCdp;
  if (typeof cdp.sendCDP === "function") {
    // Slow approach from nearby — instant teleport clicks trip Turnstile.
    const startX = Math.max(0, x - 40 - Math.random() * 30);
    const startY = Math.max(0, y + 20 + Math.random() * 20);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = startX + (x - startX) * t;
      const my = startY + (y - startY) * t;
      await cdp.sendCDP("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: mx,
        y: my,
        buttons: 0,
      });
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 40));
    }
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
    await cdp.sendCDP("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 40));
    await cdp.sendCDP("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    return;
  }
  if (typeof cdp.hover === "function") await cdp.hover(x, y);
  await page.click(x, y);
}

async function turnstileFailed(page: AgentPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const t = (document.body?.innerText || "").slice(0, 8000);
        return /verification failed/i.test(t);
      })()`),
    );
  } catch {
    return false;
  }
}

/** Click Troubleshoot / reset after Cloudflare "Verification failed". */
async function resetFailedTurnstile(page: AgentPage): Promise<boolean> {
  try {
    const clicked = await page.evaluate(`(() => {
      const nodes = [...document.querySelectorAll("a, button, span, div")];
      for (const el of nodes) {
        if (!(el instanceof HTMLElement)) continue;
        const t = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
        if (/^troubleshoot$/i.test(t)) {
          el.click();
          return "troubleshoot";
        }
      }
      // Fallback: reload the Turnstile host if CF exposes turnstile.reset
      try {
        if (window.turnstile && typeof window.turnstile.reset === "function") {
          window.turnstile.reset();
          return "reset";
        }
      } catch (_) {}
      return null;
    })()`);
    return Boolean(clicked);
  } catch {
    return false;
  }
}

/**
 * Tick the captcha checkbox with ONE real mouse click, then wait.
 * Rapid multi-clicks make Cloudflare show "Verification failed".
 */
export async function clickRecaptchaCheckbox(
  page: AgentPage,
): Promise<boolean> {
  try {
    if (await turnstileFailed(page)) {
      await resetFailedTurnstile(page);
      await new Promise((r) => setTimeout(r, 1500));
    }
    const rect = await findCaptchaWidgetRect(page);
    if (!rect) return false;
    // Single click on the checkbox (left side of Turnstile).
    const x = Math.round(rect.x + Math.min(26, rect.w * 0.2));
    const y = Math.round(rect.y + rect.h / 2);
    await cdpClickAt(page, x, y);
    return true;
  } catch {
    return false;
  }
}

/**
 * Browserbase solves supported captchas when solveCaptchas is on.
 * Default: click the widget (Winna, BetOnline, …). Rainbet only: do not
 * synthetically click Turnstile — that brand fails even on Live-view ticks.
 */
export async function waitForBrowserbaseCaptcha(
  page: AgentPage,
  stagehand: Stagehand,
  opts?: {
    timeoutMs?: number;
    push?: (msg: string) => void;
    shouldAbort?: () => boolean;
  },
): Promise<"solved" | "errored" | "timeout" | "absent"> {
  if (await recaptchaSolved(page)) return "solved";

  let rect = await findCaptchaWidgetRect(page);
  if (!rect && !(await captchaChallengeVisible(page))) return "absent";

  const timeoutMs = opts?.timeoutMs ?? 50_000;
  const push = opts?.push ?? (() => {});
  const shouldAbort = opts?.shouldAbort ?? (() => false);

  let solving = false;
  let outcome: "solved" | "errored" | null = null;

  const onConsole = (msg: { text: () => string }) => {
    const text = msg.text();
    if (text === SOLVING_STARTED) {
      solving = true;
      push("Captcha: Browserbase solver started");
    } else if (text === SOLVING_FINISHED) {
      solving = false;
      outcome = "solved";
      push("Captcha: solved by Browserbase");
    } else if (text === SOLVING_ERRORED) {
      solving = false;
      outcome = "errored";
      push("Captcha: Browserbase solver failed");
    }
  };

  const pageAny = page as unknown as {
    on?: (ev: string, fn: (msg: { text: () => string }) => void) => void;
    off?: (ev: string, fn: (msg: { text: () => string }) => void) => void;
    removeListener?: (
      ev: string,
      fn: (msg: { text: () => string }) => void,
    ) => void;
  };
  pageAny.on?.("console", onConsole);

  if (!rect) {
    push("Captcha: waiting for widget to load…");
    await waitForCaptchaWidget(page, { timeoutMs: 12_000, shouldAbort });
    rect = await findCaptchaWidgetRect(page);
  }

  if (rect) {
    push(
      `Captcha: widget at ${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.w)}×${Math.round(rect.h)} (${rect.kind})`,
    );
  }

  // Winna / BetOnline need a real click — skipping Turnstile globally
  // stalled those signups. Only Rainbet burns on synthetic clicks.
  let href = "";
  try {
    href =
      typeof page.url === "function"
        ? page.url()
        : String(await page.evaluate("location.href").catch(() => ""));
  } catch {
    href = "";
  }
  const skipClick = /rainbet\.com/i.test(href);
  if (skipClick) {
    push(
      "Captcha: Rainbet Turnstile — waiting for Browserbase (no synthetic click)",
    );
  } else {
    push("Captcha: ticking Verify / I'm not a robot");
    await clickRecaptchaCheckbox(page);
  }

  const deadline = Date.now() + timeoutMs;
  const started = Date.now();
  let recoveredFail = false;
  let reclicked = false;
  while (Date.now() < deadline) {
    if (shouldAbort()) {
      detach();
      push("Captcha: aborted (paused)");
      return "timeout";
    }
    if (outcome === "solved" || (await recaptchaSolved(page))) {
      detach();
      push("Captcha: solved");
      return "solved";
    }
    if (!recoveredFail && (await turnstileFailed(page))) {
      recoveredFail = true;
      push("Captcha: Verification failed — Troubleshoot, then one more click");
      await resetFailedTurnstile(page);
      await new Promise((r) => setTimeout(r, 1500));
      if (!skipClick) await clickRecaptchaCheckbox(page);
      continue;
    }
    if (
      !skipClick &&
      !solving &&
      !reclicked &&
      Date.now() - started > 6_000 &&
      !(await recaptchaSolved(page))
    ) {
      reclicked = true;
      push("Captcha: still open — one more click");
      await clickRecaptchaCheckbox(page);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  detach();
  if (await recaptchaSolved(page)) {
    push("Captcha: solved (late)");
    return "solved";
  }
  // Last chance: human in live view.
  if (await captchaChallengeVisible(page) || (await findCaptchaWidgetRect(page))) {
    push(
      "Captcha still open — open Live view and tick Verify you are human. Waiting 60s…",
    );
    const humanDeadline = Date.now() + 60_000;
    while (Date.now() < humanDeadline) {
      if (shouldAbort()) return "timeout";
      if (await recaptchaSolved(page)) {
        push("Captcha: solved (live view)");
        return "solved";
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  push("Captcha wait ended — widget still not Success");
  return "timeout";

  function detach() {
    try {
      pageAny.off?.("console", onConsole);
      pageAny.removeListener?.("console", onConsole);
    } catch {
      /* ignore */
    }
  }
}

export async function waitForCaptchaWidget(
  page: AgentPage,
  opts?: { timeoutMs?: number; shouldAbort?: () => boolean },
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const shouldAbort = opts?.shouldAbort ?? (() => false);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (shouldAbort()) return false;
    if (await findCaptchaWidgetRect(page)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return Boolean(await findCaptchaWidgetRect(page));
}

/**
 * Tick Cloudflare when the widget is already on the registration form.
 * Returns absent only when no widget can be found.
 */
export async function solveCaptchaIfPresent(
  page: AgentPage,
  stagehand: Stagehand,
  opts?: {
    push?: (msg: string) => void;
    shouldAbort?: () => boolean;
    timeoutMs?: number;
  },
): Promise<"solved" | "absent" | "timeout" | "errored"> {
  if (await recaptchaSolved(page)) return "solved";
  const rect = await findCaptchaWidgetRect(page);
  const visible = rect || (await captchaChallengeVisible(page));
  if (!visible) return "absent";
  return waitForBrowserbaseCaptcha(page, stagehand, {
    timeoutMs: opts?.timeoutMs ?? 50_000,
    push: opts?.push,
    shouldAbort: opts?.shouldAbort,
  });
}

export async function solveCaptchaAfterSubmit(
  page: AgentPage,
  stagehand: Stagehand,
  opts?: {
    push?: (msg: string) => void;
    shouldAbort?: () => boolean;
    appearMs?: number;
  },
): Promise<"solved" | "absent" | "timeout" | "errored"> {
  const push = opts?.push ?? (() => {});
  const shouldAbort = opts?.shouldAbort ?? (() => false);

  if (await recaptchaSolved(page)) return "solved";

  push("Waiting for Cloudflare / captcha after Create Account…");
  const appeared = await waitForCaptchaWidget(page, {
    timeoutMs: opts?.appearMs ?? 12_000,
    shouldAbort,
  });
  if (shouldAbort()) return "timeout";
  if (!appeared && !(await captchaChallengeVisible(page))) {
    push("No captcha after submit");
    return "absent";
  }

  await new Promise((r) => setTimeout(r, 600));
  return waitForBrowserbaseCaptcha(page, stagehand, {
    timeoutMs: 50_000,
    push,
    shouldAbort,
  });
}
