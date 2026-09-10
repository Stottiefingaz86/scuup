import type { Stagehand } from "@browserbasehq/stagehand";

/** Count visible empty+filled inputs on the current registration screen. */
export async function countVisibleFormFields(
  page: { evaluate: (expr: string) => Promise<unknown> }
): Promise<number> {
  try {
    const n = await page.evaluate(`(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return false;
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
      };
      const inputs = [...document.querySelectorAll("input, select, textarea")].filter((el) => {
        if (!visible(el)) return false;
        const type = (el.getAttribute("type") || "").toLowerCase();
        if (["hidden", "submit", "button", "image", "reset", "file"].includes(type)) return false;
        return true;
      });
      return inputs.length;
    })()`);
    return typeof n === "number" ? n : 0;
  } catch {
    return 0;
  }
}

/** Heuristic: visible validation / error banners on the page. */
export async function countVisibleErrors(
  page: { evaluate: (expr: string) => Promise<unknown> }
): Promise<number> {
  try {
    const n = await page.evaluate(`(() => {
      const nodes = [...document.querySelectorAll(
        "[role='alert'], [aria-invalid='true'], .error, .invalid, [class*='error' i], [class*='invalid' i]"
      )];
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden";
      };
      return nodes.filter(visible).length;
    })()`);
    return typeof n === "number" ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Attach navigation listeners for the duration of a stage.
 * Counts full navigations + history pushes as context switches.
 */
export function attachRedirectCounter(page: unknown): {
  count: () => number;
  detach: () => void;
} {
  let redirects = 0;
  const onNav = () => {
    redirects += 1;
  };
  const p = page as {
    on?: (event: string, handler: () => void) => unknown;
    off?: (event: string, handler: () => void) => unknown;
  };
  try {
    p.on?.("framenavigated", onNav);
  } catch {
    // Stagehand page may not expose the event — stay at 0.
  }
  return {
    count: () => Math.max(0, redirects - 1),
    detach: () => {
      try {
        p.off?.("framenavigated", onNav);
      } catch {
        // ignore
      }
    },
  };
}

/** Ask the model for a short friction note grounded in what's on screen. */
export async function observeStageFriction(
  stagehand: Stagehand,
  stageLabel: string
): Promise<{
  friction: string | null;
  userImpact: string | null;
  frictionType: string | null;
  severity: "critical" | "high" | "medium" | "low" | null;
}> {
  try {
    const result = await stagehand.extract(
      `You are timing a player journey stage "${stageLabel}". Look only at the current screen.
Return JSON only:
{ "friction": "short issue or null if smooth", "userImpact": "one short sentence or null", "frictionType": "remove|simplify|automate|clarify|reassure|speed_up|personalise|null", "severity": "critical|high|medium|low|null" }
Severity: critical=blocks completion; high=big delay/trust; medium=noticeable; low=polish.
Do not invent issues — if the flow looks fine, set friction null.`
    );
    const start = result.extraction.indexOf("{");
    const end = result.extraction.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return {
        friction: null,
        userImpact: null,
        frictionType: null,
        severity: null,
      };
    }
    const parsed = JSON.parse(result.extraction.slice(start, end + 1)) as {
      friction?: string | null;
      userImpact?: string | null;
      frictionType?: string | null;
      severity?: string | null;
    };
    const sev = parsed.severity?.toLowerCase();
    const severity =
      sev === "critical" || sev === "high" || sev === "medium" || sev === "low"
        ? sev
        : null;
    // Models often return the *string* "null" / "none" — never show that.
    const clean = (v: string | null | undefined) => {
      const t = (v ?? "").trim();
      return !t || /^(null|none|n\/a|no friction|smooth)\.?$/i.test(t) ? null : t;
    };
    const friction = clean(parsed.friction);
    return {
      friction,
      userImpact: friction ? clean(parsed.userImpact) : null,
      frictionType: friction ? clean(parsed.frictionType) : null,
      severity: friction ? severity : null,
    };
  } catch {
    return {
      friction: null,
      userImpact: null,
      frictionType: null,
      severity: null,
    };
  }
}
