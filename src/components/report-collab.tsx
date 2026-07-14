"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useAuthUser } from "@/lib/use-auth-user";
import { colorForUser, type ReportComment } from "@/lib/collab";

/* ---- Model ---- */

export interface Peer {
  key: string;
  name: string;
  color: string;
  /** Cursor position as fractions of the report container, null = parked. */
  cursor: { x: number; y: number } | null;
}

interface CollabContextValue {
  /** Everyone on the report right now, excluding yourself. */
  peers: Peer[];
  /** Yourself, once auth resolves. */
  self: { id: string; name: string } | null;
  comments: ReportComment[];
  addComment: (sectionId: string, body: string) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
}

const CollabContext = createContext<CollabContextValue | null>(null);

export function useReportCollab(): CollabContextValue {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error("useReportCollab outside ReportCollabProvider");
  return ctx;
}

/* ---- Cursor arrow (same mark as the landing demo) ---- */

function CursorArrow({
  name,
  color,
  x,
  y,
}: {
  name: string;
  color: string;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-40 hidden items-start transition-[left,top] duration-100 ease-linear sm:flex print:hidden"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      aria-hidden
    >
      <svg
        width="16"
        height="18"
        viewBox="0 0 16 18"
        fill="none"
        className="drop-shadow-md"
      >
        <path
          d="M1.2 1.2V14.8L5.1 11.2L7.8 16.2L9.5 15.4L6.7 10.1L12.1 9.6L1.2 1.2Z"
          fill={color}
          stroke="white"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="ms-2 -mt-0.5 inline-block max-w-[10rem] truncate rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </div>
  );
}

/* ---- Presence facepile for the toolbar ---- */

export function PresenceFacepile() {
  const { peers, self } = useReportCollab();
  if (!self) return null;
  const everyone = [
    { key: self.id, name: `${self.name} (you)`, color: colorForUser(self.id) },
    ...peers,
  ];
  return (
    <div className="flex items-center print:hidden">
      <div className="flex -space-x-1.5">
        {everyone.slice(0, 5).map((p) => (
          <span
            key={p.key}
            title={p.name}
            className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background"
            style={{ backgroundColor: p.color }}
          >
            {p.name.charAt(0).toUpperCase()}
          </span>
        ))}
      </div>
      {peers.length > 0 ? (
        <span className="ms-2 text-xs text-muted-foreground">
          {peers.length + 1} viewing
        </span>
      ) : null}
    </div>
  );
}

/* ---- Provider ---- */

interface CursorPayload {
  key: string;
  name: string;
  color: string;
  x: number | null;
  y: number | null;
}

export function ReportCollabProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const { user, name } = useAuthUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [comments, setComments] = useState<ReportComment[]>([]);

  const self = useMemo(
    () => (user ? { id: user.id, name: name ?? "You" } : null),
    [user, name]
  );

  // Initial comment load + read receipt.
  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}/comments`)
      .then((res) => (res.ok ? res.json() : { comments: [] }))
      .then((data) => {
        if (active) setComments(data.comments ?? []);
      })
      .catch(() => {});
    fetch(`/api/projects/${projectId}/view`, { method: "POST" }).catch(
      () => {}
    );
    return () => {
      active = false;
    };
  }, [projectId]);

  // Realtime channel: presence + cursor + comment broadcasts.
  useEffect(() => {
    if (!self) return;
    const client = supabaseBrowser();
    const channel = client.channel(`report:${projectId}`, {
      config: { presence: { key: self.id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    const upsertPeer = (key: string, patch: Partial<Peer>) => {
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(key) ?? {
          key,
          name: "Teammate",
          color: colorForUser(key),
          cursor: null,
        };
        next.set(key, { ...existing, ...patch });
        return next;
      });
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name: string }>();
        setPeers((prev) => {
          const next = new Map<string, Peer>();
          for (const [key, metas] of Object.entries(state)) {
            if (key === self.id) continue;
            next.set(key, {
              key,
              name: metas[0]?.name ?? "Teammate",
              color: colorForUser(key),
              cursor: prev.get(key)?.cursor ?? null,
            });
          }
          return next;
        });
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const p = payload as CursorPayload;
        if (p.key === self.id) return;
        upsertPeer(p.key, {
          name: p.name,
          cursor: p.x === null || p.y === null ? null : { x: p.x, y: p.y },
        });
      })
      .on("broadcast", { event: "comment_added" }, ({ payload }) => {
        const comment = payload as ReportComment;
        setComments((prev) =>
          prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]
        );
      })
      .on("broadcast", { event: "comment_removed" }, ({ payload }) => {
        const { id } = payload as { id: string };
        setComments((prev) => prev.filter((c) => c.id !== id));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ name: self.name });
        }
      });

    return () => {
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [projectId, self]);

  // Broadcast your cursor as fractions of the report container.
  useEffect(() => {
    if (!self) return;
    const el = containerRef.current;
    if (!el) return;

    let last = 0;
    const send = (x: number | null, y: number | null) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          key: self.id,
          name: self.name,
          color: colorForUser(self.id),
          x,
          y,
        } satisfies CursorPayload,
      });
    };
    const onMove = (e: PointerEvent) => {
      const now = Date.now();
      if (now - last < 60) return;
      last = now;
      const rect = el.getBoundingClientRect();
      send(
        Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
        Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      );
    };
    const onLeave = () => send(null, null);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [self]);

  const addComment = useCallback(
    async (sectionId: string, body: string) => {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to post comment");
      }
      const comment = data.comment as ReportComment;
      setComments((prev) => [...prev, comment]);
      channelRef.current?.send({
        type: "broadcast",
        event: "comment_added",
        payload: comment,
      });
    },
    [projectId]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete comment");
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      channelRef.current?.send({
        type: "broadcast",
        event: "comment_removed",
        payload: { id: commentId },
      });
    },
    [projectId]
  );

  const value = useMemo<CollabContextValue>(
    () => ({
      peers: Array.from(peers.values()),
      self,
      comments,
      addComment,
      removeComment,
    }),
    [peers, self, comments, addComment, removeComment]
  );

  return (
    <CollabContext.Provider value={value}>
      <div ref={containerRef} className="relative">
        {children}
        {Array.from(peers.values()).map((p) =>
          p.cursor ? (
            <CursorArrow
              key={p.key}
              name={p.name}
              color={p.color}
              x={p.cursor.x}
              y={p.cursor.y}
            />
          ) : null
        )}
      </div>
    </CollabContext.Provider>
  );
}
