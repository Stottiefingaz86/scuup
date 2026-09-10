import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { appHomePathForUser } from "@/lib/app-home";
import { isResearchHost, RESEARCH_BASE } from "@/lib/research/host";
import {
  RESEARCH_PIN_COOKIE,
  RESEARCH_PIN_PATH,
  isResearchPinUnlocked,
  researchPinEnabled,
} from "@/lib/research/pin-gate";
import {
  SITE_GATE_COOKIE,
  isSiteGateUnlocked,
  siteGateEnabled,
} from "@/lib/site-gate";

/** Paths anyone can reach logged out. Everything else needs an account. */
const PUBLIC_PATHS = [
  /^\/$/,
  /^\/gate(\/|$)/,
  /^\/login(\/|$)/,
  /^\/auth(\/|$)/,
  /^\/privacy(\/|$)/,
  /^\/terms(\/|$)/,
  /^\/cookies(\/|$)/,
  /^\/api\/showcase(\/|$)/,
  /^\/api\/contact(\/|$)/,
  /^\/research(\/|$)/,
  /^\/api\/research(\/|$)/,
  // Stripe calls this from its servers; the signature check is the auth.
  /^\/api\/billing\/webhook$/,
  // Sentry event tunnel — must work for logged-out visitors too.
  /^\/monitoring(\/|$)/,
  // Vercel Cron calls this with the CRON_SECRET bearer token as its auth.
  /^\/api\/cron(\/|$)/,
];

/** Always reachable even when the site password gate is on. */
const GATE_BYPASS = [
  /^\/gate(\/|$)/,
  /^\/api\/billing\/webhook$/,
  /^\/api\/cron(\/|$)/,
  /^\/monitoring(\/|$)/,
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");

  // Research is its own app: PIN only. Never the Scuup site password or login.
  const researchScoped =
    isResearchHost(host) ||
    pathname.startsWith(RESEARCH_BASE) ||
    pathname.startsWith("/api/research");
  if (researchScoped) {
    const onPinScreen =
      pathname.startsWith(RESEARCH_PIN_PATH) ||
      (isResearchHost(host) && pathname.startsWith("/pin"));
    if (
      researchPinEnabled() &&
      !isResearchPinUnlocked(request.cookies.get(RESEARCH_PIN_COOKIE)?.value) &&
      !onPinScreen &&
      !GATE_BYPASS.some((p) => p.test(pathname))
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Research is PIN-protected." },
          { status: 401 },
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = isResearchHost(host) ? "/pin" : RESEARCH_PIN_PATH;
      url.search = "";
      if (pathname.startsWith(RESEARCH_BASE) && pathname !== RESEARCH_BASE) {
        url.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(url);
    }

    // research.scuup.io → /research/* without changing the browser URL.
    if (
      isResearchHost(host) &&
      !pathname.startsWith(RESEARCH_BASE) &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/monitoring")
    ) {
      const url = request.nextUrl.clone();
      url.pathname =
        pathname === "/" || pathname === "/pin"
          ? pathname === "/pin"
            ? RESEARCH_PIN_PATH
            : RESEARCH_BASE
          : `${RESEARCH_BASE}${pathname}`;
      return NextResponse.rewrite(url);
    }

    return response;
  }

  // Close scuup.io until the visitor enters the PIN (1986).
  if (
    siteGateEnabled() &&
    !isSiteGateUnlocked(request.cookies.get(SITE_GATE_COOKIE)?.value) &&
    !GATE_BYPASS.some((p) => p.test(pathname))
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Site is PIN-protected." },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/gate";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (all) => {
          all.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          all.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes expired sessions (writes new cookies via setAll above).
  const {
    data: { user },
  } = await client.auth.getUser();

  if (pathname === "/" && request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone();
    const desc =
      url.searchParams.get("error_description") ??
      url.searchParams.get("error_code") ??
      url.searchParams.get("error");
    url.pathname = "/login";
    url.search = "";
    if (desc) url.searchParams.set("error", desc);
    return NextResponse.redirect(url);
  }

  const isPublic = PUBLIC_PATHS.some((p) => p.test(pathname));

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "You need to log in to do this." },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    // Honor ?next= so "log in, then go to /admin" style links work.
    const next = url.searchParams.get("next");
    url.pathname =
      next?.startsWith("/") && !next.startsWith("//")
        ? next
        : await appHomePathForUser(user.id);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/dashboard") {
    const url = request.nextUrl.clone();
    const search = url.searchParams.toString();
    const dest = await appHomePathForUser(user.id, search || undefined);
    return NextResponse.redirect(new URL(dest, url.origin));
  }

  return response;
}

export const config = {
  // Skip static assets; run on pages and API routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
