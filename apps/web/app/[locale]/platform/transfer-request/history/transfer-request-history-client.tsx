"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { AlertCircle } from "lucide-react";
import type { StatusTone } from "~/components/shared/status-badge";
import { StatusBadge } from "~/components/shared/status-badge";
import { useTransferRequests } from "~/hooks/useTransferRequests/useTransferRequests";
import { formatDate } from "~/util/date";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Skeleton } from "@repo/ui/components/skeleton";

/** Request status to the pill it wears. A total record, so a seventh status
 *  fails to compile rather than rendering an unstyled badge. */
const STATUS_TONES: Record<string, StatusTone> = {
  pending: "stale",
  approved: "published",
  partial_failed: "destructive",
  completed: "active",
  rejected: "destructive",
  failed: "destructive",
};

export default function TransferRequestHistoryClient() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useTransferRequests();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="mb-4 text-lg font-medium">{t("transferRequest.yourRequests")}</h2>

        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h2 className="mb-4 text-lg font-medium">{t("transferRequest.yourRequests")}</h2>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("transferRequest.errorLoadingRequest")}</AlertTitle>
          <AlertDescription>{t("transferRequest.errorLoadingRequests")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const requests = data ?? [];

  if (requests.length === 0) {
    return (
      <Alert>
        <AlertTitle>{t("transferRequest.noRequests")}</AlertTitle>
        <AlertDescription>{t("transferRequest.noRequestsDescription")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="mb-4 text-lg font-medium">{t("transferRequest.yourRequests")}</h2>

      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-2">
        {requests.map((request) => {
          return (
            <SettingsCard
              key={request.requestId}
              title={request.projectIdOld}
              action={
                <StatusBadge tone={STATUS_TONES[request.status] ?? "stale"}>
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </StatusBadge>
              }
              contentClassName="space-y-1"
            >
              <p className="text-muted-foreground text-sm">{request.projectUrlOld}</p>
              <p className="text-muted-foreground text-sm">
                {t("transferRequest.requestedAt")} {formatDate(request.requestedAt)}
              </p>
            </SettingsCard>
          );
        })}
      </div>
    </div>
  );
}
