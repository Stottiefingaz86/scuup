"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SITE_GATE_COOKIE,
  siteAccessPassword,
  siteGateCookieValue,
} from "@/lib/site-gate";

export async function unlockSite(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const password = String(
    formData.get("pin") ?? formData.get("password") ?? "",
  ).replace(/\s+/g, "");
  if (password !== siteAccessPassword()) {
    return { error: "Wrong PIN." };
  }

  const jar = await cookies();
  jar.set(SITE_GATE_COOKIE, siteGateCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  const next = String(formData.get("next") ?? "/");
  const dest =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(dest);
}
