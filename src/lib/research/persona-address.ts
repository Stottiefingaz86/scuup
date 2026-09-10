import { DEFAULT_TEST_EMAIL } from "@/lib/constants";
import type { ResearchPersona } from "./types";

const CA_STREETS = [
  "Queen Street West",
  "King Street East",
  "Yonge Street",
  "Bay Street",
  "Bloor Street West",
  "Dundas Street West",
  "Spadina Avenue",
  "College Street",
];

const CA_CITIES: { city: string; province: string; postalPrefix: string }[] = [
  { city: "Toronto", province: "ON", postalPrefix: "M5H" },
  { city: "Vancouver", province: "BC", postalPrefix: "V6B" },
  { city: "Montreal", province: "QC", postalPrefix: "H2Y" },
  { city: "Calgary", province: "AB", postalPrefix: "T2P" },
  { city: "Ottawa", province: "ON", postalPrefix: "K1P" },
];

const US_STREETS = [
  "Main Street",
  "Oak Avenue",
  "Maple Drive",
  "Park Avenue",
  "Washington Street",
  "Fifth Avenue",
  "Broadway",
  "Market Street",
];

const US_CITIES: { city: string; state: string; zip: string }[] = [
  { city: "New York", state: "NY", zip: "10001" },
  { city: "Jersey City", state: "NJ", zip: "07302" },
  { city: "Miami", state: "FL", zip: "33101" },
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Denver", state: "CO", zip: "80202" },
  { city: "Seattle", state: "WA", zip: "98101" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join(
    ""
  );
}

/** Canadian postal: A1A 1A1 style from a city prefix. */
function caPostal(prefix: string): string {
  const letters = "ABCEGHJKLMNPRSTVXY";
  const L = () => letters[Math.floor(Math.random() * letters.length)]!;
  const D = () => String(Math.floor(Math.random() * 10));
  // Keep first letter+digit from real city prefix when possible.
  const p = prefix.toUpperCase().padEnd(3, "A").slice(0, 3);
  return `${p[0]}${p[1] ?? D()}${p[2] ?? L()} ${D()}${L()}${D()}`;
}

export function randomCanadianAddress(): Pick<
  ResearchPersona,
  "addressLine1" | "city" | "postalCode" | "country" | "phone" | "state"
> {
  const place = pick(CA_CITIES);
  const num = 40 + Math.floor(Math.random() * 900);
  const unit = 100 + Math.floor(Math.random() * 800);
  return {
    addressLine1: `${num} ${pick(CA_STREETS)}, Unit ${unit}`,
    city: place.city,
    state: place.province,
    postalCode: caPostal(place.postalPrefix),
    country: "Canada",
    phone: `416555${randomDigits(4)}`,
  };
}

export function randomUsAddress(): Pick<
  ResearchPersona,
  "addressLine1" | "city" | "postalCode" | "country" | "phone" | "state"
> {
  const place = pick(US_CITIES);
  const num = 100 + Math.floor(Math.random() * 1900);
  return {
    addressLine1: `${num} ${pick(US_STREETS)}`,
    city: place.city,
    state: place.state,
    postalCode: place.zip.replace(/\d{2}$/, randomDigits(2)),
    country: "United States",
    phone: `201555${randomDigits(4)}`,
  };
}

/** Prefer Canada; US when market is clearly American. */
export function defaultAddressForMarket(market: string): ReturnType<
  typeof randomCanadianAddress
> {
  if (
    /united states|new jersey|us\b|global|crypto/i.test(market) &&
    !/canada/i.test(market)
  ) {
    return randomUsAddress();
  }
  // Canada preferred for research signups (crypto-friendly, realistic).
  return randomCanadianAddress();
}

export function defaultResearchPersona(market?: string): ResearchPersona {
  const address = defaultAddressForMarket(market ?? "Canada");
  return {
    email: DEFAULT_TEST_EMAIL,
    password: "",
    dateOfBirth: "1986-03-15",
    ...address,
    notes:
      "Password blank → TEST_ACCOUNT_PASSWORD. Address randomized Canada/US for signup forms.",
  };
}
