"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { colorForUser, timeAgo, type ReportMember } from "@/lib/collab";
import { track } from "@/lib/track";

interface MembersPayload {
  members: ReportMember[];
  isOwner: boolean;
  inviteLimit: number;
  used: number;
}

function MemberRow({
  member,
  isOwner,
  projectId,
  onRemoved,
}: {
  member: ReportMember;
  isOwner: boolean;
  projectId: string;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const label = member.name ?? member.email;

  const copyLink = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/members/${member.id}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.inviteUrl) {
      toast.error(data.error ?? "Couldn't fetch the invite link");
      return;
    }
    await navigator.clipboard.writeText(data.inviteUrl);
    toast.success("Invite link copied");
  }, [member.id, projectId]);

  const remove = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${member.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to remove");
      }
      onRemoved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
      setBusy(false);
    }
  }, [member.id, onRemoved, projectId]);

  return (
    <div className="flex items-center gap-2.5 py-2">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: colorForUser(member.email) }}
      >
        {label.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {member.role === "admin"
            ? "Admin, full access"
            : member.status === "pending"
              ? "Invite sent, hasn't joined yet"
              : member.viewedAt
                ? `Viewed ${timeAgo(member.viewedAt)}`
                : "Hasn't opened the report yet"}
        </span>
      </div>
      {member.role === "admin" ? (
        <Badge variant="secondary">Admin</Badge>
      ) : (
        <>
          <Badge variant="outline">Can view</Badge>
          {isOwner && member.status === "pending" ? (
            <Button
              size="icon-sm"
              variant="ghost"
              title="Copy invite link"
              onClick={copyLink}
            >
              <Copy />
            </Button>
          ) : null}
          {isOwner ? (
            <Button
              size="icon-sm"
              variant="ghost"
              title="Remove from report"
              disabled={busy}
              onClick={remove}
            >
              {busy ? <Loader2 className="animate-spin" /> : <X />}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

export function InviteTeamDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MembersPayload | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/members`);
    if (!res.ok) return;
    setData((await res.json()) as MembersPayload);
  }, [projectId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const invite = useCallback(async () => {
    const target = email.trim();
    if (!target) return;
    setSending(true);
    setLastInviteUrl(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to invite");
      track("invite_sent");
      setEmail("");
      setLastInviteUrl(payload.inviteUrl ?? null);
      setCopied(false);
      toast.success(
        payload.emailSent
          ? `Invite emailed to ${target}`
          : `Invite created for ${target}, copy the link below`
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setSending(false);
    }
  }, [email, projectId, refresh]);

  const seatsLeft = data ? data.inviteLimit - data.used : null;
  const isOwner = data?.isOwner ?? false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <UserPlus data-icon="inline-start" />
            Invite team
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite your team</DialogTitle>
          <DialogDescription>
            Teammates get read access to this report and can leave comments.
            Only you can run, change or delete it.
          </DialogDescription>
        </DialogHeader>

        {isOwner ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void invite();
                }}
                disabled={sending || (seatsLeft !== null && seatsLeft <= 0)}
              />
              <Button
                onClick={invite}
                disabled={
                  sending ||
                  !email.trim() ||
                  (seatsLeft !== null && seatsLeft <= 0)
                }
              >
                {sending ? <Loader2 className="animate-spin" /> : "Invite"}
              </Button>
            </div>
            {data ? (
              <p className="text-xs text-muted-foreground">
                {seatsLeft !== null && seatsLeft <= 0
                  ? `All ${data.inviteLimit} team seats on your plan are in use.`
                  : `${data.used} of ${data.inviteLimit} team seats used on your plan.`}
              </p>
            ) : null}
            {lastInviteUrl ? (
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(lastInviteUrl);
                  setCopied(true);
                  toast.success("Invite link copied");
                }}
                className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-start text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {copied ? (
                  <Check className="size-3.5 shrink-0 text-brand" />
                ) : (
                  <Copy className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{lastInviteUrl}</span>
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col divide-y">
          {data ? (
            data.members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isOwner={isOwner}
                projectId={projectId}
                onRemoved={refresh}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
