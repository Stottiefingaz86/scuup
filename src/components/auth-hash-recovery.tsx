"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

/** Fallback for legacy Supabase implicit-flow links that land with
 * #access_token (or #error) in the URL hash on any page. New emails use the
 * server-side /auth/confirm route and never hit this path. */
export function AuthHashRecovery() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(hash.slice(1));

    const errorDescription =
      params.get("error_description") ?? params.get("error_code");
    if (params.get("error")) {
      handled.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(
        `/login?error=${encodeURIComponent(
          errorDescription ?? "That link is invalid or has expired."
        )}`
      );
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    handled.current = true;
    void (async () => {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      if (error) {
        router.replace("/login?error=Could%20not%20sign%20you%20in%20from%20that%20link.");
        return;
      }
      try {
        await fetch("/api/auth/complete-verification", { method: "POST" });
      } catch {
        // Session is set; the verify banner can re-check later.
      }
      router.replace("/dashboard?verified=1");
      router.refresh();
    })();
  }, [router]);

  return null;
}
