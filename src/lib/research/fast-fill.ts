/** Instant DOM fill for registration fields — avoids Stagehand typing
 * each character via the LLM (often 30–60s for first + last name alone). */

const HELPERS = `function visible(el) {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const s = getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
}
function labelFor(el) {
  const id = el.getAttribute("id");
  if (id) {
    const lab = document.querySelector('label[for="' + CSS.escape(id) + '"]');
    if (lab) return lab.textContent || "";
  }
  const wrap = el.closest("label, [class*='field' i], [class*='input' i], form, div");
  return wrap ? wrap.textContent || "" : "";
}
/** Native checkbox may be opacity:0 / sr-only — still usable if label is on-screen. */
function checkboxUsable(el) {
  if (!(el instanceof HTMLInputElement) || el.type !== "checkbox") return false;
  if (el.disabled) return false;
  if (visible(el)) return true;
  const lab =
    (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) ||
    el.closest("label");
  if (lab instanceof HTMLElement && visible(lab)) return true;
  const wrap = el.closest("[class*='check' i], [class*='consent' i], [class*='term' i], form, div");
  return wrap instanceof HTMLElement && visible(wrap);
}
function roleCheckboxUsable(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return visible(el) || (el.closest("label") instanceof HTMLElement && visible(el.closest("label")));
}
function checkboxMeta(el) {
  const label = [
    el.getAttribute("aria-label") || "",
    labelFor(el),
    el.closest("label")?.textContent || "",
  ].join(" ").replace(/\\s+/g, " ").trim();
  return (
    (el.getAttribute("name") || "") +
    " " +
    (el.getAttribute("id") || "") +
    " " +
    label
  ).toLowerCase();
}
function isMarketingMeta(meta) {
  return (
    /market|promo|offer|newsletter|sms|email me|keep me|partner|third.?party|bonus alert/.test(meta) &&
    !/terms|condition|privacy|age|18|21|agree to|acknowledge|confirm i|over the age/.test(meta)
  );
}
function isRequiredConsentMeta(meta) {
  return /terms|condition|privacy|age|\\b18\\b|\\b21\\b|agree|acknowledge|accept the|i confirm|i am over|over the age|responsible|consent/.test(
    meta
  );
}
function tickCheckboxEl(el) {
  if (el instanceof HTMLInputElement) {
    if (el.checked) return false;
    // Click the INPUT only — never the wrapping label. Labels often wrap
    // "Terms and Conditions" <a> links; clicking the label navigates away
    // and closes the signup modal.
    try { el.click(); } catch {}
    if (!el.checked) {
      el.checked = true;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return !!el.checked;
  }
  // role=checkbox custom control
  if (el.getAttribute("aria-checked") === "true") return false;
  if (el.closest && el.closest("a[href]")) return false;
  try {
    el.click();
  } catch {}
  const pressed = el.getAttribute("aria-checked");
  if (pressed !== "true") {
    el.setAttribute("aria-checked", "true");
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return el.getAttribute("aria-checked") === "true";
}`

type PageLike = {
  evaluate: (expr: string) => Promise<unknown>;
  url?: () => string;
  // Stagehand Page.goto — keep loose so Playwright LoadState doesn't fight us
  goto?: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
};

export async function fastFillPersonaFields(
  page: PageLike,
  vars: Record<string, string>,
): Promise<{ filled: number; kinds: string[] }> {
  const pairs: {
    kind: string;
    value: string;
    re: string;
    types?: string[];
    day?: string;
    month?: string;
    year?: string;
  }[] = [
    {
      kind: "email",
      value: vars.email ?? "",
      re: "e-?mail|emailaddress",
      types: ["email", "text"],
    },
    {
      kind: "password",
      value: vars.password ?? "",
      re: "password|passcode|create password|confirm",
      types: ["password"],
    },
    {
      kind: "firstName",
      value: vars.firstName ?? "",
      re: "first\\s*name|forename|given\\s*name|firstname",
    },
    {
      kind: "lastName",
      value: vars.lastName ?? "",
      re: "last\\s*name|surname|family\\s*name|lastname",
    },
    {
      kind: "fullName",
      value: vars.fullName ?? "",
      re: "full\\s*name|your\\s*name|^name$",
    },
    {
      kind: "username",
      value: vars.username ?? "",
      re: "username|user\\s*name|display\\s*name|nickname",
    },
    {
      kind: "phone",
      value: vars.phone ?? "",
      re: "phone|mobile|tel|cell",
      types: ["tel", "text"],
    },
    {
      kind: "dateOfBirth",
      // Placeholder on the input wins — see formatDobFromParts in the script.
      value: vars.dateOfBirthDisplay ?? vars.dateOfBirth ?? "",
      re: "date\\s*of\\s*birth|dob|birth\\s*date|birthday",
      day: vars.dateOfBirthDay ?? "",
      month: vars.dateOfBirthMonth ?? "",
      year: vars.dateOfBirthYear ?? "",
    },
    {
      kind: "dateOfBirthDay",
      value: vars.dateOfBirthDay ?? "",
      re: "^day$|birth.*day|dob.*day",
    },
    {
      kind: "dateOfBirthMonth",
      value: vars.dateOfBirthMonth ?? "",
      re: "^month$|birth.*month|dob.*month",
    },
    {
      kind: "dateOfBirthYear",
      value: vars.dateOfBirthYear ?? "",
      re: "^year$|birth.*year|dob.*year",
    },
    {
      kind: "addressLine1",
      value: vars.addressLine1 ?? "",
      re: "address\\s*line\\s*1|address1|street|house\\s*number|address(?!\\s*line\\s*2)",
    },
    {
      kind: "city",
      value: vars.city ?? "",
      re: "city|town",
    },
    {
      kind: "postalCode",
      value: vars.postalCode ?? "",
      re: "post\\s*code|postal\\s*code|zip",
    },
    {
      kind: "state",
      value: vars.state ?? "",
      re: "county|state|province|region",
    },
    {
      kind: "country",
      value: vars.country ?? "",
      re: "country|nation",
    },
  ].filter((p) => p.value);

  const script = `(() => {
    ${HELPERS}
    const pairs = ${JSON.stringify(pairs)};
    const proto = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );
    const formatDob = (pair, hint) => {
      const day = String(pair.day || "").padStart(2, "0");
      const month = String(pair.month || "").padStart(2, "0");
      const year = String(pair.year || "");
      if (!day || !month || !year) return pair.value;
      const h = String(hint || "").toUpperCase();
      if (/MM\\s*\\/\\s*DD\\s*\\/\\s*YYYY/.test(h) || /MM-DD-YYYY/.test(h)) {
        return h.includes("-")
          ? month + "-" + day + "-" + year
          : month + "/" + day + "/" + year;
      }
      if (/DD\\s*\\/\\s*MM\\s*\\/\\s*YYYY/.test(h) || /DD-MM-YYYY/.test(h)) {
        return h.includes("-")
          ? day + "-" + month + "-" + year
          : day + "/" + month + "/" + year;
      }
      if (/YYYY\\s*[-/]\\s*MM\\s*[-/]\\s*DD/.test(h)) {
        return h.includes("/")
          ? year + "/" + month + "/" + day
          : year + "-" + month + "-" + day;
      }
      return pair.value;
    };
    const setVal = (el, v) => {
      try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (_) {} }
      el.select?.();
      if (el.tagName === "SELECT") {
        const opts = [...el.options];
        const hit =
          opts.find((o) => o.value.toLowerCase() === v.toLowerCase()) ||
          opts.find((o) => o.text.toLowerCase().includes(v.toLowerCase()));
        if (hit) el.value = hit.value;
        else return false;
      } else if (proto && proto.set) proto.set.call(el, v);
      else el.value = v;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: v, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    };
    const inputs = [...document.querySelectorAll("input, select, textarea")].filter(visible);
    let filled = 0;
    const filledKinds = [];
    let dobFormatUsed = null;
    for (const pair of pairs) {
      const re = new RegExp(pair.re, "i");
      const allow = pair.types || null;
      for (const el of inputs) {
        const type = (el.getAttribute("type") || "text").toLowerCase();
        if (type === "hidden" || type === "checkbox" || type === "radio" || type === "submit") continue;
        if (allow && !allow.includes(type) && el.tagName !== "SELECT") continue;
        if (pair.kind !== "password" && type === "password") continue;
        const placeholder = el.getAttribute("placeholder") || "";
        const meta = [
          el.getAttribute("name") || "",
          el.getAttribute("id") || "",
          el.getAttribute("autocomplete") || "",
          placeholder,
          el.getAttribute("aria-label") || "",
          labelFor(el),
        ].join(" ");
        if (pair.kind === "email" && type === "email") {
          /* match */
        } else if (pair.kind === "password" && type === "password") {
          /* match */
        } else if (!re.test(meta)) continue;

        let value = pair.value;
        if (pair.kind === "dateOfBirth") {
          value = formatDob(pair, placeholder + " " + meta);
          dobFormatUsed = placeholder || value;
          // Overwrite wrong format already typed (e.g. DD/MM into MM/DD field).
          const cur = String(el.value || "").trim();
          if (cur && cur !== value) {
            if (proto && proto.set) proto.set.call(el, "");
            else el.value = "";
          } else if (cur && cur === value) {
            break;
          }
        } else if (el.value && String(el.value).trim().length > 0) {
          continue;
        }

        if (setVal(el, value)) {
          filled += 1;
          filledKinds.push(
            pair.kind === "dateOfBirth" && placeholder
              ? pair.kind + "@" + placeholder
              : pair.kind
          );
        }
        break;
      }
    }
    return { filled, kinds: filledKinds, dobFormatUsed };
  })()`;

  try {
    const result = (await page.evaluate(script)) as {
      filled: number;
      kinds: string[];
      dobFormatUsed?: string | null;
    };
    return {
      filled: result?.filled ?? 0,
      kinds: result?.kinds ?? [],
    };
  } catch {
    return { filled: 0, kinds: [] };
  }
}

export type CheckboxInsight = {
  label: string;
  checked: boolean;
  required: boolean;
  marketing: boolean;
};

/**
 * Fill login email + password via DOM (Stagehand often skips password fields).
 * Returns which fields were written.
 */
export async function fastFillLoginCredentials(
  page: PageLike,
  opts: { email: string; password: string },
): Promise<{ email: boolean; password: boolean }> {
  const email = opts.email.trim();
  const password = opts.password;
  if (!email || !password) {
    return { email: false, password: false };
  }

  const script = `(() => {
    ${HELPERS}
    const emailVal = ${JSON.stringify(email)};
    const passVal = ${JSON.stringify(password)};
    const proto = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );
    const setVal = (el, v) => {
      el.focus();
      el.select?.();
      if (proto && proto.set) proto.set.call(el, v);
      else el.value = v;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: v, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return (el.value || "").length > 0;
    };
    const inputs = [...document.querySelectorAll("input")].filter(visible);
    let emailOk = false;
    let passOk = false;

    // Password first — unambiguous type=password
    for (const el of inputs) {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type !== "password") continue;
      // Prefer the login password, not "confirm" on register forms
      const meta = (
        (el.getAttribute("name") || "") +
        " " +
        (el.getAttribute("id") || "") +
        " " +
        (el.getAttribute("placeholder") || "") +
        " " +
        labelFor(el)
      ).toLowerCase();
      if (/confirm|re-?enter|repeat/.test(meta) && inputs.filter((i) => (i.getAttribute("type") || "").toLowerCase() === "password").length > 1) {
        continue;
      }
      if (setVal(el, passVal)) passOk = true;
      break;
    }
    // If still empty, force the first visible password input
    if (!passOk) {
      const pw = inputs.find((el) => (el.getAttribute("type") || "").toLowerCase() === "password");
      if (pw && setVal(pw, passVal)) passOk = true;
    }

    for (const el of inputs) {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "password" || type === "hidden" || type === "checkbox" || type === "submit") continue;
      const meta = (
        (el.getAttribute("name") || "") +
        " " +
        (el.getAttribute("id") || "") +
        (el.getAttribute("autocomplete") || "") +
        " " +
        (el.getAttribute("placeholder") || "") +
        " " +
        labelFor(el)
      ).toLowerCase();
      const isEmail =
        type === "email" ||
        /e-?mail|account\\s*number|username|user\\s*name|login|userid/.test(meta);
      if (!isEmail) continue;
      if (setVal(el, emailVal)) emailOk = true;
      break;
    }

    return {
      email: emailOk,
      password: passOk,
      passwordLen: (() => {
        const pw = inputs.find((el) => (el.getAttribute("type") || "").toLowerCase() === "password");
        return pw ? String(pw.value || "").length : 0;
      })(),
    };
  })()`;

  try {
    const result = (await page.evaluate(script)) as {
      email?: boolean;
      password?: boolean;
      passwordLen?: number;
    };
    return {
      email: Boolean(result?.email),
      password: Boolean(result?.password) && (result?.passwordLen ?? 0) > 0,
    };
  } catch {
    return { email: false, password: false };
  }
}

/** Read visible checkboxes and classify required vs optional marketing. */
export async function inspectRegistrationCheckboxes(
  page: PageLike,
): Promise<CheckboxInsight[]> {
  const script = `(() => {
    ${HELPERS}
    const native = [...document.querySelectorAll('input[type="checkbox"]')].filter(checkboxUsable);
    const roles = [...document.querySelectorAll('[role="checkbox"]')].filter(roleCheckboxUsable);
    const seen = new Set();
    const rows = [];
    for (const el of [...native, ...roles]) {
      if (seen.has(el)) continue;
      seen.add(el);
      const meta = checkboxMeta(el);
      const label = meta.trim().slice(0, 160) || "checkbox";
      const marketing = isMarketingMeta(meta);
      const requiredAttr =
        (el instanceof HTMLInputElement && (el.required || el.getAttribute("aria-required") === "true")) ||
        el.getAttribute("aria-required") === "true";
      const required = (requiredAttr || isRequiredConsentMeta(meta)) && !marketing;
      const checked =
        el instanceof HTMLInputElement
          ? !!el.checked
          : el.getAttribute("aria-checked") === "true";
      rows.push({
        label: label.slice(0, 160),
        checked,
        required,
        marketing,
      });
    }
    return rows;
  })()`;

  try {
    const rows = (await page.evaluate(script)) as CheckboxInsight[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/**
 * Tick age / terms consent if present. If none found, do nothing (not an error).
 * Handles Rainbet-style custom squares (red-outlined box next to acknowledge text).
 * Returns `already` when consent is already satisfied (so callers must NOT run an
 * LLM "tick checkbox" act — that often hits the modal Close instead).
 */
export async function fastTickRequiredCheckboxes(
  page: PageLike,
): Promise<{ ticked: number; skipped: number; none: boolean; already: boolean }> {
  const script = `(() => {
    ${HELPERS}
    let ticked = 0;
    let skipped = 0;
    let already = false;

    function clickSmallBox(root) {
      if (!(root instanceof HTMLElement)) return false;
      const nodes = [
        ...root.querySelectorAll(
          'input[type="checkbox"], [role="checkbox"], button, span, div, i, svg'
        ),
        root.previousElementSibling,
        root.parentElement && root.parentElement.firstElementChild,
      ].filter(Boolean);
      for (const c of nodes) {
        if (!(c instanceof HTMLElement)) continue;
        if (c.closest && c.closest("a")) continue;
        const lab = ((c.getAttribute("aria-label") || "") + " " + (c.getAttribute("title") || "")).toLowerCase();
        if (/close|dismiss|cancel|×|✕/.test(lab)) continue;
        if (/close|dismiss|cancel/.test((c.className || "").toString().toLowerCase())) continue;
        const r = c.getBoundingClientRect();
        if (r.width < 10 || r.height < 10 || r.width > 48 || r.height > 48) continue;
        // Already checked — don't click again (would uncheck / confuse the UI).
        if (c instanceof HTMLInputElement && c.type === "checkbox" && c.checked) {
          already = true;
          return false;
        }
        if (c.getAttribute && c.getAttribute("aria-checked") === "true") {
          already = true;
          return false;
        }
        try {
          c.click();
          return true;
        } catch {}
      }
      return false;
    }

    // 1) Native + role checkboxes with consent wording
    const native = [...document.querySelectorAll('input[type="checkbox"]')].filter(checkboxUsable);
    const roles = [...document.querySelectorAll('[role="checkbox"]')].filter(roleCheckboxUsable);
    const seen = new Set();
    for (const el of [...native, ...roles]) {
      if (seen.has(el)) continue;
      seen.add(el);
      const meta = checkboxMeta(el);
      if (isMarketingMeta(meta)) {
        skipped += 1;
        continue;
      }
      if (!isRequiredConsentMeta(meta)) {
        // Lone unchecked box next to short consent-ish label still counts
        if (!/agree|terms|age|18|acknowledge|confirm|accept|privacy|consent/i.test(meta)) {
          skipped += 1;
          continue;
        }
      }
      const checked =
        (el instanceof HTMLInputElement && el.checked) ||
        el.getAttribute("aria-checked") === "true";
      if (checked) {
        already = true;
        continue;
      }
      if (tickCheckboxEl(el)) ticked += 1;
    }

    // 2) Custom UI: find "over the age of 18" / Terms acknowledge row, click the square
    if (ticked === 0 && !already) {
      const candidates = [
        ...document.querySelectorAll("label, div, span, p, li, button"),
      ].filter((n) => n instanceof HTMLElement && visible(n));
      for (const n of candidates) {
        const t = (n.textContent || "").replace(/\\s+/g, " ").trim();
        if (t.length < 20 || t.length > 260) continue;
        if (
          !/over the age of\\s*18|acknowledge that i am|agree to the terms and conditions|i am over\\s*18|terms and conditions/i.test(
            t
          )
        ) {
          continue;
        }
        // Prefer the checkbox square, never the Terms <a> / whole label.
        if (clickSmallBox(n) || clickSmallBox(n.parentElement)) {
          ticked += 1;
          break;
        }
        // Labels that wrap Terms links navigate away if clicked.
        try {
          if (
            n instanceof HTMLLabelElement &&
            !n.querySelector("a[href]")
          ) {
            const box = n.querySelector('input[type="checkbox"], [role="checkbox"]');
            if (box instanceof HTMLElement) {
              box.click();
              ticked += 1;
              break;
            }
          }
        } catch {}
      }
    }

    return {
      ticked,
      skipped,
      already,
      none: ticked === 0 && skipped === 0 && !already && native.length + roles.length === 0,
    };
  })()`;

  try {
    const result = (await page.evaluate(script)) as {
      ticked: number;
      skipped: number;
      none: boolean;
      already?: boolean;
    };
    return {
      ticked: result?.ticked ?? 0,
      skipped: result?.skipped ?? 0,
      none: Boolean(result?.none),
      already: Boolean(result?.already),
    };
  } catch {
    return { ticked: 0, skipped: 0, none: true, already: false };
  }
}

export function looksLikeHelpOrLegalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = `${u.hostname}${u.pathname}`.toLowerCase();
    return (
      /help\.|support\.|zendesk|intercom|freshdesk/.test(path) ||
      /terms|privacy|cookie-policy|responsible-gam/.test(path)
    );
  } catch {
    return /terms|privacy|help\./i.test(url);
  }
}

/**
 * If we drifted onto Terms/Help (usually via a consent-row link), go BACK.
 * Never goto(homepage) first — that kills the open signup modal.
 */
export async function recoverFromHelpOrLegalPage(
  page: PageLike,
  brandUrl: string,
): Promise<boolean> {
  const current =
    typeof page.url === "function"
      ? page.url()
      : String(await page.evaluate("location.href").catch(() => ""));
  if (!looksLikeHelpOrLegalUrl(current)) return false;
  try {
    const backed = await page.evaluate(`(() => {
      if (history.length > 1) { history.back(); return true; }
      return false;
    })()`);
    if (backed) {
      await new Promise((r) => setTimeout(r, 1500));
      const now =
        typeof page.url === "function"
          ? page.url()
          : String(await page.evaluate("location.href").catch(() => ""));
      if (!looksLikeHelpOrLegalUrl(now)) return true;
    }
  } catch {
    /* fall through to goto */
  }
  if (typeof page.goto !== "function") return false;
  // Last resort — caller must reopen Register after this.
  await page
    .goto(brandUrl, { waitUntil: "domcontentloaded", timeoutMs: 30000 })
    .catch(() => {});
  return true;
}

export async function countEmptyVisibleInputs(page: PageLike): Promise<number> {
  try {
    const n = await page.evaluate(`(() => {
      ${HELPERS}
      return [...document.querySelectorAll("input, select, textarea")]
        .filter(visible)
        .filter((el) => {
          const type = (el.getAttribute("type") || "text").toLowerCase();
          if (type === "hidden" || type === "checkbox" || type === "radio" || type === "submit") return false;
          return !el.value || String(el.value).trim().length === 0;
        }).length;
    })()`);
    return Number(n) || 0;
  } catch {
    return 0;
  }
}

/** Detect Create Account vs wizard Continue on the open registration UI. */
export async function inspectRegistrationSubmitUi(page: PageLike): Promise<{
  hasCreateAccount: boolean;
  hasContinueNext: boolean;
  createAccountDisabled: boolean;
}> {
  try {
    const result = (await page.evaluate(`(() => {
      ${HELPERS}
      const dialog = [...document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="drawer" i]'
      )].find((el) => {
        if (!(el instanceof HTMLElement) || !visible(el)) return false;
        const t = (el.innerText || "").slice(0, 4000);
        return /password|e-?mail|create(\\s+an?)?\\s+account|sign\\s*up|register/i.test(t);
      }) || null;
      const root = dialog || document;
      const nodes = [
        ...root.querySelectorAll("button, a, [role='button'], input[type='submit']"),
      ].filter((el) => el instanceof HTMLElement && visible(el));
      let hasCreateAccount = false;
      let hasContinueNext = false;
      let createAccountDisabled = false;
      for (const el of nodes) {
        const t = ((el.textContent || el.getAttribute("value") || "") + " " + (el.getAttribute("aria-label") || ""))
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
        if (!t || t.length > 48) continue;
        if (
          /create(\\s+an?)?\\s+account|sign\\s*up|register|join\\s+now|submit/.test(t) &&
          !/log\\s*in|sign\\s*in|already/.test(t)
        ) {
          // Header Sign Up while a dialog is open is a toggle, not submit.
          if (dialog && !dialog.contains(el) && !/create(\\s+an?)?\\s+account/.test(t)) {
            continue;
          }
          hasCreateAccount = true;
          if (
            ("disabled" in el && (el).disabled) ||
            el.getAttribute("aria-disabled") === "true" ||
            el.classList.contains("disabled")
          ) {
            createAccountDisabled = true;
          }
        }
        if (/^(continue|next|proceed)\\b/.test(t) || t === "continue" || t === "next") {
          hasContinueNext = true;
        }
      }
      return { hasCreateAccount, hasContinueNext, createAccountDisabled };
    })()`)) as {
      hasCreateAccount: boolean;
      hasContinueNext: boolean;
      createAccountDisabled: boolean;
    };
    return {
      hasCreateAccount: Boolean(result?.hasCreateAccount),
      hasContinueNext: Boolean(result?.hasContinueNext),
      createAccountDisabled: Boolean(result?.createAccountDisabled),
    };
  } catch {
    return {
      hasCreateAccount: false,
      hasContinueNext: false,
      createAccountDisabled: false,
    };
  }
}

/** True when Cloudflare Turnstile (or similar) already shows Success. */
export async function turnstileLooksSolved(page: PageLike): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const text = (document.body?.innerText || "").slice(0, 8000);
        if (/\\bsuccess!\\b/i.test(text) && /turnstile|cloudflare|verify you are human|security check/i.test(
          document.documentElement.innerHTML.slice(0, 50000)
        )) {
          return true;
        }
        // Green check + Success near the widget is enough on Rainbet-class forms.
        if (/\\bsuccess!\\b/i.test(text) && document.querySelector(
          "[class*='turnstile' i], iframe[src*='turnstile'], iframe[src*='challenges.cloudflare']"
        )) {
          return true;
        }
        return /\\bsuccess!\\b/i.test(text) && /create(\\s+an?)?\\s+account/i.test(text);
      })()`),
    );
  } catch {
    return false;
  }
}

/** Click Create Account via DOM. Never header Sign Up (that toggles the modal shut). */
export async function fastClickCreateAccount(
  page: PageLike,
  opts?: { force?: boolean },
): Promise<boolean> {
  const force = Boolean(opts?.force);
  try {
    const clicked = await page.evaluate(`((force) => {
      ${HELPERS}
      function fireClick(el) {
        // Do NOT scrollIntoView — scrolling the page behind a modal often
        // dismisses Rainbet/BetOnline-style registration dialogs.
        try { el.focus({ preventScroll: true }); } catch (_) {
          try { el.focus(); } catch (_) {}
        }
        const r = el.getBoundingClientRect();
        const x = r.left + Math.min(r.width / 2, 40);
        const y = r.top + Math.min(r.height / 2, 20);
        const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
          try {
            el.dispatchEvent(
              type.startsWith("pointer")
                ? new PointerEvent(type, { ...opts, pointerId: 1, pointerType: "mouse" })
                : new MouseEvent(type, opts)
            );
          } catch (_) {
            el.dispatchEvent(new MouseEvent(type === "pointerdown" ? "mousedown" : type === "pointerup" ? "mouseup" : type, opts));
          }
        }
        try { el.click(); } catch (_) {}
      }
      function labelOf(el) {
        return ((el.textContent || el.getAttribute("value") || "") + " " + (el.getAttribute("aria-label") || ""))
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }
      // Scope to the open registration panel via the password field (works even
      // when Rainbet doesn't use role=dialog / .modal class names).
      const pw = [...document.querySelectorAll("input[type='password']")].find(
        (el) => el instanceof HTMLElement && visible(el)
      );
      let dialog = null;
      if (pw) {
        let el = pw.parentElement;
        for (let i = 0; i < 14 && el; i++) {
          const t = (el.innerText || "").slice(0, 8000);
          const isDialog =
            el.getAttribute("role") === "dialog" ||
            el.getAttribute("aria-modal") === "true" ||
            /modal|drawer|signup|register|auth/i.test(el.className || "");
          if (
            /create(\\s+an?)?\\s+account/i.test(t) &&
            (isDialog || el.tagName === "FORM" || t.length > 200)
          ) {
            dialog = el;
            break;
          }
          if (isDialog && /password|e-?mail/i.test(t)) {
            dialog = el;
            break;
          }
          el = el.parentElement;
        }
        if (!dialog) {
          dialog =
            pw.closest(
              '[role="dialog"], [aria-modal="true"], form, [class*="modal" i], [class*="drawer" i], [class*="signup" i], [class*="register" i], [class*="auth" i]'
            ) || null;
        }
      }
      if (!dialog) {
        dialog =
          [...document.querySelectorAll(
            '[role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="drawer" i]'
          )].find((el) => {
            if (!(el instanceof HTMLElement) || !visible(el)) return false;
            const t = (el.innerText || "").slice(0, 4000);
            return /password|e-?mail|create(\\s+an?)?\\s+account/i.test(t);
          }) || null;
      }
      const formOpen = Boolean(pw);
      const root = dialog instanceof HTMLElement ? dialog : document;
      const nodes = [
        ...root.querySelectorAll("button, a, [role='button'], input[type='submit']"),
      ].filter((el) => el instanceof HTMLElement && visible(el));
      const scored = [];
      for (const el of nodes) {
        const t = labelOf(el);
        if (!t || t.length > 64) continue;
        if (/log\\s*in|sign\\s*in|already have|terms|privacy|help|contact|close|dismiss|cancel|×|✕/.test(t)) continue;
        // While the reg form is open, ONLY Create Account / submit — never
        // Sign Up / Register (header + in-modal toggles close Rainbet's sheet).
        let score = 0;
        if (/create(\\s+an?)?\\s+account/.test(t)) score = 100;
        else if (
          !formOpen &&
          (/^sign\\s*up$/.test(t) || t === "register" || /sign\\s*up|register|join now/.test(t))
        ) {
          score = 80;
        } else if (
          el.tagName === "BUTTON" &&
          (el.getAttribute("type") || "").toLowerCase() === "submit" &&
          !/sign\\s*up|register|log\\s*in/.test(t)
        ) {
          score = 60;
        } else if (
          el.tagName === "INPUT" &&
          (el.getAttribute("type") || "").toLowerCase() === "submit"
        ) {
          score = 55;
        }
        if (score === 0) continue;
        const disabled =
          ("disabled" in el && el.disabled) ||
          el.getAttribute("aria-disabled") === "true" ||
          el.classList.contains("disabled");
        // Create Account: allow force. Never force-click Sign Up.
        if (disabled && !(force && score >= 100)) continue;
        scored.push({ el, score, disabled });
      }
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (!best) {
        if (!(dialog instanceof HTMLElement)) return false;
        const form =
          (dialog.tagName === "FORM" ? dialog : dialog.querySelector("form")) ||
          null;
        if (form instanceof HTMLFormElement) {
          // Prefer the Create Account submitter if present.
          const submitter = [...form.querySelectorAll("button, input[type='submit']")].find(
            (el) => el instanceof HTMLElement && /create(\\s+an?)?\\s+account/i.test(labelOf(el))
          );
          try {
            if (submitter instanceof HTMLElement && typeof form.requestSubmit === "function") {
              form.requestSubmit(submitter);
              return true;
            }
            if (typeof form.requestSubmit === "function") form.requestSubmit();
            else form.submit();
            return true;
          } catch (_) {}
        }
        return false;
      }
      if (best.disabled && force) {
        try { best.el.removeAttribute("disabled"); } catch (_) {}
        try { best.el.setAttribute("aria-disabled", "false"); } catch (_) {}
      }
      fireClick(best.el);
      return true;
    })(${force ? "true" : "false"})`);
    return Boolean(clicked);
  } catch {
    return false;
  }
}

/**
 * Detect DOB (or similar) fields that show a value but still error — classic
 * wrong-format / opaque validation friction for the teardown report.
 */
export async function detectFormatValidationFriction(
  page: PageLike,
): Promise<string | null> {
  const script = `(() => {
    ${HELPERS}
    const fields = [...document.querySelectorAll("input, select, textarea")].filter(visible);
    for (const el of fields) {
      const placeholder = (el.getAttribute("placeholder") || "").trim();
      const label = labelFor(el);
      const meta = (placeholder + " " + label).toLowerCase();
      if (!/birth|dob|date/.test(meta)) continue;
      const value = String(el.value || "").trim();
      const wrap = el.closest("label, [class*='field' i], [class*='input' i], div") || el.parentElement;
      const err = wrap
        ? [...wrap.querySelectorAll("[class*='error' i], [role='alert'], span, p")]
            .map((n) => (n.textContent || "").trim())
            .find((t) => /please enter|invalid|format|required/i.test(t) && t.length < 120)
        : null;
      const invalid =
        el.getAttribute("aria-invalid") === "true" ||
        /error|invalid|danger/.test((el.className || "") + " " + (wrap?.className || ""));
      if (value && (err || invalid)) {
        return (
          "DOB format friction: field shows \\"" +
          value +
          "\\" but still errors" +
          (placeholder ? " (placeholder " + placeholder + ")" : "") +
          (err ? " — \\"" + err + "\\"" : "")
        );
      }
      if (!value && placeholder && /MM\\/DD|DD\\/MM|YYYY/.test(placeholder) && (err || invalid)) {
        return "DOB empty while placeholder asks for " + placeholder;
      }
    }
    return null;
  })()`;
  try {
    const msg = await page.evaluate(script);
    return typeof msg === "string" && msg ? msg : null;
  } catch {
    return null;
  }
}

/**
 * Submit the login form deterministically: the form's own submit button
 * (Log In / Sign In / Login / Continue — never Register / Create Account),
 * else Enter in the password field. Returns what was used, or null.
 */
export async function fastSubmitLogin(page: PageLike): Promise<string | null> {
  const script = `(() => {
    ${HELPERS}
    const pw = [...document.querySelectorAll("input[type=password]")].filter(visible).pop();
    const scope = pw ? (pw.closest("form, [role=dialog], [class*='modal' i], [class*='login' i]") || document) : document;
    const bad = /register|sign ?up|create|join|forgot|reset/i;
    const good = /^(log ?in|sign ?in|login|continue|submit|enter|go)\\b/i;
    const btns = [...scope.querySelectorAll("button, input[type=submit], [role=button], a")].filter(visible);
    let pick = btns.find((b) => {
      const t = ((b.innerText || b.value || b.getAttribute("aria-label") || "")).trim();
      return good.test(t) && !bad.test(t);
    });
    if (!pick && pw) {
      const form = pw.closest("form");
      pick = form ? [...form.querySelectorAll("button:not([type=button]), input[type=submit]")].filter(visible).find((b) => !bad.test(b.innerText || b.value || "")) : null;
    }
    if (pick) {
      pick.scrollIntoView({ block: "center" });
      pick.click();
      return "click:" + ((pick.innerText || pick.value || "").trim().slice(0, 30) || "submit");
    }
    if (pw) {
      pw.focus();
      for (const type of ["keydown", "keypress", "keyup"]) {
        pw.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      }
      const form = pw.closest("form");
      if (form && typeof form.requestSubmit === "function") { try { form.requestSubmit(); } catch {} }
      return "enter";
    }
    return null;
  })()`;
  try {
    const r = await page.evaluate(script);
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

/** Is a login form (visible password field) on screen right now? */
export async function loginFormVisible(page: PageLike): Promise<boolean> {
  try {
    const r = await page.evaluate(`(() => {
      ${HELPERS}
      return [...document.querySelectorAll("input[type=password]")].some(visible);
    })()`);
    return Boolean(r);
  } catch {
    return false;
  }
}

/**
 * DOM-first "open the login form": a visible Log In / Sign In control in the
 * header, else the same inside an opened hamburger menu. Returns what it
 * clicked, or null when nothing matched.
 */
export async function fastOpenLogin(page: PageLike): Promise<string | null> {
  const script = `(() => {
    ${HELPERS}
    const good = /^(log ?in|sign ?in|login|account log ?in)$/i;
    const bad = /register|sign ?up|join|create/i;
    const find = () => [...document.querySelectorAll("a, button, [role=button], [role=link]")]
      .filter(visible)
      .find((el) => {
        const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
        return good.test(t) && !bad.test(t);
      });
    let pick = find();
    if (!pick) {
      const href = [...document.querySelectorAll("a[href]")].filter(visible)
        .find((a) => /\\/(login|signin|sign-in|log-in)\\b/i.test(a.getAttribute("href") || "") && !bad.test(a.innerText || ""));
      if (href) pick = href;
    }
    if (!pick) {
      // Mobile: login often sits behind the hamburger / account icon.
      const menu = [...document.querySelectorAll("button, [role=button], a")].filter(visible).find((el) => {
        const meta = ((el.getAttribute("aria-label") || "") + " " + (el.className || "") + " " + (el.id || "")).toLowerCase();
        return /menu|hamburger|burger|account|user|profile/.test(meta) && el.getBoundingClientRect().top < 120;
      });
      if (menu) {
        menu.click();
        return "menu";
      }
      return null;
    }
    pick.scrollIntoView({ block: "center" });
    pick.click();
    return "click:" + ((pick.innerText || pick.getAttribute("aria-label") || "login").trim().slice(0, 24));
  })()`;
  try {
    let r = await page.evaluate(script);
    if (r === "menu") {
      await new Promise((res) => setTimeout(res, 900));
      r = await page.evaluate(script);
      if (r === "menu") return null;
    }
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

/**
 * Close bet-result / game modals that sit on Rainbet's lobby (live bets feed).
 * Stagehand often mis-clicks those instead of Register.
 */
export async function dismissDistractingModals(
  page: PageLike,
): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        ${HELPERS}
        const url = location.href.toLowerCase();
        const betDeep =
          /modal=bet|tab=result|betid=|\\/casino\\?/.test(url) ||
          /placed by|provably fair|roll over|multiplier/i.test(
            (document.body?.innerText || "").slice(0, 4000)
          );
        const roots = [
          ...document.querySelectorAll(
            "[role=dialog], [aria-modal=true], [class*='modal' i], [class*='drawer' i]"
          ),
        ].filter(visible);
        let closed = false;
        for (const root of roots) {
          const t = (root.innerText || "").slice(0, 1200);
          const isReg = /create(\\s+an?)?\\s+account|password|e-?mail address/i.test(t);
          const isBet =
            /\\bbet\\b/i.test(t) &&
            /placed by|provably fair|multiplier|payout|roll over/i.test(t);
          const isLoginOnly =
            /\\blog\\s*in\\b/i.test(t) && !/create(\\s+an?)?\\s+account|password/i.test(t);
          if (isReg) continue;
          if (!isBet && !isLoginOnly && !betDeep) continue;
          const close = [...root.querySelectorAll("button, [role=button], a")]
            .filter(visible)
            .find((b) => {
              const lab = (
                (b.getAttribute("aria-label") || "") +
                " " +
                (b.getAttribute("title") || "") +
                " " +
                (b.textContent || "")
              )
                .replace(/\\s+/g, " ")
                .trim();
              return /^(close|dismiss|×|x|✕|✖)$/i.test(lab) || /close|dismiss/i.test(lab);
            });
          if (close) {
            try { close.click(); closed = true; } catch (_) {}
          }
        }
        return closed;
      })()`),
    );
  } catch {
    return false;
  }
}

/** Logged-in lobby chrome (Winna: balance + wallet + avatar, no Register). */
export async function pageLooksLoggedInChrome(
  page: PageLike,
): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const visTop = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8 || r.top > 100) return false;
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
        if (login && register) return false;
        const pwd = [...document.querySelectorAll("input[type='password']")].some((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (pwd) return false;
        const t = (document.body && document.body.innerText || "").slice(0, 4000);
        return /\\$[\\d.,]+|balance|log ?out|sign ?out/i.test(t);
      })()`),
    );
  } catch {
    return false;
  }
}

/** Sign out so a fresh Register button comes back. Never click chat. */
export async function fastLogoutIfAuthed(page: PageLike): Promise<boolean> {
  try {
    const opened = await page.evaluate(`(() => {
      const vis = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden";
      };
      const nodes = [...document.querySelectorAll("a, button, [role='button']")].filter(vis);
      const logout = nodes.find((el) => {
        const t = (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
        return /^(log ?out|sign ?out)$/i.test(t);
      });
      if (logout) { logout.click(); return "logout"; }
      // Profile / avatar in the top-right — not the wallet chip, not chat.
      const profile = nodes
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.top > 72 || r.right < innerWidth - 120) return false;
          const t = (el.innerText || el.getAttribute("aria-label") || "").toLowerCase();
          if (/chat|message|wallet|deposit|cashier|rain/i.test(t)) return false;
          return /account|profile|avatar|user/i.test(t) || (r.width <= 48 && r.height <= 48 && !t);
        })
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
      if (profile) { profile.click(); return "menu"; }
      return null;
    })()`);
    if (opened === "logout") return true;
    if (opened !== "menu") return false;
    await new Promise((res) => setTimeout(res, 700));
    return Boolean(
      await page.evaluate(`(() => {
        const nodes = [...document.querySelectorAll("a, button, [role='button'], [role='menuitem']")];
        for (const el of nodes) {
          const t = (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
          if (/^(log ?out|sign ?out)$/i.test(t)) {
            el.click();
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

/** Casino deep-link / bet modal — not the registration form. */
export async function onCasinoDistraction(page: PageLike): Promise<boolean> {
  try {
    const href =
      typeof page.url === "function"
        ? page.url()
        : String(await page.evaluate("location.href").catch(() => ""));
    if (/modal=bet|tab=result|betId=/i.test(href)) return true;
    if (/\/casino(\/|\?|#|$)/i.test(href) && !/register|signup|sign-up/i.test(href)) {
      // Casino lobby alone is OK if Register header is still there; bet modal is not.
      return Boolean(
        await page.evaluate(`(() => {
          const t = (document.body?.innerText || "").slice(0, 5000);
          return /placed by|provably fair/i.test(t) && /multiplier|payout|roll over/i.test(t);
        })()`),
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * DOM-first open registration. Prefer header Register / Sign Up with short
 * labels — never bet rows, Join game tiles, or Create Account in ads.
 */
export async function fastOpenRegistration(
  page: PageLike,
): Promise<string | null> {
  const script = `(() => {
    ${HELPERS}
    // Short header CTAs only — "Join now" on a game tile is not registration.
    const good = /^(register|sign\\s*up|sign\\s*up\\s*now|create\\s*account|create\\s*an\\s*account)$/i;
    const bad = /log\\s*in|sign\\s*in|bet|deposit|play|provably|terms|privacy|help/i;
    const candidates = [...document.querySelectorAll("a, button, [role=button], [role=link]")]
      .filter(visible)
      .map((el) => {
        const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "")
          .replace(/\\s+/g, " ")
          .trim();
        const href = (el.getAttribute("href") || "").toLowerCase();
        return { el, t, href };
      })
      .filter(({ t, href }) => {
        if (!t || t.length > 28) return false;
        if (bad.test(t)) return false;
        if (good.test(t)) return true;
        if (/\\/(register|signup|sign-up|join)\\b/i.test(href) && !/bet|casino\\/game/i.test(href)) {
          return /^sign|^reg|^join|^create/i.test(t) || t.length < 16;
        }
        return false;
      });
    // Prefer controls in the top header band.
    candidates.sort((a, b) => {
      const ay = a.el.getBoundingClientRect().top;
      const by = b.el.getBoundingClientRect().top;
      const aHead = ay < 120 ? 0 : 1;
      const bHead = by < 120 ? 0 : 1;
      if (aHead !== bHead) return aHead - bHead;
      return ay - by;
    });
    const pick = candidates[0];
    if (!pick) {
      const menu = [...document.querySelectorAll("button, [role=button], a")].filter(visible).find((el) => {
        const meta = ((el.getAttribute("aria-label") || "") + " " + (el.className || "") + " " + (el.id || "")).toLowerCase();
        return /menu|hamburger|burger/i.test(meta) && el.getBoundingClientRect().top < 120;
      });
      if (menu) {
        menu.click();
        return "menu";
      }
      return null;
    }
    // No scrollIntoView — can dismiss overlays / shift the header.
    try { pick.el.focus({ preventScroll: true }); } catch (_) {}
    pick.el.click();
    return "click:" + pick.t.slice(0, 24);
  })()`;
  try {
    let r = await page.evaluate(script);
    if (r === "menu") {
      await new Promise((res) => setTimeout(res, 900));
      r = await page.evaluate(script);
      if (r === "menu") return null;
    }
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

/** Visible error / alert copy near a login form (wrong password, locked, verify). */
export async function readLoginError(page: PageLike): Promise<string | null> {
  const script = `(() => {
    ${HELPERS}
    const sel = "[role=alert], [class*='error' i], [class*='invalid' i], [class*='alert' i], [class*='message' i], [aria-live]";
    const texts = [...document.querySelectorAll(sel)]
      .filter(visible)
      .map((el) => (el.innerText || "").replace(/\\s+/g, " ").trim())
      .filter((t) => t.length > 3 && t.length < 240)
      .filter((t) => /incorrect|invalid|wrong|not (?:found|match|recogni)|locked|suspend|blocked|verify|verification|code|try again|failed|unable|denied|captcha/i.test(t));
    return texts[0] || null;
  })()`;
  try {
    const r = await page.evaluate(script);
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

/** Does the page currently ask for a one-time login code (email / SMS / 2FA)? */
export async function loginOtpPromptVisible(page: PageLike): Promise<boolean> {
  const script = `(() => {
    ${HELPERS}
    const inputs = [...document.querySelectorAll("input")].filter(visible);
    const codeInput = inputs.some((el) => {
      const meta = ((el.getAttribute("name") || "") + " " + (el.getAttribute("id") || "") + " " + (el.getAttribute("placeholder") || "") + " " + (el.getAttribute("autocomplete") || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
      return /one-time|otp|verification code|security code|passcode|\\bcode\\b|2fa|token/.test(meta) || (el.maxLength > 0 && el.maxLength <= 8 && (el.inputMode === "numeric" || el.type === "tel"));
    });
    const text = (document.body?.innerText || "").slice(0, 8000);
    const copy = /enter (?:the )?(?:\\d-digit |verification |security |one[- ]time )?code|code (?:we )?sent|verification code|check your (?:email|inbox|phone)|two[- ]factor|2fa/i.test(text);
    return codeInput && copy;
  })()`;
  try {
    return Boolean(await page.evaluate(script));
  } catch {
    return false;
  }
}
