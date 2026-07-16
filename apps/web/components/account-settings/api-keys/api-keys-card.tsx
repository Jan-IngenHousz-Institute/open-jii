"use client";

import { KeyRound } from "lucide-react";
import { useApiKeys } from "~/hooks/auth/useApiKeys/useApiKeys";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";

export function ApiKeysCard() {
  const { t } = useTranslation("account");
  const locale = useLocale();
  const { data, isLoading } = useApiKeys();

  const apiKeys = data?.apiKeys ?? [];

  const formatDate = (value: Date | string | null) =>
    value ? new Date(value).toLocaleDateString(locale) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{t("apiKeys.title")}</CardTitle>
          <CardDescription>{t("apiKeys.description")}</CardDescription>
        </div>
        <CreateApiKeyDialog />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" data-testid="api-keys-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
            <KeyRound className="h-8 w-8 opacity-50" />
            {t("apiKeys.empty")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("apiKeys.columns.name")}</TableHead>
                <TableHead>{t("apiKeys.columns.key")}</TableHead>
                <TableHead>{t("apiKeys.columns.created")}</TableHead>
                <TableHead>{t("apiKeys.columns.expires")}</TableHead>
                <TableHead>{t("apiKeys.columns.lastUsed")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="font-medium">{apiKey.name}</TableCell>
                  <TableCell>
                    <code className="text-muted-foreground text-xs">
                      {apiKey.start ?? apiKey.prefix ?? ""}…
                    </code>
                  </TableCell>
                  <TableCell>{formatDate(apiKey.createdAt)}</TableCell>
                  <TableCell>
                    {apiKey.expiresAt ? (
                      formatDate(apiKey.expiresAt)
                    ) : (
                      <Badge variant="secondary">{t("apiKeys.expirationNever")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDate(apiKey.lastRequest) ?? (
                      <span className="text-muted-foreground">{t("apiKeys.neverUsed")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RevokeApiKeyDialog keyId={apiKey.id} keyName={apiKey.name ?? ""} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
