import {
  DEFAULT_TEST_EMAIL,
  defaultTestEmailForBrand,
} from "./constants";

/** Address + identity bundle for registration forms — varies by project market. */
export interface SignupPersona {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  /** Display format for date fields (US vs EU). */
  dateOfBirthDisplay: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const PERSONA_BY_REGION: Record<
  string,
  Omit<SignupPersona, "email" | "dateOfBirthDisplay">
> = {
  us: {
    firstName: "Alex",
    lastName: "Morgan",
    dateOfBirth: "1990-05-15",
    phone: "+1 201 555 0142",
    addressLine1: "350 Fifth Avenue",
    addressLine2: "Apt 12B",
    city: "New York",
    state: "NY",
    postalCode: "10118",
    country: "United States",
  },
  nordic: {
    firstName: "Erik",
    lastName: "Lindqvist",
    dateOfBirth: "1990-05-15",
    phone: "+46 70 123 4567",
    addressLine1: "Drottninggatan 71",
    addressLine2: "",
    city: "Stockholm",
    state: "Stockholm",
    postalCode: "111 36",
    country: "Sweden",
  },
  uk: {
    firstName: "James",
    lastName: "Hartley",
    dateOfBirth: "1990-05-15",
    phone: "+44 7700 900123",
    addressLine1: "42 Baker Street",
    addressLine2: "",
    city: "London",
    state: "England",
    postalCode: "NW1 6XE",
    country: "United Kingdom",
  },
  ie: {
    firstName: "Sean",
    lastName: "Murphy",
    dateOfBirth: "1990-05-15",
    phone: "+353 87 123 4567",
    addressLine1: "14 Grafton Street",
    addressLine2: "",
    city: "Dublin",
    state: "Dublin",
    postalCode: "D02 VF65",
    country: "Ireland",
  },
  ca: {
    firstName: "Jordan",
    lastName: "Chen",
    dateOfBirth: "1990-05-15",
    phone: "+1 416 555 0198",
    addressLine1: "100 Queen Street West",
    addressLine2: "Unit 804",
    city: "Toronto",
    state: "ON",
    postalCode: "M5H 2N2",
    country: "Canada",
  },
  de: {
    firstName: "Lukas",
    lastName: "Weber",
    dateOfBirth: "1990-05-15",
    phone: "+49 151 12345678",
    addressLine1: "Friedrichstraße 43",
    addressLine2: "",
    city: "Berlin",
    state: "Berlin",
    postalCode: "10117",
    country: "Germany",
  },
  nl: {
    firstName: "Daan",
    lastName: "Jansen",
    dateOfBirth: "1990-05-15",
    phone: "+31 6 12345678",
    addressLine1: "Damrak 1",
    addressLine2: "",
    city: "Amsterdam",
    state: "Noord-Holland",
    postalCode: "1012 LG",
    country: "Netherlands",
  },
};

/** Map project market label → persona region key. */
export function personaRegionForMarket(market: string): keyof typeof PERSONA_BY_REGION {
  if (market === "Nordics") return "nordic";
  if (market === "United Kingdom") return "uk";
  if (market === "Ireland") return "ie";
  if (market === "Ontario, Canada") return "ca";
  if (market === "Germany") return "de";
  if (market === "Netherlands") return "nl";
  // Global / Crypto, New Jersey US, and unknown → US-style address.
  return "us";
}

export function defaultTestPassword(): string {
  const fromEnv = process.env.TEST_ACCOUNT_PASSWORD;
  if (fromEnv) return fromEnv;
  throw new Error(
    "TEST_ACCOUNT_PASSWORD is not set — add it to .env.local and Vercel project env."
  );
}

export function buildSignupPersona(opts: {
  market: string;
  brandName: string;
  ownBrand?: boolean;
}): SignupPersona {
  const region = personaRegionForMarket(opts.market);
  const base = PERSONA_BY_REGION[region];
  const email = opts.ownBrand
    ? DEFAULT_TEST_EMAIL
    : defaultTestEmailForBrand(opts.brandName);
  const dobDisplay =
    region === "us" || region === "ca" ? "05/15/1990" : "15/05/1990";
  return {
    ...base,
    email,
    dateOfBirthDisplay: dobDisplay,
  };
}

/** Flat string map for Stagehand %variable% substitution — never log this. */
export function personaVariables(
  persona: SignupPersona,
  password: string
): Record<string, string> {
  return {
    email: persona.email,
    password,
    firstName: persona.firstName,
    lastName: persona.lastName,
    fullName: `${persona.firstName} ${persona.lastName}`,
    dateOfBirth: persona.dateOfBirth,
    dateOfBirthDisplay: persona.dateOfBirthDisplay,
    phone: persona.phone,
    addressLine1: persona.addressLine1,
    addressLine2: persona.addressLine2,
    address: persona.addressLine2
      ? `${persona.addressLine1}, ${persona.addressLine2}`
      : persona.addressLine1,
    city: persona.city,
    state: persona.state,
    postalCode: persona.postalCode,
    zip: persona.postalCode,
    country: persona.country,
  };
}
