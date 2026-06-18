"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";

type Status = "pending" | "accepted" | "error";

/** Accepts an organization invitation by id, then links into the platform. */
export function AcceptInvitation({
  invitationId,
  locale,
}: {
  invitationId: string;
  locale: string;
}) {
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;
    void authClient.organization
      .acceptInvitation({ invitationId })
      .then((res) => {
        if (res.error) {
          setStatus("error");
          setMessage(res.error.message ?? "This invitation could not be accepted.");
        } else {
          setStatus("accepted");
        }
      })
      .catch((err: unknown) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
      });
  }, [invitationId]);

  return (
    <section aria-label="Accept invitation" className="space-y-4">
      {status === "pending" && (
        <p className="text-muted-foreground text-sm">Accepting invitation…</p>
      )}
      {status === "accepted" && (
        <>
          <p className="text-sm">You&apos;ve joined the organization.</p>
          <Button asChild>
            <Link href={`/${locale}/platform`}>Go to the platform</Link>
          </Button>
        </>
      )}
      {status === "error" && (
        <>
          <p className="text-destructive text-sm">{message}</p>
          <Button asChild variant="outline">
            <Link href={`/${locale}/platform`}>Back to the platform</Link>
          </Button>
        </>
      )}
    </section>
  );
}
