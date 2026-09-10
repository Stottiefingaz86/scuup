import { NextResponse, type NextRequest } from "next/server";
import {
  countPendingActions,
  listResearchActions,
} from "@/lib/research/action-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;
  const actions = listResearchActions(projectId);
  return NextResponse.json({
    actions,
    pendingCount: countPendingActions(projectId),
  });
}
