import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/send-contact-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, company, message, website } = body as Record<
    string,
    unknown
  >;

  if (typeof website === "string" && website.trim()) {
    return NextResponse.json({ ok: true });
  }

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length < 10) {
    return NextResponse.json(
      { error: "Message must be at least 10 characters" },
      { status: 400 },
    );
  }

  const companyValue =
    typeof company === "string" && company.trim() ? company.trim() : undefined;

  const sent = await sendContactEmail({
    name: name.trim(),
    email: email.trim(),
    company: companyValue,
    message: message.trim(),
  });

  if (!sent) {
    return NextResponse.json(
      {
        error: "We couldn't send your message right now. Please try again later.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
