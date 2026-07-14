import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-server";
import { acceptInvite } from "@/lib/collab-db";
import { Button } from "@/components/ui/button";

/** Invite landing — the proxy already forces login (with ?next back here),
 * so by the time this renders we have an account to attach the seat to. */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await currentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const accepted = await acceptInvite(token, user);
  if (accepted) {
    redirect(`/projects/${accepted.projectId}/report`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-heading text-2xl font-semibold">
        This invite link isn&apos;t valid
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The invite may have been revoked by the report admin. Ask them to send
        you a fresh link.
      </p>
      <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
        Go to your dashboard
      </Button>
    </div>
  );
}
