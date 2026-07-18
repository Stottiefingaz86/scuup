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
  // Soft match — banners often wrap "Accept cookies" in a longer label or
  // with a checkmark / icon glyph that textContent picks up.
  const ACCEPT_RE =
    /accept\\s*(all|cookies|\\&\\s*continue|and\\s*(close|continue))?|allow\\s*(all|cookies)|i\\s*agree|agree(\\s*and\\s*continue)?|yes,?\\s*i\\s*agree|got\\s*it|ok,?\\s*got\\s*it|understood|confirm(\\s*my\\s*choices)?|consent/i;

  const REJECT_RE =
    /reject|decline|only\\s*essential|necessary\\s*only|manage\\s*(cookies|preferences)|customize|settings|more\\s*info|learn\\s*more|cookie\\s*settings/i;

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
    ".cc-btn.cc-dismiss",
    ".js-cookie-consent-agree",
    ".cookie-accept",
    "#cookie-accept",
    "#accept-cookies",
    ".accept-cookies",
    "button.accept-cookies",
    ".qc-cmp2-summary-buttons button[mode='primary']",
    ".termly-styles-module-accept-btn",
    '[data-test="cookie-accept-all"]',
    "#cookiescript_accept",
    "#cookie_action_close_header",
    ".cky-btn-accept",
    ".fc-cta-consent",
    ".message-button.no-consent",
    '[aria-label*="accept" i][aria-label*="cookie" i]',
    '[aria-label*="accept all" i]',
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
      el.getAttribute("value") ||
      el.textContent ||
      ""
    )
      .replace(/\\s+/g, " ")
      .trim();
  }

  function clickEl(el, method, detail) {
    try {
      el.focus({ preventScroll: true });
    } catch {}
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    );
    el.click();
    return { dismissed: true, method, detail };
  }

  for (const sel of SELECTORS) {
    try {
      for (const el of document.querySelectorAll(sel)) {
        if (visible(el)) return clickEl(el, "selector", sel);
      }
    } catch {
      // Invalid selector in older engines — keep going.
    }
  }

  const candidates = [
    ...document.querySelectorAll(
      "button, a[role='button'], [role='button'], input[type='button'], input[type='submit'], a"
    ),
  ];

  for (const el of candidates) {
    if (!visible(el)) continue;
    const text = label(el);
    if (!text || text.length > 80) continue;
    if (REJECT_RE.test(text)) continue;
    if (ACCEPT_RE.test(text)) return clickEl(el, "label", text);
  }

  const overlays = [
    ...document.querySelectorAll(
      "[id*='cookie' i], [class*='cookie' i], [id*='consent' i], [class*='consent' i], [class*='gdpr' i], [id*='onetrust' i], [class*='onetrust' i], [class*='CybotCookiebot' i], [class*='didomi' i], [class*='osano' i], [class*='cmp' i], [id*='cmp' i], [class*='privacy' i]"
    ),
  ];
  for (const root of overlays) {
    if (!(root instanceof HTMLElement) || !visible(root)) continue;
    const buttons = root.querySelectorAll(
      "button, a[role='button'], [role='button'], input[type='button'], input[type='submit'], a"
    );
    for (const btn of buttons) {
      if (!visible(btn)) continue;
      const text = label(btn);
      if (!text || text.length > 80) continue;
      if (REJECT_RE.test(text)) continue;
      if (ACCEPT_RE.test(text)) {
        return clickEl(btn, "overlay", text);
      }
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
  const retries = opts?.retries ?? 5;
  let any = false;
  for (let i = 0; i < retries; i++) {
    if (i > 0) await page.waitForTimeout(800);
    if (await tryDismissOnce(page)) {
      any = true;
      await page.waitForTimeout(400);
    }
  }
  return any;
}

/** Wait for CMP paint, dismiss via DOM, then Stagehand fallback if needed. */
export async function preparePageAfterNavigation(
  page: CookieDismissPage,
  stagehand?: StagehandLike
): Promise<void> {
  await page.waitForTimeout(1500);
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
        "If a cookie consent banner, privacy popup, or GDPR dialog is visible on the page, click the button labelled Accept cookies, Accept All, Allow All, I Agree, or the primary green accept button to dismiss it. Do not click Reject, Manage, or Settings. If no cookie banner is visible, do nothing."
      );
      if (result.success) {
        await page.waitForTimeout(800);
        dismissed = (await dismissSiteCookies(page, { retries: 2 })) || true;
      }
    } catch {
      // Non-fatal — continue the audit without dismissal.
    }
  }
  return dismissed;
}
