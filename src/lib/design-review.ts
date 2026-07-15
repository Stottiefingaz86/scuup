import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { createSession, proxyCountryFor, releaseSession } from "./browserbase";
import { auditUrlForMarket } from "./brand-markets";
import { preparePageAfterNavigation } from "./dismiss-site-cookies";
import {
  ANALYSIS_AREA_LABELS,
  MARKET_PROXY_COUNTRY,
} from "./constants";
import { isRemoteEvidenceUrl, localEvidencePath } from "./evidence-storage";
import {
  alignJourneyNotes,
  collectDesignReviewShots,
  DESIGN_REVIEW_AREA_ORDER,
  isLoginGateAnalysis,
  pickDesignScreenshot,
  type DesignReviewShot,
} from "./design-shots";
import type { Brand, DesignReview, Project } from "./types";

/**
 * Design review: open the brand's live site in a real browser, read the
 * rendered code (framework, design system, colour usage, accessibility
 * markup), then have the analyst combine those hard signals with the
 * captured journey screenshots into a designer's critique — palette,
 * dark-vs-light rationale, branding consistency across journeys, and
 * per-journey UI practice.
 */

/** Hard, measurable facts pulled from the rendered DOM — the LLM never
 * guesses these, it interprets them. */
export interface DesignSignals {
  finalUrl: string;
  lang: string | null;
  themeColorMeta: string | null;
  bodyBg: string;
  bodyColor: string;
  bodyFont: string;
  headingFont: string | null;
  cssVarCount: number;
  framework: string | null;
  frameworkEvidence: string;
  uiLibHints: string[];
  tailwindLikeShare: number;
  /** Top rendered colours by pixel coverage: [hex, share 0-1, isText]. */
  palette: { hex: string; share: number; text: boolean }[];
  /** Saturated brand/CTA colours measured from buttons, links and other
   * chromatic UI — small in area, but they ARE the brand. */
  accents: { hex: string; weight: number; source: string }[];
  a11y: {
    langSet: boolean;
    imgs: number;
    imgsMissingAlt: number;
    buttonsWithoutName: number;
    inputsWithoutLabel: number;
    hasSkipLink: boolean;
    h1Count: number;
    headingLevelsSkipped: boolean;
    focusVisibleInCss: boolean | null;
    viewportZoomBlocked: boolean;
  };
}

/* Runs inside the page. Kept dependency-free and defensive: any part that
 * throws (cross-origin stylesheets etc.) degrades to null, never fails. */
const EXTRACT_SCRIPT = `(() => {
  const doc = document;
  const win = window;

  const toHex = (rgb) => {
    const m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    const h = (n) => (+n).toString(16).padStart(2, "0");
    return "#" + h(m[1]) + h(m[2]) + h(m[3]);
  };

  // --- palette: visible elements weighted by area ---
  // Accents are tracked separately: CTA reds/greens are tiny in pixel
  // coverage, so an area-weighted palette alone only ever finds neutrals.
  const saturation = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = (n & 255);
    const mx = Math.max(r, g, b);
    return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
  };
  const accentWeight = new Map();
  // Browser-default link colours: unstyled anchors report these even when
  // they never visibly render, so they'd fake a "brand blue".
  const UA_DEFAULTS = new Set(["#0000ee", "#551a8b", "#0000ff", "#800080"]);
  const bumpAccent = (hex, w, source) => {
    if (!hex || saturation(hex) < 0.3) return;
    if (UA_DEFAULTS.has(hex.toLowerCase())) return;
    const cur = accentWeight.get(hex);
    if (cur) cur.weight += w;
    else accentWeight.set(hex, { weight: w, source });
  };

  // Collect elements INCLUDING open shadow roots — sites built on web
  // components (Betonline's header, for one) paint their primary CTAs
  // inside shadow DOM where querySelectorAll never looks.
  const allEls = [];
  const collect = (root, depth) => {
    if (depth > 25 || allEls.length > 8000) return;
    for (const el of root.querySelectorAll("*")) {
      allEls.push(el);
      if (el.shadowRoot) collect(el.shadowRoot, depth + 1);
      if (allEls.length > 8000) return;
    }
  };
  collect(doc.body ?? doc, 0);

  const bgWeight = new Map();
  const textWeight = new Map();
  let sampled = 0;
  for (const el of allEls) {
    if (sampled > 2500) break;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 12) continue;
    if (r.bottom < 0 || r.top > win.innerHeight * 3) continue;
    sampled++;
    const cs = win.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const area = Math.min(r.width * r.height, win.innerWidth * win.innerHeight);
    const bg = toHex(cs.backgroundColor);
    if (bg) {
      bgWeight.set(bg, (bgWeight.get(bg) ?? 0) + area);
      bumpAccent(bg, Math.sqrt(area), "coloured surface");
    }
    if (el.childElementCount === 0 && (el.textContent ?? "").trim().length > 2) {
      const fg = toHex(cs.color);
      if (fg) {
        textWeight.set(fg, (textWeight.get(fg) ?? 0) + area);
        bumpAccent(fg, Math.sqrt(area), "coloured text");
      }
    }
  }

  // Interactive elements carry the brand colour — weight them heavily.
  const CTA_SEL = "button, [role='button'], a, [class*='btn' i], [class*='cta' i], [class*='badge' i], [class*='tag' i]";
  let ctaSampled = 0;
  for (const el of allEls) {
    if (ctaSampled > 1200) break;
    let isCta = false;
    try { isCta = el.matches(CTA_SEL); } catch {}
    if (!isCta) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) continue;
    if (r.bottom < 0 || r.top > win.innerHeight * 3) continue;
    ctaSampled++;
    const cs = win.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const w = Math.sqrt(Math.min(r.width * r.height, 200000));
    bumpAccent(toHex(cs.backgroundColor), w * 6, "button/CTA background");
    bumpAccent(toHex(cs.color), w * 2, "link/button text");
    if (cs.borderTopWidth !== "0px") bumpAccent(toHex(cs.borderTopColor), w, "border/outline");
    // Gradient-painted CTAs report a transparent backgroundColor — the
    // brand colour lives in the gradient stops.
    if (cs.backgroundImage.includes("gradient")) {
      for (const stop of cs.backgroundImage.match(/rgba?\\([^)]+\\)/g) ?? []) {
        bumpAccent(toHex(stop), w * 3, "CTA gradient");
      }
    }
  }
  bumpAccent(toHex(win.getComputedStyle(doc.body).backgroundColor), 1, "page background");
  const themeMetaHex = doc.querySelector("meta[name='theme-color']")?.getAttribute("content");
  if (themeMetaHex && /^#[0-9a-f]{6}$/i.test(themeMetaHex)) bumpAccent(themeMetaHex.toLowerCase(), 50, "meta theme-color");

  const accents = [...accentWeight.entries()]
    .map(([hex, v]) => ({ hex, weight: Math.round(v.weight), source: v.source }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  const totalBg = [...bgWeight.values()].reduce((s, v) => s + v, 0) || 1;
  const totalText = [...textWeight.values()].reduce((s, v) => s + v, 0) || 1;
  const palette = [
    ...[...bgWeight.entries()].map(([hex, w]) => ({ hex, share: w / totalBg, text: false })),
    ...[...textWeight.entries()].map(([hex, w]) => ({ hex, share: w / totalText, text: true })),
  ]
    .filter((p) => p.share > 0.01)
    .sort((a, b) => b.share - a.share)
    .slice(0, 24);

  // --- framework detection ---
  let framework = null;
  let frameworkEvidence = "";
  if (doc.getElementById("__NEXT_DATA__") || win.__NEXT_DATA__ || doc.querySelector("script[src*='/_next/']")) {
    framework = "Next.js (React)"; frameworkEvidence = "_next assets / __NEXT_DATA__ present";
  } else if (win.__NUXT__ || doc.getElementById("__nuxt")) {
    framework = "Nuxt (Vue)"; frameworkEvidence = "__NUXT__ payload present";
  } else if (doc.querySelector("[ng-version]")) {
    framework = "Angular"; frameworkEvidence = "ng-version attribute: " + doc.querySelector("[ng-version]").getAttribute("ng-version");
  } else if (doc.getElementById("root")?.hasAttribute("data-reactroot") || Object.keys(doc.getElementById("root") ?? {}).some((k) => k.startsWith("__react"))) {
    framework = "React (SPA)"; frameworkEvidence = "React root fingerprints";
  } else if (doc.querySelector("[data-svelte-h]") || doc.querySelector("script[src*='_app/immutable']")) {
    framework = "SvelteKit"; frameworkEvidence = "Svelte hydration markers";
  } else if (doc.getElementById("app")?.__vue_app__ || doc.querySelector("[data-v-app]")) {
    framework = "Vue (SPA)"; frameworkEvidence = "Vue app mount point";
  }

  // --- UI library fingerprints ---
  const html = doc.documentElement.outerHTML.slice(0, 400000);
  const uiLibHints = [];
  if (/class="[^"]*\\bMui[A-Z]/.test(html)) uiLibHints.push("MUI (Material UI) class prefixes");
  if (/class="[^"]*\\bchakra-/.test(html)) uiLibHints.push("Chakra UI class prefixes");
  if (/class="[^"]*\\bant-(btn|input|modal|select)/.test(html)) uiLibHints.push("Ant Design class prefixes");
  if (/class="[^"]*\\b(btn btn-|navbar-|col-md-)/.test(html)) uiLibHints.push("Bootstrap class patterns");
  if (doc.querySelector("[data-radix-popper-content-wrapper], [data-radix-scroll-area-viewport], [data-slot]")) uiLibHints.push("Radix primitives / shadcn-style data attributes");
  if (doc.querySelector("[class*='css-']") && !uiLibHints.length) uiLibHints.push("CSS-in-JS hashed classes (emotion/styled-components)");
  if (/class="[^"]*\\bsc-[a-zA-Z]/.test(html)) uiLibHints.push("styled-components generated classes");
  // Legacy / mixed-foundation fingerprints — these are the red flags.
  try {
    if (win.jQuery) uiLibHints.push("jQuery " + (win.jQuery.fn?.jquery ?? "") + " loaded (legacy)");
  } catch {}
  const scriptSrcs = [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src") ?? "");
  if (scriptSrcs.some((s) => /jquery/i.test(s)) && !uiLibHints.some((h) => h.includes("jQuery"))) uiLibHints.push("jQuery script tag (legacy)");
  if (scriptSrcs.some((s) => /bootstrap(\\.bundle|\\.min)?\\.js/i.test(s))) uiLibHints.push("Bootstrap JS bundle loaded");
  const reactMarkers = !!(doc.querySelector("[data-reactroot]") || Object.keys(doc.body ?? {}).some((k) => k.startsWith("__react")));
  const svelteMarkers = !!(doc.querySelector("[data-svelte-h]") || doc.querySelector("script[src*='_app/immutable']"));
  if (reactMarkers && svelteMarkers) uiLibHints.push("BOTH React and Svelte hydration markers present (mixed frameworks on one page)");

  // tailwind-ish share: utility-looking tokens among all class tokens
  let utilTokens = 0, allTokens = 0;
  const utilRe = /^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|items-|justify-|gap-|p[xytrbl]?-|m[xytrbl]?-|w-|h-|min-|max-|text-|font-|bg-|border|rounded|shadow|overflow-|z-|top-|left-|right-|bottom-|space-|divide-|transition|duration-|hover:|focus:|sm:|md:|lg:|xl:|2xl:)/;
  for (const el of doc.querySelectorAll("[class]")) {
    if (allTokens > 4000) break;
    for (const t of String(el.className).split(/\\s+/)) {
      if (!t) continue;
      allTokens++;
      if (utilRe.test(t)) utilTokens++;
    }
  }
  const tailwindLikeShare = allTokens ? utilTokens / allTokens : 0;

  // --- CSS custom properties on :root ---
  let cssVarCount = 0;
  try {
    for (const sheet of doc.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of rules ?? []) {
        if (rule.selectorText === ":root" || rule.selectorText === "html") {
          for (const prop of rule.style ?? []) {
            if (prop.startsWith("--")) cssVarCount++;
          }
        }
      }
    }
  } catch {}

  // --- focus-visible present anywhere in same-origin CSS ---
  let focusVisibleInCss = null;
  try {
    let found = false, readable = false;
    for (const sheet of doc.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      readable = true;
      for (const rule of rules ?? []) {
        if (rule.selectorText && rule.selectorText.includes(":focus-visible")) { found = true; break; }
      }
      if (found) break;
    }
    focusVisibleInCss = readable ? found : null;
  } catch {}

  // --- accessibility counts ---
  const imgs = [...doc.querySelectorAll("img")].filter((i) => {
    const r = i.getBoundingClientRect();
    return r.width > 16 && r.height > 16;
  });
  const imgsMissingAlt = imgs.filter((i) => !i.getAttribute("alt") && i.getAttribute("role") !== "presentation" && i.getAttribute("aria-hidden") !== "true").length;
  const buttonsWithoutName = [...doc.querySelectorAll("button, [role='button']")].filter((b) => {
    const name = (b.textContent ?? "").trim() || b.getAttribute("aria-label") || b.getAttribute("title");
    return !name;
  }).length;
  const inputsWithoutLabel = [...doc.querySelectorAll("input:not([type='hidden']), select, textarea")].filter((i) => {
    if (i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.getAttribute("placeholder")) return false;
    const id = i.getAttribute("id");
    return !(id && doc.querySelector("label[for='" + id + "']"));
  }).length;
  const hasSkipLink = !!doc.querySelector("a[href='#main'], a[href='#content'], a[class*='skip']");
  const headings = [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => +h.tagName[1]);
  let headingLevelsSkipped = false;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) { headingLevelsSkipped = true; break; }
  }
  const viewportMeta = doc.querySelector("meta[name='viewport']")?.getAttribute("content") ?? "";
  const viewportZoomBlocked = /user-scalable\\s*=\\s*(no|0)|maximum-scale\\s*=\\s*1(\\b|,)/.test(viewportMeta);

  const bodyCs = win.getComputedStyle(doc.body);
  const h1 = doc.querySelector("h1, h2");
  return {
    lang: doc.documentElement.getAttribute("lang"),
    themeColorMeta: doc.querySelector("meta[name='theme-color']")?.getAttribute("content") ?? null,
    bodyBg: toHex(bodyCs.backgroundColor) ?? "#ffffff",
    bodyColor: toHex(bodyCs.color) ?? "#000000",
    bodyFont: bodyCs.fontFamily,
    headingFont: h1 ? win.getComputedStyle(h1).fontFamily : null,
    cssVarCount,
    framework,
    frameworkEvidence,
    uiLibHints,
    tailwindLikeShare,
    palette,
    accents,
    a11y: {
      langSet: !!doc.documentElement.getAttribute("lang"),
      imgs: imgs.length,
      imgsMissingAlt,
      buttonsWithoutName,
      inputsWithoutLabel,
      hasSkipLink,
      h1Count: doc.querySelectorAll("h1").length,
      headingLevelsSkipped,
      focusVisibleInCss,
      viewportZoomBlocked,
    },
  };
})()`;

/** Open the live site in a market-correct browser session and measure the
 * rendered code. Throws when the page never renders real content. */
export async function extractDesignSignals(
  brandUrl: string,
  market: string
): Promise<DesignSignals> {
  const url = auditUrlForMarket(
    brandUrl.startsWith("http") ? brandUrl : `https://${brandUrl}`,
    market
  );
  const proxyCountry = proxyCountryFor(MARKET_PROXY_COUNTRY[market] ?? null);
  const session = await createSession(undefined, undefined, proxyCountry);
  const browser = await chromium.connectOverCDP(session.connectUrl);

  try {
    const page = browser.contexts()[0].pages()[0];
    await page
      .goto(url, { waitUntil: "domcontentloaded", timeout: 45000 })
      .catch(() => {});
    await preparePageAfterNavigation(page);
    // SPAs paint after hydration; poll until the page has real content.
    for (let i = 0; i < 10; i++) {
      const textLen = await page
        .evaluate(() => document.body?.innerText.length ?? 0)
        .catch(() => 0);
      if (textLen > 400) break;
      await page.waitForTimeout(1500);
    }
    const raw = (await page.evaluate(EXTRACT_SCRIPT)) as Omit<
      DesignSignals,
      "finalUrl"
    >;
    if (!raw || !raw.palette?.length) {
      throw new Error(
        `Couldn't read the rendered page for ${brandUrl} — the site never painted real content.`
      );
    }
    return { ...raw, finalUrl: page.url() };
  } finally {
    await browser.close().catch(() => {});
    await releaseSession(session.id).catch(() => {});
  }
}

/* ---------------------------------------------------------------- */

const SWATCH_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      hex: { type: "string" },
      role: { type: "string" },
    },
    required: ["hex", "role"],
  },
} as const;

const DESIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "number" },
    craft: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number" },
        note: { type: "string" },
      },
      required: ["score", "note"],
    },
    summary: { type: "string" },
    theme: { type: "string", enum: ["dark", "light", "mixed"] },
    themeNote: { type: "string" },
    palette: SWATCH_SCHEMA,
    typography: { type: "string" },
    stack: {
      type: "object",
      additionalProperties: false,
      properties: {
        framework: { type: ["string", "null"] },
        designSystem: { type: ["string", "null"] },
        evidence: { type: "string" },
        health: { type: "string", enum: ["solid", "mixed", "fragile"] },
        verdict: { type: "string" },
      },
      required: ["framework", "designSystem", "evidence", "health", "verdict"],
    },
    accessibility: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number" },
        findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              check: { type: "string" },
              pass: { type: ["boolean", "null"] },
              note: { type: "string" },
            },
            required: ["check", "pass", "note"],
          },
        },
      },
      required: ["score", "findings"],
    },
    consistency: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number" },
        note: { type: "string" },
      },
      required: ["score", "note"],
    },
    journeyNotes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          note: { type: "string" },
        },
        required: ["area", "note"],
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
  },
  required: [
    "score",
    "craft",
    "summary",
    "theme",
    "themeNote",
    "palette",
    "typography",
    "stack",
    "accessibility",
    "consistency",
    "journeyNotes",
    "strengths",
    "improvements",
  ],
} as const;

/** Evidence screenshots live locally in dev and in Supabase Storage in
 * prod — either way the LLM needs raw base64. */
async function shotToBase64(url: string): Promise<string | null> {
  try {
    if (isRemoteEvidenceUrl(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer()).toString("base64");
    }
    const file = path.basename(new URL(url, "http://x").pathname);
    return (await readFile(localEvidencePath(file))).toString("base64");
  } catch {
    return null;
  }
}

/** Load base64 for the canonical design-review screenshot set. */
async function journeyShots(
  brand: Brand
): Promise<(DesignReviewShot & { b64: string })[]> {
  const picked = collectDesignReviewShots(brand);
  const out: (DesignReviewShot & { b64: string })[] = [];
  for (const shot of picked) {
    const b64 = await shotToBase64(shot.screenshot);
    if (b64) out.push({ ...shot, b64 });
  }
  return out;
}

function signalsBlock(s: DesignSignals): string {
  const palette = s.palette
    .map(
      (p) =>
        `${p.hex} (${p.text ? "text" : "surface"}, ${(p.share * 100).toFixed(1)}% coverage)`
    )
    .join(", ");
  const accents = (s.accents ?? [])
    .map((a) => `${a.hex} (${a.source}, weight ${a.weight})`)
    .join(", ");
  const a = s.a11y;
  return [
    `Final URL: ${s.finalUrl}`,
    `Framework detected: ${s.framework ?? "not detected"}${s.frameworkEvidence ? ` — ${s.frameworkEvidence}` : ""}`,
    `UI library fingerprints: ${s.uiLibHints.length ? s.uiLibHints.join("; ") : "none found"}`,
    `Utility-class (Tailwind-like) share of class tokens: ${(s.tailwindLikeShare * 100).toFixed(0)}%`,
    `CSS custom properties on :root: ${s.cssVarCount} (a token system usually means 20+)`,
    `Body background ${s.bodyBg}, body text ${s.bodyColor}, meta theme-color ${s.themeColorMeta ?? "unset"}`,
    `Body font: ${s.bodyFont}; heading font: ${s.headingFont ?? "same as body"}`,
    `Rendered colour usage (measured): ${palette}`,
    `Brand accent colours (measured from CTAs, links and coloured UI — small in coverage but these ARE the brand): ${accents || "none found"}`,
    `Accessibility (measured on the rendered landing page):`,
    `- html lang attribute: ${a.langSet ? "set" : "MISSING"}`,
    `- images: ${a.imgs} visible, ${a.imgsMissingAlt} missing alt text`,
    `- buttons without an accessible name: ${a.buttonsWithoutName}`,
    `- form inputs without label/aria-label/placeholder: ${a.inputsWithoutLabel}`,
    `- skip-to-content link: ${a.hasSkipLink ? "present" : "absent"}`,
    `- h1 count: ${a.h1Count}; heading levels skipped: ${a.headingLevelsSkipped ? "yes" : "no"}`,
    `- :focus-visible styles in CSS: ${a.focusVisibleInCss === null ? "unreadable (cross-origin)" : a.focusVisibleInCss ? "present" : "absent"}`,
    `- pinch-zoom blocked by viewport meta: ${a.viewportZoomBlocked ? "YES (WCAG failure)" : "no"}`,
  ].join("\n");
}

/** Turn measured signals + journey screenshots into the designer's review. */
export async function buildDesignReview(
  project: Project,
  brand: Brand,
  signals: DesignSignals
): Promise<DesignReview> {
  const shots = await journeyShots(brand);
  const skippedLoginGates = DESIGN_REVIEW_AREA_ORDER.filter((area) => {
    const a = brand.analyses[area];
    return a && !a.blocked && isLoginGateAnalysis(a) && !pickDesignScreenshot(area, a);
  }).map((area) => ANALYSIS_AREA_LABELS[area] ?? area);

  const prompt = `You are PlayerScope's design lead reviewing ${brand.name} (an iGaming site audited for the ${project.market} market). You have (a) HARD CODE SIGNALS measured from the live rendered homepage, and (b) one screenshot per captured journey area listed below — in that exact order. Write an in-depth but plain-language design review a product team and a CEO can both read.

CRITICAL — WHAT TO JUDGE:
- Visual craft and consistency must be scored primarily from PRODUCT surfaces: homepage/first impression, casino lobby, sportsbook, promo banners, rewards hubs — NOT from login forms.
- If a journey screenshot is a login/sign-in wall, do NOT treat it as that journey's design. Login gates are excluded from the images you receive; when a product screen was unavailable, say so in journeyNotes instead of critiquing a login form as if it were the casino.
- Weight the homepage and main product lobbies heaviest for craft. Signup/login templates are secondary.
- Compare like-for-like: a promo-led homepage with structured nav and branded chrome is stronger craft than a bare Bootstrap login template, even if both are "dated".
${skippedLoginGates.length ? `\nJourneys where only a login wall was captured (excluded from images): ${skippedLoginGates.join(", ")}. Mention the gap — do not score casino/loyalty craft from login screens.` : ""}

RULES:
- Never contradict the measured signals — interpret them. If signals say the background is #0d1117, the theme is dark; don't claim light.
- theme + themeNote: is it dark, light or mixed — and WHY that fits (or doesn't fit) this vertical. Crypto casinos go dark because sessions are long and evening-heavy, dark surfaces make neon accents and win-feeds pop, and it reads "premium tech"; regulated mainstream books often go light for trust and daytime sports traffic. Judge whether THIS brand's choice serves its positioning.
- palette: 5-7 colours that define the brand's UI. It MUST include the top brand accent colours from the accents list — and when that list spans multiple distinct hues (a red AND a green AND a gold…), include one of each hue before any neutral: in iGaming those are CTA, win/positive and loss/negative signals and the reader must see them. Only include colours you can actually SEE in the screenshots — if a measured colour doesn't visibly appear on the screens, leave it out. Then the key surfaces and text neutrals (ignore near-duplicates). Give each a ROLE in plain words ("Primary CTA / brand red", "Win/positive accent", "Page background"). Use the measured hexes verbatim — do not invent colours.
- typography: name the actual families from the signals and judge the pairing — is there a real hierarchy, is it legible at small sizes in the screenshots?
- stack: name the framework from the signals. designSystem: judge from fingerprints + utility-class share + CSS variables ("MUI", "Tailwind utility system (shadcn-style)", "Bootstrap", "Custom CSS-in-JS", "Custom CSS, no token system"). evidence = one line citing the fingerprints. null only when signals are truly inconclusive.
- stack.health + stack.verdict: judge the engineering foundation like a principal engineer, and CALL OUT bad practice by name. "solid" = one modern framework with a coherent component/token system. "mixed" = mismatched pieces stitched together (e.g. SvelteKit shell + Bootstrap CSS + bits of React, or thousands of ad-hoc :root variables with no naming discipline). "fragile" = legacy foundations (jQuery, old Bootstrap, no framework, no token system). verdict = 2-3 sentences naming the specific problem AND its practical cost for THIS site: mixing frameworks/UI kits ships duplicate CSS and JS (slower loads on the pages players deposit from), produces the visual drift you can see between their screens, makes every component exist in two styles, and slows any redesign; Bootstrap-era CSS fights custom theming and tends to leak the dated look; no token system means colours/spacing drift page by page. Tie it to what the screenshots actually show (e.g. the signup screen looking like a different product). If the foundation is genuinely good, say what it enables instead — don't invent problems.
- accessibility: score 0-100 from the measured checks (weight: missing alt on many images, unlabelled inputs and zoom-blocking are heavy; skip link absent is minor). findings = one entry per measured check with pass true/false (null when unreadable), each note one plain sentence with the number. Add one finding judged from screenshots: text contrast at small sizes (pass null if unsure).
- consistency: compare the journey screenshots — does branding (logo placement, accent colour, tone, component style) carry through signup, casino, cashier, rewards? Cite the specific screens that break.
- journeyNotes: one entry per screenshot provided, using the EXACT area key from the list below (${shots.map((s) => s.area).join(", ") || "none"}). 1-2 sentences of UI-practice critique per screen.
- strengths / improvements: 3-4 each, most impactful first. Improvements must be actionable ("Raise body text from ~12px to 14px in the bet slip"), not generic ("improve UX").
- craft: visual craft judged from the SCREENSHOTS ALONE, scored like a demanding design director reviewing a portfolio — not like a polite consultant. You grade against the whole web, not just iGaming. Anchored bands, pick the band FIRST then the number:
  * 85-100: world-class product design (Stripe, Linear, Apple). Almost no gambling site belongs here.
  * 70-84: genuinely polished — disciplined type scale, consistent spacing rhythm, restrained colour, modern components. Stake on a good day is ~75.
  * 55-69: competent but unremarkable — professional, some density or dated patterns, nothing embarrassing.
  * 40-54: cluttered or dated — competing neon CTAs, banner-stack homepages, inconsistent buttons, affiliate-portal energy. Most offshore sportsbooks live HERE.
  * <40: actively bad — clashing colours, broken alignment, unreadable text, early-2010s template feel.
  Signs that force a LOW band no matter how "energetic" the brand feels: more than 2 competing accent colours shouting at once, promo banners stacked 3+ deep, ALL-CAPS bold text everywhere, tiny cramped nav links, drop shadows and gradients from 2012, no whitespace discipline, every element fighting to be loudest. "Conversion-focused" and "high-energy" are NOT craft — a loud, ugly page that converts is still a 45. note: 2 sentences naming the band evidence.
- score: set this to the same value as craft.score (the final overall is computed outside the model from craft, consistency and accessibility — your job is only the honest craft number).
- summary: 2 sentences, the verdict. Match the tone to the craft band — do not write "premium" or "polished" about a 50-craft site.

MEASURED CODE SIGNALS:
${signalsBlock(signals)}

JOURNEY SCREENSHOTS (exact order, area key → label): ${shots.map((s, i) => `[${i}] ${s.area} (${ANALYSIS_AREA_LABELS[s.area] ?? s.area})`).join(", ") || "none captured yet — judge visual craft from the live homepage signals only and say so in the summary"}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...shots.map((s) => ({
              type: "input_image",
              image_url: `data:image/jpeg;base64,${s.b64}`,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "design_review",
          schema: DESIGN_SCHEMA,
          strict: true,
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const message = data.output?.find(
    (o: { type: string }) => o.type === "message"
  );
  const text = message?.content?.find(
    (c: { type: string }) => c.type === "output_text"
  )?.text;
  if (!text) throw new Error("OpenAI returned no output text");
  const parsed = JSON.parse(text) as Omit<
    DesignReview,
    "fetchedAt" | "reviewedScreens"
  >;

  const reviewedScreens = shots.map(({ area, screenshot }) => ({
    area,
    screenshot,
  }));
  const journeyNotes = alignJourneyNotes(
    reviewedScreens,
    parsed.journeyNotes,
    ANALYSIS_AREA_LABELS
  );

  // The overall score is arithmetic, not vibes: visual craft carries the
  // most weight, consistency and measured accessibility the rest. This is
  // what makes the number defensible to a sceptical reader.
  const craft = parsed.craft?.score ?? parsed.score;
  const score = Math.round(
    0.4 * craft +
      0.3 * parsed.consistency.score +
      0.3 * parsed.accessibility.score
  );

  return {
    ...parsed,
    journeyNotes,
    reviewedScreens,
    score,
    fetchedAt: new Date().toISOString(),
  };
}
