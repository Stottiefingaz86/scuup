import {
  DEFAULT_TEST_EMAIL,
} from "./constants";

/** Address + identity bundle for registration forms — varies by project market. */
export interface SignupPersona {
  firstName: string;
  lastName: string;
  /** Random handle for sites that ask for a username. */
  username?: string;
  email: string;
  dateOfBirth: string;
  /** Display format for date fields (US vs EU). */
  dateOfBirthDisplay: string;
  /** Primary phone — local national format for the market (what most
   * registration forms expect, e.g. 07XXX XXXXXX for UK). */
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/* Randomised identity: a fresh name/phone/username per brand so repeated
 * signups don't collide on operator-side dedupe. Persisted encrypted per
 * brand, so the same persona is reused on retries. */
const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Chris", "Jamie", "Taylor", "Ryan", "Casey",
  "Morgan", "Drew", "Lee", "Jesse",
];
const LAST_NAMES = [
  "Morgan", "Hunter", "Bennett", "Walker", "Reid", "Carter", "Brooks",
  "Hayes", "Ellis", "Grant", "Porter", "Shaw",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

function randomDob(region: string): { iso: string; display: string } {
  const year = 1986 + Math.floor(Math.random() * 12); // 21+ everywhere
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 3 + Math.floor(Math.random() * 25);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return {
    iso: `${year}-${mm}-${dd}`,
    display:
      region === "us" || region === "ca"
        ? `${mm}/${dd}/${year}`
        : `${dd}/${mm}/${year}`,
  };
}

/** UK mobiles operators expect the national form (07…). Avoid Ofcom's
 * drama range 07700 900xxx and +44-with-spaces — both fail Tombola-class
 * validators even though they look "internationally correct". */
function formatUkMobile(): string {
  // Common valid-looking UK mobile prefixes (07 + 3 digits + 6 digits).
  const prefixes = [
    "7400", "7411", "7422", "7433", "7444", "7455", "7466", "7477", "7488", "7499",
    "7500", "7511", "7522", "7533", "7544", "7555", "7566", "7577", "7588", "7599",
    "7701", "7711", "7722", "7733", "7744", "7755", "7766", "7777", "7788", "7799",
    "7800", "7811", "7822", "7833", "7844", "7855", "7866", "7877", "7888", "7899",
    "7900", "7911", "7922", "7933", "7944", "7955", "7966", "7977", "7988", "7999",
  ];
  const body = pick(prefixes) + randomDigits(6); // 10 digits after leading 0
  return `0${body.slice(0, 4)} ${body.slice(4, 7)} ${body.slice(7)}`;
}

function generateIeMobile(): string {
  const third = pick(["3", "5", "6", "7", "9"]);
  return `08${third} ${randomDigits(3)} ${randomDigits(4)}`;
}

/** Randomise the trailing digits of a region phone number so each brand
 * gets a unique but correctly-formatted mobile. */
function randomizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").length;
  const keep = Math.max(4, digits - 6);
  let seen = 0;
  return phone
    .split("")
    .map((ch) => {
      if (!/\d/.test(ch)) return ch;
      seen += 1;
      return seen <= keep ? ch : String(Math.floor(Math.random() * 10));
    })
    .join("");
}

type PersonaBase = Omit<SignupPersona, "email" | "dateOfBirthDisplay" | "phone"> & {
  phone?: string;
};

const PERSONA_BY_REGION: Record<string, PersonaBase> = {
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
  if (
    market === "Ontario, Canada" ||
    market === "Canada (rest / crypto)" ||
    market === "Canada (rest)"
  )
    return "ca";
  if (market === "Germany") return "de";
  if (market === "Netherlands") return "nl";
  // Global / Crypto, New Jersey US, and unknown → US-style address.
  return "us";
}

function phoneForRegion(region: string, template?: string): string {
  if (region === "uk") return formatUkMobile();
  if (region === "ie") return generateIeMobile();
  if (template) return randomizePhone(template);
  return randomizePhone("+1 201 555 0142");
}

/** True when a stored UK/IE phone will fail common operator validators
 * (+44 with spaces, Ofcom drama range, missing leading 0). */
export function phoneNeedsRepair(phone: string, country: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (/united kingdom|uk/i.test(country)) {
    // Accept national 07XXXXXXXXX (11 digits) only.
    if (/^07\d{9}$/.test(digits)) return false;
    return true;
  }
  if (/ireland/i.test(country)) {
    if (/^08[35679]\d{7}$/.test(digits)) return false;
    return true;
  }
  return false;
}

/** Rewrite a bad UK/IE phone into the national format forms expect. */
export function repairPersonaPhone(persona: SignupPersona): SignupPersona {
  if (!phoneNeedsRepair(persona.phone, persona.country)) return persona;
  if (/united kingdom|uk/i.test(persona.country)) {
    return { ...persona, phone: formatUkMobile() };
  }
  if (/ireland/i.test(persona.country)) {
    return { ...persona, phone: generateIeMobile() };
  }
  return persona;
}

/** Alternate phone spellings to try when a form rejects the primary. */
export function phoneAlternates(phone: string, country: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const alts: string[] = [];
  const push = (v: string) => {
    if (v && v !== phone && !alts.includes(v)) alts.push(v);
  };

  if (/united kingdom|uk/i.test(country)) {
    // National compact / spaced, then E.164.
    let national = digits;
    if (digits.startsWith("44") && digits.length === 12) {
      national = `0${digits.slice(2)}`;
    }
    if (national.startsWith("07") && national.length === 11) {
      push(national);
      push(`${national.slice(0, 5)} ${national.slice(5, 8)} ${national.slice(8)}`);
      push(`+44${national.slice(1)}`);
      push(`+44 ${national.slice(1, 5)} ${national.slice(5, 8)} ${national.slice(8)}`);
    }
  } else if (/ireland/i.test(country)) {
    let national = digits;
    if (digits.startsWith("353") && digits.length >= 12) {
      national = `0${digits.slice(3)}`;
    }
    if (national.startsWith("08") && national.length === 10) {
      push(national);
      push(`${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`);
      push(`+353${national.slice(1)}`);
    }
  }

  return alts;
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
  const email = DEFAULT_TEST_EMAIL;
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const dob = randomDob(region);
  return {
    ...base,
    firstName,
    lastName,
    username: `${firstName}${lastName}${randomDigits(4)}`.toLowerCase(),
    phone: phoneForRegion(region, base.phone),
    email,
    dateOfBirth: dob.iso,
    dateOfBirthDisplay: dob.display,
  };
}

/** Flat string map for Stagehand %variable% substitution — never log this. */
export function personaVariables(
  persona: SignupPersona,
  password: string
): Record<string, string> {
  const alts = phoneAlternates(persona.phone, persona.country);
  return {
    email: persona.email,
    loginId: persona.email,
    password,
    username:
      persona.username ??
      `${persona.firstName}${persona.lastName}${Math.floor(1000 + Math.random() * 9000)}`.toLowerCase(),
    firstName: persona.firstName,
    lastName: persona.lastName,
    fullName: `${persona.firstName} ${persona.lastName}`,
    dateOfBirth: persona.dateOfBirth,
    dateOfBirthDisplay: persona.dateOfBirthDisplay,
    phone: persona.phone,
    // First alternate for a quick retry without regenerating the persona.
    phoneAlt: alts[0] ?? persona.phone,
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
