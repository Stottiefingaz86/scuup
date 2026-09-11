import type { PostSignupObservation, WelcomeTouch } from "./types";

/**
 * Post-signup research: the moment the account exists, does the brand say
 * hello? Winna fires a personalised Intercom-style greeting ("Hey
 * jordanbrooks9010, welcome to Winna…") a couple of minutes after signup.
 * That's a retention touch worth benchmarking — and a floating panel that
 * would swallow clicks if we left it open, so we capture then dismiss.
 */

type InspectPage = {
  evaluate: (expr: string) => Promise<unknown>;
};

type WelcomeHit = {
  channel: WelcomeTouch["channel"];
  text: string;
  sender: string | null;
  ctas: string[];
};

/** Regex is intentionally narrow — "welcome bonus" copy is on every homepage. */
const WELCOME_JS_RE = String.raw`/(^|\b)(hey|hi|hello|welcome)\b[^.!\n]{0,40}(welcome|great to have you|glad you|thanks for (joining|signing)|you're in|you picked a great time|account (is|has been) created|let'?s get (you )?started)|welcome to [a-z0-9 .'-]{2,30}[!.,]|thanks for (joining|signing up)|great to have you on board/i`;

const INSPECT_SCRIPT = `(() => {
  const vis = (el) => {
    if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  };
  const clean = (s) => String(s || "").replace(/[ \\t]+/g, " ").replace(/\\n{2,}/g, "\\n").trim();
  const welcomeRe = ${WELCOME_JS_RE};
  const bonusOnly = /welcome (bonus|offer|package|pack)/i;
  const isWelcome = (t) => {
    if (!t || t.length < 16 || t.length > 2500) return false;
    if (!welcomeRe.test(t)) return false;
    // "Welcome bonus 200%" banners aren't a greeting.
    const stripped = t.replace(bonusOnly, "");
    return welcomeRe.test(stripped);
  };
  const ctasOf = (root) => {
    const out = [];
    for (const el of root.querySelectorAll("a, button, [role='button']")) {
      if (!vis(el)) continue;
      const label = clean(el.innerText || el.getAttribute("aria-label") || "");
      if (!label || label.length > 40 || /^[×x✕]$/i.test(label)) continue;
      if (!out.includes(label)) out.push(label);
      if (out.length >= 6) break;
    }
    return out;
  };
  const senderOf = (t) => {
    const m = t.match(/(?:^|\\n)\\s*([A-Z][A-Za-z]{1,24})\\s*[•·]\\s*(?:just now|\\d+\\s?(?:m|min|h|s)\\b)/);
    return m ? m[1] : null;
  };

  const chatSel = [
    "#intercom-container", "[class*='intercom' i]", "iframe[name^='intercom']",
    ".crisp-client", "#hubspot-messages-iframe-container", "[id*='tawk' i]",
    "[class*='livechat' i]", "#chat-widget-container", "[class*='zsiq' i]",
    "[id*='fc_frame' i]", "#drift-widget", "[class*='drift' i]", "#tidio-chat",
    "[class*='messenger' i]", "[class*='chat-widget' i]", "[class*='chatwidget' i]",
    "[class*='support-widget' i]", "[data-testid*='chat' i]",
  ].join(",");

  // Same-origin iframes (Intercom's message frames are about:blank) — read their body.
  const frameDocs = [];
  for (const f of document.querySelectorAll("iframe")) {
    if (!vis(f)) continue;
    try {
      const d = f.contentDocument;
      if (d && d.body) frameDocs.push({ frame: f, doc: d });
    } catch {}
  }

  // 1) Chat widgets: containers on the page or their same-origin frames.
  for (const { frame, doc } of frameDocs) {
    const t = clean(doc.body.innerText).slice(0, 1200);
    if (isWelcome(t)) {
      frame.setAttribute("data-rs-welcome", "frame");
      return { channel: "chat", text: t.slice(0, 700), sender: senderOf(t), ctas: ctasOf(doc.body) };
    }
  }
  for (const el of document.querySelectorAll(chatSel)) {
    if (!vis(el)) continue;
    const t = clean(el.innerText).slice(0, 1200);
    if (isWelcome(t)) {
      el.setAttribute("data-rs-welcome", "chat");
      return { channel: "chat", text: t.slice(0, 700), sender: senderOf(t), ctas: ctasOf(el) };
    }
  }

  // 2) Modal / popup / toast / banner greeting.
  const groups = [
    ["modal", "[role='dialog'], [aria-modal='true'], [class*='modal' i], [class*='popup' i], [class*='dialog' i]"],
    ["toast", "[role='alert'], [role='status'], [class*='toast' i], [class*='snackbar' i], [class*='notification' i]"],
    ["banner", "[class*='banner' i], [class*='announce' i], [class*='onboard' i], [class*='welcome' i]"],
  ];
  for (const [channel, sel] of groups) {
    for (const el of document.querySelectorAll(sel)) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > innerWidth * 0.98 && r.height > innerHeight * 0.98) continue; // page wrapper
      const t = clean(el.innerText).slice(0, 1200);
      if (isWelcome(t)) {
        el.setAttribute("data-rs-welcome", channel);
        return { channel, text: t.slice(0, 700), sender: senderOf(t), ctas: ctasOf(el) };
      }
    }
  }
  // Full-page messenger (Winna / Paul) has no dialog role — still a greeting.
  const body = clean(document.body && document.body.innerText).slice(0, 1200);
  if (isWelcome(body) || /need help\\??|we.?ve got you covered/i.test(body)) {
    document.body.setAttribute("data-rs-welcome", "chat");
    return { channel: "chat", text: body.slice(0, 700), sender: senderOf(body), ctas: ctasOf(document.body) };
  }
  return null;
})()`;

const CHAT_COPY_RE = String.raw`/live\\s*rain|top\\s*rain\\s*contributors|need help\\??|we.?ve got you covered|great to have you on board|welcome to [a-z0-9 .'-]{2,24}|drop me a message|type a message|message\\.{2,}|happily to have you|happy to have you/i`;

const DISMISS_CHAT_HELPERS = `
  const closeRe = /^(close|dismiss|×|x|✕|✖|got it|ok|okay|later|not now)$/i;
  const chatCopyRe = ${CHAT_COPY_RE};
  const vis = (el) => {
    if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  };
  const clickClose = (root) => {
    if (!root) return null;
    const cands = [...root.querySelectorAll(
      "button, [role='button'], a, [aria-label*='close' i], [aria-label*='dismiss' i], [class*='close' i], [data-testid*='close' i]"
    )];
    // Prefer the top-right X on messenger / rain chat.
    cands.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      if (Math.abs(ar.top - br.top) > 12) return ar.top - br.top;
      return br.right - ar.right;
    });
    for (const el of cands) {
      if (!vis(el)) continue;
      const label = String(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "")
        .replace(/\\s+/g, " ").trim();
      const cls = String(el.className || "");
      if (closeRe.test(label) || /close|dismiss/i.test(cls) || /close|dismiss/i.test(String(el.getAttribute("aria-label") || ""))) {
        try { el.click(); return "clicked"; } catch {}
      }
    }
    // Unlabelled X in the top-right of a large overlay (Winna Live Rain).
    const box = root.getBoundingClientRect ? root.getBoundingClientRect() : null;
    if (box && box.width > 280) {
      for (const el of cands) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        const lab = String(el.textContent || "").replace(/\\s+/g, "").trim();
        if (lab.length > 2) continue;
        if (r.top <= box.top + 56 && r.right >= box.right - 56 && r.width <= 48 && r.height <= 48) {
          try { el.click(); return "clicked"; } catch {}
        }
      }
    }
    return null;
  };
  const looksLikeChat = (el) => {
    const t = String(el.innerText || "").slice(0, 2500);
    if (chatCopyRe.test(t)) return true;
    const composer = el.querySelector("textarea, [contenteditable='true'], input[placeholder*='message' i], input[placeholder*='Message' i]");
    if (!composer) return false;
    return /paul|general|live rain|welcome|chat|need help/i.test(t);
  };
  const hideEl = (el) => {
    try { el.style.setProperty("display", "none", "important"); return "hidden"; } catch { return null; }
  };
  const pageIsMessenger = () => {
    const t = String(document.body && document.body.innerText || "").slice(0, 4000);
    const composer = [...document.querySelectorAll(
      "textarea, [contenteditable='true'], input[placeholder*='message' i], input[placeholder*='Message' i]"
    )].some(vis);
    if (!composer) return false;
    return /need help|we.?ve got you covered|great to have you on board|welcome to winna|drop me a message|live\\s*rain|- paul\\b|message\\.{2,}/i.test(t);
  };
  const clickViewportClose = () => {
    const cands = [...document.querySelectorAll("button, [role='button'], a")].filter(vis);
    const topRight = cands.filter((el) => {
      const r = el.getBoundingClientRect();
      const lab = String(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "")
        .replace(/\\s+/g, " ").trim();
      const iconOnly = lab.length <= 2 || /close|dismiss/i.test(lab);
      return iconOnly && r.top < 80 && r.right > innerWidth - 80 && r.width <= 52 && r.height <= 52;
    });
    topRight.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    if (topRight[0]) {
      try { topRight[0].click(); return "clicked"; } catch {}
    }
    return null;
  };
`;

/** Hide chat only — never click. Clicking X / the launcher toggles Winna chat open. */
const IGNORE_CHAT_SCRIPT = `(() => {
  ${DISMISS_CHAT_HELPERS}
  const bury = (el) => {
    if (!el || !(el instanceof HTMLElement)) return;
    const r = el.getBoundingClientRect();
    // Never hide the app shell / cashier — that blanks the page.
    if (r.width > innerWidth * 0.82 || r.height > innerHeight * 0.82) return;
    hideEl(el);
    try {
      el.style.setProperty("pointer-events", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
    } catch {}
  };
  let result = null;
  const tagged = document.querySelector("[data-rs-welcome]");
  if (tagged instanceof HTMLElement) {
    bury(tagged);
    tagged.removeAttribute("data-rs-welcome");
    result = "hidden";
  }
  for (const f of document.querySelectorAll(
    "iframe[name*='intercom'], iframe[id*='intercom'], iframe[title*='intercom' i]"
  )) {
    bury(f);
    const wrap = f.closest("#intercom-container");
    if (wrap instanceof HTMLElement) bury(wrap);
    result = "hidden";
  }
  const intercom = document.querySelector("#intercom-container");
  if (intercom instanceof HTMLElement) {
    bury(intercom);
    result = "hidden";
  }
  // Innermost welcome card only — do not bury ancestors (wallet is often a modal).
  const welcomeRe = /hey,?\\s+\\w+|welcome to [a-z0-9 .'-]{2,24}|great to have you on board/i;
  const cards = [...document.querySelectorAll(
    "[role='dialog'], [aria-modal='true']"
  )].filter((el) => el instanceof HTMLElement);
  const welcomeCards = cards.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 80) return false;
    if (r.width > innerWidth * 0.82 || r.height > innerHeight * 0.82) return false;
    return welcomeRe.test(String(el.innerText || ""));
  });
  welcomeCards.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.width * ar.height - br.width * br.height;
  });
  if (welcomeCards[0]) {
    bury(welcomeCards[0]);
    result = "hidden";
  }
  return result;
})()`;

const CHAT_OPEN_SCRIPT = `(() => {
  ${DISMISS_CHAT_HELPERS}
  const dialogs = [...document.querySelectorAll(
    "[role='dialog'], [aria-modal='true'], [class*='modal' i], [class*='messenger' i], [class*='chat' i], iframe[name*='intercom']"
  )].filter(vis);
  if (dialogs.some((el) => el.tagName === "IFRAME" || looksLikeChat(el))) return true;
  const t = String(document.body && document.body.innerText || "").slice(0, 4000);
  const composer = [...document.querySelectorAll(
    "textarea, [contenteditable='true'], input[placeholder*='message' i], input[placeholder*='Message' i]"
  )].some(vis);
  return Boolean(composer && /need help|we.?ve got you covered|great to have you on board|welcome to winna|drop me a message|live\\s*rain|- paul\\b/i.test(t));
})()`;

/**
 * Auto welcome card on the lobby (Winna Paul popup). Not the full-page
 * messenger — that only appears if something clicked the chat launcher.
 */
export async function pageLooksLikeWelcomePopup(
  page: InspectPage,
): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const vis = (el) => {
          if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 160 || r.height < 80) return false;
          const cs = getComputedStyle(el);
          return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
        };
        const welcomeRe = /hey,?\\s+\\w+|welcome to [a-z0-9 .'-]{2,24}|great to have you on board/i;
        const body = String(document.body && document.body.innerText || "");
        const lobby = /originals|see all|providers|casino/i.test(body);
        const composer = [...document.querySelectorAll(
          "textarea, [contenteditable='true'], input[placeholder*='message' i]"
        )].some(vis);
        // Full-page messenger — do not treat as the popup we want.
        if (composer && !lobby) return false;
        const nodes = [
          ...document.querySelectorAll(
            "[role='dialog'], [aria-modal='true'], [class*='modal' i], [class*='popup' i], [class*='intercom' i], [class*='messenger' i], iframe"
          ),
        ];
        for (const el of nodes) {
          if (!vis(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width > innerWidth * 0.92 && r.height > innerHeight * 0.92) continue;
          let t = String(el.innerText || "");
          if (el instanceof HTMLIFrameElement) {
            try {
              t = String(el.contentDocument && el.contentDocument.body && el.contentDocument.body.innerText || "");
            } catch {}
          }
          if (welcomeRe.test(t)) return true;
        }
        return welcomeRe.test(body) && lobby;
      })()`),
    );
  } catch {
    return false;
  }
}

export async function inspectWelcomeTouch(
  page: InspectPage,
): Promise<WelcomeHit | null> {
  try {
    const raw = await page.evaluate(INSPECT_SCRIPT);
    if (!raw || typeof raw !== "object") return null;
    const hit = raw as WelcomeHit;
    if (!hit.text) return null;
    return hit;
  } catch {
    return null;
  }
}

/** Hide the greeting without clicking — clicks reopen Winna chat. */
export async function dismissWelcomeTouch(
  page: InspectPage,
): Promise<"clicked" | "hidden" | null> {
  return dismissOpenChat(page);
}

/** Winna Live Rain / Intercom messenger / any chat overlay covering the lobby. */
export async function pageLooksLikeOpenChat(
  page: InspectPage,
): Promise<boolean> {
  try {
    return Boolean(await page.evaluate(CHAT_OPEN_SCRIPT));
  } catch {
    return false;
  }
}

/**
 * The screen the brand puts the player on after submit — logged-in lobby,
 * welcome chat, or cashier. Not the signup form and not the logged-out home.
 */
export async function pageLooksLikePostSignupDestination(
  page: InspectPage,
): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const visTop = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8 || r.top > 160) return false;
          const cs = getComputedStyle(el);
          return cs.display !== "none" && cs.visibility !== "hidden";
        };
        let login = false, register = false;
        for (const el of document.querySelectorAll("a, button, [role='button']")) {
          if (!visTop(el)) continue;
          const t = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
          if (!t || t.length > 22) continue;
          if (/^(log ?in|sign ?in)$/.test(t)) login = true;
          if (/^(register|sign ?up|join)$/.test(t)) register = true;
        }
        const t = (document.body && document.body.innerText || "").slice(0, 8000);
        const pwd = [...document.querySelectorAll("input[type='password']")].some((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (pwd && /create(\\s+an?)?\\s+account|sign\\s*up|register/i.test(t)) return false;
        if (login && register) return false;
        const cashier = /wallet\\s*address|payment method|minimum deposit/i.test(t);
        const authed = /log ?out|sign ?out|my (account|profile)/i.test(t);
        // Lobby only — an open messenger is not the landing page.
        const lobby = !login && !register && !pwd;
        return cashier || authed || lobby;
      })()`),
    );
  } catch {
    return false;
  }
}

/** Hide chat overlays. Never click and never leave the page. */
export async function dismissOpenChat(
  page: InspectPage,
): Promise<"clicked" | "hidden" | null> {
  try {
    const r = await page.evaluate(IGNORE_CHAT_SCRIPT);
    return r === "hidden" || r === "navigated" ? "hidden" : null;
  } catch {
    return null;
  }
}

/** Does the greeting use the player's own name / handle? */
export function isPersonalized(
  text: string,
  vars: Record<string, string | undefined>,
): boolean {
  const hay = text.toLowerCase();
  const keys = [vars.username, vars.firstName, vars.email?.split("@")[0]]
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter((v) => v.length >= 3);
  return keys.some((k) => hay.includes(k));
}

export function emptyPostSignup(): PostSignupObservation {
  return {
    welcome: {
      seen: false,
      channel: null,
      text: null,
      sender: null,
      personalized: false,
      ctas: [],
      afterSec: null,
      dismissed: null,
    },
    landedOn: null,
    landingUrl: null,
    clicksToWallet: null,
    screenshotUrls: [],
  };
}

/** Known landings from the finished walks — used when the agent never stored one. */
export function knownSignupLanding(
  brandName: string,
): Pick<PostSignupObservation, "landedOn" | "clicksToWallet"> | null {
  if (/betonline/i.test(brandName)) {
    return { landedOn: "cashier", clicksToWallet: 0 };
  }
  if (/betus/i.test(brandName)) {
    return { landedOn: "cashier", clicksToWallet: 0 };
  }
  if (/winna/i.test(brandName)) {
    return { landedOn: "casino", clicksToWallet: 1 };
  }
  return null;
}

export function signupLandingLabel(
  obs: PostSignupObservation | null | undefined,
): string | null {
  if (!obs?.landedOn) return null;
  const where =
    obs.landedOn === "cashier"
      ? "Deposit"
      : obs.landedOn === "casino"
        ? "Casino"
        : obs.landedOn === "sportsbook"
          ? "Sports"
          : obs.landedOn === "lobby"
            ? "Lobby"
            : obs.landedOn;
  if (obs.clicksToWallet == null) return where;
  if (obs.clicksToWallet === 0) return `${where} · wallet is here`;
  if (obs.clicksToWallet === 1) return `${where} · 1 click to wallet`;
  return `${where} · ${obs.clicksToWallet} clicks to wallet`;
}

/** One-line for the feature matrix / evidence strings. */
export function welcomeTouchLabel(
  obs: PostSignupObservation | null | undefined,
): string | null {
  if (!obs) return null;
  const w = obs.welcome;
  if (!w.seen) return "None seen";
  const channel =
    w.channel === "chat"
      ? "Chat greeting"
      : w.channel === "modal"
        ? "Welcome modal"
        : w.channel === "toast"
          ? "Welcome toast"
          : "Welcome banner";
  const bits = [channel];
  if (w.personalized) bits.push("personalised");
  if (w.sender) bits.push(`from ${w.sender}`);
  if (w.afterSec != null) bits.push(`${w.afterSec}s after signup`);
  return bits.join(" · ");
}
