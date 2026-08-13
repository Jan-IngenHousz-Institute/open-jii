"use client";

import { UserAvatar } from "@/components/user-avatar";
import { useDecideOrganizationJoinRequest } from "@/hooks/organization/join-request/useDecideOrganizationJoinRequest/useDecideOrganizationJoinRequest";
import { useOrganizationJoinRequests } from "@/hooks/organization/join-request/useOrganizationJoinRequests/useOrganizationJoinRequests";
import { formatDate } from "@/util/date";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { OrganizationJoinRequest } from "@repo/api/domains/organization/join-requests/organization-join-requests.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * The decision queue: people who asked to join. Pending requests carry the
 * decision buttons; the decided ones stay as history, without them — a decision is
 * not reversible here, the person is either a member now or has to ask again.
 */
export function OrganizationJoinRequests({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useOrganizationJoinRequests(organizationId);
  const { mutateAsync: decide } = useDecideOrganizationJoinRequest();

  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const requests = data ?? [];
  const pending = requests.filter((request) => request.status === "pending");
  const decided = requests.filter((request) => request.status !== "pending");

  const submitDecision = async (
    request: OrganizationJoinRequest,
    decision: "approve" | "reject",
  ) => {
    setBusyRequestId(request.id);
    try {
      await decide({ id: organizationId, requestId: request.id, decision });
      toast({
        description:
          decision === "approve"
            ? t("organizations.requests.approved", { name: requesterName(request) })
            : t("organizations.requests.rejected", { name: requesterName(request) }),
      });
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("organizations.requests.decisionFailed"),
        variant: "destructive",
      });
    } finally {
      setBusyRequestId(null);
    }
  };

  if (isError) {
    return <p className="text-destructive text-sm">{t("organizations.requests.loadFailed")}</p>;
  }

  if (isPending) {
    return (
      <Card aria-busy="true" className="divide-border divide-y overflow-hidden">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-8 w-40" />
          </div>
        ))}
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="px-6 py-11 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <Inbox className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {t("organizations.requests.emptyTitle")}
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
          {t("organizations.requests.emptyHint")}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="list"
        aria-label={t("organizations.requests.label")}
        className="flex flex-col gap-3"
      >
        {pending.map((request) => (
          <Card role="listitem" key={request.id} className="flex items-start gap-3.5 p-5">
            <UserAvatar
              avatarUrl={request.user.avatarUrl}
              firstName={request.user.firstName}
              lastName={request.user.lastName}
              className="h-9 w-9"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2">
                <p className="truncate text-sm font-semibold">{requesterName(request)}</p>
                <p className="text-muted-foreground truncate text-xs">{request.user.email}</p>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t("organizations.requests.requestedOn", { date: formatDate(request.createdAt) })}
              </p>
              {/* The note the requester wrote, set apart so it reads as their words
                  rather than as more metadata about them. */}
              {request.message ? (
                <p className="bg-muted/60 text-muted-foreground mt-2.5 rounded-md px-3 py-2.5 text-xs leading-relaxed">
                  {request.message}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                onClick={() => void submitDecision(request, "approve")}
                disabled={busyRequestId === request.id}
              >
                {t("organizations.requests.approveAction")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void submitDecision(request, "reject")}
                disabled={busyRequestId === request.id}
              >
                {t("organizations.requests.rejectAction")}
              </Button>
            </div>
          </Card>
        ))}
        {pending.length === 0 ? (
          <Card className="text-muted-foreground px-6 py-8 text-center text-sm">
            {t("organizations.requests.noPending")}
          </Card>
        ) : null}
      </div>

      {decided.length > 0 ? (
        <div className="flex flex-col gap-2">
          {/* Deliberately not "earlier decisions": a withdrawn request is in here
              too, and nobody in the organization decided that one. */}
          <h3 id="organization-request-history-title" className="text-sm font-semibold">
            {t("organizations.requests.historyTitle")}
          </h3>
          <Card
            role="list"
            aria-labelledby="organization-request-history-title"
            className="bg-muted/40 divide-border divide-y overflow-hidden shadow-none"
          >
            {decided.map((request) => (
              <div role="listitem" key={request.id} className="flex items-center gap-3 px-5 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm">{requesterName(request)}</p>
                <p className="text-muted-foreground shrink-0 text-xs">
                  {request.decidedAt
                    ? t("organizations.requests.decidedOn", {
                        date: formatDate(request.decidedAt),
                      })
                    : null}
                </p>
                <Badge variant="outline" className="bg-card shrink-0 text-xs font-normal">
                  {t(`organizations.requests.status.${request.status}`)}
                </Badge>
              </div>
            ))}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function requesterName(request: OrganizationJoinRequest): string {
  return (
    `${request.user.firstName} ${request.user.lastName}`.trim() ||
    (request.user.email ?? request.user.id)
  );
}
