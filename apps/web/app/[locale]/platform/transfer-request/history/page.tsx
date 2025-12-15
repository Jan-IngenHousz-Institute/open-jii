"use client";

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
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
import { cva } from "@repo/ui/lib/utils";

const statusCardVariants = cva("border", {
  variants: {
    status: {
      pending: "bg-highlight/20 border-highlight",
      completed: "bg-secondary/10 border-secondary/30",
      rejected: "bg-destructive/10 border-destructive/30",
    },
  },
  defaultVariants: {
    status: "pending",
  },
});

const statusIconVariants = cva("flex items-center gap-2", {
  variants: {
    status: {
      pending: "text-amber-600",
      completed: "text-primary",
      rejected: "text-destructive",
    },
  },
  defaultVariants: {
    status: "pending",
  },
});

const statusConfig = {
  pending: { icon: Clock, label: "Pending" },
  completed: { icon: CheckCircle2, label: "Completed" },
  rejected: { icon: AlertCircle, label: "Rejected" },
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
          const { icon: Icon, label } = statusConfig[request.status];

          return (
            <Card
              key={request.requestId}
              className={statusCardVariants({ status: request.status })}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{request.projectIdOld}</CardTitle>
                    <Link
                      href={request.projectUrlOld}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary text-sm underline transition-colors"
                    >
                      {request.projectUrlOld}
                    </Link>
                  </div>
                  <div className={statusIconVariants({ status: request.status })}>
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{label}</span>
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
