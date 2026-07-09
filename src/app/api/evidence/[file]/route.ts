import { readFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVIDENCE_DIR = path.join(process.cwd(), ".evidence");

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/evidence/[file]">
) {
  const { file } = await ctx.params;
  // Filenames are generated internally; reject anything else.
  if (!/^[a-z0-9-]+\.jpg$/.test(file)) {
    return new Response("not found", { status: 404 });
  }
  try {
    const data = await readFile(path.join(EVIDENCE_DIR, file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
