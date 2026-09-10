"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  RESEARCH_PIN_COOKIE,
  researchPin,
  researchPinCookieValue,
} from "@/lib/research/pin-gate";

export async function unlockResearch(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const pin = String(formData.get("pin") ?? "").replace(/\D/g, "");
  if (pin !== researchPin()) {
    return { error: "Wrong PIN." };
  }

  const jar = await cookies();
  jar.set(RESEARCH_PIN_COOKIE, researchPinCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  const next = String(formData.get("next") ?? "/research");
  const dest =
    next.startsWith("/research") && !next.startsWith("//")
      ? next
      : "/research";
  redirect(dest);
}
