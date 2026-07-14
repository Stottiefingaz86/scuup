/** Client-safe shared model for report collaboration — members, comments
 * and live presence. Server-side data access lives in collab-db. */

export interface ReportMember {
  id: string;
  email: string;
  /** Display name once the invite is accepted, otherwise null. */
  name: string | null;
  role: "admin" | "viewer";
  status: "pending" | "active";
  /** When this person last opened the report, if ever. */
  viewedAt: string | null;
}

export interface ReportComment {
  id: string;
  sectionId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** Figma-style cursor palette — deterministic per user so a teammate keeps
 * the same colour across sessions and surfaces. */
export const CURSOR_COLORS = [
  "#3ecf8e",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#38bdf8",
  "#f97316",
  "#a3e635",
  "#f43f5e",
];

export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
