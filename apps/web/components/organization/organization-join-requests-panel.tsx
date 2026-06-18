"use client";

import {
  useApproveJoinRequest,
  useRejectJoinRequest,
} from "@/hooks/organization/useOrganizationJoinMutations";
import { useOrganizationJoinRequests } from "@/hooks/organization/useOrganizationJoinRequests";
import { Check, Inbox, X } from "lucide-react";

import { Button } from "@repo/ui/components/button";

import { UserAvatar } from "../user-avatar";

interface OrganizationJoinRequestsPanelProps {
  organizationId: string;
}

/** Owner/admin view of pending join requests with approve/reject controls. */
export function OrganizationJoinRequestsPanel({
  organizationId,
}: OrganizationJoinRequestsPanelProps) {
  const { data, isPending } = useOrganizationJoinRequests(organizationId);
  const approve = useApproveJoinRequest();
  const reject = useRejectJoinRequest();
  const requests = data?.status === 200 ? data.body : [];

  if (isPending) {
    return <p className="text-muted-foreground p-4 text-sm">Loading…</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <Inbox className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">No pending requests</p>
      </div>
    );
  }

  return (
    <div className="divide-border divide-y overflow-hidden rounded-lg border">
      {requests.map((r) => {
        const name = `${r.user.firstName} ${r.user.lastName}`.trim() || (r.user.email ?? "Someone");
        const busy = approve.isPending || reject.isPending;
        return (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
            <UserAvatar
              avatarUrl={r.user.avatarUrl}
              firstName={r.user.firstName}
              lastName={r.user.lastName}
              className="h-9 w-9"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              {r.message ? (
                <p className="text-muted-foreground truncate text-xs">{r.message}</p>
              ) : (
                <p className="text-muted-foreground truncate text-xs">{r.user.email}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  reject.mutate({ params: { id: organizationId, requestId: r.id }, body: {} })
                }
                aria-label={`Reject ${name}`}
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  approve.mutate({ params: { id: organizationId, requestId: r.id }, body: {} })
                }
                aria-label={`Approve ${name}`}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
