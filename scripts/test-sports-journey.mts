// Live test of the sports_betslip agent walk: sportsbook → match → odds
// click → betslip → stake. Run: npx tsx scripts/test-sports-journey.mts [url]
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const { analyzeJourney } = await import("../src/lib/analyst");

const url = process.argv[2] ?? "https://www.betonline.ag";
console.log("running sports_betslip against", url);
const t0 = Date.now();
const analysis = await analyzeJourney(url, "sports_betslip", null, null);
console.log(`\ndone in ${Math.round((Date.now() - t0) / 1000)}s`);
console.log("blocked:", analysis.blocked, analysis.blockReason ?? "");
console.log("score:", analysis.score);
console.log("finalUrl:", analysis.finalUrl);
console.log("summary:", analysis.summary);
console.log(
  "heuristics:",
  analysis.heuristics.map((h) => `${h.name}=${h.score}`).join(", ")
);
console.log("screenshots:", analysis.screenshots.length);
process.exit(0);
