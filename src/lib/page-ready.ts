/** Wait until a page has rendered real content before screenshots. */

import type { CookieDismissPage } from "./dismiss-site-cookies";

const PAGE_SNAPSHOT_SCRIPT = `(() => {
  const text = (document.body?.innerText ?? "").trim();
  const loadingSelectors = [
    '[aria-busy="true"]',
    '[class*="skeleton" i]',
    '[class*="spinner" i]',
    '[class*="loader" i]',
    '[data-testid*="loading" i]',
  ];
  let loading = false;
  for (const sel of loadingSelectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (r.width < 16 || r.height < 16) continue;
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) < 0.05
      ) {
        continue;
      }
      loading = true;
      break;
    }
    if (loading) break;
  }
  const interstitial =
    text.length < 2500 &&
    /is loading the page|please click refresh|checking your browser|verify you are human|pardon our interruption/i.test(
      text
    );
  return {
    len: text.length,
    ready: document.readyState === "complete",
    loading,
    interstitial,
  };
})()`;

const WAIT_FOR_LOAD_SCRIPT = `new Promise((resolve) => {
  if (document.readyState === "complete") resolve(undefined);
  else {
    window.addEventListener("load", () => resolve(undefined), { once: true });
    setTimeout(() => resolve(undefined), 12000);
  }
})`;

export type PageReadyOptions = {
  /** Minimum visible body text length before we accept the page. */
  minChars?: number;
  /** Hard cap on total wait time. */
  maxWaitMs?: number;
  /** Initial pause before polling (SPA paint after click). */
  initialMs?: number;
  /** Shorter thresholds for in-app navigation after the first paint. */
  relaxed?: boolean;
};

type PageSnapshot = {
  len: number;
  ready: boolean;
  loading: boolean;
  interstitial: boolean;
};

/** Poll until load event, spinners/skeletons clear, and body text stabilises. */
export async function waitForPageReady(
  page: CookieDismissPage,
  opts?: PageReadyOptions
): Promise<void> {
  const minChars = opts?.minChars ?? (opts?.relaxed ? 120 : 400);
  const maxWaitMs = opts?.maxWaitMs ?? 28000;
  const initialMs = opts?.initialMs ?? 1500;

  await page.waitForTimeout(initialMs);
  await page.evaluate(WAIT_FOR_LOAD_SCRIPT).catch(() => {});

  const start = Date.now();
  let stablePasses = 0;
  let lastLen = 0;

  while (Date.now() - start < maxWaitMs) {
    const snapshot = (await page
      .evaluate(PAGE_SNAPSHOT_SCRIPT)
      .catch(() => null)) as PageSnapshot | null;

    if (!snapshot) {
      await page.waitForTimeout(1500);
      continue;
    }

    const ready =
      snapshot.ready &&
      !snapshot.loading &&
      !snapshot.interstitial &&
      snapshot.len >= minChars;

    if (ready) {
      if (Math.abs(snapshot.len - lastLen) < 80) stablePasses++;
      else stablePasses = 0;
      lastLen = snapshot.len;
      if (stablePasses >= 1) {
        await page.waitForTimeout(700);
        return;
      }
    } else {
      stablePasses = 0;
      lastLen = snapshot.len;
    }

    await page.waitForTimeout(1800);
  }
}
