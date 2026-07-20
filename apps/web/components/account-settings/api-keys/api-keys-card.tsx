"use client";

import { CircleAlert, KeyRound, Loader2 } from "lucide-react";
import { useApiKeys } from "~/hooks/auth/useApiKeys/useApiKeys";
import { useLocale } from "~/hooks/useLocale";
import { daysUntil, formatRelativeTime, formatShortDate } from "~/util/date";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";

const EXPIRY_WARNING_DAYS = 14;

function ExpiryStatus({ expiresAt }: { expiresAt: Date | string | null }) {
  const { t } = useTranslation("account");
  const locale = useLocale();

  if (!expiresAt) return <Badge variant="secondary">{t("apiKeys.noExpiry")}</Badge>;

  const days = daysUntil(expiresAt);
  if (days <= 0) {
    return <span className="text-destructive text-xs font-medium">{t("apiKeys.expired")}</span>;
  }
  if (days <= EXPIRY_WARNING_DAYS) {
    return (
      <span className="text-xs font-medium text-amber-600 dark:text-amber-500">
        {t("apiKeys.expiresInDays", { count: days })}
      </span>
    );
  }
  return (
    <Badge variant="secondary">
      {t("apiKeys.expiresUntil", { date: formatShortDate(expiresAt, locale) })}
    </Badge>
  );
}

export function ApiKeysCard() {
  const { t } = useTranslation("account");
  const locale = useLocale();
  const { data, isError, isFetching, isLoading, refetch } = useApiKeys();

  const apiKeys = data?.apiKeys ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{t("apiKeys.title")}</CardTitle>
          <CardDescription>{t("apiKeys.description")}</CardDescription>
        </div>
        <CreateApiKeyDialog />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" data-testid="api-keys-loading">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <div
            className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-sm"
            data-testid="api-keys-error"
          >
            <CircleAlert className="text-destructive h-8 w-8" />
            <p>{t("apiKeys.loadError")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("apiKeys.retry")}
            </Button>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
            <KeyRound className="h-8 w-8 opacity-50" />
            {t("apiKeys.empty")}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{apiKey.name}</span>
                    <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                      {apiKey.start ?? apiKey.prefix ?? ""}…
                    </code>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t("apiKeys.created")} {formatShortDate(apiKey.createdAt, locale)} ·{" "}
                    {t("apiKeys.lastUsed")}{" "}
                    {apiKey.lastRequest
                      ? formatRelativeTime(apiKey.lastRequest, locale)
                      : t("apiKeys.neverUsed")}
                  </p>
                </div>
                <ExpiryStatus expiresAt={apiKey.expiresAt} />
                <RevokeApiKeyDialog keyId={apiKey.id} keyName={apiKey.name ?? ""} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
