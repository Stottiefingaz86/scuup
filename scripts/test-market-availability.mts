// Sanity-check curated brand market rules.
// Run: npx tsx scripts/test-market-availability.mts
import { curatedAvailability } from "../src/lib/brand-markets";
import { MARKET_OPTIONS } from "../src/lib/constants";

const markets = MARKET_OPTIONS.filter((m) => m.geo).map((m) => m.label);

for (const host of ["stake.com", "winna.com", "betonline.ag", "rainbet.com"]) {
  const c = curatedAvailability(host, markets);
  if (!c) {
    console.log(host, "— no curated rules");
    continue;
  }
  console.log("\n==", host);
  console.log("blocks CA crypto:", c.blocked.includes("Canada (rest / crypto)"));
  console.log("serves US rest:", c.available.includes("US (rest / offshore)"));
  console.log("blocked:", c.blocked.slice(0, 8).join(", "), "…");
  console.log("available:", c.available.join(", "));
}
