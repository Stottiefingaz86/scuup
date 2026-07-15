"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { colorForUser, timeAgo } from "@/lib/collab";
import { useReportCollab } from "@/components/report-collab";
import { cn } from "@/lib/utils";

/** Toggle for a section heading, shows the comment count and expands the
 * thread inline. Hidden in print. */
export function SectionCommentsButton({
  sectionId,
  open,
  onToggle,
}: {
  sectionId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { comments } = useReportCollab();
  const count = comments.filter((c) => c.sectionId === sectionId).length;
  return (
    <Button
      variant={open ? "secondary" : "ghost"}
      size="sm"
      className="print:hidden"
      onClick={onToggle}
    >
      <MessageSquare data-icon="inline-start" />
      {count > 0 ? count : "Comment"}
    </Button>
  );
}

export function SectionCommentsThread({
  sectionId,
  isOwner,
  className,
}: {
  sectionId: string;
  isOwner: boolean;
  className?: string;
}) {
  const { comments, self, addComment, removeComment } = useReportCollab();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const thread = comments.filter((c) => c.sectionId === sectionId);

  const post = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await addComment(sectionId, body);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card/50 p-4 print:hidden",
        className
      )}
    >
      {thread.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No comments on this section yet, start the discussion.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {thread.map((c) => (
            <div key={c.id} className="group flex items-start gap-2.5">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: colorForUser(c.userId) }}
              >
                {c.authorName.charAt(0).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs">
                  <span className="font-medium">{c.authorName}</span>{" "}
                  <span className="text-muted-foreground">
                    {timeAgo(c.createdAt)}
                  </span>
                </span>
                <p className="text-sm leading-relaxed">{c.body}</p>
              </div>
              {self && (c.userId === self.id || isOwner) ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  title="Delete comment"
                  onClick={() =>
                    removeComment(c.id).catch((e) =>
                      toast.error(
                        e instanceof Error ? e.message : "Failed to delete"
                      )
                    )
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          placeholder="Add a comment…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void post();
          }}
          rows={2}
          className="min-h-0 flex-1 resize-none text-sm"
        />
        <Button
          size="icon"
          onClick={post}
          disabled={!draft.trim() || posting}
          title="Post comment"
        >
          {posting ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
    </div>
  );
}
