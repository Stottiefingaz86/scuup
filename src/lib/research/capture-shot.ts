import { persistShots } from "../evidence-storage";

type ShotPage = {
  screenshot?: (opts?: {
    type?: "jpeg" | "png";
    quality?: number;
    fullPage?: boolean;
  }) => Promise<Buffer | Uint8Array>;
  evaluate?: (expr: string) => Promise<unknown>;
};

/**
 * Desktop-only layouts (no viewport meta — BetOnline's cashier) lay out at
 * ~980px inside a 390px mobile viewport. A full-page capture then comes out
 * 980px wide and looks "zoomed in" next to the 390px frames around it. When
 * that happens, shoot the viewport instead: what the player actually sees.
 */
export async function pageIsWiderThanViewport(
  page: ShotPage | null | undefined,
): Promise<boolean> {
  if (!page?.evaluate) return false;
  try {
    return Boolean(
      await page.evaluate(
        "document.documentElement.scrollWidth > window.innerWidth + 40",
      ),
    );
  } catch {
    return false;
  }
}

export type CaptureShotOptions = {
  /** Full scrollable page (default true — viewport crops landing pages). */
  fullPage?: boolean;
  quality?: number;
  /**
   * Return true to drop the frame before it's persisted — used by stage
   * streams to skip pixel-identical repeats the DOM fingerprint let through.
   */
  skipIf?: (imageHash: string) => boolean;
};

/** Solid-colour / pre-paint frames compress tiny — reject before we lock them in. */
export function jpegLooksEmpty(buf: Buffer | Uint8Array): boolean {
  const bytes = Buffer.from(buf);
  // Real casino/home screenshots are almost always > 25KB at our quality.
  if (bytes.length < 20_000) return true;
  return false;
}

/** Cheap content hash of the encoded image — identical screens encode identically. */
export function imageHash(buf: Buffer | Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0;
  const step = Math.max(1, Math.floor(buf.length / 65536));
  for (let i = 0; i < buf.length; i += step) {
    h1 = ((h1 ^ buf[i]!) * 16777619) >>> 0;
    h2 = (h2 * 31 + buf[i]!) | 0;
  }
  return `${buf.length}:${h1.toString(16)}:${(h2 >>> 0).toString(16)}`;
}

/** Capture + persist a JPEG of the current Browserbase page. */
export async function captureResearchShot(
  page: ShotPage | null | undefined,
  opts?: CaptureShotOptions,
): Promise<string | null> {
  if (!page?.screenshot) return null;
  // Prefer viewport for journey evidence — fullPage on SPAs like Rainbet
  // produces 20kpx-tall scrolls whose top is empty navy in the card UI.
  const wantFull =
    opts?.fullPage === true && !(await pageIsWiderThanViewport(page));
  const quality = opts?.quality ?? (wantFull ? 48 : 55);
  const persist = async (buf: Buffer | Uint8Array) => {
    const bytes = Buffer.from(buf);
    if (jpegLooksEmpty(bytes)) return null;
    if (opts?.skipIf?.(imageHash(bytes))) return null;
    const [url] = await persistShots([bytes.toString("base64")]);
    return url ?? null;
  };
  try {
    const buf = await page.screenshot({
      type: "jpeg",
      quality,
      fullPage: wantFull,
    });
    return await persist(buf);
  } catch {
    if (wantFull) {
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 55 });
        return await persist(buf);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Poll until the page has real body text (not a blank navy shell). */
export async function waitForPaintedContent(
  page: ShotPage | null | undefined,
  opts?: { minChars?: number; maxMs?: number },
): Promise<boolean> {
  if (!page?.evaluate) return false;
  const minChars = opts?.minChars ?? 120;
  const maxMs = opts?.maxMs ?? 15_000;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const len = await page.evaluate(
        `(document.body && document.body.innerText || "").replace(/\\s+/g, " ").trim().length`,
      );
      if (typeof len === "number" && len >= minChars) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}
