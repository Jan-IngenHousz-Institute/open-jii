"use client";

import { AlertCircle } from "lucide-react";
import { useTransferRequests } from "~/hooks/useTransferRequests/useTransferRequests";
import { formatDate } from "~/util/date";

import { useTranslation } from "@repo/i18n";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

const statusBadgeVariants = cva("", {
  variants: {
    status: {
      pending: "bg-badge-stale",
      approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      completed: "bg-badge-active",
      rejected: "bg-destructive text-destructive-foreground",
      failed: "bg-destructive text-destructive-foreground",
    },
  },
  defaultVariants: {
    status: "pending",
  },
});

export default function TransferRequestHistoryPage() {
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

  const requests = data?.body ?? [];

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
            <Card key={request.requestId} className="bg-surface-light">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{request.projectIdOld}</CardTitle>
                  </div>
                  <Badge className={statusBadgeVariants({ status: request.status })}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-muted-foreground text-sm">{request.projectUrlOld}</p>
                <p className="text-muted-foreground text-sm">
                  {t("transferRequest.requestedAt")} {formatDate(request.requestedAt)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
