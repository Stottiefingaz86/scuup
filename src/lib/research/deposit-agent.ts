import type { Stagehand } from "@browserbasehq/stagehand";
import { dismissOpenChat, pageLooksLikeOpenChat } from "./post-signup";

export interface DepositDetails {
  address: string | null;
  network: string | null;
  currency: string | null;
  amountHint: string | null;
}

type DepositPage = {
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate: (expr: string) => Promise<unknown>;
};

/**
 * Bitcoin addresses only — research deposits are always BTC.
 * Case-sensitive on purpose: a case-insensitive legacy pattern matches hashed
 * CSS class names / tokens, and a false positive here means asking for real
 * money to a bogus address.
 */
export const BTC_ADDRESS_RE =
  /\b(?:bc1[ac-hj-np-z02-9]{25,87}|BC1[AC-HJ-NP-Z02-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/;

export function isValidBtcAddress(value: string | null | undefined): boolean {
  if (!value) return false;
  return BTC_ADDRESS_RE.test(value.trim());
}

function parseDepositJson(raw: string): DepositDetails {
  const empty: DepositDetails = {
    address: null,
    network: null,
    currency: null,
    amountHint: null,
  };
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return empty;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    const addressRaw =
      typeof parsed.address === "string" && parsed.address.trim()
        ? parsed.address.trim()
        : null;
    const btcMatch = addressRaw ? BTC_ADDRESS_RE.exec(addressRaw) : null;
    return {
      address: btcMatch?.[0] ?? null,
      network:
        typeof parsed.network === "string" ? parsed.network.trim() : null,
      currency:
        typeof parsed.currency === "string" ? parsed.currency.trim() : null,
      amountHint:
        typeof parsed.amountMin === "string"
          ? parsed.amountMin.trim()
          : typeof parsed.amountHint === "string"
            ? parsed.amountHint.trim()
            : null,
    };
  } catch {
    const match = BTC_ADDRESS_RE.exec(raw);
    return match
      ? { ...empty, address: match[0], currency: "BTC", network: "Bitcoin" }
      : empty;
  }
}

function normalizeBtc(details: DepositDetails): DepositDetails {
  const addr = details.address ? BTC_ADDRESS_RE.exec(details.address) : null;
  return {
    address: addr?.[0] ?? null,
    network: details.network || "Bitcoin",
    currency: "BTC",
    amountHint: details.amountHint
      ? details.amountHint.includes("min") || details.amountHint.includes("Min")
        ? details.amountHint
        : `Min ${details.amountHint}`
      : details.amountHint,
  };
}

/**
 * Deterministic scrape — LLM extract often misses clearly labeled wallet
 * addresses (red text, copy buttons, QR screens). Prefer DOM over vision.
 */
export async function scrapeBtcAddressFromDom(
  page: DepositPage,
): Promise<string | null> {
  try {
    const found = await page.evaluate(`(() => {
      const re = /\\b(?:bc1[ac-hj-np-z02-9]{25,87}|BC1[AC-HJ-NP-Z02-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\\b/g;
      const labelHint = /wallet\\s*address|deposit\\s*address|btc\\s*address|bitcoin\\s*address|receiving\\s*address|send\\s*(btc|bitcoin)\\s*to|address\\s*:/i;

      const pick = (text) => {
        if (!text) return null;
        const matches = String(text).match(re);
        return matches && matches[0] ? matches[0] : null;
      };
      // Visible text only — textContent would include <script> bodies.
      const visibleText = (el) =>
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el.value
          : el.innerText || "";

      // 1) Prefer nodes labeled as wallet / deposit address.
      const candidates = [...document.querySelectorAll(
        "input, textarea, [data-address], [data-testid*='address' i], [class*='address' i], [id*='address' i], code, pre, span, p, div, td, li, button"
      )];
      let unlabeled = null;
      for (const el of candidates) {
        if (!(el instanceof HTMLElement)) continue;
        const attrBits = [
          el.getAttribute("aria-label"),
          el.getAttribute("placeholder"),
          el.getAttribute("name"),
          el.getAttribute("id"),
          el.getAttribute("data-testid"),
          el.getAttribute("title"),
          el.className && String(el.className),
          el.previousElementSibling && el.previousElementSibling.textContent,
          el.parentElement && el.parentElement.textContent
            ? el.parentElement.textContent.slice(0, 400)
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        const value = visibleText(el);
        const nearLabel =
          labelHint.test(attrBits) ||
          labelHint.test(String(value || "").slice(0, 120));
        // Only ever take the address from visible value/text — never from
        // class/id attributes, which can hold address-shaped hashes.
        const hit = pick(value);
        if (!hit) continue;
        if (nearLabel) return hit;
        if (!unlabeled) unlabeled = hit;
      }
      if (unlabeled) return unlabeled;

      // Second pass: any labeled neighborhood wins first.
      for (const el of candidates) {
        if (!(el instanceof HTMLElement)) continue;
        const blob = (el.innerText || "").slice(0, 600);
        if (!labelHint.test(blob)) continue;
        const hit = pick(blob);
        if (hit) return hit;
      }

      // 2) Readonly / copy inputs often hold the address even without a label match.
      for (const el of document.querySelectorAll("input, textarea")) {
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
        const hit = pick(el.value);
        if (hit) return hit;
      }

      // 3) Full visible body text last (catches red "Wallet Address" text).
      return pick((document.body && document.body.innerText) || "");
    })()`);
    if (typeof found === "string" && isValidBtcAddress(found)) {
      return BTC_ADDRESS_RE.exec(found)?.[0] ?? found;
    }
  } catch {
    // Fall through to LLM extract.
  }
  return null;
}

async function pageLooksPastAddressScreen(page: DepositPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const t = (document.body?.innerText || "").slice(0, 6000).toLowerCase();
        return (
          /pending confirmation from the blockchain|transaction is in progress|waiting for (your )?deposit|awaiting (blockchain|confirm)/i.test(t) &&
          !/wallet\\s*address|deposit\\s*address/i.test(t)
        );
      })()`),
    );
  } catch {
    return false;
  }
}

/** Cashier / deposit UI already on screen (method list or wallet). */
export async function pageLooksLikeCashier(
  page: DepositPage,
): Promise<boolean> {
  try {
    // Tight on purpose: a crypto casino homepage mentions "deposit" and
    // "crypto" in passing, which used to read as "already in cashier" and
    // left the agent shooting the lobby for eight frames (Winna).
    return Boolean(
      await page.evaluate(`(() => {
        const vis = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 220 || r.height < 160) return false;
          const cs = getComputedStyle(el);
          return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
        };
        const path = (location.pathname + location.search + location.hash).toLowerCase();
        const urlHit = /cashier|deposit|wallet|banking|payment|buy-?crypto/.test(path);
        const dialog = [...document.querySelectorAll(
          "[role='dialog'], [aria-modal='true'], [class*='modal' i], [class*='drawer' i], [class*='sheet' i], [class*='cashier' i], [class*='wallet' i], [class*='deposit' i]"
        )].find(vis);
        const root = dialog || (urlHit ? document.body : null);
        if (!root) return false;
        const t = (root.innerText || "").slice(0, 8000);
        const heading = /cashier|deposit|add funds|wallet|payment method|buy crypto|top ?up/i.test(t);
        const methods = new Set((t.match(/bitcoin|\\bbtc\\b|crypto|visa|mastercard|interac|tether|usdt|usdc|ethereum|litecoin|solana|apple pay|google pay|e-?transfer/gi) || []).map((m) => m.toLowerCase())).size;
        const btcForm = /wallet\\s*address|deposit\\s*address|scan (the )?qr|minimum deposit/i.test(t);
        if (btcForm || (heading && methods >= 1)) return true;
        // Full-page messenger only — a welcome card on cashier is still cashier.
        if (/live\\s*rain|top\\s*rain|need help\\??|we.?ve got you covered|type a message|message\\.{2,}|drop me a message/i.test(t)) {
          return false;
        }
        return false;
      })()`),
    );
  } catch {
    return false;
  }
}

/** Hide the welcome card and scroll the wallet address / QR into view. */
async function revealDepositAddress(page: DepositPage): Promise<void> {
  await dismissOpenChat(page);
  try {
    await page.evaluate(`(() => {
      const hint = /wallet\\s*address|deposit\\s*address|minimum deposit|scan (the )?qr|bc1|[13][a-km-zA-HJ-NP-Z1-9]{25,}/i;
      const nodes = [...document.querySelectorAll(
        "input, textarea, code, pre, p, div, span, img, canvas, [class*='qr' i], [class*='address' i]"
      )];
      for (const el of nodes) {
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const t = [
          el.innerText,
          el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : "",
          el.getAttribute("aria-label"),
          el.getAttribute("alt"),
          el.className,
        ].join(" ");
        if (!hint.test(t)) continue;
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        return true;
      }
      return false;
    })()`);
  } catch {
    /* ignore */
  }
}

/** Still choosing a payment method (several options listed, no BTC form yet). */
async function pageStillOnMethodPicker(page: DepositPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const t = (document.body?.innerText || "").slice(0, 8000);
        const otherMethods = (t.match(/tether|usdt|ethereum|litecoin|visa|mastercard|interac|e-?transfer|altcoins?/gi) || []).length;
        const btcForm = /wallet\\s*address|deposit\\s*address|(deposit|send|enter)\\s*amount|amount\\s*\\(?(usd|btc|cad)|minimum deposit|scan (the )?qr/i.test(t);
        return otherMethods >= 2 && !btcForm;
      })()`),
    );
  } catch {
    return false;
  }
}

async function clickCopyAddress(page: DepositPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const nodes = [
          ...document.querySelectorAll("button, a, [role='button'], svg, [class*='copy' i]"),
        ];
        for (const el of nodes) {
          if (!(el instanceof HTMLElement)) continue;
          const t = (
            (el.textContent || "") +
            " " +
            (el.getAttribute("aria-label") || "") +
            " " +
            (el.getAttribute("title") || "") +
            " " +
            (el.className || "")
          ).toLowerCase();
          if (!/copy/.test(t)) continue;
          if (!/address|wallet|btc|bitcoin|deposit|qr/.test(t) && !/copy/.test(t)) continue;
          // Prefer copy controls near wallet address copy.
          const near = (el.closest("div, section, form, li")?.innerText || "").slice(0, 400);
          if (/wallet|address|btc|bitcoin|bc1|deposit/i.test(near) || /copy/.test(t)) {
            el.click();
            return true;
          }
        }
        return false;
      })()`),
    );
  } catch {
    return false;
  }
}

async function readDepositDetails(
  stagehand: Stagehand,
  page: DepositPage,
  amountHint: string | null,
): Promise<DepositDetails> {
  const fromDom = await scrapeBtcAddressFromDom(page);
  if (fromDom) {
    return normalizeBtc({
      address: fromDom,
      network: "Bitcoin",
      currency: "BTC",
      amountHint,
    });
  }

  const extracted = await stagehand.extract(
    `From this Bitcoin deposit screen return a JSON object only, with keys:
address (the Bitcoin wallet address if visible — look for labels like "Wallet Address", "Deposit address", QR copy text — else null),
network (Bitcoin or BTC network name, else null),
currency (should be BTC if this is Bitcoin deposit),
amountMin (minimum deposit amount text if shown, else null).
Only use values visible on screen — do not invent an address. Never return a non-Bitcoin address.`,
  );

  const details = normalizeBtc(parseDepositJson(extracted.extraction));
  if (details.address && isValidBtcAddress(details.address)) return details;

  const body = await stagehand.extract(
    "Quote the exact Bitcoin deposit address visible on this page (bc1… or 1… / 3…). Look next to the words 'Wallet Address'. Or say NONE if not visible.",
  );
  const match = BTC_ADDRESS_RE.exec(body.extraction);
  if (match) {
    return normalizeBtc({
      address: match[0],
      network: "Bitcoin",
      currency: "BTC",
      amountHint: details.amountHint ?? amountHint,
    });
  }

  return normalizeBtc({
    address: null,
    network: details.network,
    currency: "BTC",
    amountHint: details.amountHint ?? amountHint,
  });
}

async function safeAct(
  stagehand: Stagehand,
  instruction: string,
): Promise<void> {
  await stagehand.act(instruction).catch(() => {});
}

/**
 * Cashiers that group methods: click the "Crypto" category when no Bitcoin
 * option is visible yet. Returns true if a group row was clicked.
 */
async function fastOpenCryptoGroup(page: DepositPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const vis = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 40 || r.height < 20) return false;
          const cs = getComputedStyle(el);
          return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
        };
        const txt = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
        const all = [...document.querySelectorAll("button, a, [role='button'], li, div, span, h3, h4, p")].filter(vis);
        // Bitcoin already selectable → nothing to open.
        if (all.some((el) => { const t = txt(el); return t.length <= 40 && /^bitcoin\\b|\\bbtc\\b/i.test(t); })) return false;
        const groupRe = /^(crypto|cryptocurrency|cryptocurrencies|crypto ?currencies|digital currenc(y|ies)|coins)$/i;
        let best = null;
        for (const el of all) {
          const t = txt(el);
          if (!groupRe.test(t)) {
            // Card whose heading is "Crypto" and body is icons only (little text).
            const first = t.split(/\\s/)[0] || "";
            if (!groupRe.test(first) || t.length > 24) continue;
          }
          // Walk up to the clickable card / row.
          let node = el;
          for (let i = 0; i < 5 && node; i++) {
            const cs = getComputedStyle(node);
            const clickable = node.matches("button, a, [role='button'], li") || cs.cursor === "pointer" || node.onclick;
            if (clickable) { best = node; break; }
            node = node.parentElement;
          }
          if (!best) best = el;
          break;
        }
        if (!best) return false;
        best.click();
        return true;
      })()`),
    );
  } catch {
    return false;
  }
}

/**
 * Deterministic cashier opener. Returns true if something was clicked.
 * Order: explicit Deposit/Wallet/Cashier text → aria/title/href hints →
 * icon-only button sitting beside the header balance ("$0.00").
 */
async function fastOpenCashier(page: DepositPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const vis = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 18 || r.height < 18) return false;
          if (r.bottom < 0 || r.top > innerHeight) return false;
          const cs = getComputedStyle(el);
          return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
        };
        const txt = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
        const hint = (el) =>
          [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-testid"), el.getAttribute("href"), el.id, el.className]
            .map((v) => String(v || ""))
            .join(" ")
            .toLowerCase();
        const depositRe = /^(deposit|wallet|cashier|add funds|top ?up|buy crypto|fund)( now)?$/i;
        const hintRe = /deposit|wallet|cashier|add-?funds|top-?up/;
        const badRe = /withdraw|history|logout|log out|help|support|promo|bonus|chat|message|rain|intercom|live.?chat|join|balance|dropdown/i;
        const ctrls = [...document.querySelectorAll("button, a, [role='button']")].filter(vis);

        const moneyRe = /^(?:[A-Z]{0,4}[\\$€£¥₿]?)\\s?\\d[\\d,]*(\\.\\d{2})?\\s?(usd|eur|cad|btc|usdt)?$/i;
        const isMoney = (t) => moneyRe.test(String(t || "").replace(/[v▼▾⌄˅].*$/, "").trim());
        const isBalanceOrChevron = (el) => {
          const t = txt(el);
          if (isMoney(t)) return true;
          if (el.getAttribute("aria-haspopup") || el.hasAttribute("aria-expanded")) return true;
          if (/dropdown|chevron|caret|balance|currency/i.test(hint(el))) return true;
          if (/^[v▼▾⌄˅]$/i.test(t)) return true;
          const r = el.getBoundingClientRect();
          if (r.width < 28 && r.height < 28) return true;
          return false;
        };
        const brightBlue = (el) => {
          const nodes = [el, ...el.children];
          for (const n of nodes) {
            if (!(n instanceof HTMLElement)) continue;
            const bg = getComputedStyle(n).backgroundColor || "";
            const m = bg.match(/rgba?\\((\\d+)[\\s,]+(\\d+)[\\s,]+(\\d+)/);
            if (!m) continue;
            const rs = Number(m[1]), gs = Number(m[2]), bs = Number(m[3]);
            if (bs > 170 && gs > 130 && rs < 180 && bs >= gs - 10) return true;
          }
          return false;
        };

        // Winna deposit = light-blue wallet chip to the RIGHT of the balance
        // dropdown. Never click $0.00 or the chevron on that pill.
        const header = [...document.querySelectorAll("button, a, [role='button'], div")]
          .filter((el) => vis(el) && el.getBoundingClientRect().top < 140);
        const chips = header.filter((el) => {
          if (isBalanceOrChevron(el) || badRe.test(hint(el) + txt(el))) return false;
          const r = el.getBoundingClientRect();
          const ratio = r.width / r.height;
          if (ratio < 0.75 || ratio > 1.35) return false;
          if (r.width < 32 || r.width > 56 || r.height < 32 || r.height > 56) return false;
          if (txt(el).length > 2) return false;
          if (!el.querySelector("svg, img, i, [class*='icon' i]")) return false;
          return brightBlue(el);
        });
        if (chips.length) {
          chips.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
          chips[0].click();
          return "wallet-chip";
        }

        for (const el of ctrls) {
          const t = txt(el);
          if (isBalanceOrChevron(el)) continue;
          if (t && t.length <= 24 && depositRe.test(t) && !badRe.test(hint(el) + t)) { el.click(); return "text"; }
        }
        for (const el of ctrls) {
          if (isBalanceOrChevron(el)) continue;
          const h = hint(el);
          if (hintRe.test(h) && !badRe.test(h) && txt(el).length <= 24) { el.click(); return "hint"; }
        }

        const balance = header.find((el) => isMoney(txt(el)));
        if (balance) {
          const b = balance.getBoundingClientRect();
          let best = null, bestScore = -1;
          for (const el of header) {
            if (el === balance || isBalanceOrChevron(el)) continue;
            if (badRe.test(hint(el))) continue;
            if (txt(el).length > 2) continue;
            if (!el.querySelector("svg, img, i, [class*='icon' i]")) continue;
            const r = el.getBoundingClientRect();
            if (r.left < b.right - 2) continue;
            const sameRow = Math.abs((r.top + r.bottom) / 2 - (b.top + b.bottom) / 2) < 28;
            if (!sameRow) continue;
            const square = Math.abs(r.width - r.height) < 10 && r.width >= 32;
            const dx = r.left - b.right;
            if (dx > 120) continue;
            const score = (square ? 8 : 0) + (brightBlue(el) ? 12 : 0) + Math.max(0, 6 - dx / 20);
            if (score > bestScore) { best = el; bestScore = score; }
          }
          if (best && bestScore >= 8) { best.click(); return "icon"; }
        }
        return false;
      })()`),
    );
  } catch {
    return false;
  }
}

/**
 * Open wallet/cashier, select Bitcoin, set minimum amount when asked,
 * and read the BTC deposit address. Never confirms/submits payment.
 * Never asks a human to send BTC unless a real address was scraped.
 */
export async function walkToDepositAddress(
  stagehand: Stagehand,
  page: DepositPage,
  /** Called after every screen change so the journey has a frame per step. */
  onShot?: (label: string) => Promise<void>,
): Promise<DepositDetails> {
  const shot = async (label: string) => {
    if (onShot) await onShot(label);
  };
  const host = String(
    await page.evaluate("location.hostname").catch(() => ""),
  );
  const winna = /winna\.com/i.test(host);

  // Never click chat — on Winna that toggles the messenger open.
  // Hide it or leave the chat route, then open wallet via URL / header chip.
  await dismissOpenChat(page);

  if (winna && !(await pageLooksLikeCashier(page))) {
    await page
      .evaluate(`location.assign(location.origin + "/wallet")`)
      .catch(() => {});
    await page.waitForTimeout(3500);
  }

  const alreadyInCashier = await pageLooksLikeCashier(page);
  if (!alreadyInCashier) {
    const fast = await fastOpenCashier(page);
    if (fast) await page.waitForTimeout(2500);

    if (!fast || !(await pageLooksLikeCashier(page))) {
      if (winna) {
        await fastOpenCashier(page);
        await page.waitForTimeout(2000);
        if (!(await pageLooksLikeCashier(page))) {
          throw new Error(
            "Couldn't open deposit — cashier never appeared (ignored live chat)",
          );
        }
      } else {
        const open = await stagehand.act(
          "Open the deposit / cashier screen. Click Deposit, Wallet, Cashier, or Add Funds. Do not click Chat, Support, or Message. Do not confirm a payment.",
        );
        await page.waitForTimeout(2500);
        if (!(await pageLooksLikeCashier(page))) {
          if (await fastOpenCashier(page)) await page.waitForTimeout(2500);
          if (!(await pageLooksLikeCashier(page))) {
            throw new Error(
              `Couldn't open deposit — cashier never appeared${
                open.message ? ` (${open.message})` : ""
              }`,
            );
          }
        }
      }
    }
  }
  await revealDepositAddress(page);
  await shot("Cashier opened");

  let amountHint: string | null = null;

  // After every navigation step: scrape first. Never Continue past a visible address.
  const tryRead = async () => {
    await revealDepositAddress(page);
    const d = await readDepositDetails(stagehand, page, amountHint);
    if (d.amountHint) amountHint = d.amountHint;
    if (d.address) await shot("Wallet address shown");
    return d;
  };

  let details = await tryRead();
  if (details.address) return details;

  // Two-level pickers (Winna): a "Crypto" category row with coin icons opens
  // the coin list. Open the group first so Bitcoin is actually on screen.
  if (await fastOpenCryptoGroup(page)) {
    await page.waitForTimeout(2000);
    await shot("Crypto methods opened");
  }

  // Always Bitcoin — click the Bitcoin row on cashiers like BetOnline.
  await safeAct(
    stagehand,
    "On this deposit or wallet screen, select Bitcoin. If payment methods are grouped (e.g. a 'Crypto' or 'Cryptocurrency' row with coin icons and an arrow), open that group first, then click Bitcoin or BTC only — the row or button labeled Bitcoin. Do not select Tether, USDT, USDC, Credit Card, Interac, Ethereum, Litecoin, Solana, or Altcoins. Do not confirm payment. Do not click Continue if a Wallet Address is already visible.",
  );
  await page.waitForTimeout(2000);
  // DOM fallback if LLM missed the Bitcoin row — only while the method list is
  // still showing (never on the BTC amount / address screen, where clicking a
  // "Bitcoin" heading could navigate back).
  if (await pageStillOnMethodPicker(page)) {
    await page
      .evaluate(
        `(() => {
      const nodes = [...document.querySelectorAll("button, a, [role='button'], li, div, span")];
      for (const el of nodes) {
        if (!(el instanceof HTMLElement)) continue;
        const t = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
        if (!t || t.length > 80) continue;
        if (/^bitcoin\\b|\\bbtc\\b/i.test(t) && !/tether|usdt|eth|ltc|card|interac|altcoin/i.test(t)) {
          el.click();
          return true;
        }
      }
      return false;
    })()`,
      )
      .catch(() => {});
    await page.waitForTimeout(2000);
  }
  await shot("Bitcoin selected");
  details = await tryRead();
  if (details.address) return details;

  await safeAct(
    stagehand,
    "If a network or chain list is shown, choose Bitcoin or BTC network (not Lightning unless it is the only Bitcoin option). Do not confirm payment. Do not click Continue if a Wallet Address is already visible.",
  );
  await page.waitForTimeout(1500);
  details = await tryRead();
  if (details.address) return details;

  await safeAct(
    stagehand,
    "If there is a deposit amount field, enter the minimum allowed deposit amount (use the minimum hint on screen if shown). Do NOT click Confirm, Pay, Submit, Continue, or I have paid.",
  );
  await page.waitForTimeout(2000);
  await shot("Amount entered");
  details = await tryRead();
  if (details.address) return details;

  // Up to 4 recovery loops: reveal → scrape → copy → go back if we overshot.
  for (let i = 0; i < 4; i++) {
    details = await tryRead();
    if (details.address) return details;

    if (await pageLooksPastAddressScreen(page)) {
      await safeAct(
        stagehand,
        "We left the wallet address screen. Click Back, Close, or return to Bitcoin deposit / Wallet Address so the deposit address and QR are visible again. Do not click I have paid.",
      );
      await page.waitForTimeout(2000);
      details = await tryRead();
      if (details.address) return details;
    }

    await safeAct(
      stagehand,
      "The Bitcoin deposit address is not captured yet. If Continue, Next, Show address, or Generate address reveals the Wallet Address / QR, click ONLY that. STOP if you can already see text labeled Wallet Address or a bc1… address. Never click Confirm payment, I have paid, or Submit.",
    );
    await page.waitForTimeout(2200);
    await shot(`Deposit step ${i + 1}`);
    details = await tryRead();
    if (details.address) return details;

    const copied = await clickCopyAddress(page);
    if (copied) await page.waitForTimeout(800);
    await safeAct(
      stagehand,
      "Click the Copy button next to Wallet Address if present, then leave the address visible on screen. Do not leave this deposit screen.",
    );
    await page.waitForTimeout(1500);
    details = await tryRead();
    if (details.address) return details;
  }

  return details;
}

export async function siteShowsDepositCredited(
  stagehand: Stagehand,
): Promise<{ credited: boolean; balanceText: string | null }> {
  try {
    const result = await stagehand.extract(
      `Answer with JSON only: { credited: true|false, balance: "visible balance text or null" }.
credited is true if wallet balance is above zero, a deposit success message is visible, or funds are shown as available.`,
    );
    const start = result.extraction.indexOf("{");
    const end = result.extraction.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(result.extraction.slice(start, end + 1)) as {
        credited?: boolean;
        balance?: string | null;
      };
      return {
        credited: Boolean(parsed.credited),
        balanceText: typeof parsed.balance === "string" ? parsed.balance : null,
      };
    }
  } catch {
    // Fall through.
  }
  const fallback = await stagehand.extract(
    "Does this page show deposit success or a wallet balance greater than zero? Answer exactly YES or NO.",
  );
  return {
    credited: fallback.extraction.toUpperCase().includes("YES"),
    balanceText: null,
  };
}

type QrPage = DepositPage & {
  screenshot?: (opts?: {
    type?: "jpeg" | "png";
    quality?: number;
    clip?: { x: number; y: number; width: number; height: number };
  }) => Promise<Buffer | Uint8Array>;
};

/**
 * Find the site's own QR code for the deposit address and crop it out of
 * the page — a square <img>/<canvas>/<svg> near the address text. Returns
 * the JPEG bytes as base64, or null when nothing plausible is on screen.
 */
export async function captureDepositQr(
  page: QrPage,
  address: string,
): Promise<string | null> {
  if (!page.screenshot) return null;
  try {
    const rect = (await page.evaluate(`(() => {
      const addr = ${JSON.stringify(address)};
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      };
      // Where the address is shown — QR is usually right next to it.
      let anchor = null;
      for (const el of document.querySelectorAll("body *")) {
        if (el.children.length > 3) continue;
        const t = (el.textContent || "") + " " + (el.value || "");
        if (t.includes(addr) && vis(el)) { anchor = el.getBoundingClientRect(); break; }
      }
      const cands = [];
      for (const el of document.querySelectorAll("img,canvas,svg,[class*=qr i],[id*=qr i]")) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        const size = Math.min(r.width, r.height);
        const ratio = r.width / r.height;
        if (size < 70 || size > 700 || ratio < 0.8 || ratio > 1.25) continue;
        const meta = [el.getAttribute("src"), el.getAttribute("alt"), el.className, el.id, el.getAttribute("aria-label")]
          .filter(Boolean).join(" ").toLowerCase();
        let score = 0;
        if (/qr/.test(meta)) score += 50;
        if (el.tagName === "CANVAS") score += 20;
        if (el.tagName === "SVG" && el.querySelectorAll("rect,path").length > 30) score += 30;
        if (el.tagName === "IMG" && /^data:/.test(el.getAttribute("src") || "")) score += 15;
        if (anchor) {
          const dx = Math.abs((r.left + r.width / 2) - (anchor.left + anchor.width / 2));
          const dy = Math.abs((r.top + r.height / 2) - (anchor.top + anchor.height / 2));
          score += Math.max(0, 40 - Math.hypot(dx, dy) / 20);
        }
        if (/logo|avatar|flag|icon|provider/.test(meta)) score -= 40;
        cands.push({ el, score });
      }
      cands.sort((a, b) => b.score - a.score);
      const best = cands[0];
      if (!best || best.score < 25) return null;
      best.el.scrollIntoView({ block: "center", inline: "center" });
      const r = best.el.getBoundingClientRect();
      const pad = 6;
      return {
        x: Math.max(0, r.left - pad),
        y: Math.max(0, r.top - pad),
        width: Math.min(window.innerWidth, r.width + pad * 2),
        height: Math.min(window.innerHeight, r.height + pad * 2),
      };
    })()`)) as { x: number; y: number; width: number; height: number } | null;
    if (!rect || rect.width < 40 || rect.height < 40) return null;
    await page.waitForTimeout(300);
    const buf = await page.screenshot({
      type: "jpeg",
      quality: 85,
      clip: rect,
    });
    return Buffer.from(buf).toString("base64");
  } catch {
    return null;
  }
}
