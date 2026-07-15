/** Dismiss third-party cookie / GDPR consent banners on audited sites
 * before screenshots and scoring. */

export type CookieDismissPage = {
  evaluate: (expr: string) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
};

type StagehandLike = {
  act: (instruction: string) => Promise<{ success: boolean; message?: string }>;
};

const DISMISS_SCRIPT = `(() => {
  const ACCEPT_RE =
    /^(accept all( cookies)?|allow all( cookies)?|accept( cookies)?|allow( cookies)?|i agree|agree( and continue)?|yes,? i agree|got it|ok,? got it|accept & continue|accept and close|continue|understood|confirm( my choices)?)$/i;

  const REJECT_RE =
    /reject|decline|only essential|necessary only|manage (cookies|preferences)|customize|settings/i;

  const SELECTORS = [
    "#onetrust-accept-btn-handler",
    "#onetrust-banner-sdk #accept-recommended-btn-handler",
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "#CybotCookiebotDialogBodyButtonAccept",
    "#truste-consent-button",
    ".truste_button_accept",
    "#didomi-notice-agree-button",
    ".didomi-continue-without-agreeing",
    ".osano-cm-accept-all",
    ".osano-cm-button--type_accept",
    '[data-testid="accept-all"]',
    '[data-testid="uc-accept-all-button"]',
    '[data-testid="cookie-policy-dialog-accept-button"]',
    '[data-testid="cookie-banner-accept"]',
    '[data-action="accept"]',
    '[data-cookiebanner="accept"]',
    ".iubenda-cs-accept-btn",
    ".cmplz-accept",
    ".cc-accept",
    ".cc-allow",
    ".js-cookie-consent-agree",
    ".cookie-accept",
    "#cookie-accept",
    "#accept-cookies",
    ".accept-cookies",
    ".qc-cmp2-summary-buttons button[mode='primary']",
    ".termly-styles-module-accept-btn",
    '[data-test="cookie-accept-all"]',
    "#cookiescript_accept",
    "#cookie_action_close_header",
    ".cky-btn-accept",
    ".fc-cta-consent",
    ".message-button.no-consent",
  ];

  function visible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return false;
    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) < 0.05 ||
      style.pointerEvents === "none"
    ) {
      return false;
    }
    return true;
  }

  function label(el) {
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.textContent ||
      ""
    )
      .replace(/\\s+/g, " ")
      .trim();
  }

  function clickEl(el, method, detail) {
    el.click();
    return { dismissed: true, method, detail };
  }

  for (const sel of SELECTORS) {
    for (const el of document.querySelectorAll(sel)) {
      if (visible(el)) return clickEl(el, "selector", sel);
    }
  }

  const candidates = [
    ...document.querySelectorAll(
      "button, a[role='button'], [role='button'], input[type='button'], input[type='submit']"
    ),
  ];

  for (const el of candidates) {
    if (!visible(el)) continue;
    const text = label(el);
    if (!text || text.length > 48) continue;
    if (REJECT_RE.test(text)) continue;
    if (ACCEPT_RE.test(text)) return clickEl(el, "label", text);
  }

  const overlays = [
    ...document.querySelectorAll(
      "[id*='cookie' i], [class*='cookie' i], [id*='consent' i], [class*='consent' i], [class*='gdpr' i], [id*='onetrust' i], [class*='onetrust' i], [class*='CybotCookiebot' i], [class*='didomi' i], [class*='osano' i]"
    ),
  ];
  for (const root of overlays) {
    if (!(root instanceof HTMLElement) || !visible(root)) continue;
    const btn = root.querySelector(
      "button, a[role='button'], [role='button'], input[type='button'], input[type='submit']"
    );
    if (!btn || !visible(btn)) continue;
    const text = label(btn);
    if (REJECT_RE.test(text)) continue;
    if (ACCEPT_RE.test(text) || /accept|allow all|agree|got it/i.test(text)) {
      return clickEl(btn, "overlay", text);
    }
  }

  return { dismissed: false };
})()`;

async function tryDismissOnce(page: CookieDismissPage): Promise<boolean> {
  try {
    const result = (await page.evaluate(DISMISS_SCRIPT)) as {
      dismissed?: boolean;
    };
    return result?.dismissed === true;
  } catch {
    return false;
  }
}

/** Click known CMP accept buttons. Retries briefly — banners often animate in. */
export async function dismissSiteCookies(
  page: CookieDismissPage,
  opts?: { retries?: number }
): Promise<boolean> {
  const retries = opts?.retries ?? 4;
  let any = false;
  for (let i = 0; i < retries; i++) {
    if (i > 0) await page.waitForTimeout(700);
    if (await tryDismissOnce(page)) {
      any = true;
      await page.waitForTimeout(350);
    }
  }
  return any;
}

/** Wait for CMP paint, dismiss via DOM, then Stagehand fallback if needed. */
export async function preparePageAfterNavigation(
  page: CookieDismissPage,
  stagehand?: StagehandLike
): Promise<void> {
  await page.waitForTimeout(1200);
  await dismissSiteCookiesWithAgent(page, stagehand);
}

export async function dismissSiteCookiesWithAgent(
  page: CookieDismissPage,
  stagehand?: StagehandLike
): Promise<boolean> {
  let dismissed = await dismissSiteCookies(page);
  if (!dismissed && stagehand) {
    try {
      const result = await stagehand.act(
        "If a cookie consent banner, privacy popup, or GDPR dialog is visible on the page, click Accept All, Accept Cookies, Allow All, I Agree, or the main green accept button to dismiss it. If no cookie banner is visible, do nothing."
      );
      if (result.success) {
        await page.waitForTimeout(600);
        dismissed = (await dismissSiteCookies(page, { retries: 2 })) || true;
      }
    } catch {
      // Non-fatal — continue the audit without dismissal.
    }
  }
  return dismissed;
}
