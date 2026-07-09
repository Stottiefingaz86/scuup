import type { NextRequest } from "next/server";
import { getSession, type RecorderEvent } from "@/lib/capture-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-sent events stream of recorder events for a capture session. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("sessionId") ?? "";
  const session = getSession(id);
  if (!session) {
    return new Response("session not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // The stream can be torn down from two sides (session done, client
      // abort) — guard every enqueue/close so the race can't throw.
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the other side.
        }
      };
      const send = (event: RecorderEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Replay events already captured before the stream connected.
      for (const event of session.events) send(event);

      const onEvent = (event: RecorderEvent) => send(event);
      const onDone = () => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          } catch {
            // Stream already gone.
          }
        }
        safeClose();
      };
      session.emitter.on("event", onEvent);
      session.emitter.once("done", onDone);

      request.signal.addEventListener("abort", () => {
        session.emitter.off("event", onEvent);
        session.emitter.off("done", onDone);
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
