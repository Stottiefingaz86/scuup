import { cn } from "@/lib/utils";
import type { JourneyAnalysis } from "@/lib/types";

/** Normalise a heuristic name so the same axis matches across brands even
 * when older analyses used slightly different wording. */
function heuristicKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchHeuristic(
  name: string,
  candidates: { name: string; score: number; note: string }[]
) {
  const key = heuristicKey(name);
  const exact = candidates.find((c) => heuristicKey(c.name) === key);
  if (exact) return exact;
  // Token-overlap fallback for legacy analyses with free-form names.
  const tokens = new Set(key.split(" "));
  let best: { c: (typeof candidates)[number]; overlap: number } | null = null;
  for (const c of candidates) {
    const cTokens = heuristicKey(c.name).split(" ");
    const overlap =
      cTokens.filter((t) => tokens.has(t)).length /
      Math.max(tokens.size, cTokens.length);
    if (overlap >= 0.5 && (!best || overlap > best.overlap)) {
      best = { c, overlap };
    }
  }
  return best?.c ?? null;
}

/** Explains the score gap between the viewed brand and a rival, heuristic by
 * heuristic, the direct answer to "why does Stake score higher than me". */
export function GapCompare({
  viewed,
  viewedName,
  rival,
  rivalName,
  rivalIsYou,
}: {
  viewed: JourneyAnalysis;
  viewedName: string;
  rival: JourneyAnalysis;
  rivalName: string;
  rivalIsYou: boolean;
}) {
  const rows = viewed.heuristics
    .map((h) => {
      const match = matchHeuristic(h.name, rival.heuristics);
      return match
        ? { name: h.name, viewed: h, rival: match, delta: h.score - match.score }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (!rows.length) return null;

  const totalDelta = viewed.score - rival.score;
  const drivers = rows.filter((r) => Math.abs(r.delta) >= 5).slice(0, 4);
  const even = rows.filter((r) => Math.abs(r.delta) < 5);
  const rivalLabel = rivalIsYou ? "you" : rivalName;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <h3 className="text-sm font-medium">
        {totalDelta > 0
          ? `Why ${viewedName} scores ${viewed.score} vs ${rivalIsYou ? `your ${rival.score}` : `${rivalName}'s ${rival.score}`}`
          : totalDelta < 0
            ? `Where ${viewedName} (${viewed.score}) trails ${rivalLabel} (${rival.score})`
            : `${viewedName} and ${rivalLabel} are level on ${viewed.score}`}
      </h3>
      <div className="mt-3 flex flex-col gap-3">
        {drivers.map((r) => {
          const leadsRival = r.delta > 0;
          const leader = leadsRival ? r.viewed : r.rival;
          const subject = leadsRival
            ? viewedName
            : rivalIsYou
              ? "You"
              : rivalName;
          return (
            <div key={r.name} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">
                  {r.viewed.score} vs {r.rival.score}
                </span>
                <span
                  className={cn(
                    "ms-auto rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    leadsRival
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-rose-500/15 text-rose-500"
                  )}
                >
                  {r.delta > 0 ? "+" : ""}
                  {r.delta}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/70">
                  {subject === "You" ? "You lead: " : `${subject} leads: `}
                </span>
                {leader.note}
              </p>
            </div>
          );
        })}
        {drivers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No single heuristic separates them by more than a few points, the
            gap is spread evenly.
          </p>
        ) : even.length ? (
          <p className="text-xs text-muted-foreground">
            Roughly level on {even.map((r) => r.name.toLowerCase()).join(", ")}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
