// Live test of the signup registration walk: open register → fill persona
// → submit → check authenticated. Run: npx tsx scripts/test-signup-journey.mts [url]
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const { analyzeJourney } = await import("../src/lib/analyst");
const { buildSignupPersona, defaultTestPassword, personaVariables } =
  await import("../src/lib/test-persona");

const url = process.argv[2] ?? "https://www.rainbet.com";
const brandName = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
const persona = buildSignupPersona({ market: "Global / Crypto", brandName });
const vars = personaVariables(persona, defaultTestPassword());
console.log("running signup against", url);
console.log("persona:", {
  email: persona.email,
  username: persona.username,
  name: `${persona.firstName} ${persona.lastName}`,
  phone: persona.phone,
  dob: persona.dateOfBirthDisplay,
});

const t0 = Date.now();
const analysis = await analyzeJourney(url, "signup", null, null, vars);
console.log(`\ndone in ${Math.round((Date.now() - t0) / 1000)}s`);
console.log("blocked:", analysis.blocked, analysis.blockReason ?? "");
console.log("authenticated:", analysis.authenticated);
console.log("score:", analysis.score);
console.log("finalUrl:", analysis.finalUrl);
console.log("summary:", analysis.summary);
console.log("screenshots:", analysis.screenshots.length);
process.exit(0);
