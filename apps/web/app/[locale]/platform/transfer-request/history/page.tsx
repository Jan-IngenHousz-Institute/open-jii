"use client";

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useTransferRequests } from "~/hooks/useTransferRequests/useTransferRequests";
import { formatDate } from "~/util/date";

import { useTranslation } from "@repo/i18n";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@repo/ui/components";

const statusConfig = {
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-highlight/20",
    borderColor: "border-highlight",
    label: "Pending",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-primary",
    bgColor: "bg-secondary/10",
    borderColor: "border-secondary/30",
    label: "Completed",
  },
  rejected: {
    icon: AlertCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    label: "Rejected",
  },
};

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
          <AlertTitle>Error loading transfer requests</AlertTitle>
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
          const config = statusConfig[request.status];
          const Icon = config.icon;

          return (
            <Card
              key={request.requestId}
              className={`border ${config.borderColor} ${config.bgColor}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{request.projectIdOld}</CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">{request.projectUrlOld}</p>
                  </div>
                  <div className={`flex items-center gap-2 ${config.color}`}>
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
